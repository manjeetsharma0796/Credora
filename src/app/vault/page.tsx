'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
    authenticate,
    disconnect,
    userSession,
    depositSbtc,
    borrowStx,
    repayStx,
    withdrawSbtc,
    fetchBalances,
    getVaultInfo,
    getProtocolStats,
    fetchTransactionHistory,
    explorerTxUrl,
    VAULT_CONTRACT_ID,
    waitForTransaction,
    type Balances,
    type ProtocolStats,
    type TransactionHistory,
    type VaultInfo,
} from '@/lib/stacks';

function BlinkDot({ color = '#00d4a0' }: { color?: string }) {
    return (
        <span
            style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                animation: 'blink 1.4s step-start infinite',
                flexShrink: 0,
            }}
        />
    );
}

function getSafeTestnetAddress(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        if (!userSession.isUserSignedIn()) return null;
        const data = userSession.loadUserData();
        const addr = (data as unknown as { profile?: { stxAddress?: { testnet?: string } } })?.profile
            ?.stxAddress?.testnet;
        return addr ?? null;
    } catch {
        try {
            window.localStorage.removeItem('blockstack-session');
        } catch {
            // ignore
        }
        return null;
    }
}

function toErrorLog(err: unknown) {
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
        };
    }
    return { raw: String(err) };
}

function stringifyForLog(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function formatTokenAmount(raw: string, decimals: number): string {
    const num = Number(raw);
    if (!Number.isFinite(num)) return raw;
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

const STEPS = [
    { id: 1, code: '01', label: 'Connect Wallet', sub: 'Leather or Xverse' },
    { id: 2, code: '02', label: 'Deposit sBTC', sub: 'Collateral setup' },
    { id: 3, code: '03', label: 'Borrow STX', sub: 'Borrow against collateral' },
    { id: 4, code: '04', label: 'Repay STX', sub: 'Reduce debt' },
];

type TxStatus =
    | 'idle'
    | 'pending-deposit'
    | 'pending-borrow'
    | 'pending-repay'
    | 'pending-withdraw'
    | 'success'
    | 'error';

function TxBanner({ txId, onDismiss }: { txId: string; onDismiss: () => void }) {
    const short = `${txId.slice(0, 8)}...${txId.slice(-6)}`;
    return (
        <div
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 999,
                background: '#0a0f1e',
                border: '1px solid rgba(0,212,160,0.35)',
                padding: '14px 18px',
                maxWidth: 360,
                animation: 'fadeUp 0.3s ease',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 9, color: '#00d4a0', letterSpacing: '0.12em', marginBottom: 5 }}>
                        TX BROADCAST
                    </div>
                    <div style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.06em', marginBottom: 8 }}>{short}</div>
                    <a
                        href={explorerTxUrl(txId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 10, color: '#4a9eff', letterSpacing: '0.08em', textDecoration: 'none' }}
                    >
                        VIEW ON EXPLORER {'->'}
                    </a>
                </div>
                <button
                    onClick={onDismiss}
                    style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                >
                    x
                </button>
            </div>
        </div>
    );
}

export default function VaultPage() {
    const [mounted, setMounted] = useState(false);
    const [time, setTime] = useState('');
    const [sbtcAmount, setSbtcAmount] = useState('');
    const [borrowAmount, setBorrowAmount] = useState('');
    const [repayAmount, setRepayAmount] = useState('');
    const [txStatus, setTxStatus] = useState<TxStatus>('idle');
    const [lastTxId, setLastTxId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [balances, setBalances] = useState<Balances>({ stx: '-', sbtc: '-' });
    const [vaultBalances, setVaultBalances] = useState<Balances>({ stx: '-', sbtc: '-' });
    const [protocolStats, setProtocolStats] = useState<ProtocolStats>({
        totalSbtcLocked: 0,
        totalStxBorrowed: 0,
        totalStxLiquidity: 0,
        protocolFees: 0,
        sbtcPriceUstx: 0,
    });
    const [vaultInfo, setVaultInfo] = useState<VaultInfo>({
        sbtcDeposited: 0,
        stxBorrowed: 0,
        interestOwed: 0,
        totalOwed: 0,
        currentLtv: 0,
        isOpen: false,
        isLiquidatable: false,
    });
    const [loadingBal, setLoadingBal] = useState(false);
    const [txHistory, setTxHistory] = useState<TransactionHistory[]>([]);
    const [activeStep, setActiveStep] = useState(1);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const tick = () => {
            const n = new Date();
            setTime(
                n.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }),
            );
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    const loadData = useCallback(async () => {
        const addr = getSafeTestnetAddress();
        if (!addr) return;
        setLoadingBal(true);
        try {
            console.log('[DEBUG loadData] Starting data refresh for address:', addr);
            const [bal, vault, vBal, history] = await Promise.all([
                fetchBalances(addr),
                getVaultInfo(addr),
                fetchBalances(VAULT_CONTRACT_ID),
                fetchTransactionHistory(addr, 10),
            ]);
            const stats = await getProtocolStats(addr);

            console.log('[DEBUG loadData] Fetched stats:', stats);
            console.log('[DEBUG loadData] Total STX Liquidity:', stats.totalStxLiquidity);

            setBalances(bal);
            setVaultInfo(vault);
            setVaultBalances(vBal);
            setProtocolStats(stats);
            setTxHistory(history);
        } catch (err) {
            console.error('[ERROR loadData]', err);
        } finally {
            setLoadingBal(false);
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (getSafeTestnetAddress()) {
            loadData();
            setActiveStep(2);
        }
    }, [mounted, loadData]);

    useEffect(() => {
        if (!mounted) return;
        if (getSafeTestnetAddress()) {
            pollRef.current = setInterval(loadData, 30000);
        }

        // Auto-refresh when page becomes visible (e.g., user switches tabs)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && getSafeTestnetAddress()) {
                console.log('[DEBUG] Page became visible, refreshing data...');
                loadData();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [mounted, loadData]);

    if (!mounted) return null;

    const address = getSafeTestnetAddress();
    const isConnected = !!address;
    const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

    const depositedSbtcHuman = (vaultInfo.sbtcDeposited / 1e8).toFixed(8);
    const stxBorrowedHuman = (vaultInfo.stxBorrowed / 1e6).toFixed(2);
    const interestOwedHuman = (vaultInfo.interestOwed / 1e6).toFixed(4);
    const totalOwedHuman = (vaultInfo.totalOwed / 1e6).toFixed(4);
    const ltvPct = (vaultInfo.currentLtv / 100).toFixed(2);

    const collateralUsd = Number(sbtcAmount || '0') * 104000;
    const suggestedBorrowStx = collateralUsd * 0.5;
    const availableLiquidityStx = protocolStats.totalStxLiquidity / 1000000;

    const isPending =
        txStatus === 'pending-deposit' ||
        txStatus === 'pending-borrow' ||
        txStatus === 'pending-repay' ||
        txStatus === 'pending-withdraw';

    const pendingLabel =
        txStatus === 'pending-deposit'
            ? 'WAITING FOR DEPOSIT SIGNATURE...'
            : txStatus === 'pending-borrow'
                ? 'WAITING FOR BORROW SIGNATURE...'
                : txStatus === 'pending-repay'
                    ? 'WAITING FOR REPAY SIGNATURE...'
                    : txStatus === 'pending-withdraw'
                        ? 'WAITING FOR WITHDRAW SIGNATURE...'
                        : 'BROADCASTING...';

    const handleConnect = () => authenticate();
    const handleDisconnect = () => disconnect();

    const handleDepositAndBorrow = async () => {
        if (!isConnected || Number(sbtcAmount) <= 0 || Number(borrowAmount) <= 0) return;
        setErrorMsg('');
        try {
            console.log('[VAULT] Starting deposit+borrow flow', {
                address,
                sbtcAmount,
                borrowAmount,
                userBalances: { stx: balances.stx, sbtc: balances.sbtc },
                protocolLiquidity: protocolStats.totalStxLiquidity,
            });

            const borrowUstx = Math.round(Number(borrowAmount) * 1_000_000);
            if (protocolStats.totalStxLiquidity < borrowUstx) {
                throw new Error(
                    `Insufficient vault STX liquidity. Available ${availableLiquidityStx.toFixed(4)} STX, requested ${Number(borrowAmount).toFixed(4)} STX. Go to /vault/admin to deposit STX liquidity first.`,
                );
            }

            setTxStatus('pending-deposit');
            const depositTxId = await depositSbtc(Number(sbtcAmount));
            setLastTxId(depositTxId);
            console.log('[VAULT] Waiting for deposit TX:', depositTxId);
            await waitForTransaction(depositTxId);
            console.log('[VAULT] Deposit TX confirmed');

            setTxStatus('pending-borrow');
            const borrowTxId = await borrowStx(Number(borrowAmount));
            setLastTxId(borrowTxId);
            console.log('[VAULT] Waiting for borrow TX:', borrowTxId);
            await waitForTransaction(borrowTxId);
            console.log('[VAULT] Borrow TX confirmed');

            setTxStatus('success');
            setActiveStep(4);
            setTimeout(loadData, 1000);
        } catch (err: unknown) {
            console.error(
                `handleDepositAndBorrow failed\n${stringifyForLog({
                    error: toErrorLog(err),
                    sbtcAmount,
                    borrowAmount,
                    address,
                    lastTxId,
                    errorCode: err instanceof Error && err.message.includes('err u') ? err.message.match(/err u\d+/)?.[0] : 'unknown',
                })}`,
            );
            setTxStatus('error');
            const msg = err instanceof Error ? err.message : 'Transaction failed';

            // Enhanced error messages for specific error codes
            if (msg.includes('(err u4)')) {
                setErrorMsg(`sBTC transfer failed. This could mean: (1) Insufficient sBTC balance - you have ${balances.sbtc} sBTC, trying to deposit ${sbtcAmount} sBTC, or (2) Transfer permission issue. Details: ${msg}`);
            } else if (msg.includes('(err u108)')) {
                setErrorMsg(`Vault has no STX liquidity yet. Add liquidity first, then borrow. Details: ${msg}`);
            } else {
                setErrorMsg(msg);
            }
        }
    };

    const handleRepay = async () => {
        if (!isConnected || Number(repayAmount) <= 0) return;
        setErrorMsg('');
        try {
            setTxStatus('pending-repay');
            const txId = await repayStx(Number(repayAmount));
            setLastTxId(txId);
            await waitForTransaction(txId);
            setTxStatus('success');
            setTimeout(loadData, 1000);
        } catch (err: unknown) {
            console.error(
                `handleRepay failed\n${stringifyForLog({
                    error: toErrorLog(err),
                    repayAmount,
                    address,
                    lastTxId,
                })}`,
            );
            setTxStatus('error');
            setErrorMsg(err instanceof Error ? err.message : 'Repay failed');
        }
    };

    const handleWithdrawAll = async () => {
        if (!isConnected || vaultInfo.sbtcDeposited <= 0) return;
        setErrorMsg('');
        try {
            setTxStatus('pending-withdraw');
            const txId = await withdrawSbtc(vaultInfo.sbtcDeposited / 1e8);
            setLastTxId(txId);
            await waitForTransaction(txId);
            setTxStatus('success');
            setTimeout(loadData, 1000);
        } catch (err: unknown) {
            console.error(
                `handleWithdrawAll failed\n${stringifyForLog({
                    error: toErrorLog(err),
                    deposited: vaultInfo.sbtcDeposited,
                    address,
                    lastTxId,
                })}`,
            );
            setTxStatus('error');
            setErrorMsg(err instanceof Error ? err.message : 'Withdraw failed');
        }
    };

    const suggestedStep = !isConnected ? 1 : vaultInfo.sbtcDeposited > 0 ? 4 : 2;

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{background:#070B14;color:#f1f5f9;font-family:'DM Mono',monospace;overflow-x:hidden}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .vault-input{width:100%;background:#070B14;border:1px solid #1c2235;color:#e8edf5;padding:14px 16px;font-family:'DM Mono',monospace;font-size:18px;letter-spacing:0.02em;outline:none;transition:border-color 0.2s}
        .vault-input:focus{border-color:#e0a820}
        .btn-primary{width:100%;padding:15px;border:none;cursor:pointer;background:#e0a820;color:#070B14;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.14em;font-weight:500;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .btn-primary:hover:not(:disabled){background:#f0b830;transform:translateY(-1px)}
        .btn-primary:disabled{opacity:0.35;cursor:not-allowed}
        .btn-claim{width:100%;padding:15px;border:none;cursor:pointer;background:#00d4a0;color:#070B14;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.14em;font-weight:500;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .btn-claim:hover:not(:disabled){background:#00e8b0;transform:translateY(-1px)}
        .btn-claim:disabled{opacity:0.35;cursor:not-allowed}
        .spinner{width:12px;height:12px;border:2px solid rgba(7,11,20,0.3);border-top-color:#070B14;border-radius:50%;animation:spin 0.8s linear infinite}
      `}</style>

            {lastTxId && txStatus === 'success' && (
                <TxBanner
                    txId={lastTxId}
                    onDismiss={() => {
                        setLastTxId(null);
                        setTxStatus('idle');
                    }}
                />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                <div style={{ height: 28, background: '#06090f', borderBottom: '1px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BlinkDot />
                        <span style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.14em' }}>LIVE · STACKS TESTNET · BUIDL BATTLE #2</span>
                    </div>
                    <span style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.1em' }}>{time} UTC</span>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    <aside style={{ width: 230, borderRight: '1px solid #111827', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#070B14' }}>
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: '1px solid #111827', textDecoration: 'none' }}>
                            <div style={{ width: 28, height: 28, background: '#e0a820', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#070B14', clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)', flexShrink: 0 }}>B</div>
                            <div>
                                <div style={{ fontSize: 11, color: '#f1f5f9', letterSpacing: '0.1em', fontWeight: 500 }}>BTCBOOST</div>
                                <div style={{ fontSize: 8, color: '#8b949e', letterSpacing: '0.1em' }}>REAL ASSET VAULT</div>
                            </div>
                        </Link>

                        <div style={{ padding: '14px 20px 8px', fontSize: 9, color: '#8b949e', letterSpacing: '0.18em' }}>STEPS</div>

                        <nav style={{ flex: 1 }}>
                            {STEPS.map((step) => {
                                const isDone = (isConnected && step.id === 1) || (txStatus === 'success' && step.id <= 3);
                                const isActive = activeStep === step.id;
                                const reachable = isConnected || step.id === 1;
                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => reachable && setActiveStep(step.id)}
                                        style={{
                                            width: '100%',
                                            border: 'none',
                                            borderBottom: '1px solid #111827',
                                            padding: '14px 20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            cursor: reachable ? 'pointer' : 'default',
                                            background: isActive ? 'rgba(224,168,32,0.06)' : 'transparent',
                                            borderLeft: isActive ? '2px solid #e0a820' : '2px solid transparent',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: `1px solid ${isDone ? '#00d4a0' : isActive ? '#e0a820' : '#1c2235'}`,
                                                color: isDone ? '#00d4a0' : isActive ? '#e0a820' : '#3a4560',
                                                fontSize: 10,
                                            }}
                                        >
                                            {isDone ? 'OK' : step.code}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: isActive ? '#e8edf5' : '#cbd5e0', letterSpacing: '0.04em', marginBottom: 2 }}>{step.label}</div>
                                            <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.08em' }}>{step.sub}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </nav>

                        <div style={{ borderTop: '1px solid #111827', padding: 16 }}>
                            {isConnected ? (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                        <BlinkDot />
                                        <span style={{ fontSize: 9, color: '#00d4a0', letterSpacing: '0.08em' }}>CONNECTED</span>
                                    </div>
                                    <div style={{ fontSize: 9, color: '#a1a1aa', letterSpacing: '0.06em', marginBottom: 10 }}>{shortAddr}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#0a0f1e', border: '1px solid #111827' }}>
                                            <span style={{ fontSize: 9, color: '#e0a820' }}>B sBTC</span>
                                            <span style={{ fontSize: 10, color: '#f1f5f9' }}>{loadingBal ? '...' : formatTokenAmount(balances.sbtc, 8)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#0a0f1e', border: '1px solid #111827' }}>
                                            <span style={{ fontSize: 9, color: '#00d4a0' }}>STX</span>
                                            <span style={{ fontSize: 10, color: '#f1f5f9' }}>{loadingBal ? '...' : formatTokenAmount(balances.stx, 4)}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.12em', marginBottom: 8 }}>VAULT HOLDINGS</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#0a0f1e', border: '1px solid #111827' }}>
                                            <span style={{ fontSize: 9, color: '#e0a820' }}>B sBTC</span>
                                            <span style={{ fontSize: 10, color: '#f1f5f9' }}>{loadingBal ? '...' : formatTokenAmount(vaultBalances.sbtc, 8)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#0a0f1e', border: '1px solid #111827' }}>
                                            <span style={{ fontSize: 9, color: '#00d4a0' }}>STX</span>
                                            <span style={{ fontSize: 10, color: '#f1f5f9' }}>{loadingBal ? '...' : formatTokenAmount(vaultBalances.stx, 4)}</span>
                                        </div>
                                    </div>
                                    <button onClick={loadData} style={{ width: '100%', padding: '8px', border: '1px solid #1c2235', background: 'transparent', color: '#a1a1aa', fontSize: 9, letterSpacing: '0.12em', cursor: 'pointer', marginBottom: 8 }}>REFRESH</button>
                                    <button onClick={handleDisconnect} style={{ width: '100%', padding: '9px', border: '1px solid #1c2235', background: 'transparent', color: '#a1a1aa', fontSize: 9, letterSpacing: '0.12em', cursor: 'pointer' }}>DISCONNECT</button>
                                </div>
                            ) : (
                                <button onClick={handleConnect} style={{ width: '100%', padding: '13px', background: '#e0a820', border: 'none', color: '#070B14', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', cursor: 'pointer' }}>
                                    CONNECT WALLET
                                </button>
                            )}
                        </div>
                    </aside>

                    <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '14px 28px', borderBottom: '1px solid #111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.16em', marginBottom: 4 }}>VAULT.DASHBOARD</div>
                                <div style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 18, fontWeight: 700, color: '#e8edf5' }}>sBTC Collateral / STX Borrow</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {STEPS.map((s) => (
                                    <div key={s.id} style={{ width: 28, height: 4, borderRadius: 2, background: s.id <= suggestedStep ? '#e0a820' : '#1c2235' }} />
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#111827' }}>
                            <div style={{ background: '#0a0f1e', padding: '24px' }}>
                                <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.14em', marginBottom: 8 }}>COLLATERAL</div>
                                <div style={{ fontSize: 28, color: '#e0a820' }}>{depositedSbtcHuman} sBTC</div>
                            </div>
                            <div style={{ background: '#0a0f1e', padding: '24px' }}>
                                <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.14em', marginBottom: 8 }}>BORROWED</div>
                                <div style={{ fontSize: 28, color: '#00d4a0' }}>{stxBorrowedHuman} STX</div>
                            </div>
                            <div style={{ background: '#0a0f1e', padding: '24px' }}>
                                <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.14em', marginBottom: 8 }}>RISK</div>
                                <div style={{ fontSize: 28, color: vaultInfo.isLiquidatable ? '#f05252' : '#4a9eff' }}>{ltvPct}% LTV</div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(224,168,32,0.05)', borderTop: '1px solid rgba(224,168,32,0.2)', padding: '14px 28px', fontSize: 8, color: '#8b949e' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                <div>
                                    <div style={{ color: '#e0a820', marginBottom: 4, fontWeight: 500 }}>PROTOCOL STX LIQUIDITY</div>
                                    <div style={{ fontSize: 10, color: '#f1f5f9' }}>{(protocolStats.totalStxLiquidity / 1_000_000).toFixed(4)} STX</div>
                                </div>
                                <div>
                                    <div style={{ color: '#e0a820', marginBottom: 4, fontWeight: 500 }}>TOTAL STX BORROWED</div>
                                    <div style={{ fontSize: 10, color: '#f1f5f9' }}>{(protocolStats.totalStxBorrowed / 1_000_000).toFixed(4)} STX</div>
                                </div>
                                <div>
                                    <div style={{ color: '#e0a820', marginBottom: 4, fontWeight: 500 }}>TOTAL sBTC LOCKED</div>
                                    <div style={{ fontSize: 10, color: '#f1f5f9' }}>{(protocolStats.totalSbtcLocked / 1e8).toFixed(8)} sBTC</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, padding: 28, paddingBottom: 48 }}>
                            {activeStep === 1 && (
                                <div style={{ maxWidth: 560, margin: '0 auto' }}>
                                    <h2 style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 28, marginBottom: 10 }}>Connect your wallet</h2>
                                    <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.7, marginBottom: 24 }}>Use Leather or Xverse on Stacks testnet to interact with the real sBTC/STX vault.</p>
                                    <button onClick={handleConnect} className="btn-primary">CONNECT WALLET {'->'}</button>
                                </div>
                            )}

                            {activeStep === 2 && (
                                <div style={{ maxWidth: 560, margin: '0 auto' }}>
                                    <h2 style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 28, marginBottom: 10 }}>Deposit sBTC collateral</h2>
                                    <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.7, marginBottom: 20 }}>Deposit real sBTC to open or top up your collateral position.</p>

                                    <div style={{ marginBottom: 12, fontSize: 10, color: '#8b949e' }}>AMOUNT (sBTC)</div>
                                    <input className="vault-input" type="number" placeholder="0.00000000" value={sbtcAmount} onChange={(e) => setSbtcAmount(e.target.value)} />

                                    {vaultInfo.sbtcDeposited > 0 && (
                                        <button onClick={handleWithdrawAll} disabled={isPending} style={{ marginTop: 10, width: '100%', padding: '11px', border: '1px solid #1c2235', background: 'transparent', color: '#a1a1aa', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer' }}>
                                            WITHDRAW ALL ({depositedSbtcHuman} sBTC)
                                        </button>
                                    )}

                                    <button onClick={() => setActiveStep(3)} disabled={Number(sbtcAmount) <= 0} className="btn-primary" style={{ marginTop: 14 }}>
                                        CONTINUE TO BORROW {'->'}
                                    </button>
                                </div>
                            )}

                            {activeStep === 3 && (
                                <div style={{ maxWidth: 560, margin: '0 auto' }}>
                                    <h2 style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 28, marginBottom: 10 }}>Borrow STX</h2>
                                    <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.7, marginBottom: 20 }}>This step sends two transactions: deposit sBTC then borrow STX.</p>

                                    <div style={{ background: '#0a0f1e', border: '1px solid #111827', padding: 16, marginBottom: 16 }}>
                                        <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 12 }}>
                                            Vault STX liquidity available: {availableLiquidityStx.toFixed(4)} STX
                                        </div>
                                        <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 12 }}>Borrow hint (safe): ~{suggestedBorrowStx.toFixed(2)} STX</div>
                                        <input className="vault-input" type="number" placeholder="Borrow amount in STX" value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} />
                                    </div>

                                    {isPending && (
                                        <div style={{ background: 'rgba(224,168,32,0.05)', border: '1px solid rgba(224,168,32,0.25)', padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div className="spinner" style={{ borderColor: 'rgba(224,168,32,0.3)', borderTopColor: '#e0a820' }} />
                                            <span style={{ fontSize: 10, color: '#e0a820', letterSpacing: '0.1em' }}>{pendingLabel}</span>
                                        </div>
                                    )}

                                    {txStatus === 'error' && (
                                        <div style={{ background: 'rgba(240,82,82,0.07)', border: '1px solid rgba(240,82,82,0.2)', padding: '12px 16px', marginBottom: 16, fontSize: 10, color: '#f05252' }}>
                                            {errorMsg || 'TRANSACTION FAILED'}
                                        </div>
                                    )}

                                    <button onClick={handleDepositAndBorrow} disabled={isPending || Number(sbtcAmount) <= 0 || Number(borrowAmount) <= 0} className="btn-primary">
                                        {isPending ? (
                                            <>
                                                <div className="spinner" />
                                                {pendingLabel}
                                            </>
                                        ) : (
                                            'DEPOSIT + BORROW ->'
                                        )}
                                    </button>
                                </div>
                            )}

                            {activeStep === 4 && (
                                <div style={{ maxWidth: 560, margin: '0 auto' }}>
                                    <h2 style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 28, marginBottom: 10 }}>Repay STX debt</h2>
                                    <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.7, marginBottom: 20 }}>Repay any amount to reduce debt and improve LTV.</p>

                                    {txStatus === 'error' && (
                                        <div style={{ background: 'rgba(240,82,82,0.07)', border: '1px solid rgba(240,82,82,0.2)', padding: '12px 16px', marginBottom: 16, fontSize: 10, color: '#f05252' }}>
                                            {errorMsg || 'REPAY FAILED'}
                                        </div>
                                    )}

                                    <div style={{ background: '#0a0f1e', border: '1px solid #111827', padding: 16, marginBottom: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8b949e', marginBottom: 8 }}>
                                            <span>TOTAL OWED</span>
                                            <span>{totalOwedHuman} STX</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8b949e', marginBottom: 8 }}>
                                            <span>INTEREST OWED</span>
                                            <span>{interestOwedHuman} STX</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8b949e' }}>
                                            <span>CURRENT LTV</span>
                                            <span>{ltvPct}% {vaultInfo.isLiquidatable ? '(LIQUIDATABLE)' : ''}</span>
                                        </div>
                                    </div>

                                    <input className="vault-input" type="number" placeholder="Repay amount in STX" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} />
                                    <button onClick={() => setRepayAmount(totalOwedHuman)} style={{ marginTop: 8, marginBottom: 12, padding: '8px 10px', border: '1px solid #1c2235', background: 'transparent', color: '#a1a1aa', fontSize: 9, cursor: 'pointer' }}>
                                        USE MAX (TOTAL OWED)
                                    </button>

                                    <button onClick={handleRepay} disabled={isPending || Number(repayAmount) <= 0} className="btn-claim">
                                        {txStatus === 'pending-repay' ? (
                                            <>
                                                <div className="spinner" />
                                                WAITING FOR SIGNATURE...
                                            </>
                                        ) : (
                                            'REPAY STX ->'
                                        )}
                                    </button>

                                    <button onClick={loadData} disabled={loadingBal} style={{ marginTop: 10, width: '100%', padding: '11px', border: '1px solid #1c2235', background: 'transparent', color: '#a1a1aa', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer' }}>
                                        {loadingBal ? 'LOADING...' : 'REFRESH BALANCES'}
                                    </button>
                                </div>
                            )}

                            <div style={{ marginTop: 48, paddingTop: 28, borderTop: '1px solid #111827' }}>
                                <h3 style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 16, marginBottom: 14, color: '#e8edf5' }}>Transaction History</h3>
                                {txHistory.length === 0 ? (
                                    <div style={{ fontSize: 10, color: '#8b949e', padding: '20px 0' }}>No transactions yet</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                                        {txHistory.map((tx) => (
                                            <div
                                                key={tx.txId}
                                                style={{
                                                    background: '#0a0f1e',
                                                    border: '1px solid #111827',
                                                    padding: 12,
                                                    borderRadius: 4,
                                                    fontSize: 9,
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                    <span style={{ color: '#e0a820', fontWeight: 500, textTransform: 'uppercase' }}>
                                                        {tx.type.replace(/-/g, ' ')}
                                                    </span>
                                                    <span
                                                        style={{
                                                            color: tx.status === 'success' ? '#00d4a0' : tx.status === 'pending' ? '#e0a820' : '#f05252',
                                                            fontSize: 8,
                                                        }}
                                                    >
                                                        {tx.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div style={{ color: '#8b949e', marginBottom: 4, wordBreak: 'break-all' }}>
                                                    <a
                                                        href={explorerTxUrl(tx.txId)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#4a9eff', textDecoration: 'none' }}
                                                    >
                                                        {tx.txId.slice(0, 12)}...{tx.txId.slice(-8)}
                                                    </a>
                                                </div>
                                                <div style={{ color: '#8b949e', fontSize: 8 }}>
                                                    {new Date(tx.timestamp * 1000).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}

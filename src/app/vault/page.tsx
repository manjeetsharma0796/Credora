'use client';
// vault/page.tsx – Bloomberg terminal style, full Leather wallet + smart contract integration

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  authenticate, disconnect, userSession,
  depositSbtc, boostYield, claimYield, withdrawSbtc,
  fetchBalances, getVaultInfo, explorerTxUrl,
  type Balances, type VaultInfo,
} from '@/lib/stacks';

/* ── tiny helpers ── */
function BlinkDot({ color = '#00d4a0' }: { color?: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: color, animation: 'blink 1.4s step-start infinite', flexShrink: 0,
    }} />
  );
}

// Safely derive the current testnet address from the session, clearing any
// old/broken session data produced by previous @stacks/connect versions.
function getSafeTestnetAddress(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!userSession.isUserSignedIn()) return null;
    const data = userSession.loadUserData();
    const addr = (data as any)?.profile?.stxAddress?.testnet as string | undefined;
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

const STEPS = [
  { id: 1, code: '01', label: 'Connect Wallet', sub: 'Leather or Xverse' },
  { id: 2, code: '02', label: 'Deposit sBTC',   sub: 'Choose amount'     },
  { id: 3, code: '03', label: 'Boost Yield',    sub: '1.5× leverage'    },
  { id: 4, code: '04', label: 'Claim Rewards',  sub: 'USDCx earnings'   },
];

type TxStatus = 'idle' | 'pending-deposit' | 'pending-boost' | 'pending-claim' | 'success' | 'error';

/* ── TX Toast Banner ── */
function TxBanner({ txId, onDismiss }: { txId: string; onDismiss: () => void }) {
  const short = `${txId.slice(0, 8)}…${txId.slice(-6)}`;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: '#0a0f1e', border: '1px solid rgba(0,212,160,0.35)',
      padding: '14px 18px', maxWidth: 360, animation: 'fadeUp 0.3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: '#00d4a0', letterSpacing: '0.12em', marginBottom: 5 }}>
            ✓ TX BROADCAST
          </div>
          <div style={{ fontSize: 10, color: '#5a6585', letterSpacing: '0.06em', marginBottom: 8 }}>
            {short}
          </div>
          <a
            href={explorerTxUrl(txId)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: '#4a9eff', letterSpacing: '0.08em', textDecoration: 'none' }}
          >
            VIEW ON EXPLORER →
          </a>
        </div>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#3a4560', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function VaultPage() {
  const [mounted, setMounted]         = useState(false);
  const [time, setTime]               = useState('');
  const [sbtcAmount, setSbtcAmount]   = useState('');
  const [txStatus, setTxStatus]       = useState<TxStatus>('idle');
  const [lastTxId, setLastTxId]       = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [balances, setBalances]       = useState<Balances>({ stx: '—', sbtc: '—', usdcx: '—' });
  const [vaultInfo, setVaultInfo]     = useState<VaultInfo>({ depositedSbtc: 0, borrowedUsdcx: 0, accruedYield: 0, lastUpdate: 0 });
  const [loadingBal, setLoadingBal]   = useState(false);
  const [apy, setApy]                 = useState(11.20);
  const [activeStep, setActiveStep]   = useState(1);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Clock
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(n.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // APY wobble
  useEffect(() => {
    const id = setInterval(() => setApy(p => +(p + (Math.random() - 0.5) * 0.04).toFixed(2)), 3000);
    return () => clearInterval(id);
  }, []);

  // Fetch both balances and vault info
  const loadData = useCallback(async () => {
    const addr = getSafeTestnetAddress();
    if (!addr) return;
    setLoadingBal(true);
    try {
      const [bal, vault] = await Promise.all([fetchBalances(addr), getVaultInfo(addr)]);
      setBalances(bal);
      setVaultInfo(vault);
    } finally {
      setLoadingBal(false);
    }
  }, []);

  // On mount: if wallet already connected, jump to deposit and load data
  useEffect(() => {
    if (!mounted) return;
    if (getSafeTestnetAddress()) {
      loadData();
      setActiveStep(2);
    }
  }, [mounted, loadData]);

  // Poll vault info every 30s while connected
  useEffect(() => {
    if (!mounted) return;
    if (getSafeTestnetAddress()) {
      pollRef.current = setInterval(loadData, 30_000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [mounted, loadData]);

  if (!mounted) return null;

  const address     = getSafeTestnetAddress();
  const isConnected = !!address;
  const shortAddr   = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;
  const usdVal      = sbtcAmount ? `≈ $${(Number(sbtcAmount) * 104_000).toLocaleString()}` : '≈ $0';
  const estYield    = sbtcAmount ? (Number(sbtcAmount) * 104_000 * apy / 100).toFixed(0) : '—';

  // Human-readable vault values
  const depositedSbtcHuman  = (vaultInfo.depositedSbtc  / 1e8).toFixed(8);
  const accruedYieldHuman   = (vaultInfo.accruedYield   / 1e6).toFixed(2);
  const accruedYieldUsd     = `≈ $${(vaultInfo.accruedYield / 1e6).toFixed(2)}`;
  const hasYieldToClaim     = vaultInfo.accruedYield > 0;

  /* ── Handlers ── */
  const handleConnect    = () => authenticate();
  const handleDisconnect = () => disconnect();

  const handleBoost = async () => {
    if (!sbtcAmount || Number(sbtcAmount) <= 0 || !isConnected) return;
    setErrorMsg('');
    try {
      // Step 1: deposit
      setTxStatus('pending-deposit');
      const depositTxId = await depositSbtc(Number(sbtcAmount));
      setLastTxId(depositTxId);

      // Step 2: boost (immediately after wallet signs deposit)
      setTxStatus('pending-boost');
      const boostTxId = await boostYield(150);
      setLastTxId(boostTxId);

      setTxStatus('success');
      setActiveStep(4);
      setTimeout(loadData, 4000);  // refresh after a moment
    } catch (err: unknown) {
      setTxStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  const handleClaim = async () => {
    if (!isConnected || !hasYieldToClaim) return;
    setErrorMsg('');
    try {
      setTxStatus('pending-claim');
      const txId = await claimYield();
      setLastTxId(txId);
      setTxStatus('success');
      setTimeout(loadData, 4000);
    } catch (err: unknown) {
      setTxStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Claim failed');
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected || vaultInfo.depositedSbtc === 0) return;
    setErrorMsg('');
    try {
      setTxStatus('pending-deposit'); // reuse "pending" style
      const txId = await withdrawSbtc(vaultInfo.depositedSbtc / 1e8);
      setLastTxId(txId);
      setTxStatus('success');
      setTimeout(loadData, 4000);
    } catch (err: unknown) {
      setTxStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Withdrawal failed');
    }
  };

  const isPending = txStatus === 'pending-deposit' || txStatus === 'pending-boost' || txStatus === 'pending-claim';

  const pendingLabel =
    txStatus === 'pending-deposit' ? '① WAITING FOR DEPOSIT SIGNATURE…'
    : txStatus === 'pending-boost' ? '② WAITING FOR BOOST SIGNATURE…'
    : txStatus === 'pending-claim' ? 'WAITING FOR CLAIM SIGNATURE…'
    : 'BROADCASTING…';

  const suggestedStep = !isConnected ? 1
    : (!sbtcAmount || txStatus === 'idle') ? 2
    : txStatus === 'success' ? 4
    : 3;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{background:#070B14;color:#c8d0e0;font-family:'DM Mono',monospace;overflow-x:hidden}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#1c2235;border-radius:2px}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

        .vault-input{
          width:100%;background:#070B14;border:1px solid #1c2235;
          color:#e8edf5;padding:14px 100px 14px 16px;
          font-family:'DM Mono',monospace;font-size:20px;
          letter-spacing:0.02em;outline:none;transition:border-color 0.2s;
        }
        .vault-input:focus{border-color:#e0a820}
        .vault-input::placeholder{color:#2a3050}

        .btn-primary{
          width:100%;padding:15px;border:none;cursor:pointer;
          background:#e0a820;color:#070B14;
          font-family:'DM Mono',monospace;font-size:11px;
          letter-spacing:0.14em;font-weight:500;
          transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;
        }
        .btn-primary:hover:not(:disabled){background:#f0b830;transform:translateY(-1px)}
        .btn-primary:disabled{opacity:0.35;cursor:not-allowed}

        .btn-claim{
          width:100%;padding:15px;border:none;cursor:pointer;
          background:#00d4a0;color:#070B14;
          font-family:'DM Mono',monospace;font-size:11px;
          letter-spacing:0.14em;font-weight:500;
          transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;
        }
        .btn-claim:hover:not(:disabled){background:#00e8b0;transform:translateY(-1px)}
        .btn-claim:disabled{opacity:0.35;cursor:not-allowed}

        .spinner{width:12px;height:12px;border:2px solid rgba(7,11,20,0.3);border-top-color:#070B14;border-radius:50%;animation:spin 0.8s linear infinite}
        .dr{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #0d1320}
        .dr:last-child{border-bottom:none}
        .lbl{font-size:10px;color:#3a4560;letter-spacing:0.1em;text-transform:uppercase}
      `}</style>

      {/* TX Banner */}
      {lastTxId && txStatus === 'success' && (
        <TxBanner txId={lastTxId} onDismiss={() => { setLastTxId(null); setTxStatus('idle'); }} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* ── thin top strip ── */}
        <div style={{ height: 28, background: '#06090f', borderBottom: '1px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BlinkDot />
            <span style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.14em' }}>LIVE · STACKS TESTNET · BUIDL BATTLE #2</span>
          </div>
          <span style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.1em' }}>{time} UTC</span>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ════════════════════════════════════
              LEFT SIDEBAR
          ════════════════════════════════════ */}
          <aside style={{ width: 220, borderRight: '1px solid #111827', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#070B14' }}>

            {/* Logo */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: '1px solid #111827', textDecoration: 'none' }}>
              <div style={{ width: 28, height: 28, background: '#e0a820', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#070B14', clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)', flexShrink: 0 }}>₿</div>
              <div>
                <div style={{ fontSize: 11, color: '#c8d0e0', letterSpacing: '0.1em', fontWeight: 500 }}>BTCBOOST</div>
                <div style={{ fontSize: 8, color: '#3a4560', letterSpacing: '0.1em' }}>sBTC YIELD VAULT</div>
              </div>
            </Link>

            <div style={{ padding: '14px 20px 8px', fontSize: 9, color: '#3a4560', letterSpacing: '0.18em' }}>STEPS TO EARN</div>

            <nav style={{ flex: 1 }}>
              {STEPS.map(step => {
                const isDone = (isConnected && step.id === 1) || (txStatus === 'success' && step.id <= 3);
                const isActive = activeStep === step.id;
                const isSuggested = suggestedStep === step.id && !isActive;
                const reachable = isConnected || step.id === 1;

                return (
                  <button
                    key={step.id}
                    onClick={() => reachable && setActiveStep(step.id)}
                    style={{
                      width: '100%', border: 'none',
                      borderBottom: '1px solid #111827',
                      padding: '14px 20px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      cursor: reachable ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                      background: isActive ? 'rgba(224,168,32,0.06)' : 'transparent',
                      borderLeft: isActive ? '2px solid #e0a820' : '2px solid transparent',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${isDone ? '#00d4a0' : isActive ? '#e0a820' : '#1c2235'}`,
                      background: isDone ? 'rgba(0,212,160,0.1)' : isActive ? 'rgba(224,168,32,0.1)' : 'transparent',
                      fontSize: 10, fontWeight: 500,
                      color: isDone ? '#00d4a0' : isActive ? '#e0a820' : '#3a4560',
                    }}>
                      {isDone ? '✓' : step.code}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: isActive ? '#e8edf5' : reachable ? '#8a95a8' : '#3a4560', letterSpacing: '0.04em', marginBottom: 2 }}>{step.label}</div>
                      <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.08em' }}>{step.sub}</div>
                    </div>
                    {isSuggested && <div style={{ marginLeft: 'auto', fontSize: 8, color: '#e0a820', letterSpacing: '0.1em' }}>NEXT→</div>}
                  </button>
                );
              })}
            </nav>

            {/* Wallet area */}
            <div style={{ borderTop: '1px solid #111827', padding: 16 }}>
              {isConnected ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <BlinkDot />
                    <span style={{ fontSize: 9, color: '#00d4a0', letterSpacing: '0.08em' }}>CONNECTED</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#5a6585', letterSpacing: '0.06em', marginBottom: 10 }}>{shortAddr}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    {([
                      { icon: '₿', label: 'sBTC',  val: balances.sbtc,  color: '#e0a820' },
                      { icon: '$', label: 'USDCx', val: balances.usdcx, color: '#4a9eff' },
                      { icon: '◈', label: 'STX',   val: balances.stx,   color: '#00d4a0' },
                    ] as const).map(b => (
                      <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: '#0a0f1e', border: '1px solid #111827' }}>
                        <span style={{ fontSize: 9, color: b.color }}>{b.icon} {b.label}</span>
                        <span style={{ fontSize: 10, color: '#c8d0e0' }}>{loadingBal ? '…' : b.val}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={loadData}
                    style={{ width: '100%', padding: '7px', border: '1px solid #1c2235', background: 'transparent', color: '#5a6585', fontSize: 8, letterSpacing: '0.12em', cursor: 'pointer', fontFamily: '"DM Mono",monospace', marginBottom: 6, transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#c8d0e0')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#5a6585')}
                  >
                    ↻ REFRESH
                  </button>
                  <button
                    onClick={handleDisconnect}
                    style={{ width: '100%', padding: '9px', border: '1px solid #1c2235', background: 'transparent', color: '#5a6585', fontSize: 9, letterSpacing: '0.12em', cursor: 'pointer', fontFamily: '"DM Mono",monospace', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#f05252'; (e.currentTarget as HTMLElement).style.color = '#f05252'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1c2235'; (e.currentTarget as HTMLElement).style.color = '#5a6585'; }}
                  >
                    DISCONNECT
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  style={{ width: '100%', padding: '13px', background: '#e0a820', border: 'none', color: '#070B14', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', cursor: 'pointer', fontFamily: '"DM Mono",monospace', transition: 'background 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0b830')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#e0a820')}
                >
                  CONNECT WALLET
                </button>
              )}
            </div>
          </aside>

          {/* ════════════════════════════════════
              MAIN CONTENT
          ════════════════════════════════════ */}
          <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Top bar */}
            <div style={{ padding: '14px 28px', borderBottom: '1px solid #111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.16em', marginBottom: 4 }}>▸ VAULT.DASHBOARD</div>
                <div style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 18, fontWeight: 700, color: '#e8edf5', letterSpacing: '-0.02em' }}>sBTC Yield Vault</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {STEPS.map(s => (
                  <div key={s.id} style={{ width: 28, height: 4, borderRadius: 2, background: s.id <= suggestedStep ? '#e0a820' : '#1c2235', transition: 'background 0.3s' }} />
                ))}
              </div>
            </div>

            {/* ── 3 KPI cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#111827', flexShrink: 0 }}>
              {[
                { code: 'APY', label: 'Vault Net APY',   value: `${apy.toFixed(2)}%`,       sub: 'at 1.5× leverage',                     color: '#00d4a0', icon: '📈' },
                { code: 'TVL', label: 'Your Position',   value: isConnected ? `${depositedSbtcHuman} sBTC` : '—', sub: isConnected ? `Borrowed: ${(vaultInfo.borrowedUsdcx/1e6).toFixed(2)} USDCx` : 'Connect wallet', color: '#e0a820', icon: '🔒' },
                { code: 'YLD', label: 'Accrued Yield',   value: accruedYieldHuman,           sub: `USDCx claimable ${accruedYieldUsd}`,    color: '#4a9eff', icon: '💰' },
              ].map(c => (
                <div key={c.code} style={{ background: '#0a0f1e', padding: '24px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.14em' }}>{c.label.toUpperCase()}</div>
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                  </div>
                  <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 28, fontWeight: 300, color: c.color, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6 }}>{c.value}</div>
                  <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.1em' }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Active Step Panel ── */}
            <div style={{ flex: 1, padding: 28, paddingBottom: 48, animation: 'fadeUp 0.3s ease' }}>

              {/* ── STEP 1: Connect ── */}
              {activeStep === 1 && (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <div style={{ fontSize: 9, color: '#e0a820', letterSpacing: '0.18em', marginBottom: 12 }}>▸ STEP 01 / FIRST THINGS FIRST</div>
                  <div style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 26, fontWeight: 700, color: '#e8edf5', marginBottom: 10, letterSpacing: '-0.02em' }}>Connect your wallet</div>
                  <p style={{ fontSize: 12, color: '#5a6585', lineHeight: 1.8, marginBottom: 28 }}>
                    Use <span style={{ color: '#e0a820' }}>Leather</span> or <span style={{ color: '#e0a820' }}>Xverse</span> — the two most popular Stacks wallets. Your Bitcoin stays in your wallet; you only authorize the vault to work with it.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#111827', marginBottom: 28 }}>
                    {[
                      { name: 'Leather', icon: '🔑', desc: 'The original Stacks wallet. Open-source and battle-tested.', href: 'https://leather.io' },
                      { name: 'Xverse',  icon: '⚡', desc: 'Mobile-first Stacks wallet. Great for beginners.', href: 'https://www.xverse.app' },
                    ].map(w => (
                      <div key={w.name} style={{ background: '#0a0f1e', padding: 20 }}>
                        <div style={{ fontSize: 22, marginBottom: 10 }}>{w.icon}</div>
                        <div style={{ fontSize: 13, color: '#c8d0e0', marginBottom: 6, letterSpacing: '0.04em' }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: '#4a5568', lineHeight: 1.6, marginBottom: 10 }}>{w.desc}</div>
                        <a href={w.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: '#4a9eff', letterSpacing: '0.1em' }}>GET {w.name.toUpperCase()} →</a>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleConnect} className="btn-primary">CONNECT WALLET →</button>
                  <div style={{ marginTop: 12, fontSize: 9, color: '#3a4560', textAlign: 'center', letterSpacing: '0.1em' }}>NO PRIVATE KEY REQUIRED · READ-ONLY UNTIL YOU SIGN</div>
                </div>
              )}

              {/* ── STEP 2: Deposit ── */}
              {activeStep === 2 && (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <div style={{ fontSize: 9, color: '#e0a820', letterSpacing: '0.18em', marginBottom: 12 }}>▸ STEP 02 / OPEN POSITION</div>
                  <div style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 26, fontWeight: 700, color: '#e8edf5', marginBottom: 10, letterSpacing: '-0.02em' }}>Deposit sBTC</div>
                  <p style={{ fontSize: 12, color: '#5a6585', lineHeight: 1.8, marginBottom: 28 }}>
                    Enter how much sBTC you want to put to work. The vault will use it as collateral to borrow USDCx and earn yield — <span style={{ color: '#e0a820' }}>your sBTC is never sold.</span>
                  </p>

                  {/* Existing position info */}
                  {vaultInfo.depositedSbtc > 0 && (
                    <div style={{ background: 'rgba(224,168,32,0.05)', border: '1px solid rgba(224,168,32,0.2)', padding: '12px 16px', marginBottom: 20, fontSize: 10, color: '#e0a820', letterSpacing: '0.08em' }}>
                      ⚡ ACTIVE POSITION: {depositedSbtcHuman} sBTC — you can top up by depositing more
                    </div>
                  )}

                  {/* Input */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className="lbl">Amount to deposit</span>
                      <span style={{ fontSize: 10, color: '#3a4560' }}>
                        BAL: <span style={{ color: '#e0a820' }}>{balances.sbtc} sBTC</span>
                      </span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="vault-input"
                        type="number"
                        placeholder="0.00000000"
                        value={sbtcAmount}
                        onChange={e => setSbtcAmount(e.target.value)}
                      />
                      <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', display: 'flex' }}>
                        <span style={{ padding: '0 14px', display: 'flex', alignItems: 'center', fontSize: 11, color: '#e0a820', borderLeft: '1px solid #1c2235', letterSpacing: '0.08em' }}>sBTC</span>
                        <button
                          onClick={() => setSbtcAmount(balances.sbtc === '—' ? '0.1' : balances.sbtc)}
                          style={{ padding: '0 12px', background: '#0a0f1e', border: 'none', borderLeft: '1px solid #1c2235', color: '#5a6585', fontSize: 9, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: '"DM Mono",monospace', transition: 'color 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#e0a820')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#5a6585')}
                        >MAX</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 10, color: '#3a4560', letterSpacing: '0.06em' }}>{usdVal}</div>
                  </div>

                  {/* Preview */}
                  {sbtcAmount && Number(sbtcAmount) > 0 && (
                    <div style={{ background: '#0a0f1e', border: '1px solid #111827', padding: '16px 20px', marginBottom: 20, animation: 'fadeUp 0.2s ease' }}>
                      <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.14em', marginBottom: 12 }}>POSITION PREVIEW</div>
                      {[
                        { k: 'Leverage Factor',   v: '1.5×',                c: '#e0a820' },
                        { k: 'Estimated APY',     v: `${apy.toFixed(2)}%`,  c: '#00d4a0' },
                        { k: 'Est. USDCx / year', v: `${estYield} USDCx`,   c: '#4a9eff' },
                        { k: 'Protocol Fee',      v: '0.30%',               c: '' },
                      ].map(r => (
                        <div key={r.k} className="dr">
                          <span className="lbl">{r.k}</span>
                          <span style={{ fontSize: 12, color: r.c || '#c8d0e0' }}>{r.v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => { if (sbtcAmount && Number(sbtcAmount) > 0) setActiveStep(3); }}
                    disabled={!sbtcAmount || Number(sbtcAmount) <= 0}
                    className="btn-primary"
                  >
                    CONTINUE TO BOOST →
                  </button>

                  {/* Withdraw existing position */}
                  {vaultInfo.depositedSbtc > 0 && (
                    <button
                      onClick={handleWithdraw}
                      disabled={isPending}
                      style={{ marginTop: 10, width: '100%', padding: '11px', border: '1px solid #1c2235', background: 'transparent', color: '#5a6585', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: '"DM Mono",monospace', transition: 'all 0.2s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f05252'; (e.currentTarget as HTMLElement).style.borderColor = '#f05252'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5a6585'; (e.currentTarget as HTMLElement).style.borderColor = '#1c2235'; }}
                    >
                      ↑ WITHDRAW ALL ({depositedSbtcHuman} sBTC)
                    </button>
                  )}
                </div>
              )}

              {/* ── STEP 3: Boost ── */}
              {activeStep === 3 && (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <div style={{ fontSize: 9, color: '#e0a820', letterSpacing: '0.18em', marginBottom: 12 }}>▸ STEP 03 / REVIEW & BOOST</div>
                  <div style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 26, fontWeight: 700, color: '#e8edf5', marginBottom: 10, letterSpacing: '-0.02em' }}>Confirm & Boost Yield</div>
                  <p style={{ fontSize: 12, color: '#5a6585', lineHeight: 1.8, marginBottom: 24 }}>
                    Leather will pop up <strong style={{ color: '#c8d0e0' }}>twice</strong> — once to deposit your sBTC, then again to activate the 1.5× leverage loop. Both must be approved.
                  </p>

                  {/* UX step indicator */}
                  {isPending && (
                    <div style={{ background: 'rgba(224,168,32,0.05)', border: '1px solid rgba(224,168,32,0.25)', padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="spinner" style={{ borderColor: 'rgba(224,168,32,0.3)', borderTopColor: '#e0a820' }} />
                      <span style={{ fontSize: 10, color: '#e0a820', letterSpacing: '0.1em' }}>{pendingLabel}</span>
                    </div>
                  )}

                  {/* Summary */}
                  <div style={{ background: '#0a0f1e', border: '1px solid #1c2235', padding: '20px', marginBottom: 20 }}>
                    <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.14em', marginBottom: 14 }}>TRANSACTION SUMMARY</div>
                    {[
                      { k: 'Depositing',         v: `${sbtcAmount} sBTC`, c: '#e0a820', big: true },
                      { k: '≈ USD Value',         v: usdVal, c: '' },
                      { k: 'Leverage',            v: '1.5×', c: '#e0a820' },
                      { k: 'Estimated APY',       v: `${apy.toFixed(2)}%`, c: '#00d4a0' },
                      { k: 'Est. Yearly Yield',   v: `${estYield} USDCx`, c: '#4a9eff' },
                      { k: 'Wallet Popups',       v: '2 signatures', c: '' },
                      { k: 'Protocol',            v: 'Stacks Testnet', c: '' },
                    ].map(r => (
                      <div key={r.k} className="dr">
                        <span className="lbl">{r.k}</span>
                        <span style={{ fontSize: r.big ? 15 : 12, color: r.c || '#c8d0e0', fontWeight: r.big ? 500 : 300 }}>{r.v}</span>
                      </div>
                    ))}
                  </div>

                  {txStatus === 'error' && (
                    <div style={{ background: 'rgba(240,82,82,0.07)', border: '1px solid rgba(240,82,82,0.2)', padding: '12px 16px', marginBottom: 16, fontSize: 10, color: '#f05252', letterSpacing: '0.08em' }}>
                      ✗ {errorMsg || 'TRANSACTION REJECTED — CHECK WALLET AND RETRY'}
                    </div>
                  )}

                  <button onClick={handleBoost} disabled={isPending} className="btn-primary">
                    {isPending
                      ? <><div className="spinner" />{pendingLabel}</>
                      : 'BOOST & EARN →'}
                  </button>
                  <button
                    onClick={() => setActiveStep(2)}
                    disabled={isPending}
                    style={{ marginTop: 10, width: '100%', padding: '11px', border: '1px solid #1c2235', background: 'transparent', color: '#5a6585', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: '"DM Mono",monospace', transition: 'all 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#c8d0e0')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#5a6585')}
                  >
                    ← EDIT AMOUNT
                  </button>
                </div>
              )}

              {/* ── STEP 4: Claim ── */}
              {activeStep === 4 && (
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <div style={{ fontSize: 9, color: '#00d4a0', letterSpacing: '0.18em', marginBottom: 12 }}>▸ STEP 04 / REWARDS</div>
                  <div style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 26, fontWeight: 700, color: '#e8edf5', marginBottom: 10, letterSpacing: '-0.02em' }}>Your Yield is Accruing</div>
                  <p style={{ fontSize: 12, color: '#5a6585', lineHeight: 1.8, marginBottom: 24 }}>
                    {txStatus === 'success'
                      ? 'Both transactions confirmed — the vault is now looping your sBTC to generate USDCx. Rewards accrue every ~10 minutes (one Stacks block).'
                      : 'USDCx rewards from your active position appear here. Refresh to get the latest on-chain balance.'}
                  </p>

                  {txStatus === 'success' && lastTxId && (
                    <div style={{ background: 'rgba(0,212,160,0.06)', border: '1px solid rgba(0,212,160,0.2)', padding: '14px 18px', marginBottom: 20, animation: 'fadeUp 0.3s ease' }}>
                      <div style={{ fontSize: 9, color: '#00d4a0', letterSpacing: '0.12em', marginBottom: 6 }}>✓ POSITION ACTIVE</div>
                      <a
                        href={explorerTxUrl(lastTxId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 10, color: '#4a9eff', letterSpacing: '0.08em', textDecoration: 'none' }}
                      >
                        VIEW BOOST TX ON EXPLORER →
                      </a>
                    </div>
                  )}

                  {txStatus === 'error' && (
                    <div style={{ background: 'rgba(240,82,82,0.07)', border: '1px solid rgba(240,82,82,0.2)', padding: '12px 16px', marginBottom: 16, fontSize: 10, color: '#f05252', letterSpacing: '0.08em' }}>
                      ✗ {errorMsg || 'CLAIM FAILED — CHECK WALLET AND RETRY'}
                    </div>
                  )}

                  {/* Live yield display */}
                  <div style={{ background: '#0a0f1e', border: '1px solid #111827', padding: '24px 20px', marginBottom: 20, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.14em', marginBottom: 10 }}>CLAIMABLE NOW</div>
                    <div style={{
                      fontFamily: '"DM Mono",monospace', fontSize: 44, fontWeight: 300,
                      color: hasYieldToClaim ? '#00d4a0' : '#3a4560',
                      letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6,
                      transition: 'color 0.3s',
                    }}>
                      {loadingBal ? '…' : accruedYieldHuman}
                    </div>
                    <div style={{ fontSize: 12, color: '#3a4560' }}>USDCx {loadingBal ? '' : accruedYieldUsd}</div>
                  </div>

                  <button
                    onClick={handleClaim}
                    disabled={!hasYieldToClaim || isPending}
                    className="btn-claim"
                  >
                    {txStatus === 'pending-claim'
                      ? <><div className="spinner" />WAITING FOR SIGNATURE…</>
                      : hasYieldToClaim
                        ? `CLAIM ${accruedYieldHuman} USDCx →`
                        : 'CLAIM REWARDS (NO BALANCE YET)'}
                  </button>

                  <button
                    onClick={loadData}
                    disabled={loadingBal}
                    style={{ marginTop: 10, width: '100%', padding: '11px', border: '1px solid #1c2235', background: 'transparent', color: '#5a6585', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: '"DM Mono",monospace', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#c8d0e0')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#5a6585')}
                  >
                    {loadingBal ? '↻ LOADING…' : '↻ REFRESH BALANCES'}
                  </button>

                  <div style={{ marginTop: 16, padding: '14px 18px', background: '#0a0f1e', border: '1px solid #111827', fontSize: 10, color: '#5a6585', lineHeight: 1.7 }}>
                    <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.12em', marginBottom: 8 }}>VAULT POSITION DETAILS</div>
                    {[
                      { k: 'Deposited sBTC',  v: `${depositedSbtcHuman} sBTC` },
                      { k: 'Borrowed USDCx',  v: `${(vaultInfo.borrowedUsdcx/1e6).toFixed(2)} USDCx` },
                      { k: 'Last Updated',    v: vaultInfo.lastUpdate > 0 ? `Block #${vaultInfo.lastUpdate}` : '—' },
                    ].map(r => (
                      <div key={r.k} className="dr">
                        <span className="lbl">{r.k}</span>
                        <span style={{ fontSize: 12, color: '#c8d0e0' }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </>
  );
}

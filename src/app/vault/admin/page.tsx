'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ADMIN_ADDRESS,
    authenticate,
    disconnect,
    depositStxLiquidity,
    getProtocolStats,
    userSession,
    waitForTransaction,
    type ProtocolStats,
} from '@/lib/stacks';

function getSafeTestnetAddress(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        if (!userSession.isUserSignedIn()) return null;
        const data = userSession.loadUserData();
        return (data as unknown as { profile?: { stxAddress?: { testnet?: string } } })
            ?.profile?.stxAddress?.testnet ?? null;
    } catch {
        return null;
    }
}

export default function VaultAdminPage() {
    const [mounted, setMounted] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<ProtocolStats>({
        totalSbtcLocked: 0,
        totalStxBorrowed: 0,
        totalStxLiquidity: 0,
        protocolFees: 0,
        sbtcPriceUstx: 0,
    });

    const isAuthorized = address === ADMIN_ADDRESS || "ST14RA6VWTZJF2ZNK3G83A40BC0CBK31MCAEGS1HX";

    async function refreshStats(currentAddress?: string | null) {
        const sender = currentAddress ?? address;
        if (!sender) return;
        const result = await getProtocolStats(sender);
        setStats(result);
    }

    useEffect(() => {
        setMounted(true);
        const addr = getSafeTestnetAddress();
        setAddress(addr);
        if (addr) {
            void refreshStats(addr);
        }
    }, []);

    async function handleConnect() {
        authenticate();
    }

    async function handleDeposit() {
        if (!isAuthorized) return;
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            setStatus('Enter a valid STX amount.');
            return;
        }

        try {
            setLoading(true);
            setStatus('Waiting for wallet signature...');
            const txId = await depositStxLiquidity(value);
            setStatus(`Broadcasted: ${txId}. Waiting for confirmation...`);
            console.log('[ADMIN] Deposit TX broadcasted:', txId);

            const result = await waitForTransaction(txId);
            console.log('[ADMIN] Deposit TX confirmed:', result);
            console.log('[ADMIN] TX result status:', result?.tx_status);

            // Wait extra 2 seconds for contract state to finalize
            console.log('[ADMIN] Waiting for contract state to finalize...');
            await new Promise(r => setTimeout(r, 2000));

            await refreshStats();
            console.log('[ADMIN] Stats refreshed after deposit');
            setStatus(`Success! Liquidity deposited in tx ${txId}. Check vault page to borrow.`);
            setAmount('');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[ADMIN ERROR] Deposit failed:', err);
            setStatus(`Failed: ${msg}`);
        } finally {
            setLoading(false);
        }
    }

    if (!mounted) return null;

    return (
        <main style={{ minHeight: '100vh', background: '#070B14', color: '#f1f5f9', padding: '32px' }}>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h1 style={{ fontSize: 28, margin: 0 }}>Vault Admin Liquidity</h1>
                    <Link href="/vault" style={{ color: '#4a9eff', textDecoration: 'none' }}>Back to Vault</Link>
                </div>

                {!address ? (
                    <section style={{ border: '1px solid #1c2235', padding: 18, marginBottom: 16 }}>
                        <p style={{ marginTop: 0 }}>Connect wallet to continue.</p>
                        <button
                            onClick={handleConnect}
                            style={{
                                background: '#e0a820',
                                color: '#070B14',
                                border: 'none',
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            Connect Wallet
                        </button>
                    </section>
                ) : (
                    <section style={{ border: '1px solid #1c2235', padding: 18, marginBottom: 16 }}>
                        <div style={{ marginBottom: 8 }}>
                            <strong>Connected:</strong> {address}
                        </div>
                        <div>
                            <strong>Required admin:</strong> {ADMIN_ADDRESS}
                        </div>
                        <button
                            onClick={() => disconnect()}
                            style={{
                                marginTop: 12,
                                background: 'transparent',
                                color: '#c0c8dc',
                                border: '1px solid #1c2235',
                                padding: '8px 12px',
                                cursor: 'pointer',
                            }}
                        >
                            Disconnect
                        </button>
                    </section>
                )}

                {address && !isAuthorized && (
                    <section style={{ border: '1px solid #f05252', color: '#fca5a5', padding: 18, marginBottom: 16 }}>
                        Access denied. This page is restricted to {ADMIN_ADDRESS}.
                    </section>
                )}

                {address && isAuthorized && (
                    <section style={{ border: '1px solid #1c2235', padding: 18 }}>
                        <h2 style={{ marginTop: 0 }}>Deposit STX Liquidity</h2>
                        <p style={{ color: '#9aa3b8' }}>
                            Current vault STX liquidity: {(stats.totalStxLiquidity / 1_000_000).toLocaleString('en-US', {
                                minimumFractionDigits: 4,
                                maximumFractionDigits: 4,
                            })} STX
                        </p>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input
                                type="number"
                                placeholder="Amount in STX"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: '#0a0f1e',
                                    border: '1px solid #1c2235',
                                    color: '#f1f5f9',
                                    padding: '10px 12px',
                                }}
                            />
                            <button
                                onClick={handleDeposit}
                                disabled={loading}
                                style={{
                                    background: '#e0a820',
                                    color: '#070B14',
                                    border: 'none',
                                    padding: '10px 14px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    opacity: loading ? 0.65 : 1,
                                }}
                            >
                                {loading ? 'Processing...' : 'Deposit'}
                            </button>
                            <button
                                onClick={() => refreshStats()}
                                disabled={loading}
                                style={{
                                    background: 'transparent',
                                    color: '#c0c8dc',
                                    border: '1px solid #1c2235',
                                    padding: '10px 14px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Refresh
                            </button>
                        </div>

                        {status ? (
                            <p style={{ marginTop: 12, color: status.startsWith('Failed:') ? '#fca5a5' : '#9ae6b4' }}>
                                {status}
                            </p>
                        ) : null}
                    </section>
                )}
            </div>
        </main>
    );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  authenticate, disconnect, userSession,
  depositSbtc, boostYield, fetchBalances, type Balances,
} from '@/lib/stacks';

const TICKER_ITEMS = [
  ['sBTC/BTC', '1.0000', true],
  ['USDCx/USD', '$1.0000', true],
  ['VAULT APY', '11.20%', true],
  ['BORROW RATE', '2.46%', false],
  ['MAX LEVERAGE', '3×', true],
  ['LTV RATIO', '65%', false],
  ['PROTOCOL FEE', '0.30%', false],
  ['NETWORK', 'TESTNET', false],
  ['sBTC/BTC', '1.0000', true],
  ['USDCx/USD', '$1.0000', true],
  ['VAULT APY', '11.20%', true],
  ['BORROW RATE', '2.46%', false],
  ['MAX LEVERAGE', '3×', true],
  ['LTV RATIO', '65%', false],
  ['PROTOCOL FEE', '0.30%', false],
  ['NETWORK', 'TESTNET', false],
];

function Ticker() {
  return (
    <div style={{ overflow: 'hidden', flex: 1 }}>
      <div style={{ display: 'flex', gap: 0, animation: 'ticker 30s linear infinite', width: 'max-content' }}>
        {TICKER_ITEMS.map(([label, val, pos], i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 0,
            borderRight: '1px solid #1c2235', padding: '0 18px', height: '100%',
          }}>
            <span style={{ color: '#3a4560', fontSize: 10, fontFamily: '"DM Mono",monospace', letterSpacing: '0.06em', marginRight: 8 }}>{label as string}</span>
            <span style={{ color: pos ? '#00d4a0' : '#e0a820', fontSize: 11, fontFamily: '"DM Mono",monospace' }}>{val as string}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BlinkDot({ color = '#00d4a0' }: { color?: string }) {
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, animation: 'blink 1.4s step-start infinite', flexShrink: 0 }} />;
}

type Tab = 'deposit' | 'withdraw';
type TxStatus = 'idle' | 'pending' | 'success' | 'error';

export default function VaultPage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const [tab, setTab] = useState<Tab>('deposit');
  const [sbtcAmount, setSbtcAmount] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [balances, setBalances] = useState<Balances>({ stx: '—', sbtc: '—', usdcx: '—' });
  const [loadingBal, setLoadingBal] = useState(false);
  const [apy, setApy] = useState(11.20);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(n.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setApy(p => +(p + (Math.random() - 0.5) * 0.04).toFixed(2)), 3000);
    return () => clearInterval(id);
  }, []);

  const loadBalances = useCallback(async () => {
    if (!userSession.isUserSignedIn()) return;
    setLoadingBal(true);
    try {
      const addr = userSession.loadUserData().profile.stxAddress.testnet;
      const b = await fetchBalances(addr);
      setBalances(b);
    } finally {
      setLoadingBal(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (userSession.isUserSignedIn()) loadBalances();
  }, [mounted, loadBalances]);

  if (!mounted) return null;

  const isConnected = userSession.isUserSignedIn();
  const address = isConnected ? userSession.loadUserData().profile.stxAddress.testnet : null;
  const shortAddr = address ? `${address.slice(0, 8)}...${address.slice(-4)}` : null;

  const usdVal = sbtcAmount ? (Number(sbtcAmount) * 104000).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '$0';
  const estimatedYield = sbtcAmount ? (Number(sbtcAmount) * 104000 * apy / 100).toFixed(0) : '0';

  const handleDeposit = async () => {
    if (!isConnected) { authenticate(); return; }
    if (!sbtcAmount || Number(sbtcAmount) <= 0) { setTxStatus('error'); return; }
    setTxStatus('pending');
    try {
      await depositSbtc(Number(sbtcAmount));
      await boostYield(150);
      setTxHash('pending-confirmation');
      setTxStatus('success');
      setTimeout(loadBalances, 3000);
    } catch {
      setTxStatus('error');
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{background:#070B14;color:#c8d0e0;font-family:'DM Mono',monospace;overflow-x:hidden;}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#070B14}
        ::-webkit-scrollbar-thumb{background:#1c2235;border-radius:2px}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .data-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #0f1525}
        .data-row:last-child{border-bottom:none}
        .lbl{font-size:10px;color:#3a4560;letter-spacing:0.12em;text-transform:uppercase}
        .val-green{color:#00d4a0}
        .val-amber{color:#e0a820}
        .val-blue{color:#4a9eff}
        .val-red{color:#f05252}
        .section-code{font-size:9px;color:#3a4560;letter-spacing:0.14em}
        .section-title{font-size:11px;color:#5a6585;letter-spacing:0.1em;text-transform:uppercase}
        .tab-btn{
          flex:1;padding:10px;border:none;cursor:pointer;
          font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;
          transition:all 0.2s;background:transparent;
        }
        .tab-active{color:#e0a820;border-bottom:1px solid #e0a820;background:rgba(224,168,32,0.04)}
        .tab-inactive{color:#3a4560;border-bottom:1px solid #111827}
        .vault-input{
          width:100%;background:#070B14;border:1px solid #1c2235;
          color:#c8d0e0;padding:14px 16px;font-family:'DM Mono',monospace;
          font-size:16px;letter-spacing:0.02em;outline:none;transition:border-color 0.2s;
        }
        .vault-input:focus{border-color:#e0a820}
        .vault-input::placeholder{color:#3a4560}
        .btn-cta{
          width:100%;padding:15px;border:none;cursor:pointer;
          background:#e0a820;color:#070B14;
          font-family:'DM Mono',monospace;font-size:11px;
          letter-spacing:0.12em;text-transform:uppercase;font-weight:500;
          transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;
        }
        .btn-cta:hover:not(:disabled){background:#f0b830}
        .btn-cta:disabled{opacity:0.4;cursor:not-allowed}
        .btn-connect{
          padding:8px 20px;border:1px solid #e0a820;
          color:#e0a820;background:transparent;
          font-family:'DM Mono',monospace;font-size:10px;
          letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;
        }
        .btn-connect:hover{background:#e0a820;color:#070B14}
        .spinner{
          width:12px;height:12px;border:2px solid rgba(7,11,20,0.3);
          border-top-color:#070B14;border-radius:50%;animation:spin 0.8s linear infinite;
        }
        .balance-tag{
          display:inline-flex;align-items:center;gap:6px;
          font-size:10px;color:#5a6585;letter-spacing:0.06em;
          padding:4px 10px;border:1px solid #1c2235;background:#0a0f1e;
        }
        .metric-card{background:#0a0f1e;border:1px solid #111827;padding:20px 22px}
      `}</style>

      {/* ═══ TOP TICKER ═══ */}
      <div style={{ height: 32, display: 'flex', alignItems: 'center', background: '#06090f', borderBottom: '1px solid #111827' }}>
        <div style={{ padding: '0 12px', borderRight: '1px solid #1c2235', height: '100%', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <BlinkDot /><span style={{ fontSize: 9, letterSpacing: '0.16em', color: '#3a4560' }}>LIVE</span>
        </div>
        <Ticker />
      </div>

      {/* ═══ NAV ═══ */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 48, borderBottom: '1px solid #111827',
        background: '#070B14', position: 'sticky', top: 32, zIndex: 100,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', height: '100%', borderRight: '1px solid #111827', padding: '0 20px', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 26, height: 26, background: '#e0a820', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#070B14', clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)' }}>₿</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#c8d0e0', letterSpacing: '0.1em' }}>BTCBOOST</div>
            <div style={{ fontSize: 8, color: '#3a4560', letterSpacing: '0.12em' }}>← BACK TO HOME</div>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 20px', borderLeft: '1px solid #111827', gap: 8 }}>
          <span className="section-code">▸ VAULT.DASHBOARD</span>
          <span className="section-title">sBTC Yield Vault</span>
        </div>

        {/* Wallet area */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 0 }}>
          {isConnected ? (
            <>
              {/* Balance tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderLeft: '1px solid #111827' }}>
                <div className="balance-tag">
                  <span style={{ color: '#e0a820' }}>₿</span>
                  <span>{loadingBal ? '...' : balances.sbtc}</span>
                  <span style={{ color: '#3a4560' }}>sBTC</span>
                </div>
                <div className="balance-tag">
                  <span style={{ color: '#4a9eff' }}>$</span>
                  <span>{loadingBal ? '...' : balances.usdcx}</span>
                  <span style={{ color: '#3a4560' }}>USDCx</span>
                </div>
                <div className="balance-tag">
                  <span style={{ color: '#00d4a0' }}>◈</span>
                  <span>{loadingBal ? '...' : balances.stx}</span>
                  <span style={{ color: '#3a4560' }}>STX</span>
                </div>
              </div>
              <div style={{ padding: '0 16px', borderLeft: '1px solid #111827', height: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BlinkDot color="#00d4a0" />
                <span style={{ fontSize: 10, color: '#5a6585', letterSpacing: '0.06em', fontFamily: '"DM Mono",monospace' }}>{shortAddr}</span>
              </div>
              <button onClick={handleDisconnect} style={{ height: '100%', padding: '0 16px', borderLeft: '1px solid #111827', background: 'none', border: 'none', borderLeft: '1px solid #111827', color: '#3a4560', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', transition: 'color 0.2s', fontFamily: '"DM Mono",monospace' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f05252')}
                onMouseLeave={e => (e.currentTarget.style.color = '#3a4560')}>
                DISCONNECT
              </button>
            </>
          ) : (
            <>
              <div style={{ padding: '0 16px', borderLeft: '1px solid #111827', fontSize: 9, color: '#3a4560', letterSpacing: '0.1em' }}>
                {time} UTC
              </div>
              <button onClick={authenticate} style={{ height: '100%', padding: '0 24px', background: '#e0a820', color: '#070B14', border: 'none', borderLeft: '1px solid #1c2235', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: '"DM Mono",monospace', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0b830')}
                onMouseLeave={e => (e.currentTarget.style.background = '#e0a820')}>
                CONNECT WALLET →
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: 'calc(100vh - 80px)' }}>

        {/* ─── LEFT: Deposit Panel ─── */}
        <div style={{ borderRight: '1px solid #111827', display: 'flex', flexDirection: 'column' }}>

          {/* Panel header */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="section-code">▸ INPUT.001</span>
              <span className="section-title">Open Position</span>
            </div>
            <div style={{ display: 'flex', gap: 0, flex: 1, marginLeft: 16 }}>
              {(['deposit', 'withdraw'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? 'tab-active' : 'tab-inactive'}`}>{t.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {tab === 'deposit' ? (
            <div style={{ padding: '24px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Amount input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="lbl">Amount</span>
                  {isConnected && <span style={{ fontSize: 10, color: '#3a4560' }}>BAL: <span style={{ color: '#e0a820' }}>{balances.sbtc} sBTC</span></span>}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    className="vault-input"
                    type="number"
                    placeholder="0.00000000"
                    value={sbtcAmount}
                    onChange={e => setSbtcAmount(e.target.value)}
                  />
                  <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 0 }}>
                    <span style={{ padding: '0 12px', fontSize: 10, color: '#e0a820', borderLeft: '1px solid #1c2235', height: '100%', display: 'flex', alignItems: 'center', letterSpacing: '0.1em' }}>sBTC</span>
                    <button onClick={() => setSbtcAmount('0.1')} style={{ padding: '0 12px', height: '100%', background: '#0a0f1e', border: 'none', borderLeft: '1px solid #1c2235', color: '#3a4560', fontSize: 9, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: '"DM Mono",monospace', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e0a820')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#3a4560')}>
                      MAX
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#3a4560' }}>≈ {usdVal}</div>
              </div>

              {/* Separator */}
              <div style={{ height: 1, background: '#111827' }} />

              {/* Position details */}
              <div>
                <div style={{ marginBottom: 12, fontSize: 9, color: '#3a4560', letterSpacing: '0.14em' }}>POSITION DETAILS</div>
                {[
                  { k: 'Leverage', v: '1.5×', c: 'val-amber' },
                  { k: 'Estimated APY', v: `${apy.toFixed(2)}%`, c: 'val-green' },
                  { k: 'Est. USDCx / yr', v: sbtcAmount ? `${estimatedYield} USDCx` : '—', c: '' },
                  { k: 'Borrow Rate', v: '2.46%', c: '' },
                  { k: 'Protocol Fee', v: '0.30%', c: '' },
                  { k: 'Max Leverage', v: '3.00×', c: 'val-amber' },
                ].map(r => (
                  <div key={r.k} className="data-row">
                    <span className="lbl">{r.k}</span>
                    <span className={r.c} style={{ fontSize: 12, color: r.c ? undefined : '#c8d0e0' }}>{r.v}</span>
                  </div>
                ))}
              </div>

              {/* Status messages */}
              {txStatus === 'success' && (
                <div style={{ background: 'rgba(0,212,160,0.06)', border: '1px solid rgba(0,212,160,0.2)', padding: '12px 14px', fontSize: 10, color: '#00d4a0', letterSpacing: '0.08em', animation: 'fadeIn 0.3s ease' }}>
                  ✓ TRANSACTION BROADCAST — AWAITING CONFIRMATION
                </div>
              )}
              {txStatus === 'error' && (
                <div style={{ background: 'rgba(240,82,82,0.06)', border: '1px solid rgba(240,82,82,0.2)', padding: '12px 14px', fontSize: 10, color: '#f05252', letterSpacing: '0.08em' }}>
                  ✗ CHECK WALLET AND RETRY
                </div>
              )}

              {/* CTA */}
              <button onClick={handleDeposit} disabled={txStatus === 'pending'} className="btn-cta" style={{ marginTop: 'auto' }}>
                {txStatus === 'pending' ? (
                  <><div className="spinner" />BROADCASTING...</>
                ) : isConnected ? 'DEPOSIT & BOOST →' : 'CONNECT WALLET TO OPEN POSITION'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 9, color: '#3a4560', letterSpacing: '0.1em' }}>
                SECURED BY STACKS CLARITY CONTRACTS · TESTNET
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
              <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.14em', marginBottom: 8 }}>WITHDRAW.002</div>
              <div style={{ fontSize: 13, color: '#5a6585' }}>No active position</div>
              <div style={{ fontSize: 10, color: '#3a4560', textAlign: 'center', lineHeight: 1.8 }}>Deposit sBTC first to open<br />a leveraged position</div>
              <button onClick={() => setTab('deposit')} style={{ marginTop: 8, padding: '8px 20px', border: '1px solid #1c2235', background: 'none', color: '#5a6585', fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: '"DM Mono",monospace' }}>
                ← BACK TO DEPOSIT
              </button>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Dashboard ─── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Row 1: Position + Yield */}
          <div style={{ borderBottom: '1px solid #111827', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

            {/* My Position */}
            <div style={{ borderRight: '1px solid #111827', padding: 0 }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #111827', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="section-code">▸ POS.001</span>
                  <span className="section-title">My Position</span>
                </div>
                {isConnected && <button onClick={loadBalances} style={{ fontSize: 9, color: '#3a4560', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', fontFamily: '"DM Mono",monospace' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#00d4a0')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#3a4560')}>
                  ↻ REFRESH
                </button>}
              </div>
              <div style={{ padding: '0 20px' }}>
                {[
                  { k: 'sBTC Deposited', v: isConnected ? `${balances.sbtc} sBTC` : '—', c: 'val-amber' },
                  { k: 'Borrowed USDCx', v: isConnected ? `${balances.usdcx} USDCx` : '—', c: 'val-blue' },
                  { k: 'Active Leverage', v: '1.5×', c: 'val-amber' },
                  { k: 'Health Factor', v: '∞', c: 'val-green' },
                  { k: 'STX Balance', v: isConnected ? `${balances.stx} STX` : '—', c: '' },
                ].map(r => (
                  <div key={r.k} className="data-row">
                    <span className="lbl">{r.k}</span>
                    <span className={r.c} style={{ fontSize: 12, color: r.c ? undefined : '#c8d0e0' }}>{loadingBal ? '...' : r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Accrued Yield */}
            <div>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="section-code">▸ YIELD.002</span>
                <span className="section-title">Accrued Yield</span>
              </div>
              <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 9, color: '#3a4560', letterSpacing: '0.14em', marginBottom: 8 }}>CLAIMABLE NOW</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                  <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 38, fontWeight: 300, color: '#00d4a0', letterSpacing: '-0.03em', lineHeight: 1 }}>0.00</span>
                  <span style={{ fontSize: 13, color: '#3a4560', paddingBottom: 4, letterSpacing: '0.06em' }}>USDCx</span>
                </div>
                <div style={{ fontSize: 10, color: '#3a4560', marginBottom: 16 }}>≈ $0.00 USD</div>
                <button disabled style={{ padding: '10px 20px', border: '1px solid #1c2235', background: 'none', color: '#3a4560', fontSize: 10, letterSpacing: '0.1em', fontFamily: '"DM Mono",monospace', cursor: 'not-allowed', opacity: 0.4 }}>
                  CLAIM REWARDS (NO BALANCE)
                </button>
                <div style={{ marginTop: 12, height: 1, background: '#111827' }} />
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span className="lbl">Lifetime Earned</span>
                  <span style={{ fontSize: 11, color: '#c8d0e0' }}>0.00 USDCx</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="lbl">Last Block Update</span>
                  <span style={{ fontSize: 11, color: '#c8d0e0' }}>#147,823</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Loop Stats */}
          <div style={{ borderBottom: '1px solid #111827' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #111827', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="section-code">▸ LOOP.003</span>
              <span className="section-title">Loop Statistics</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#111827' }}>
              {[
                { k: 'TOTAL BORROWED', v: '0.00 USDCx', c: '' },
                { k: 'UTILIZATION', v: '0%', c: '' },
                { k: 'LOOP ROUNDS', v: '0', c: '' },
                { k: 'LIVE APY', v: `${apy.toFixed(2)}%`, c: 'val-green' },
              ].map(s => (
                <div key={s.k} style={{ background: '#070B14', padding: '20px 16px' }}>
                  <div className="lbl" style={{ marginBottom: 8 }}>{s.k}</div>
                  <div className={s.c} style={{ fontSize: 18, fontWeight: 300, color: s.c ? undefined : '#c8d0e0' }}>{s.v}</div>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="lbl">Leverage Utilization</span>
                <span style={{ fontSize: 10, color: '#e0a820', letterSpacing: '0.08em' }}>1.5× / 3.0× MAX</span>
              </div>
              <div style={{ height: 4, background: '#0f1525', borderRadius: 0 }}>
                <div style={{ height: '100%', width: '0%', background: 'linear-gradient(90deg, #e0a820, #f0b830)', transition: 'width 0.5s' }} />
              </div>
            </div>
          </div>

          {/* Row 3: Protocol info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#111827', flex: 1 }}>
            {[
              { code: 'NET.001', title: 'Network', rows: [['Chain', 'Stacks L2'], ['Bitcoin', 'Finality'], ['Environment', 'Testnet']] },
              { code: 'TOK.002', title: 'Tokens', rows: [['Collateral', 'sBTC'], ['Reward', 'USDCx'], ['Fee', '0.30%']] },
              { code: 'SEC.003', title: 'Security', rows: [['Contract', 'Clarity'], ['LTV Max', '65%'], ['Audit', 'Pending']] },
            ].map(p => (
              <div key={p.code} style={{ background: '#070B14', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span className="section-code">▸ {p.code}</span>
                  <span className="section-title">{p.title}</span>
                </div>
                {p.rows.map(([k, v]) => (
                  <div key={k} className="data-row" style={{ padding: '7px 0' }}>
                    <span className="lbl">{k}</span>
                    <span style={{ fontSize: 11, color: '#c8d0e0' }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM TICKER ═══ */}
      <div style={{ height: 32, display: 'flex', alignItems: 'center', background: '#06090f', borderTop: '1px solid #111827' }}>
        <div style={{ padding: '0 12px', borderRight: '1px solid #1c2235', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.14em', color: '#3a4560' }}>SYS</span>
        </div>
        <Ticker />
      </div>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const TICKER_ITEMS = [
  { label: 'sBTC/BTC', val: '1.0000', chg: '0.00%', pos: true },
  { label: 'USDCx/USD', val: '1.0000', chg: 'STABLE', pos: true },
  { label: 'VAULT APY', val: '11.20%', chg: '+2× LEVERAGED', pos: true },
  { label: 'NET YIELD', val: '8.74%', chg: 'AFTER FEES', pos: true },
  { label: 'BORROW RATE', val: '2.46%', chg: 'USDCx/ZEST', pos: false },
  { label: 'TOTAL DEPOSITED', val: '2.84 sBTC', chg: '$295.4K', pos: true },
  { label: 'MAX LEVERAGE', val: '3.00×', chg: 'SAFE LTV', pos: true },
  { label: 'PROTOCOL FEE', val: '0.30%', chg: 'ANNUAL', pos: false },
  { label: 'STX BLOCK', val: '#147,823', chg: '~10 MIN', pos: false },
  { label: 'NETWORK', val: 'TESTNET', chg: 'STACKS L2', pos: false },
];

function Ticker({ reverse = false, speed = 35 }: { reverse?: boolean; speed?: number }) {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div style={{ overflow: 'hidden', width: '100%' }}>
      <div style={{
        display: 'flex', gap: 0,
        animation: `${reverse ? 'tickerRev' : 'ticker'} ${speed}s linear infinite`,
        width: 'max-content',
      }}>
        {items.map((t, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 0,
            borderRight: '1px solid #1c2235',
            padding: '0 20px', height: '100%',
          }}>
            <span style={{ color: '#a1a1aa', fontSize: 10, fontFamily: '"DM Mono",monospace', letterSpacing: '0.06em', marginRight: 8 }}>{t.label}</span>
            <span style={{ color: t.pos ? '#00d4a0' : '#e0a820', fontSize: 11, fontFamily: '"DM Mono",monospace', fontWeight: 500, marginRight: 6 }}>{t.val}</span>
            <span style={{ color: '#8b949e', fontSize: 10, fontFamily: '"DM Mono",monospace' }}>{t.chg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BlinkDot({ color = '#00d4a0' }: { color?: string }) {
  return <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, animation: 'blink 1.4s step-start infinite' }} />;
}

export default function LandingPage() {
  const [time, setTime] = useState('');
  const [apy, setApy] = useState(11.20);

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
    const id = setInterval(() => {
      setApy(prev => +(prev + (Math.random() - 0.5) * 0.04).toFixed(2));
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{
          background:#070B14;color:#f1f5f9;
          font-family:'DM Mono',monospace;overflow-x:hidden;
        }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#070B14}
        ::-webkit-scrollbar-thumb{background:#1c2235;border-radius:2px}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes tickerRev{from{transform:translateX(-50%)}to{transform:translateX(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scanline{from{transform:translateY(-100%)}to{transform:translateY(100vh)}}
        .ticker-wrap{height:32px;display:flex;align-items:center;background:#06090f;border-bottom:1px solid #111827}
        .ticker-wrap-top{border-top:none;border-bottom:1px solid #111827}
        .panel{background:#0a0f1e;border:1px solid #111827;padding:20px 24px}
        .panel-sm{background:#0a0f1e;border:1px solid #111827;padding:16px 20px}
        .data-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #0f1525}
        .data-row:last-child{border-bottom:none}
        .lbl{font-size:10px;color:#8b949e;letter-spacing:0.12em;text-transform:uppercase}
        .val{font-size:13px;color:#f1f5f9;font-weight:500}
        .val-big{font-size:22px;color:#f1f5f9;font-weight:500;letter-spacing:-0.02em}
        .val-green{color:#00d4a0}
        .val-amber{color:#e0a820}
        .val-blue{color:#4a9eff}
        .tag{
          display:inline-block;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;
          padding:3px 8px;border:1px solid;font-family:'DM Mono',monospace;
        }
        .section-header{
          display:flex;align-items:center;gap:10px;
          padding:8px 0;margin-bottom:16px;
          border-bottom:1px solid #111827;
        }
        .section-code{font-size:10px;color:#f1f5f9;letter-spacing:0.14em;font-weight:700}
        .section-title{font-size:12px;color:#f1f5f9;letter-spacing:0.1em;text-transform:uppercase;font-weight:700}
        .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#111827}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#111827}
        .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#111827}
        .btn-cta{
          display:inline-flex;align-items:center;gap:10px;
          background:#e0a820;color:#070B14;
          padding:12px 28px;font-family:'DM Mono',monospace;
          font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;
          text-decoration:none;border:none;cursor:pointer;transition:all 0.2s;
        }
        .btn-cta:hover{background:#f0b830;transform:translateY(-1px)}
        .btn-outline-cta{
          display:inline-flex;align-items:center;gap:10px;
          background:transparent;border:1px solid #1c2235;
          color:#a1a1aa;padding:12px 28px;font-family:'DM Mono',monospace;
          font-size:12px;letter-spacing:0.1em;text-transform:uppercase;
          text-decoration:none;cursor:pointer;transition:all 0.2s;
        }
        .btn-outline-cta:hover{border-color:#8b949e;color:#f1f5f9}
        .step-num{
          font-size:48px;font-weight:300;color:#4b5563;
          letter-spacing:-0.05em;line-height:1;font-family:'DM Mono',monospace;
        }
        .feat-icon{
          width:36px;height:36px;border:1px solid #1c2235;
          display:flex;align-items:center;justify-content:center;font-size:16px;
          margin-bottom:14px;flex-shrink:0;
        }
        .divider{height:1px;background:#111827;border:none;margin:0}
      `}</style>

      {/* ═══ TOP TICKER ═══ */}
      <div className="ticker-wrap">
        <div style={{ padding: '0 12px', borderRight: '1px solid #1c2235', height: '100%', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <BlinkDot color="#00d4a0" />
          <span style={{ fontSize: 9, letterSpacing: '0.16em', color: '#8b949e' }}>LIVE</span>
        </div>
        <Ticker speed={35} />
      </div>

      {/* ═══ NAV ═══ */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 0',
        height: 48, borderBottom: '1px solid #111827',
        background: '#070B14',
        position: 'sticky', top: 32, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', borderRight: '1px solid #111827', padding: '0 20px', gap: 10 }}>
          <div style={{
            width: 26, height: 26, background: '#e0a820',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 500, color: '#070B14',
            clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
            flexShrink: 0,
          }}>₿</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#f1f5f9', letterSpacing: '0.1em' }}>BTCBOOST</div>
            <div style={{ fontSize: 8, color: '#8b949e', letterSpacing: '0.12em' }}>sBTC YIELD VAULT</div>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {[['#protocol', 'PROTOCOL'], ['#why-stacks', 'WHY STACKS'], ['#vault', 'HOW IT WORKS']].map(([href, label]) => (
            <a key={label} href={href} style={{
              height: '100%', padding: '0 20px', display: 'flex', alignItems: 'center',
              fontSize: 10, color: '#8b949e', letterSpacing: '0.1em',
              textDecoration: 'none', borderRight: '1px solid #111827',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.color = '#8b949e')}
            >{label}</a>
          ))}
        </div>

        {/* Right: clock + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <div style={{ padding: '0 20px', borderLeft: '1px solid #111827', height: '100%', display: 'flex', alignItems: 'center', gap: 6 }}>
            <BlinkDot color="#00d4a0" />
            <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: '"DM Mono",monospace' }}>{time} UTC</span>
          </div>
          <Link href="/vault" style={{
            height: '100%', padding: '0 24px', display: 'flex', alignItems: 'center',
            background: '#e0a820', color: '#070B14',
            fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textDecoration: 'none',
            borderLeft: '1px solid #1c2235', transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0b830'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#e0a820'}>
            LAUNCH VAULT →
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{ borderBottom: '1px solid #111827' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', minHeight: 480 }}>

          {/* Left: headline + desc */}
          <div style={{ borderRight: '1px solid #111827', padding: '48px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
                <span className="tag" style={{ color: '#e0a820', borderColor: '#3a2800' }}>sBTC TRACK</span>
                <span className="tag" style={{ color: '#4a9eff', borderColor: '#0d2040' }}>USDCX TRACK</span>
                <span className="tag" style={{ color: '#00d4a0', borderColor: '#003020' }}>BUIDL BATTLE #2</span>
              </div>
              <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.2em', marginBottom: 16 }}>BTCBOOST / PROTOCOL OVERVIEW</div>
              <h1 style={{
                fontFamily: '"Space Grotesk",sans-serif',
                fontSize: 'clamp(32px,4vw,52px)',
                fontWeight: 700, lineHeight: 1.1,
                letterSpacing: '-0.03em', color: '#e8edf5',
                marginBottom: 24, maxWidth: 480,
              }}>
                Idle Bitcoin,<br />
                <span style={{ color: '#e0a820' }}>Amplified Yield.</span>
              </h1>
              <p style={{ fontSize: 13, color: '#f1f5f9', lineHeight: 1.8, maxWidth: 440, fontWeight: 300 }}>
                Deposit sBTC as collateral. The vault borrows USDCx, reinvests into Stacks DeFi pools, and loops — amplifying your yield without ever selling Bitcoin.
              </p>
            </div>

            <div>
              <div className="section-header" style={{ marginTop: 40, marginBottom: 20 }}>
                <span className="section-code">▸ SYS.001</span>
                <span className="section-title">Current APY Feed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 28 }}>
                <span style={{ fontSize: 56, fontWeight: 300, color: '#00d4a0', lineHeight: 1, letterSpacing: '-0.04em', fontFamily: '"DM Mono",monospace' }}>{apy.toFixed(2)}%</span>
                <div style={{ paddingBottom: 6 }}>
                  <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.14em', marginBottom: 4 }}>NET APY</div>
                  <div style={{ fontSize: 9, color: '#00d4a0', letterSpacing: '0.1em' }}>AT 2× LEVERAGE</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Link href="/vault" className="btn-cta">Open Position →</Link>
                <a href="#vault" className="btn-outline-cta">View Mechanics ↓</a>
              </div>
            </div>
          </div>

          {/* Right: live data terminal */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.14em' }}>VAULT / METRICS</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <BlinkDot color="#00d4a0" />
                <span style={{ fontSize: 9, color: '#8b949e' }}>LIVE</span>
              </div>
            </div>
            <div style={{ flex: 1, padding: '8px 0' }}>
              {[
                { k: 'Collateral Token', v: 'sBTC', c: '' },
                { k: 'Reward Token', v: 'USDCx', c: 'val-blue' },
                { k: 'Base Yield', v: '5.20%', c: 'val-green' },
                { k: 'Boosted APY (2×)', v: `${apy.toFixed(2)}%`, c: 'val-green' },
                { k: 'Max Leverage', v: '3.00×', c: 'val-amber' },
                { k: 'LTV Ratio', v: '65%', c: '' },
                { k: 'Borrow Rate (USDCx)', v: '2.46%', c: 'val-amber' },
                { k: 'Protocol Fee', v: '0.30%', c: '' },
                { k: 'Total Deposited', v: '2.84 sBTC', c: '' },
                { k: 'Network', v: 'Stacks Testnet', c: 'val-blue' },
              ].map((row) => (
                <div key={row.k} className="data-row" style={{ padding: '11px 20px' }}>
                  <span className="lbl">{row.k}</span>
                  <span className={`val ${row.c}`} style={{ fontSize: 12 }}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SECOND TICKER (reverse) ═══ */}
      <div className="ticker-wrap" style={{ borderTop: '1px solid #111827' }}>
        <div style={{ padding: '0 12px', borderRight: '1px solid #1c2235', height: '100%', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.14em', color: '#8b949e' }}>MKT</span>
        </div>
        <Ticker reverse speed={50} />
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="vault" style={{ borderBottom: '1px solid #111827' }}>
        <div style={{ padding: '20px 48px', borderBottom: '1px solid #111827', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <div className="section-header" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <span className="section-code">▸ VAULT.002</span>
            <span className="section-title">Mechanism — Leveraged Yield Loop</span>
          </div>
          <span style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.1em', position: 'absolute', right: 48 }}>3 STEPS</span>
        </div>

        <div className="grid-3">
          {[
            { num: '01', icon: '₿', title: 'DEPOSIT sBTC', color: '#e0a820', lines: ['Lock idle BTC as sBTC on', 'the Stacks network. Your', 'Bitcoin never leaves the vault.', 'No bridging. No wrapping.'] },
            { num: '02', icon: '⚡', title: 'VAULT LOOPS', color: '#00d4a0', lines: ['Vault posts sBTC as collateral,', 'borrows USDCx from Zest Protocol,', 'deploys into ALEX yield pools,', 'reinvests — all on-chain.'] },
            { num: '03', icon: '$', title: 'CLAIM USDCx', color: '#4a9eff', lines: ['Amplified stablecoin yield', 'accrues every block (~10 min).', 'Withdraw sBTC + USDCx', 'earnings at any time.'] },
          ].map((step, idx) => (
            <div key={step.num} style={{ background: '#070B14', padding: '40px 36px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: 24, top: 16, fontSize: 64, color: '#0d1120', fontWeight: 300, lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none', fontFamily: '"DM Mono",monospace' }}>{step.num}</div>
              <div style={{ width: 36, height: 36, border: `1px solid ${step.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 16 }}>{step.icon}</div>
              <div style={{ fontSize: 9, color: step.color, letterSpacing: '0.16em', marginBottom: 10 }}>{step.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {step.lines.map((l, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#f1f5f9', lineHeight: 1.6 }}>{l}</div>
                ))}
              </div>
              {idx < 2 && <div style={{ position: 'absolute', right: -1, top: '50%', fontSize: 16, color: '#1c2235', transform: 'translateY(-50%)', zIndex: 2 }}>▶</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ WHY STACKS ═══ */}
      <section id="why-stacks" style={{ borderBottom: '1px solid #111827' }}>
        <div style={{ padding: '16px 48px', borderBottom: '1px solid #111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-header" style={{ marginBottom: 0 }}>
            <span className="section-code">▸ CHAIN.003</span>
            <span className="section-title">Why Stacks — Bitcoin-Secured L2</span>
          </div>
        </div>

        <div className="grid-2">
          {[
            { code: 'SEC.001', title: 'Bitcoin Finality', color: '#e0a820', desc: 'Every Stacks block is anchored to a Bitcoin block. BTCBoost transactions inherit the full security of Bitcoin proof-of-work — not just a multi-sig bridge or wrapped asset.' },
            { code: 'ASSET.002', title: 'Real sBTC — Not a Wrap', color: '#00d4a0', desc: 'sBTC is a 1:1 BTC-backed asset native to Stacks. No bridge risk, no counterparty custodian. Redeemable for real BTC on Bitcoin mainnet at any time.' },
            { code: 'CODE.003', title: 'Clarity Smart Contracts', color: '#4a9eff', desc: 'BTCBoost runs on Clarity — Stacks\' decidable language. Unlike Solidity, Clarity functions are readable on-chain before execution. No hidden rug vectors.' },
            { code: 'TRACK.004', title: 'Dual Hackathon Tracks', color: '#b794f4', desc: 'This protocol directly participates in both the sBTC track (productive idle Bitcoin) and the USDCx track (stable, dollar-denominated yield) at BUIDL Battle #2.' },
          ].map(f => (
            <div key={f.code} style={{ background: '#070B14', padding: '36px 40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 9, color: f.color, letterSpacing: '0.14em' }}>{f.code}</span>
              </div>
              <div style={{ fontSize: 16, fontFamily: '"Space Grotesk",sans-serif', fontWeight: 600, color: '#f1f5f9', marginBottom: 12, letterSpacing: '-0.01em' }}>{f.title}</div>
              <p style={{ fontSize: 12, color: '#f1f5f9', lineHeight: 1.8, fontWeight: 300 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PROTOCOL STATS ═══ */}
      <section id="protocol" style={{ borderBottom: '1px solid #111827' }}>
        <div style={{ padding: '16px 48px', borderBottom: '1px solid #111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-header" style={{ marginBottom: 0 }}>
            <span className="section-code">▸ DATA.004</span>
            <span className="section-title">Protocol — Live Statistics</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <BlinkDot />
            <span style={{ fontSize: 9, color: '#8b949e' }}>UPDATING</span>
          </div>
        </div>

        <div className="grid-4">
          {[
            { label: 'TOTAL VALUE LOCKED', val: '$295.4K', sub: '2.84 sBTC', color: '#f1f5f9' },
            { label: 'BOOSTED NET APY', val: `${apy.toFixed(2)}%`, sub: 'at 2× leverage', color: '#00d4a0' },
            { label: 'MAX MULT', val: '3.00×', sub: 'safe LTV enforced', color: '#e0a820' },
            { label: 'REWARD TOKEN', val: 'USDCx', sub: 'circle · stacks', color: '#4a9eff' },
          ].map(s => (
            <div key={s.label} style={{ background: '#070B14', padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.14em', marginBottom: 12 }}>{s.label}</div>
              <div style={{ fontSize: 36, fontWeight: 300, color: s.color, letterSpacing: '-0.03em', fontFamily: '"DM Mono",monospace', lineHeight: 1, marginBottom: 8 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: '0.1em' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 300px' }}>
        <div style={{ padding: '56px 48px', borderRight: '1px solid #111827' }}>
          <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.2em', marginBottom: 12 }}>▸ CTA.005 — INITIATE POSITION</div>
          <h2 style={{ fontFamily: '"Space Grotesk",sans-serif', fontSize: 'clamp(26px,3vw,42px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#e8edf5', lineHeight: 1.1, marginBottom: 14 }}>
            Start earning<br />amplified Bitcoin yield.
          </h2>
          <p style={{ fontSize: 12, color: '#f1f5f9', lineHeight: 1.8, maxWidth: 380 }}>
            Connect Leather or Xverse wallet. Deposit any amount of sBTC. Choose leverage. One click and the vault handles the rest.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid #111827' }}>
          <Link href="/vault" style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, background: '#e0a820', textDecoration: 'none', padding: 32,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0b830'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#e0a820'}>
            <span style={{ fontSize: 20, fontFamily: '"DM Mono",monospace', fontWeight: 300, color: '#070B14' }}>→</span>
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', color: '#070B14' }}>LAUNCH VAULT</span>
          </Link>
          <div style={{ padding: '20px', borderTop: '1px solid #1c2235', background: '#0a0f1e', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
              <BlinkDot color="#00d4a0" />
              <span style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.12em' }}>LIVE ON STACKS TESTNET</span>
            </div>
            <div style={{ fontSize: 9, color: '#8b949e', letterSpacing: '0.1em' }}>BUIDL BATTLE #2 · sBTC + USDCx</div>
          </div>
        </div>
      </section>

      {/* ═══ BOTTOM TICKER ═══ */}
      <div className="ticker-wrap" style={{ borderTop: '1px solid #111827', borderBottom: 'none' }}>
        <div style={{ padding: '0 12px', borderRight: '1px solid #1c2235', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.14em', color: '#8b949e' }}>SYS</span>
        </div>
        <Ticker speed={28} />
      </div>
    </>
  );
}

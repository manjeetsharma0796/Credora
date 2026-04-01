# 📋 Project Validation — BTC Boost Vault

---

## 🏷️ Basic Info

| Field | Value |
|-------|-------|
| **Project Name** | BTC Boost Vault |
| **Team Members** | Manjeet Sharma (full-stack / smart contracts) |
| **Track** | DeFi |
| **Using sBTC?** | ✅ Yes — sBTC is the primary collateral asset deposited into the vault |
| **Using USDCx?** | ✅ Yes — USDCx is borrowed against sBTC collateral and earned as yield |
| **Using STX?** | ✅ Yes — STX is used to pay Stacks network transaction fees |

---

## 🎯 Problem Statement

```
Bitcoin holders earn zero native yield — the only options are to sell BTC, wrap it on 
a foreign chain, or lock it in custodial products with counterparty risk.
```

---

## 💡 Your Solution

```
BTC Boost Vault is a one-click, non-custodial leveraged yield vault on Stacks (Bitcoin L2).

Users deposit sBTC (Bitcoin-backed token), which the vault uses as collateral to 
automatically borrow USDCx at 1.5× leverage, loop the position, and stream USDCx 
yield back to the depositor — all without ever selling their Bitcoin.

Who uses it: Bitcoin holders who want passive USD-denominated yield on their BTC.
What they do: Connect wallet → Deposit sBTC → Approve 2 transactions → Watch yield accrue → Claim USDCx.
```

---

## 🔧 Tech Stack

| Component | What Was Used |
|-----------|--------------|
| Smart Contracts | Clarity (Stacks L2) — `sbtc-usdcx-vault`, `mock-sbtc`, `mock-usdcx` |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Wallet Integration | Leather & Xverse via `@stacks/connect` v7 |
| Backend | None — read-only data fetched directly from Hiro testnet API |
| Other Tools | `@stacks/transactions` for contract calls, Hiro Explorer for tx verification |

---

## 🔄 User Flow

1. **Connect wallet** — User installs Leather or Xverse, switches to Stacks Testnet, and clicks _Connect Wallet_. The UI shows their STX / sBTC / USDCx balances once connected.
2. **Deposit sBTC** — User enters an sBTC amount (e.g. `0.01`) and reviews the position preview (leverage factor, estimated APY, estimated USDCx yield per year).
3. **Boost Yield (2 transactions)** — User clicks _Boost & Earn_. Their wallet pops up twice: first to sign the `deposit-sbtc` transaction, then to sign the `boost-yield` transaction that activates the 1.5× leverage loop.
4. **Wait for yield to accrue** — USDCx rewards accumulate roughly every Stacks block (~10 min). The dashboard auto-refreshes every 30 s.
5. **Claim USDCx** — Once claimable balance is non-zero, user clicks _Claim USDCx_. One wallet popup approves the `claim-yield` transaction and the USDCx lands in their wallet.
6. *(Optional)* **Withdraw sBTC** — User clicks _Withdraw All_ in the Deposit step to close the position and return their sBTC.

---

## ✅ Current Status

- [x] Smart contracts deployed to testnet
  - Vault: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-usdcx-vault`
  - Mock sBTC: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sbtc`
  - Mock USDCx: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-usdcx`
- [x] Frontend functional (Next.js, live at `npm run dev`)
- [x] Wallet connection working (Leather & Xverse on Stacks Testnet)
- [x] sBTC integration complete (deposit + withdraw flows)
- [x] USDCx integration complete (borrow on boost, claim yield)
- [x] STX used for gas on all contract calls
- [x] README written with end-to-end demo flow
- [x] Input validation and UX edge-case guards implemented
- [x] Testnet faucet links added to the app UI

**Blockers:**

```
None at the time of submission.
Testnet only — switching to mainnet requires changing STACKS_TESTNET → STACKS_MAINNET
in src/lib/stacks.ts and replacing mock contract IDs with production ones.
```

---

## 🎥 Demo Links

| Resource | URL |
|----------|-----|
| Live Demo | `http://localhost:3000` (run `npm install && npm run dev`) |
| GitHub Repo | https://github.com/manjeetsharma0796/Credora |
| Video Demo | *(record using the 8-step flow in `README.md`)* |
| Vault Contract | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-usdcx-vault` |
| Mock sBTC | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sbtc` |
| Mock USDCx | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-usdcx` |

---

## ❓ Specific Questions for Feedback

```
1. Is the sBTC deposit flow secure? Specifically: we use PostConditionMode.Allow on all 
   contract calls — should we add explicit post-conditions instead?

2. Does this use case make sense for USDCx? We borrow USDCx against sBTC collateral 
   and pay it back when the user withdraws. Is this a valid USDCx DeFi integration?

3. Leverage safety: we default to 1.5× (150 basis points in the contract). 
   What's the recommended max safe LTV ratio for sBTC collateral on Stacks testnet?

4. Clarity contract not in repo — we pre-deployed on testnet. Should we include 
   the Clarity source files in the my-stacks-contracts/ directory for review?
```

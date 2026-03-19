## BTC Boost Vault — sBTC Collateral and STX Borrowing on Stacks

This is a custom [Next.js](https://nextjs.org) app that lets users deposit real sBTC as collateral and borrow/repay STX on Stacks testnet.

---

## Tech stack

- **Framework**: Next.js App Router
- **Chain**: Stacks Testnet
- **Wallets**: Leather / Xverse via `@stacks/connect`
- **Contracts helper**: `src/lib/stacks.ts`

Key on‑chain config (testnet):

- **Vault contract**: `ST14RA6VWTZJF2ZNK3G83A40BC0CBK31MCAEGS1HX.credora-vault`
- **sBTC token**: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-token`

---

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in a browser with **Leather** or **Xverse** installed and switched to **Stacks Testnet**.

---

## End‑to‑end testnet demo flow

This is the exact flow to record a 1–2 minute demo video.

1. **Prepare wallets + funds**
   - Install **Leather** or **Xverse** and switch network to **Stacks Testnet**.
   - Fund the address with:
     - A small amount of **testnet STX** (for gas).
   - Some **sBTC** (for collateral) and **STX** (for gas and repay).

2. **Launch the app**
   - Start the dev server (`npm run dev`) or open your deployed URL.
   - Go to the landing page and click **“Launch Vault”** to reach `/vault`.

3. **Connect wallet**
   - In the left sidebar, click **CONNECT WALLET**.
   - Approve the connection in Leather/Xverse.
   - Confirm the UI shows:
     - Green **CONNECTED** badge.
   - Your **STX / sBTC** balances.

4. **Deposit sBTC**
   - In the stepper, go to **STEP 02 — Deposit sBTC**.
   - Enter a small amount of sBTC (e.g. `0.01`).
   - Click **CONTINUE TO BORROW** to move to the borrow step.

5. **Borrow (two transactions)**
   - In **STEP 03 — Borrow STX** press **DEPOSIT + BORROW**.
   - Your wallet will show **two popups**:
     1. **Deposit sBTC** (`deposit-sbtc`).
     2. **Borrow STX** (`borrow-stx`).
   - Approve both; the bottom‑right toast will show **TX BROADCAST** with a link to the Hiro explorer.

6. **Check dashboard state**
   - After a few blocks, hit **↻ REFRESH** in the sidebar.
   - Confirm:
   - `Your Position` shows **deposited sBTC**, **borrowed STX**, and **LTV**.
   - `Interest owed` updates over time.

7. **Repay debt**
   - Switch to **STEP 04 — Repay STX**.
   - Enter a repay amount (or max total owed) and submit **REPAY STX**.
   - Approve the wallet popup and confirm on Hiro explorer.

8. **Withdraw sBTC (optional)**
   - Go back to **STEP 02** and click **↑ WITHDRAW ALL**.
   - Approve the wallet transaction; once confirmed, your vault position should show **0 sBTC deposited**.

---

## Error handling / gotchas

- If the user **rejects a transaction**, the UI will show a red error banner in the borrow / repay steps.
- If the wallet is **not connected**, the app:
  - Hides on‑chain balances.
  - Suggests **STEP 01** as the next action in the top progress indicator.
- All contract interactions are on **Stacks Testnet**; mainnet will not work without changing `STACKS_TESTNET` in `src/lib/stacks.ts`.

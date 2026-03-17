## BTC Boost Vault — One‑Click sBTC Leveraged Yield on Stacks

This is a custom [Next.js](https://nextjs.org) app that lets users deposit sBTC, automatically borrow USDCx against it on Stacks testnet, and loop the position to earn amplified USDCx yield — without ever selling Bitcoin.

---

## Tech stack

- **Framework**: Next.js App Router
- **Chain**: Stacks Testnet
- **Wallets**: Leather / Xverse via `@stacks/connect`
- **Contracts helper**: `src/lib/stacks.ts`

Key on‑chain config (testnet):

- **Vault contract**: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sbtc-usdcx-vault`
- **Mock sBTC token**: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sbtc`
- **Mock USDCx token**: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-usdcx`

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
     - Some **mock sBTC** and **mock USDCx** that correspond to the contracts above.

2. **Launch the app**
   - Start the dev server (`npm run dev`) or open your deployed URL.
   - Go to the landing page and click **“Launch Vault”** to reach `/vault`.

3. **Connect wallet**
   - In the left sidebar, click **CONNECT WALLET**.
   - Approve the connection in Leather/Xverse.
   - Confirm the UI shows:
     - Green **CONNECTED** badge.
     - Your **STX / sBTC / USDCx** balances.

4. **Deposit sBTC**
   - In the stepper, go to **STEP 02 — Deposit sBTC**.
   - Enter a small amount of sBTC (e.g. `0.01`) and review the **POSITION PREVIEW** card.
   - Click **CONTINUE TO BOOST →** to move to the boost step.

5. **Boost (two transactions)**
   - In **STEP 03 — Confirm & Boost** press **BOOST & EARN →**.
   - Your wallet will show **two popups**:
     1. **Deposit sBTC** (`deposit-sbtc`).
     2. **Boost yield** (`boost-yield`).
   - Approve both; the bottom‑right toast will show **TX BROADCAST** with a link to the Hiro explorer.

6. **Check dashboard state**
   - After a few blocks, hit **↻ REFRESH** in the sidebar.
   - Confirm:
     - `Your Position` shows **deposited sBTC** and **borrowed USDCx**.
     - `Accrued Yield` in **USDCx** starts to grow over time.

7. **Claim rewards**
   - Switch to **STEP 04 — Rewards**.
   - When **CLAIMABLE NOW** is non‑zero, click **CLAIM … USDCx →**.
   - Approve the wallet popup; verify the claim transaction in Hiro explorer and see your **USDCx wallet balance** increase.

8. **Withdraw sBTC (optional)**
   - Go back to **STEP 02** and click **↑ WITHDRAW ALL**.
   - Approve the wallet transaction; once confirmed, your vault position should show **0 sBTC deposited**.

---

## Error handling / gotchas

- If the user **rejects a transaction**, the UI will show a red error banner in the Boost / Claim steps.
- If the wallet is **not connected**, the app:
  - Hides on‑chain balances.
  - Suggests **STEP 01** as the next action in the top progress indicator.
- All contract interactions are on **Stacks Testnet**; mainnet will not work without changing `STACKS_TESTNET` in `src/lib/stacks.ts`.


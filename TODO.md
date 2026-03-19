## BTC Boost Vault — Implementation TODO

- [x] **Landing page UI**
  - Hero, tickers, protocol sections, CTA wired to `vault` route.

- [x] **Vault dashboard UI**
  - Multi-step terminal-style flow for connect → deposit → boost → claim.

- [x] **Stacks wallet integration**
  - `@stacks/connect` wired with `UserSession`, `authenticate`, and `disconnect`.

- [x] **Contract wiring for core flows**
  - `deposit-sbtc`, `boost-yield`, `claim-yield`, `withdraw-sbtc` hooked to `openContractCall`.
  - `get-vault-info` wired via `fetchCallReadOnlyFunction`.

- [x] **Basic balances + vault state**
  - Fetch STX / sBTC / USDCx balances from Hiro testnet APIs.
  - Display user-specific vault info (deposited, borrowed, accrued yield).

- [x] **End‑to‑end testnet demo checklist**
  - Verify connect with Leather and/or Xverse on testnet.
  - Run through: deposit → boost → claim → withdraw using deployed contract.
  - Add helpful error messages for network / contract failures.

- [x] **UX polish for failure / edge cases**
  - Show explicit banner when wallet is not installed or user rejects connection.
  - Guard against zero balances / invalid input (NaN, very small amounts).
  - Add small helper text + links to get testnet STX, sBTC, USDCx.

- [x] **Configuration & docs**
  - Document contract address / name and token contract IDs in `README`.
  - Add short “How to demo” section with step‑by‑step flow.
  - Add `VALIDATION.md` with full project validation template filled out.

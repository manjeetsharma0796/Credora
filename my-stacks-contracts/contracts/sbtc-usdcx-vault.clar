;; sbtc-usdcx-vault - Leveraged Yield Vault for BTCBoost
;;
;; Users deposit sBTC as collateral, the vault simulates borrowing USDCx
;; at a given leverage factor, and accrues yield in USDCx over time.
;;
;; Flow: deposit-sbtc -> boost-yield -> (time passes) -> claim-yield / withdraw-sbtc

;; --- Constants ---
(define-constant ERR_NO_VAULT (err u1001))
(define-constant ERR_ALREADY_BOOSTED (err u1002))
(define-constant ERR_NOT_BOOSTED (err u1003))
(define-constant ERR_ZERO_AMOUNT (err u1004))
(define-constant ERR_INSUFFICIENT_DEPOSIT (err u1005))
(define-constant ERR_INVALID_LEVERAGE (err u1006))
(define-constant ERR_NO_YIELD (err u1007))

;; Yield rate: 520 basis points (5.20% APY), per-block approximation
;; Stacks produces ~1 block/10min -> ~52,560 blocks/year
;; yield-per-block = deposited * leverage * 0.052 / 52560  (simplified)
;; We use a numerator/denominator approach for integer math:
;;   yield = deposited-sbtc * leverage / YIELD_DENOMINATOR per block
;; This gives roughly 5.2% annualized at 1x leverage
(define-constant YIELD_DENOMINATOR u1010770) ;; ~ 52560 / 0.052 scaled for 8-decimal sBTC

;; LTV cap: 65% - max borrow = collateral * 65 / 100  (in USD terms)
;; For simplicity, 1 sBTC ~ $104,000 and 1 USDCx = $1
;; So max USDCx borrow per 1e8 sats sBTC = 104000 * 0.65 * 1e6 = 67,600,000,000 micro-USDCx
;; At max leverage 3x, borrow = collateral_value * (leverage - 100) / 100
(define-constant SBTC_PRICE_USD u104000)  ;; sBTC price in whole USD (updatable in v2)
(define-constant MAX_LEVERAGE u300)       ;; 3.00x expressed as percentage (300 = 3x)
(define-constant MIN_LEVERAGE u100)       ;; 1.00x (no leverage, but still valid)
(define-constant PROTOCOL_FEE_BPS u30)    ;; 0.30% protocol fee on deposits

;; --- Data Maps ---

;; Per-user vault position
(define-map vaults
  principal
  {
    deposited-sbtc: uint,   ;; in sats (8 decimals)
    borrowed-usdcx: uint,   ;; in micro-USDCx (6 decimals)
    accrued-yield:  uint,   ;; accumulated USDCx yield (6 decimals)
    leverage:       uint,   ;; leverage in percentage (e.g. 150 = 1.5x)
    boosted:        bool,   ;; whether boost has been activated
    last-update:    uint    ;; block height of last yield accrual
  }
)

;; Protocol treasury for fees
(define-data-var protocol-treasury uint u0)
(define-data-var total-deposited uint u0)

;; --- Private Helpers ---

;; Calculate yield accrued since last update
(define-private (calculate-yield (deposited uint) (leverage uint) (last-block uint) (current-block uint))
  (let (
    (blocks-elapsed (- current-block last-block))
    ;; yield = deposited * leverage / 100 * blocks-elapsed * YIELD_NUMERATOR / YIELD_DENOMINATOR
    ;; Convert sBTC yield (8 dec) to USDCx (6 dec): multiply by price, divide by 1e2
    ;; Simplified: yield_usdcx = deposited * leverage * blocks * SBTC_PRICE_USD / (100 * YIELD_DENOMINATOR * 100)
    (raw-yield (/ (* (* deposited leverage) blocks-elapsed) (* u100 YIELD_DENOMINATOR)))
    ;; Convert from sBTC-denominated to USDCx micro-units
    ;; raw-yield is in sats, convert: sats * price / 1e2 (adjust 8dec->6dec)
    (yield-usdcx (/ (* raw-yield SBTC_PRICE_USD) u100))
  )
    yield-usdcx
  )
)

;; Update accrued yield for a user
(define-private (accrue-yield (user principal) (current-block uint))
  (match (map-get? vaults user)
    vault
      (if (and (get boosted vault) (> (get deposited-sbtc vault) u0) (> current-block (get last-update vault)))
        (let (
          (new-yield (calculate-yield
            (get deposited-sbtc vault)
            (get leverage vault)
            (get last-update vault)
            current-block))
        )
          (map-set vaults user
            (merge vault {
              accrued-yield: (+ (get accrued-yield vault) new-yield),
              last-update: current-block
            })
          )
          true
        )
        true
      )
    true
  )
)

;; --- Public Functions ---

;; 1. Deposit sBTC into the vault
;; Called as: deposit-sbtc(amount: uint, token-id: principal)
(define-public (deposit-sbtc (amount uint) (token-id principal))
  (let (
    (user tx-sender)
    (fee (/ (* amount PROTOCOL_FEE_BPS) u10000))
    (net-amount (- amount fee))
    (existing (default-to
      { deposited-sbtc: u0, borrowed-usdcx: u0, accrued-yield: u0, leverage: u0, boosted: false, last-update: u0 }
      (map-get? vaults user)))
  )
    ;; Validate
    (asserts! (> amount u0) ERR_ZERO_AMOUNT)

    ;; Transfer sBTC from user to vault contract
    (try! (contract-call? .mock-sbtc-v2 transfer
      amount user tx-sender none))

    ;; Accrue any existing yield before updating deposit
    (accrue-yield user burn-block-height)

    ;; Update vault position
    (map-set vaults user
      (merge existing {
        deposited-sbtc: (+ (get deposited-sbtc existing) net-amount),
        last-update: burn-block-height
      })
    )

    ;; Track protocol fee and TVL
    (var-set protocol-treasury (+ (var-get protocol-treasury) fee))
    (var-set total-deposited (+ (var-get total-deposited) net-amount))

    (print { event: "deposit", user: user, amount: amount, fee: fee, net: net-amount, token-id: token-id })
    (ok true)
  )
)

;; 2. Boost yield - activate the leverage loop
;; Called as: boost-yield(leverage: uint)
;; leverage is a percentage: 150 = 1.5x, 200 = 2x, 300 = 3x
(define-public (boost-yield (leverage uint))
  (let (
    (user tx-sender)
    (vault (unwrap! (map-get? vaults user) ERR_NO_VAULT))
  )
    ;; Validate
    (asserts! (> (get deposited-sbtc vault) u0) ERR_NO_VAULT)
    (asserts! (not (get boosted vault)) ERR_ALREADY_BOOSTED)
    (asserts! (>= leverage MIN_LEVERAGE) ERR_INVALID_LEVERAGE)
    (asserts! (<= leverage MAX_LEVERAGE) ERR_INVALID_LEVERAGE)

    ;; Calculate borrowed USDCx based on leverage
    ;; borrow = collateral_sats * (leverage - 100) / 100 * SBTC_PRICE_USD / 100
    ;; The /100 at the end converts from 8-decimal sBTC to 6-decimal USDCx
    (let (
      (collateral (get deposited-sbtc vault))
      (borrow-usdcx (/ (* (/ (* collateral (- leverage u100)) u100) SBTC_PRICE_USD) u100))
    )
      ;; Mint borrowed USDCx to the vault (simulating a lending protocol)
      (try! (contract-call? .mock-usdcx-v2 mint
        borrow-usdcx tx-sender))

      ;; Update vault state
      (map-set vaults user
        (merge vault {
          borrowed-usdcx: borrow-usdcx,
          leverage: leverage,
          boosted: true,
          last-update: burn-block-height
        })
      )

      (print { event: "boost", user: user, leverage: leverage, borrowed: borrow-usdcx })
      (ok true)
    )
  )
)

;; 3. Claim accrued USDCx yield
;; Called as: claim-yield(token-id: principal)
(define-public (claim-yield (token-id principal))
  (let (
    (user tx-sender)
  )
    ;; Accrue latest yield
    (accrue-yield user burn-block-height)

    (let (
      (vault (unwrap! (map-get? vaults user) ERR_NO_VAULT))
      (yield-amount (get accrued-yield vault))
    )
      ;; Must have yield to claim
      (asserts! (> yield-amount u0) ERR_NO_YIELD)
      (asserts! (get boosted vault) ERR_NOT_BOOSTED)

      ;; Mint USDCx yield to user (simulating yield from DeFi pools)
      (try! (contract-call? .mock-usdcx-v2 mint
        yield-amount user))

      ;; Reset accrued yield
      (map-set vaults user
        (merge vault {
          accrued-yield: u0,
          last-update: burn-block-height
        })
      )

      (print { event: "claim", user: user, yield: yield-amount, token-id: token-id })
      (ok true)
    )
  )
)

;; 4. Withdraw sBTC from the vault
;; Called as: withdraw-sbtc(amount: uint, token-id: principal)
(define-public (withdraw-sbtc (amount uint) (token-id principal))
  (let (
    (user tx-sender)
  )
    ;; Accrue yield before withdrawal
    (accrue-yield user burn-block-height)

    (let (
      (vault (unwrap! (map-get? vaults user) ERR_NO_VAULT))
      (deposited (get deposited-sbtc vault))
    )
      ;; Validate
      (asserts! (> amount u0) ERR_ZERO_AMOUNT)
      (asserts! (<= amount deposited) ERR_INSUFFICIENT_DEPOSIT)

      ;; Transfer sBTC back to user
      (try! (contract-call? .mock-sbtc-v2 transfer
        amount tx-sender user none))

      ;; If full withdrawal, close the vault position
      (if (is-eq amount deposited)
        (begin
          ;; Return any remaining borrowed USDCx state (burn simulation)
          (map-set vaults user
            { deposited-sbtc: u0, borrowed-usdcx: u0, accrued-yield: u0, leverage: u0, boosted: false, last-update: burn-block-height }
          )
          (var-set total-deposited (- (var-get total-deposited) amount))
        )
        (begin
          ;; Partial withdrawal - reduce deposit proportionally
          (let (
            (remaining (- deposited amount))
            (ratio (/ (* (get borrowed-usdcx vault) remaining) deposited))
          )
            (map-set vaults user
              (merge vault {
                deposited-sbtc: remaining,
                borrowed-usdcx: ratio,
                last-update: burn-block-height
              })
            )
          )
          (var-set total-deposited (- (var-get total-deposited) amount))
        )
      )

      (print { event: "withdraw", user: user, amount: amount, token-id: token-id })
      (ok true)
    )
  )
)

;; --- Read-Only Functions ---

;; Get vault info for a user (matches frontend VaultInfo interface)
(define-read-only (get-vault-info (user principal))
  (match (map-get? vaults user)
    vault
      (let (
        ;; Calculate pending yield without mutating state
        (pending (if (and (get boosted vault) (> (get deposited-sbtc vault) u0) (> burn-block-height (get last-update vault)))
          (calculate-yield (get deposited-sbtc vault) (get leverage vault) (get last-update vault) burn-block-height)
          u0))
      )
        (ok {
          deposited-sbtc: (get deposited-sbtc vault),
          borrowed-usdcx: (get borrowed-usdcx vault),
          accrued-yield: (+ (get accrued-yield vault) pending),
          last-update: (get last-update vault)
        })
      )
    (ok {
      deposited-sbtc: u0,
      borrowed-usdcx: u0,
      accrued-yield: u0,
      last-update: u0
    })
  )
)

;; Get total value locked in the vault (in sBTC sats)
(define-read-only (get-total-deposited)
  (ok (var-get total-deposited))
)

;; Get protocol treasury balance (fees collected in sBTC sats)
(define-read-only (get-protocol-treasury)
  (ok (var-get protocol-treasury))
)

;; Check if a user has an active boosted position
(define-read-only (is-boosted (user principal))
  (match (map-get? vaults user)
    vault (ok (get boosted vault))
    (ok false)
  )
)

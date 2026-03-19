;; credora-vault - sBTC-collateralized STX borrowing vault
;; Real assets: sBTC collateral + STX borrow/repay

(define-constant CONTRACT_OWNER 'ST14RA6VWTZJF2ZNK3G83A40BC0CBK31MCAEGS1HX)
(define-constant VAULT_PRINCIPAL 'ST14RA6VWTZJF2ZNK3G83A40BC0CBK31MCAEGS1HX.credora-vault)

(define-constant ERR-NOT-OWNER        (err u100))
(define-constant ERR-ZERO-AMOUNT      (err u101))
(define-constant ERR-NO-VAULT         (err u102))
(define-constant ERR-INSUFFICIENT     (err u104))
(define-constant ERR-BELOW-LTV        (err u105))
(define-constant ERR-NOT-LIQUIDATABLE (err u107))
(define-constant ERR-NO-LIQUIDITY     (err u108))

;; LTV constants in basis points (10000 = 100%)
(define-constant MAX-LTV       u7000)
(define-constant LIQ-THRESHOLD u8500)
(define-constant LIQ-BONUS     u500)
(define-constant INTEREST-RATE u200)
(define-constant RATE-PERIOD   u144)

;; 1 sBTC price in micro-STX
(define-data-var sbtc-price-ustx uint u52000000000)

;; Token interface for sBTC-compatible SIP-010 contracts
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

;; Protocol state
(define-data-var total-stx-liquidity uint u0)
(define-data-var total-sbtc-locked uint u0)
(define-data-var total-stx-borrowed uint u0)
(define-data-var protocol-fees uint u0)

;; Per-user vault
(define-map vaults principal
  {
    sbtc-deposited: uint,
    stx-borrowed: uint,
    interest-owed: uint,
    last-block: uint,
    is-open: bool
  }
)

;; STX lender positions
(define-map lender-deposits principal uint)

;; --- Helpers ---

(define-private (get-vault-or-default (user principal))
  (default-to
    { sbtc-deposited: u0, stx-borrowed: u0, interest-owed: u0, last-block: u0, is-open: false }
    (map-get? vaults user)
  )
)

(define-private (get-ltv (sbtc-sats uint) (stx-owed uint))
  (let ((collateral-ustx (/ (* sbtc-sats (var-get sbtc-price-ustx)) u100000000)))
    (if (is-eq collateral-ustx u0)
      u0
      (/ (* stx-owed u10000) collateral-ustx)
    )
  )
)

(define-private (accrue-interest (user principal))
  (let ((vault (get-vault-or-default user)))
    (if (and (get is-open vault) (> (get stx-borrowed vault) u0) (> burn-block-height (get last-block vault)))
      (let
        (
          (blocks-elapsed (- burn-block-height (get last-block vault)))
          (periods (/ blocks-elapsed RATE-PERIOD))
          (new-interest (/ (* (get stx-borrowed vault) (* INTEREST-RATE periods)) u10000))
        )
        (map-set vaults user
          (merge vault {
            interest-owed: (+ (get interest-owed vault) new-interest),
            last-block: burn-block-height
          })
        )
        true
      )
      true
    )
  )
)

;; --- Lender ---

(define-public (deposit-stx-liquidity (amount uint))
  (begin
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (try! (stx-transfer? amount tx-sender VAULT_PRINCIPAL))
    (map-set lender-deposits tx-sender
      (+ (default-to u0 (map-get? lender-deposits tx-sender)) amount)
    )
    (var-set total-stx-liquidity (+ (var-get total-stx-liquidity) amount))
    (print { event: "lender-deposit", lender: tx-sender, amount: amount })
    (ok amount)
  )
)

;; --- Borrower ---

(define-public (deposit-sbtc (amount uint) (token-id <sip-010-trait>))
  (let (
    (user tx-sender)
    (vault (get-vault-or-default tx-sender))
    (vault-principal VAULT_PRINCIPAL)
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    (try! (contract-call? token-id transfer amount user vault-principal none))

    (accrue-interest user)

    (let ((updated (get-vault-or-default user)))
      (map-set vaults user
        (merge updated {
          sbtc-deposited: (+ (get sbtc-deposited updated) amount),
          last-block: burn-block-height,
          is-open: true
        })
      )
    )

    (var-set total-sbtc-locked (+ (var-get total-sbtc-locked) amount))
    (print { event: "deposit-sbtc", user: user, amount: amount })
    (ok amount)
  )
)

(define-public (borrow-stx (amount uint))
  (let (
    (user tx-sender)
    (vault (unwrap! (map-get? vaults tx-sender) ERR-NO-VAULT))
  )
    (asserts! (get is-open vault) ERR-NO-VAULT)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= (var-get total-stx-liquidity) amount) ERR-NO-LIQUIDITY)

    (accrue-interest user)

    (let
      (
        (updated-vault (unwrap! (map-get? vaults user) ERR-NO-VAULT))
        (total-owed (+ (get stx-borrowed updated-vault) (get interest-owed updated-vault) amount))
        (new-ltv (get-ltv (get sbtc-deposited updated-vault) total-owed))
      )
      (asserts! (<= new-ltv MAX-LTV) ERR-BELOW-LTV)

      (try! (stx-transfer? amount VAULT_PRINCIPAL user))

      (map-set vaults user
        (merge updated-vault {
          stx-borrowed: (+ (get stx-borrowed updated-vault) amount),
          last-block: burn-block-height
        })
      )

      (var-set total-stx-borrowed (+ (var-get total-stx-borrowed) amount))
      (var-set total-stx-liquidity (- (var-get total-stx-liquidity) amount))

      (print { event: "borrow-stx", user: user, amount: amount, ltv: new-ltv })
      (ok amount)
    )
  )
)

(define-public (repay-stx (amount uint))
  (let (
    (user tx-sender)
    (vault (unwrap! (map-get? vaults tx-sender) ERR-NO-VAULT))
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    (accrue-interest user)

    (let
      (
        (updated-vault (unwrap! (map-get? vaults user) ERR-NO-VAULT))
        (interest (get interest-owed updated-vault))
        (principal (get stx-borrowed updated-vault))
        (total-owed (+ principal interest))
        (repay-amount (if (>= amount total-owed) total-owed amount))
        (pay-interest (if (>= repay-amount interest) interest repay-amount))
        (remaining-after-interest (- repay-amount pay-interest))
        (pay-principal (if (>= remaining-after-interest principal) principal remaining-after-interest))
        (new-interest (- interest pay-interest))
        (new-principal (- principal pay-principal))
        (fee (/ (* pay-interest u1000) u10000))
        (net-liquidity (- repay-amount fee))
      )
      (try! (stx-transfer? repay-amount user VAULT_PRINCIPAL))

      (var-set protocol-fees (+ (var-get protocol-fees) fee))
      (var-set total-stx-borrowed (- (var-get total-stx-borrowed) pay-principal))
      (var-set total-stx-liquidity (+ (var-get total-stx-liquidity) net-liquidity))

      (map-set vaults user
        (merge updated-vault {
          stx-borrowed: new-principal,
          interest-owed: new-interest,
          last-block: burn-block-height,
          is-open: (or (> (get sbtc-deposited updated-vault) u0) (> new-principal u0) (> new-interest u0))
        })
      )

      (print { event: "repay", user: user, repaid: repay-amount, interest-paid: pay-interest, principal-paid: pay-principal })
      (ok repay-amount)
    )
  )
)

(define-public (withdraw-sbtc (amount uint) (token-id <sip-010-trait>))
  (let (
    (user tx-sender)
    (vault (unwrap! (map-get? vaults tx-sender) ERR-NO-VAULT))
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    (accrue-interest user)

    (let
      (
        (updated-vault (unwrap! (map-get? vaults user) ERR-NO-VAULT))
        (deposited (get sbtc-deposited updated-vault))
      )
      (asserts! (<= amount deposited) ERR-INSUFFICIENT)

      (let
        (
          (remaining-sbtc (- deposited amount))
          (total-owed (+ (get stx-borrowed updated-vault) (get interest-owed updated-vault)))
          (new-ltv (get-ltv remaining-sbtc total-owed))
        )
        (if (> total-owed u0)
          (begin
            (asserts! (> remaining-sbtc u0) ERR-BELOW-LTV)
            (asserts! (<= new-ltv MAX-LTV) ERR-BELOW-LTV)
          )
          true
        )

        (try! (contract-call? token-id transfer amount VAULT_PRINCIPAL user none))

        (map-set vaults user
          (merge updated-vault {
            sbtc-deposited: remaining-sbtc,
            last-block: burn-block-height,
            is-open: (or (> remaining-sbtc u0) (> total-owed u0))
          })
        )

        (var-set total-sbtc-locked (- (var-get total-sbtc-locked) amount))

        (print { event: "withdraw-sbtc", user: user, amount: amount })
        (ok amount)
      )
    )
  )
)

(define-public (liquidate (borrower principal) (stx-repay uint) (token-id <sip-010-trait>))
  (let ((caller tx-sender))
    (asserts! (> stx-repay u0) ERR-ZERO-AMOUNT)

    (accrue-interest borrower)

    (let
      (
        (updated-vault (unwrap! (map-get? vaults borrower) ERR-NO-VAULT))
        (principal (get stx-borrowed updated-vault))
        (interest (get interest-owed updated-vault))
        (total-owed (+ principal interest))
        (current-ltv (get-ltv (get sbtc-deposited updated-vault) total-owed))
      )
      (asserts! (>= current-ltv LIQ-THRESHOLD) ERR-NOT-LIQUIDATABLE)
      (asserts! (<= stx-repay total-owed) ERR-INSUFFICIENT)

      (try! (stx-transfer? stx-repay caller VAULT_PRINCIPAL))

      (let
        (
          (pay-interest (if (>= stx-repay interest) interest stx-repay))
          (remaining-after-interest (- stx-repay pay-interest))
          (pay-principal (if (>= remaining-after-interest principal) principal remaining-after-interest))
          (new-interest (- interest pay-interest))
          (new-principal (- principal pay-principal))
          (sats-base (/ (* stx-repay u100000000) (var-get sbtc-price-ustx)))
          (sbtc-to-seize (/ (* sats-base (+ u10000 LIQ-BONUS)) u10000))
          (safe-seize (if (>= sbtc-to-seize (get sbtc-deposited updated-vault))
            (get sbtc-deposited updated-vault)
            sbtc-to-seize
          ))
          (remaining-sbtc (- (get sbtc-deposited updated-vault) safe-seize))
        )
        (try! (contract-call? token-id transfer safe-seize VAULT_PRINCIPAL caller none))

        (map-set vaults borrower
          (merge updated-vault {
            sbtc-deposited: remaining-sbtc,
            stx-borrowed: new-principal,
            interest-owed: new-interest,
            last-block: burn-block-height,
            is-open: (or (> remaining-sbtc u0) (> new-principal u0) (> new-interest u0))
          })
        )

        (var-set total-stx-borrowed (- (var-get total-stx-borrowed) pay-principal))
        (var-set total-stx-liquidity (+ (var-get total-stx-liquidity) stx-repay))
        (var-set total-sbtc-locked (- (var-get total-sbtc-locked) safe-seize))

        (print { event: "liquidation", borrower: borrower, liquidator: caller, stx-repaid: stx-repay, sbtc-seized: safe-seize })
        (ok safe-seize)
      )
    )
  )
)

;; --- Read-only ---

(define-read-only (get-vault (user principal))
  (let ((vault (get-vault-or-default user)))
    (let
      (
        (total-owed (+ (get stx-borrowed vault) (get interest-owed vault)))
        (current-ltv (get-ltv (get sbtc-deposited vault) total-owed))
      )
      (ok {
        sbtc-deposited: (get sbtc-deposited vault),
        stx-borrowed: (get stx-borrowed vault),
        interest-owed: (get interest-owed vault),
        total-owed: total-owed,
        current-ltv: current-ltv,
        is-open: (get is-open vault),
        is-liquidatable: (>= current-ltv LIQ-THRESHOLD)
      })
    )
  )
)

(define-read-only (get-protocol-stats)
  (ok {
    total-sbtc-locked: (var-get total-sbtc-locked),
    total-stx-borrowed: (var-get total-stx-borrowed),
    total-stx-liquidity: (var-get total-stx-liquidity),
    protocol-fees: (var-get protocol-fees),
    sbtc-price-ustx: (var-get sbtc-price-ustx)
  })
)

(define-read-only (get-max-borrow (user principal))
  (let
    (
      (vault (get-vault-or-default user))
      (collateral-ustx (/ (* (get sbtc-deposited vault) (var-get sbtc-price-ustx)) u100000000))
      (max-borrow (/ (* collateral-ustx MAX-LTV) u10000))
      (already-owed (+ (get stx-borrowed vault) (get interest-owed vault)))
    )
    (ok (if (>= already-owed max-borrow) u0 (- max-borrow already-owed)))
  )
)

(define-public (update-price (new-price uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR-NOT-OWNER)
    (asserts! (> new-price u0) ERR-ZERO-AMOUNT)
    (var-set sbtc-price-ustx new-price)
    (ok new-price)
  )
)

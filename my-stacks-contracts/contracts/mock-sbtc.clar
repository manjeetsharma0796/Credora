;; mock-sbtc - SIP-010 Fungible Token (8 decimals)
;; A testnet mock of sBTC for the BTCBoost vault

;; --- SIP-010 Trait ---
(impl-trait .sip-010-trait-v2.sip-010-trait)

;; --- Token Definition ---
(define-fungible-token mock-sbtc)

;; --- Constants ---
;; Mocks: no owner restrictions (vault + faucet both need to mint)

;; --- SIP-010 Functions ---

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (try! (ft-transfer? mock-sbtc amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok "Mock sBTC")
)

(define-read-only (get-symbol)
  (ok "sBTC")
)

(define-read-only (get-decimals)
  (ok u8)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance mock-sbtc account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply mock-sbtc))
)

(define-read-only (get-token-uri)
  (ok none)
)

;; --- Mint (owner only, for testnet faucet) ---

(define-public (mint (amount uint) (recipient principal))
  (begin
    (ft-mint? mock-sbtc amount recipient)
  )
)

;; --- Faucet (anyone can claim 1 sBTC for testing) ---

(define-public (faucet)
  (ft-mint? mock-sbtc u100000000 tx-sender)
)

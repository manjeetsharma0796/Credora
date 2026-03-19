;; mock-usdcx - SIP-010 Fungible Token (6 decimals)
;; A testnet mock of USDCx stablecoin for the BTCBoost vault

;; --- SIP-010 Trait ---
(impl-trait .sip-010-trait-v2.sip-010-trait)

;; --- Token Definition ---
(define-fungible-token mock-usdcx)

;; --- Constants ---
;; Mocks: no owner restrictions (vault + faucet both need to mint)

;; --- SIP-010 Functions ---

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (try! (ft-transfer? mock-usdcx amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok "Mock USDCx")
)

(define-read-only (get-symbol)
  (ok "USDCx")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance mock-usdcx account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply mock-usdcx))
)

(define-read-only (get-token-uri)
  (ok none)
)

;; --- Mint (owner only, for testnet faucet) ---

(define-public (mint (amount uint) (recipient principal))
  (begin
    (ft-mint? mock-usdcx amount recipient)
  )
)

;; --- Faucet (anyone can claim 10,000 USDCx for testing) ---

(define-public (faucet)
  (ft-mint? mock-usdcx u10000000000 tx-sender)
)

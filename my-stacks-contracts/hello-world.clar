;; Hello World Contract

;; Read-only function that returns a greeting
(define-read-only (say-hello)
  (ok "Hello, World!")
)

;; Public function that returns a personalized greeting
(define-public (greet (name (string-ascii 50)))
  (ok (concat "Hello, " name))
)

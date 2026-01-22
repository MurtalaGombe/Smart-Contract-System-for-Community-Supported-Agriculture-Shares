;; title: share-token
;; version: 1.0.0
;; summary: SIP-010 compliant fungible token for CSA shares
;; description: Implements the Stacks fungible token standard for CSA shares.
;;              Each farm's shares are represented as tokens, enabling fractional
;;              ownership, trading, and automated distribution mechanisms.
;;              This contract implements all SIP-010 required functions:
;;              - transfer, get-name, get-symbol, get-decimals, get-balance,
;;                get-total-supply, get-token-uri
;;              For production deployment, add:
;;              (impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; traits
;;


;; token definitions
;;

;; Define the fungible token for CSA shares
(define-fungible-token csa-share)

;; constants
;;

;; Error codes
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_NOT_TOKEN_OWNER (err u201))
(define-constant ERR_INSUFFICIENT_BALANCE (err u202))
(define-constant ERR_FARM_NOT_FOUND (err u203))
(define-constant ERR_INVALID_AMOUNT (err u204))
(define-constant ERR_METADATA_FROZEN (err u205))
(define-constant ERR_INVALID_PRINCIPAL (err u206))

;; Contract owner
(define-constant CONTRACT_OWNER tx-sender)

;; Token metadata constants
(define-constant TOKEN_NAME "CSA Share Token")
(define-constant TOKEN_SYMBOL "CSAS")
(define-constant TOKEN_DECIMALS u6)
(define-constant TOKEN_URI u"https://csa-shares.io/token-metadata")

;; data vars
;;

;; Counter for tracking total supply across all farms
(define-data-var total-supply uint u0)

;; data maps
;;

;; Farm-specific token metadata
(define-map farm-token-metadata
  { farm-id: uint }
  {
    name: (string-ascii 256),
    symbol: (string-ascii 32),
    decimals: uint,
    total-supply: uint,
    price-per-share: uint,
    metadata-frozen: bool
  }
)

;; Farm-specific token balances
(define-map farm-token-balances
  { farm-id: uint, holder: principal }
  { balance: uint }
)

;; Token allowances for delegated transfers
(define-map token-allowances
  { farm-id: uint, owner: principal, spender: principal }
  { amount: uint }
)

;; Authorized minters per farm (typically the farm owner or payment processor)
(define-map authorized-minters
  { farm-id: uint, minter: principal }
  { authorized: bool }
)

;; public functions
;;

;; @desc Initialize token metadata for a farm
;; @param farm-id: ID of the farm
;; @param name: Token name for this farm's shares
;; @param symbol: Token symbol for this farm's shares
;; @param price-per-share: Price per share in microSTX
;; @returns (response bool uint) - true on success, error code on failure
(define-public (initialize-farm-token (farm-id uint) (name (string-ascii 256)) (symbol (string-ascii 32)) (price-per-share uint))
  (begin
    ;; Only contract owner can initialize farm tokens
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Verify farm doesn't already have metadata
    (asserts! (is-none (map-get? farm-token-metadata { farm-id: farm-id })) ERR_FARM_NOT_FOUND)

    ;; Set farm token metadata
    (map-set farm-token-metadata
      { farm-id: farm-id }
      {
        name: name,
        symbol: symbol,
        decimals: TOKEN_DECIMALS,
        total-supply: u0,
        price-per-share: price-per-share,
        metadata-frozen: false
      }
    )

    ;; Emit event
    (print {
      event: "farm-token-initialized",
      farm-id: farm-id,
      name: name,
      symbol: symbol,
      price-per-share: price-per-share
    })
    (ok true)
  )
)

;; @desc Mint new shares for a farm
;; @param farm-id: ID of the farm
;; @param amount: Amount of shares to mint
;; @param recipient: Principal to receive the minted shares
;; @returns (response bool uint) - true on success, error code on failure
(define-public (mint-shares (farm-id uint) (amount uint) (recipient principal))
  (let
    (
      (metadata (unwrap! (map-get? farm-token-metadata { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (current-balance (default-to u0 (get balance (map-get? farm-token-balances { farm-id: farm-id, holder: recipient }))))
    )
    ;; Verify caller is authorized minter
    (asserts! (is-authorized-minter farm-id tx-sender) ERR_UNAUTHORIZED)

    ;; Verify amount is valid
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)

    ;; Mint tokens
    (try! (ft-mint? csa-share amount recipient))

    ;; Update farm-specific balance
    (map-set farm-token-balances
      { farm-id: farm-id, holder: recipient }
      { balance: (+ current-balance amount) }
    )

    ;; Update farm total supply
    (map-set farm-token-metadata
      { farm-id: farm-id }
      (merge metadata { total-supply: (+ (get total-supply metadata) amount) })
    )

    ;; Update global total supply
    (var-set total-supply (+ (var-get total-supply) amount))

    ;; Emit event
    (print {
      event: "shares-minted",
      farm-id: farm-id,
      amount: amount,
      recipient: recipient
    })
    (ok true)
  )
)

;; @desc Burn shares from a holder
;; @param farm-id: ID of the farm
;; @param amount: Amount of shares to burn
;; @param holder: Principal whose shares will be burned
;; @returns (response bool uint) - true on success, error code on failure
(define-public (burn-shares (farm-id uint) (amount uint) (holder principal))
  (let
    (
      (metadata (unwrap! (map-get? farm-token-metadata { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (current-balance (default-to u0 (get balance (map-get? farm-token-balances { farm-id: farm-id, holder: holder }))))
    )
    ;; Verify caller is authorized minter or the holder
    (asserts! (or (is-authorized-minter farm-id tx-sender) (is-eq tx-sender holder)) ERR_UNAUTHORIZED)

    ;; Verify amount is valid
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)

    ;; Verify sufficient balance
    (asserts! (>= current-balance amount) ERR_INSUFFICIENT_BALANCE)

    ;; Burn tokens
    (try! (ft-burn? csa-share amount holder))

    ;; Update farm-specific balance
    (map-set farm-token-balances
      { farm-id: farm-id, holder: holder }
      { balance: (- current-balance amount) }
    )

    ;; Update farm total supply
    (map-set farm-token-metadata
      { farm-id: farm-id }
      (merge metadata { total-supply: (- (get total-supply metadata) amount) })
    )

    ;; Update global total supply
    (var-set total-supply (- (var-get total-supply) amount))

    ;; Emit event
    (print {
      event: "shares-burned",
      farm-id: farm-id,
      amount: amount,
      holder: holder
    })
    (ok true)
  )
)

;; @desc Transfer shares (SIP-010 required function)
;; @param amount: Amount to transfer
;; @param sender: Principal sending the tokens
;; @param recipient: Principal receiving the tokens
;; @param memo: Optional memo buffer
;; @returns (response bool uint) - true on success, error code on failure
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    ;; Verify sender is tx-sender
    (asserts! (is-eq tx-sender sender) ERR_NOT_TOKEN_OWNER)

    ;; Verify amount is valid
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)

    ;; Verify recipient is valid
    (asserts! (not (is-eq recipient sender)) ERR_INVALID_PRINCIPAL)

    ;; Transfer tokens
    (try! (ft-transfer? csa-share amount sender recipient))

    ;; Emit event
    (print { event: "transfer", amount: amount, sender: sender, recipient: recipient, memo: memo })
    (ok true)
  )
)

;; @desc Transfer shares for a specific farm (farm-aware transfer)
;; @param farm-id: ID of the farm
;; @param amount: Amount to transfer
;; @param sender: Principal sending the tokens
;; @param recipient: Principal receiving the tokens
;; @returns (response bool uint) - true on success, error code on failure
(define-public (transfer-farm-shares (farm-id uint) (amount uint) (sender principal) (recipient principal))
  (let
    (
      (sender-balance (default-to u0 (get balance (map-get? farm-token-balances { farm-id: farm-id, holder: sender }))))
      (recipient-balance (default-to u0 (get balance (map-get? farm-token-balances { farm-id: farm-id, holder: recipient }))))
    )
    ;; Verify sender is tx-sender
    (asserts! (is-eq tx-sender sender) ERR_NOT_TOKEN_OWNER)

    ;; Verify amount is valid
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)

    ;; Verify sufficient farm-specific balance
    (asserts! (>= sender-balance amount) ERR_INSUFFICIENT_BALANCE)

    ;; Transfer tokens
    (try! (ft-transfer? csa-share amount sender recipient))

    ;; Update farm-specific balances
    (map-set farm-token-balances
      { farm-id: farm-id, holder: sender }
      { balance: (- sender-balance amount) }
    )

    (map-set farm-token-balances
      { farm-id: farm-id, holder: recipient }
      { balance: (+ recipient-balance amount) }
    )

    ;; Emit event
    (print {
      event: "farm-shares-transferred",
      farm-id: farm-id,
      amount: amount,
      sender: sender,
      recipient: recipient
    })
    (ok true)
  )
)

;; @desc Authorize a minter for a farm
;; @param farm-id: ID of the farm
;; @param minter: Principal to authorize
;; @returns (response bool uint) - true on success, error code on failure
(define-public (authorize-minter (farm-id uint) (minter principal))
  (begin
    ;; Only contract owner can authorize minters
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Authorize minter
    (map-set authorized-minters
      { farm-id: farm-id, minter: minter }
      { authorized: true }
    )

    ;; Emit event
    (print {
      event: "minter-authorized",
      farm-id: farm-id,
      minter: minter
    })
    (ok true)
  )
)

;; @desc Revoke minter authorization
;; @param farm-id: ID of the farm
;; @param minter: Principal to revoke
;; @returns (response bool uint) - true on success, error code on failure
(define-public (revoke-minter (farm-id uint) (minter principal))
  (begin
    ;; Only contract owner can revoke minters
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Revoke minter
    (map-delete authorized-minters { farm-id: farm-id, minter: minter })

    ;; Emit event
    (print {
      event: "minter-revoked",
      farm-id: farm-id,
      minter: minter
    })
    (ok true)
  )
)

;; read only functions
;;

;; SIP-010 Required Read-Only Functions

;; @desc Get token name (SIP-010 required)
;; @returns (response string-ascii uint) - Token name
(define-read-only (get-name)
  (ok TOKEN_NAME)
)

;; @desc Get token symbol (SIP-010 required)
;; @returns (response string-ascii uint) - Token symbol
(define-read-only (get-symbol)
  (ok TOKEN_SYMBOL)
)

;; @desc Get token decimals (SIP-010 required)
;; @returns (response uint uint) - Number of decimals
(define-read-only (get-decimals)
  (ok TOKEN_DECIMALS)
)

;; @desc Get token balance for an account (SIP-010 required)
;; @param account: Principal to check balance for
;; @returns (response uint uint) - Token balance
(define-read-only (get-balance (account principal))
  (ok (ft-get-balance csa-share account))
)

;; @desc Get total token supply (SIP-010 required)
;; @returns (response uint uint) - Total supply
(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; @desc Get token URI (SIP-010 required)
;; @returns (response (optional string-utf8) uint) - Token URI
(define-read-only (get-token-uri)
  (ok (some TOKEN_URI))
)

;; Farm-Specific Read-Only Functions

;; @desc Get farm token metadata
;; @param farm-id: ID of the farm
;; @returns (optional {...}) - Farm token metadata if found
(define-read-only (get-farm-token-metadata (farm-id uint))
  (map-get? farm-token-metadata { farm-id: farm-id })
)

;; @desc Get farm-specific balance for a holder
;; @param farm-id: ID of the farm
;; @param holder: Principal to check balance for
;; @returns uint - Farm-specific balance
(define-read-only (get-farm-balance (farm-id uint) (holder principal))
  (default-to u0 (get balance (map-get? farm-token-balances { farm-id: farm-id, holder: holder })))
)

;; @desc Get farm total supply
;; @param farm-id: ID of the farm
;; @returns (optional uint) - Farm total supply if found
(define-read-only (get-farm-total-supply (farm-id uint))
  (match (map-get? farm-token-metadata { farm-id: farm-id })
    metadata (some (get total-supply metadata))
    none
  )
)

;; @desc Get share price for a farm
;; @param farm-id: ID of the farm
;; @returns (optional uint) - Price per share if found
(define-read-only (get-share-price (farm-id uint))
  (match (map-get? farm-token-metadata { farm-id: farm-id })
    metadata (some (get price-per-share metadata))
    none
  )
)

;; @desc Check if a principal is an authorized minter for a farm
;; @param farm-id: ID of the farm
;; @param minter: Principal to check
;; @returns bool - true if authorized, false otherwise
(define-read-only (is-authorized-minter (farm-id uint) (minter principal))
  (default-to false (get authorized (map-get? authorized-minters { farm-id: farm-id, minter: minter })))
)

;; @desc Get contract owner
;; @returns principal - Contract owner address
(define-read-only (get-contract-owner)
  CONTRACT_OWNER
)

;; private functions
;;


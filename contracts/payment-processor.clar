;; title: payment-processor
;; version: 1.0.0
;; summary: Payment processing contract for CSA share purchases and fund management
;; description: Manages all financial transactions including share purchases, refunds,
;;              and fund distribution. Handles STX payments and maintains escrow for
;;              pending distributions. This contract is designed to be modular and
;;              independent, with no external contract dependencies.

;; ============================================================================
;; TRAITS
;; ============================================================================
;; None - this contract is self-contained for modularity

;; ============================================================================
;; TOKEN DEFINITIONS
;; ============================================================================
;; None - this contract handles STX transfers only

;; ============================================================================
;; CONSTANTS
;; ============================================================================

;; Error codes - using 300 series to avoid conflicts with other contracts
(define-constant ERR_UNAUTHORIZED (err u300))
(define-constant ERR_FARM_NOT_FOUND (err u301))
(define-constant ERR_INVALID_AMOUNT (err u302))
(define-constant ERR_INSUFFICIENT_BALANCE (err u303))
(define-constant ERR_ESCROW_NOT_FOUND (err u304))
(define-constant ERR_ESCROW_NOT_RELEASABLE (err u305))
(define-constant ERR_PAYMENT_NOT_FOUND (err u306))
(define-constant ERR_INVALID_FEE_PERCENTAGE (err u307))
(define-constant ERR_REFUND_ALREADY_PROCESSED (err u308))
(define-constant ERR_INVALID_STATUS (err u309))
(define-constant ERR_FARM_ALREADY_EXISTS (err u310))
(define-constant ERR_ESCROW_ALREADY_RELEASED (err u311))
(define-constant ERR_WITHDRAWAL_EXCEEDS_AVAILABLE (err u312))
(define-constant ERR_INVALID_PRINCIPAL (err u313))
(define-constant ERR_SELF_TRANSFER (err u314))

;; Contract owner - the deployer of this contract
(define-constant CONTRACT_OWNER tx-sender)

;; Payment status constants
(define-constant STATUS_COMPLETED "completed")
(define-constant STATUS_PENDING "pending")
(define-constant STATUS_REFUNDED "refunded")

;; Escrow status constants
(define-constant ESCROW_STATUS_ACTIVE "active")
(define-constant ESCROW_STATUS_RELEASED "released")
(define-constant ESCROW_STATUS_CANCELLED "cancelled")

;; Minimum and maximum fee percentage (in basis points: 100 = 1%)
(define-constant MIN_FEE_PERCENTAGE u0)
(define-constant MAX_FEE_PERCENTAGE u1000) ;; Max 10%

;; ============================================================================
;; DATA VARIABLES
;; ============================================================================

;; Counter for escrow IDs (auto-incrementing)
(define-data-var escrow-id-nonce uint u0)

;; Counter for payment IDs (auto-incrementing)  
(define-data-var payment-id-nonce uint u0)

;; Platform fee percentage in basis points (default 2% = 200 basis points)
(define-data-var platform-fee-percentage uint u200)

;; Treasury address for platform fees
(define-data-var treasury-address principal CONTRACT_OWNER)

;; ============================================================================
;; DATA MAPS
;; ============================================================================

;; Farm balances - tracks collected funds per farm
;; This is independent of the csa-registry contract for modularity
(define-map farm-balances
  { farm-id: uint }
  {
    owner: principal,
    total-collected: uint,
    total-distributed: uint,
    available-balance: uint,
    is-active: bool,
    created-at: uint
  }
)

;; Farm administrators for payment operations
(define-map farm-payment-admins
  { farm-id: uint, admin: principal }
  { added-at: uint }
)

;; Member payments - tracks payment history per member per farm
(define-map member-payments
  { payment-id: uint }
  {
    farm-id: uint,
    member: principal,
    amount-paid: uint,
    shares-purchased: uint,
    payment-date: uint,
    status: (string-ascii 32),
    refund-amount: uint
  }
)

;; Lookup map for finding payments by farm and member
(define-map member-payment-lookup
  { farm-id: uint, member: principal }
  { last-payment-id: uint, total-payments: uint }
)

;; Escrow accounts for secure fund holding
(define-map escrow-accounts
  { escrow-id: uint }
  {
    farm-id: uint,
    amount: uint,
    depositor: principal,
    recipient: principal,
    release-block: uint,
    status: (string-ascii 32),
    created-at: uint,
    released-at: (optional uint),
    description: (string-ascii 256)
  }
)

;; ============================================================================
;; PRIVATE FUNCTIONS
;; ============================================================================

;; @desc Calculate platform fee for a given amount
;; @param amount: Amount in microSTX to calculate fee for
;; @returns uint - The calculated fee amount
(define-private (calculate-fee (amount uint))
  (/ (* amount (var-get platform-fee-percentage)) u10000)
)

;; @desc Check if caller is the farm owner
;; @param farm-id: ID of the farm to check
;; @returns bool - true if caller is farm owner
(define-private (is-farm-owner (farm-id uint))
  (match (map-get? farm-balances { farm-id: farm-id })
    farm (is-eq tx-sender (get owner farm))
    false
  )
)

;; @desc Check if caller is a farm payment admin
;; @param farm-id: ID of the farm to check
;; @returns bool - true if caller is admin
(define-private (is-payment-admin (farm-id uint))
  (or 
    (is-farm-owner farm-id)
    (is-some (map-get? farm-payment-admins { farm-id: farm-id, admin: tx-sender }))
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - FARM MANAGEMENT
;; ============================================================================

;; @desc Register a farm for payment processing
;; @param farm-id: Unique identifier for the farm (should match csa-registry farm-id)
;; @returns (response bool uint) - true on success, error code on failure
;; @events farm-registered-for-payments
(define-public (register-farm-for-payments (farm-id uint))
  (begin
    ;; Verify farm doesn't already exist in payment system
    (asserts! (is-none (map-get? farm-balances { farm-id: farm-id })) ERR_FARM_ALREADY_EXISTS)

    ;; Initialize farm balance record
    (map-set farm-balances
      { farm-id: farm-id }
      {
        owner: tx-sender,
        total-collected: u0,
        total-distributed: u0,
        available-balance: u0,
        is-active: true,
        created-at: stacks-block-height
      }
    )

    ;; Add owner as payment admin
    (map-set farm-payment-admins
      { farm-id: farm-id, admin: tx-sender }
      { added-at: stacks-block-height }
    )

    ;; Emit event
    (print {
      event: "farm-registered-for-payments",
      farm-id: farm-id,
      owner: tx-sender,
      block-height: stacks-block-height
    })
    (ok true)
  )
)

;; @desc Add a payment admin for a farm
;; @param farm-id: ID of the farm
;; @param admin-address: Principal address of the new admin
;; @returns (response bool uint) - true on success, error code on failure
(define-public (add-payment-admin (farm-id uint) (admin-address principal))
  (let
    (
      (farm (unwrap! (map-get? farm-balances { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Only farm owner can add admins
    (asserts! (is-eq tx-sender (get owner farm)) ERR_UNAUTHORIZED)

    ;; Add admin
    (map-set farm-payment-admins
      { farm-id: farm-id, admin: admin-address }
      { added-at: stacks-block-height }
    )

    ;; Emit event
    (print {
      event: "payment-admin-added",
      farm-id: farm-id,
      admin: admin-address
    })
    (ok true)
  )
)

;; @desc Remove a payment admin from a farm
;; @param farm-id: ID of the farm
;; @param admin-address: Principal address of the admin to remove
;; @returns (response bool uint) - true on success, error code on failure
(define-public (remove-payment-admin (farm-id uint) (admin-address principal))
  (let
    (
      (farm (unwrap! (map-get? farm-balances { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Only farm owner can remove admins
    (asserts! (is-eq tx-sender (get owner farm)) ERR_UNAUTHORIZED)

    ;; Cannot remove the owner
    (asserts! (not (is-eq admin-address (get owner farm))) ERR_UNAUTHORIZED)

    ;; Remove admin
    (map-delete farm-payment-admins { farm-id: farm-id, admin: admin-address })

    ;; Emit event
    (print {
      event: "payment-admin-removed",
      farm-id: farm-id,
      admin: admin-address
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - PAYMENT PROCESSING
;; ============================================================================

;; @desc Process a share purchase payment
;; @param farm-id: ID of the farm receiving payment
;; @param shares-count: Number of shares being purchased
;; @param price-per-share: Price per share in microSTX
;; @returns (response uint uint) - Payment ID on success, error code on failure
;; @events payment-received, platform-fee-collected
(define-public (process-share-purchase (farm-id uint) (shares-count uint) (price-per-share uint))
  (let
    (
      (farm (unwrap! (map-get? farm-balances { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (total-amount (* shares-count price-per-share))
      (platform-fee (calculate-fee total-amount))
      (farm-amount (- total-amount platform-fee))
      (payment-id (var-get payment-id-nonce))
      (current-lookup (default-to 
        { last-payment-id: u0, total-payments: u0 }
        (map-get? member-payment-lookup { farm-id: farm-id, member: tx-sender })))
    )
    ;; Validate inputs
    (asserts! (> shares-count u0) ERR_INVALID_AMOUNT)
    (asserts! (> price-per-share u0) ERR_INVALID_AMOUNT)
    (asserts! (get is-active farm) ERR_FARM_NOT_FOUND)

    ;; Transfer platform fee to treasury
    (if (> platform-fee u0)
      (try! (stx-transfer? platform-fee tx-sender (var-get treasury-address)))
      true
    )

    ;; Transfer farm amount to contract (held in contract balance)
    (try! (stx-transfer? farm-amount tx-sender (as-contract tx-sender)))

    ;; Record payment
    (map-set member-payments
      { payment-id: payment-id }
      {
        farm-id: farm-id,
        member: tx-sender,
        amount-paid: total-amount,
        shares-purchased: shares-count,
        payment-date: stacks-block-height,
        status: STATUS_COMPLETED,
        refund-amount: u0
      }
    )

    ;; Update payment lookup
    (map-set member-payment-lookup
      { farm-id: farm-id, member: tx-sender }
      { 
        last-payment-id: payment-id, 
        total-payments: (+ (get total-payments current-lookup) u1) 
      }
    )

    ;; Update farm balance
    (map-set farm-balances
      { farm-id: farm-id }
      (merge farm {
        total-collected: (+ (get total-collected farm) farm-amount),
        available-balance: (+ (get available-balance farm) farm-amount)
      })
    )

    ;; Increment payment ID counter
    (var-set payment-id-nonce (+ payment-id u1))

    ;; Emit events
    (print {
      event: "payment-received",
      payment-id: payment-id,
      farm-id: farm-id,
      member: tx-sender,
      amount: total-amount,
      shares: shares-count,
      platform-fee: platform-fee
    })

    (ok payment-id)
  )
)

;; @desc Request a refund for a payment
;; @param payment-id: ID of the payment to refund
;; @returns (response bool uint) - true on success, error code on failure
;; @note Refund must be approved by farm admin
(define-public (request-refund (payment-id uint))
  (let
    (
      (payment (unwrap! (map-get? member-payments { payment-id: payment-id }) ERR_PAYMENT_NOT_FOUND))
    )
    ;; Only the original payer can request refund
    (asserts! (is-eq tx-sender (get member payment)) ERR_UNAUTHORIZED)

    ;; Payment must be completed (not already refunded)
    (asserts! (is-eq (get status payment) STATUS_COMPLETED) ERR_REFUND_ALREADY_PROCESSED)

    ;; Update payment status to pending refund
    (map-set member-payments
      { payment-id: payment-id }
      (merge payment { status: STATUS_PENDING })
    )

    ;; Emit event
    (print {
      event: "refund-requested",
      payment-id: payment-id,
      member: tx-sender,
      amount: (get amount-paid payment)
    })
    (ok true)
  )
)

;; @desc Approve and process a refund
;; @param payment-id: ID of the payment to refund
;; @param refund-amount: Amount to refund (may be partial)
;; @returns (response bool uint) - true on success, error code on failure
(define-public (approve-refund (payment-id uint) (refund-amount uint))
  (let
    (
      (payment (unwrap! (map-get? member-payments { payment-id: payment-id }) ERR_PAYMENT_NOT_FOUND))
      (farm (unwrap! (map-get? farm-balances { farm-id: (get farm-id payment) }) ERR_FARM_NOT_FOUND))
      (original-amount (get amount-paid payment))
      (platform-fee (calculate-fee original-amount))
      (farm-portion (- original-amount platform-fee))
    )
    ;; Only farm admin can approve refunds
    (asserts! (is-payment-admin (get farm-id payment)) ERR_UNAUTHORIZED)

    ;; Payment must be in pending status
    (asserts! (is-eq (get status payment) STATUS_PENDING) ERR_INVALID_STATUS)

    ;; Refund amount must be valid
    (asserts! (> refund-amount u0) ERR_INVALID_AMOUNT)
    (asserts! (<= refund-amount farm-portion) ERR_INVALID_AMOUNT)

    ;; Farm must have sufficient balance
    (asserts! (>= (get available-balance farm) refund-amount) ERR_INSUFFICIENT_BALANCE)

    ;; Process refund transfer from contract
    (try! (as-contract (stx-transfer? refund-amount tx-sender (get member payment))))

    ;; Update payment record
    (map-set member-payments
      { payment-id: payment-id }
      (merge payment { 
        status: STATUS_REFUNDED,
        refund-amount: refund-amount
      })
    )

    ;; Update farm balance
    (map-set farm-balances
      { farm-id: (get farm-id payment) }
      (merge farm {
        available-balance: (- (get available-balance farm) refund-amount),
        total-distributed: (+ (get total-distributed farm) refund-amount)
      })
    )

    ;; Emit event
    (print {
      event: "refund-processed",
      payment-id: payment-id,
      member: (get member payment),
      refund-amount: refund-amount
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - ESCROW MANAGEMENT
;; ============================================================================

;; @desc Create an escrow account for secure fund holding
;; @param farm-id: ID of the farm
;; @param amount: Amount to escrow in microSTX
;; @param recipient: Principal who will receive funds when released
;; @param release-blocks: Number of blocks until funds can be released
;; @param description: Description of the escrow purpose
;; @returns (response uint uint) - Escrow ID on success, error code on failure
(define-public (create-escrow 
  (farm-id uint) 
  (amount uint) 
  (recipient principal)
  (release-blocks uint)
  (description (string-ascii 256)))
  (let
    (
      (farm (unwrap! (map-get? farm-balances { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (escrow-id (var-get escrow-id-nonce))
      (release-block (+ stacks-block-height release-blocks))
    )
    ;; Validate inputs
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (not (is-eq tx-sender recipient)) ERR_SELF_TRANSFER)

    ;; Transfer funds to contract for escrow
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

    ;; Create escrow record
    (map-set escrow-accounts
      { escrow-id: escrow-id }
      {
        farm-id: farm-id,
        amount: amount,
        depositor: tx-sender,
        recipient: recipient,
        release-block: release-block,
        status: ESCROW_STATUS_ACTIVE,
        created-at: stacks-block-height,
        released-at: none,
        description: description
      }
    )

    ;; Increment escrow ID counter
    (var-set escrow-id-nonce (+ escrow-id u1))

    ;; Emit event
    (print {
      event: "escrow-created",
      escrow-id: escrow-id,
      farm-id: farm-id,
      depositor: tx-sender,
      recipient: recipient,
      amount: amount,
      release-block: release-block
    })
    (ok escrow-id)
  )
)

;; @desc Release escrowed funds to recipient
;; @param escrow-id: ID of the escrow to release
;; @returns (response bool uint) - true on success, error code on failure
(define-public (release-escrow (escrow-id uint))
  (let
    (
      (escrow (unwrap! (map-get? escrow-accounts { escrow-id: escrow-id }) ERR_ESCROW_NOT_FOUND))
    )
    ;; Verify escrow is active
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_ACTIVE) ERR_ESCROW_ALREADY_RELEASED)

    ;; Verify release block has passed
    (asserts! (>= stacks-block-height (get release-block escrow)) ERR_ESCROW_NOT_RELEASABLE)

    ;; Only depositor or recipient can release
    (asserts! 
      (or 
        (is-eq tx-sender (get depositor escrow))
        (is-eq tx-sender (get recipient escrow))
      ) 
      ERR_UNAUTHORIZED
    )

    ;; Transfer funds to recipient
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get recipient escrow))))

    ;; Update escrow status
    (map-set escrow-accounts
      { escrow-id: escrow-id }
      (merge escrow {
        status: ESCROW_STATUS_RELEASED,
        released-at: (some stacks-block-height)
      })
    )

    ;; Emit event
    (print {
      event: "escrow-released",
      escrow-id: escrow-id,
      recipient: (get recipient escrow),
      amount: (get amount escrow)
    })
    (ok true)
  )
)

;; @desc Cancel an escrow and return funds to depositor
;; @param escrow-id: ID of the escrow to cancel
;; @returns (response bool uint) - true on success, error code on failure
;; @note Only depositor can cancel before release block
(define-public (cancel-escrow (escrow-id uint))
  (let
    (
      (escrow (unwrap! (map-get? escrow-accounts { escrow-id: escrow-id }) ERR_ESCROW_NOT_FOUND))
    )
    ;; Verify escrow is active
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_ACTIVE) ERR_ESCROW_ALREADY_RELEASED)

    ;; Only depositor can cancel
    (asserts! (is-eq tx-sender (get depositor escrow)) ERR_UNAUTHORIZED)

    ;; Can only cancel before release block
    (asserts! (< stacks-block-height (get release-block escrow)) ERR_ESCROW_NOT_RELEASABLE)

    ;; Return funds to depositor
    (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get depositor escrow))))

    ;; Update escrow status
    (map-set escrow-accounts
      { escrow-id: escrow-id }
      (merge escrow {
        status: ESCROW_STATUS_CANCELLED,
        released-at: (some stacks-block-height)
      })
    )

    ;; Emit event
    (print {
      event: "escrow-cancelled",
      escrow-id: escrow-id,
      depositor: (get depositor escrow),
      amount: (get amount escrow)
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - WITHDRAWALS
;; ============================================================================

;; @desc Withdraw available funds from farm balance
;; @param farm-id: ID of the farm
;; @param amount: Amount to withdraw in microSTX
;; @returns (response bool uint) - true on success, error code on failure
(define-public (withdraw-farm-balance (farm-id uint) (amount uint))
  (let
    (
      (farm (unwrap! (map-get? farm-balances { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Only farm owner can withdraw
    (asserts! (is-eq tx-sender (get owner farm)) ERR_UNAUTHORIZED)

    ;; Validate amount
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (<= amount (get available-balance farm)) ERR_WITHDRAWAL_EXCEEDS_AVAILABLE)

    ;; Transfer funds to farm owner
    (try! (as-contract (stx-transfer? amount tx-sender (get owner farm))))

    ;; Update farm balance
    (map-set farm-balances
      { farm-id: farm-id }
      (merge farm {
        available-balance: (- (get available-balance farm) amount),
        total-distributed: (+ (get total-distributed farm) amount)
      })
    )

    ;; Emit event
    (print {
      event: "farm-withdrawal",
      farm-id: farm-id,
      owner: (get owner farm),
      amount: amount
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - ADMIN
;; ============================================================================

;; @desc Update the platform fee percentage
;; @param new-fee: New fee percentage in basis points (100 = 1%)
;; @returns (response bool uint) - true on success, error code on failure
;; @note Only contract owner can update fees
(define-public (set-platform-fee (new-fee uint))
  (begin
    ;; Only contract owner can set fee
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Validate fee range
    (asserts! (and (>= new-fee MIN_FEE_PERCENTAGE) (<= new-fee MAX_FEE_PERCENTAGE)) ERR_INVALID_FEE_PERCENTAGE)

    ;; Update fee
    (var-set platform-fee-percentage new-fee)

    ;; Emit event
    (print {
      event: "platform-fee-updated",
      new-fee: new-fee,
      updated-by: tx-sender
    })
    (ok true)
  )
)

;; @desc Update the treasury address for platform fees
;; @param new-treasury: New treasury principal address
;; @returns (response bool uint) - true on success, error code on failure
(define-public (set-treasury-address (new-treasury principal))
  (begin
    ;; Only contract owner can set treasury
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Update treasury address
    (var-set treasury-address new-treasury)

    ;; Emit event
    (print {
      event: "treasury-updated",
      new-treasury: new-treasury
    })
    (ok true)
  )
)

;; ============================================================================
;; READ-ONLY FUNCTIONS
;; ============================================================================

;; @desc Get farm balance information
;; @param farm-id: ID of the farm
;; @returns (optional {...}) - Farm balance data or none if not found
(define-read-only (get-farm-balance (farm-id uint))
  (map-get? farm-balances { farm-id: farm-id })
)

;; @desc Get payment details by payment ID
;; @param payment-id: ID of the payment
;; @returns (optional {...}) - Payment data or none if not found
(define-read-only (get-payment (payment-id uint))
  (map-get? member-payments { payment-id: payment-id })
)

;; @desc Get member payment lookup information
;; @param farm-id: ID of the farm
;; @param member: Member principal address
;; @returns (optional {...}) - Payment lookup data or none if not found
(define-read-only (get-member-payment-info (farm-id uint) (member principal))
  (map-get? member-payment-lookup { farm-id: farm-id, member: member })
)

;; @desc Get escrow account details
;; @param escrow-id: ID of the escrow
;; @returns (optional {...}) - Escrow data or none if not found
(define-read-only (get-escrow (escrow-id uint))
  (map-get? escrow-accounts { escrow-id: escrow-id })
)

;; @desc Calculate platform fee for a given amount
;; @param amount: Amount in microSTX
;; @returns uint - The calculated fee
(define-read-only (calculate-platform-fee (amount uint))
  (calculate-fee amount)
)

;; @desc Get current platform fee percentage
;; @returns uint - Fee percentage in basis points
(define-read-only (get-platform-fee)
  (var-get platform-fee-percentage)
)

;; @desc Get current treasury address
;; @returns principal - Treasury address
(define-read-only (get-treasury-address)
  (var-get treasury-address)
)

;; @desc Check if an address is a payment admin for a farm
;; @param farm-id: ID of the farm
;; @param admin: Address to check
;; @returns bool - true if address is payment admin
(define-read-only (is-farm-payment-admin (farm-id uint) (admin principal))
  (or 
    (match (map-get? farm-balances { farm-id: farm-id })
      farm (is-eq admin (get owner farm))
      false
    )
    (is-some (map-get? farm-payment-admins { farm-id: farm-id, admin: admin }))
  )
)

;; @desc Check if escrow is releasable
;; @param escrow-id: ID of the escrow
;; @returns bool - true if escrow can be released
(define-read-only (is-escrow-releasable (escrow-id uint))
  (match (map-get? escrow-accounts { escrow-id: escrow-id })
    escrow (and 
      (is-eq (get status escrow) ESCROW_STATUS_ACTIVE)
      (>= stacks-block-height (get release-block escrow))
    )
    false
  )
)

;; @desc Get the available balance for a farm
;; @param farm-id: ID of the farm
;; @returns uint - Available balance in microSTX
(define-read-only (get-available-balance (farm-id uint))
  (default-to u0 
    (match (map-get? farm-balances { farm-id: farm-id })
      farm (some (get available-balance farm))
      none
    )
  )
)

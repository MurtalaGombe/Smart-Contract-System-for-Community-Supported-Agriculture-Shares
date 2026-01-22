;; title: distribution-manager
;; version: 1.0.0
;; summary: Manages produce distribution schedules, allocations, and member claims
;; description: Automates the distribution of produce shares, tracks allocations per member,
;;              and manages the claiming process. Supports multiple distribution types
;;              (weekly, seasonal, etc.) and ensures fair allocation based on share ownership.
;;              This contract is designed to be modular and independent.

;; ============================================================================
;; TRAITS
;; ============================================================================
;; None - this contract is self-contained for modularity

;; ============================================================================
;; TOKEN DEFINITIONS
;; ============================================================================
;; None

;; ============================================================================
;; CONSTANTS
;; ============================================================================

;; Error codes - using 400 series to avoid conflicts with other contracts
(define-constant ERR_UNAUTHORIZED (err u400))
(define-constant ERR_FARM_NOT_FOUND (err u401))
(define-constant ERR_DISTRIBUTION_NOT_FOUND (err u402))
(define-constant ERR_ALLOCATION_NOT_FOUND (err u403))
(define-constant ERR_INVALID_AMOUNT (err u404))
(define-constant ERR_INVALID_STATUS (err u405))
(define-constant ERR_ALREADY_CLAIMED (err u406))
(define-constant ERR_CLAIM_EXPIRED (err u407))
(define-constant ERR_DISTRIBUTION_NOT_ACTIVE (err u408))
(define-constant ERR_FARM_ALREADY_EXISTS (err u409))
(define-constant ERR_OVER_ALLOCATION (err u410))
(define-constant ERR_DISTRIBUTION_ALREADY_EXISTS (err u411))
(define-constant ERR_NO_ALLOCATION (err u412))
(define-constant ERR_INVALID_UNIT (err u413))
(define-constant ERR_SCHEDULE_NOT_FOUND (err u414))
(define-constant ERR_MEMBER_NOT_FOUND (err u415))

;; Contract owner - the deployer of this contract
(define-constant CONTRACT_OWNER tx-sender)

;; Distribution status constants
(define-constant STATUS_SCHEDULED "scheduled")
(define-constant STATUS_ACTIVE "active")
(define-constant STATUS_COMPLETED "completed")
(define-constant STATUS_CANCELLED "cancelled")

;; Allocation status constants
(define-constant ALLOC_STATUS_PENDING "pending")
(define-constant ALLOC_STATUS_CLAIMED "claimed")
(define-constant ALLOC_STATUS_EXPIRED "expired")

;; Default claim expiration period (in blocks, ~14 days at 10 min/block)
(define-constant DEFAULT_CLAIM_EXPIRATION_BLOCKS u2016)

;; ============================================================================
;; DATA VARIABLES
;; ============================================================================

;; Counter for distribution IDs (auto-incrementing)
(define-data-var distribution-id-nonce uint u0)

;; Default claim expiration period in blocks
(define-data-var claim-expiration-blocks uint DEFAULT_CLAIM_EXPIRATION_BLOCKS)

;; ============================================================================
;; DATA MAPS
;; ============================================================================

;; Farm registry for distribution operations (independent of csa-registry)
(define-map distribution-farms
  { farm-id: uint }
  {
    owner: principal,
    name: (string-ascii 256),
    is-active: bool,
    total-distributions: uint,
    created-at: uint
  }
)

;; Farm administrators for distribution operations
(define-map farm-distribution-admins
  { farm-id: uint, admin: principal }
  { added-at: uint }
)

;; Distribution records
(define-map distributions
  { distribution-id: uint }
  {
    farm-id: uint,
    created-by: principal,
    distribution-date: uint,
    total-quantity: uint,
    allocated-quantity: uint,
    claimed-quantity: uint,
    unit: (string-ascii 32),
    status: (string-ascii 32),
    claim-deadline: uint,
    metadata-uri: (string-ascii 512),
    created-at: uint
  }
)

;; Member allocations per distribution
(define-map member-allocations
  { distribution-id: uint, member: principal }
  {
    allocated-quantity: uint,
    claimed-quantity: uint,
    claim-date: (optional uint),
    status: (string-ascii 32)
  }
)

;; Distribution schedule per farm
(define-map distribution-schedules
  { farm-id: uint }
  {
    frequency: (string-ascii 32),
    interval-blocks: uint,
    next-distribution-block: uint,
    is-active: bool,
    last-distribution-id: (optional uint)
  }
)

;; Farm member share records (for allocation calculations)
(define-map farm-member-shares
  { farm-id: uint, member: principal }
  { 
    share-count: uint,
    registered-at: uint
  }
)

;; Farm total shares tracking
(define-map farm-total-shares
  { farm-id: uint }
  { total-shares: uint }
)

;; ============================================================================
;; PRIVATE FUNCTIONS
;; ============================================================================

;; @desc Check if caller is the farm owner
;; @param farm-id: ID of the farm to check
;; @returns bool - true if caller is farm owner
(define-private (is-farm-owner (farm-id uint))
  (match (map-get? distribution-farms { farm-id: farm-id })
    farm (is-eq tx-sender (get owner farm))
    false
  )
)

;; @desc Check if caller is a farm distribution admin
;; @param farm-id: ID of the farm to check
;; @returns bool - true if caller is admin
(define-private (is-distribution-admin (farm-id uint))
  (or 
    (is-farm-owner farm-id)
    (is-some (map-get? farm-distribution-admins { farm-id: farm-id, admin: tx-sender }))
  )
)

;; @desc Calculate member's allocation share based on their share percentage
;; @param farm-id: ID of the farm
;; @param member: Member's principal address
;; @param total-quantity: Total quantity to distribute
;; @returns uint - Member's allocated quantity
(define-private (calculate-member-allocation (farm-id uint) (member principal) (total-quantity uint))
  (let
    (
      (member-shares (default-to u0 
        (match (map-get? farm-member-shares { farm-id: farm-id, member: member })
          shares (some (get share-count shares))
          none
        )))
      (total-shares (default-to u1 
        (match (map-get? farm-total-shares { farm-id: farm-id })
          shares (some (get total-shares shares))
          none
        )))
    )
    (if (is-eq total-shares u0)
      u0
      (/ (* total-quantity member-shares) total-shares)
    )
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - FARM MANAGEMENT
;; ============================================================================

;; @desc Register a farm for distribution management
;; @param farm-id: Unique identifier for the farm
;; @param name: Name of the farm
;; @returns (response bool uint) - true on success, error code on failure
;; @events farm-registered-for-distributions
(define-public (register-farm-for-distributions (farm-id uint) (name (string-ascii 256)))
  (begin
    ;; Verify farm doesn't already exist
    (asserts! (is-none (map-get? distribution-farms { farm-id: farm-id })) ERR_FARM_ALREADY_EXISTS)

    ;; Initialize farm record
    (map-set distribution-farms
      { farm-id: farm-id }
      {
        owner: tx-sender,
        name: name,
        is-active: true,
        total-distributions: u0,
        created-at: stacks-block-height
      }
    )

    ;; Add owner as distribution admin
    (map-set farm-distribution-admins
      { farm-id: farm-id, admin: tx-sender }
      { added-at: stacks-block-height }
    )

    ;; Initialize total shares
    (map-set farm-total-shares
      { farm-id: farm-id }
      { total-shares: u0 }
    )

    ;; Emit event
    (print {
      event: "farm-registered-for-distributions",
      farm-id: farm-id,
      owner: tx-sender,
      name: name,
      block-height: stacks-block-height
    })
    (ok true)
  )
)

;; @desc Add a distribution admin for a farm
;; @param farm-id: ID of the farm
;; @param admin-address: Principal address of the new admin
;; @returns (response bool uint) - true on success, error code on failure
(define-public (add-distribution-admin (farm-id uint) (admin-address principal))
  (let
    (
      (farm (unwrap! (map-get? distribution-farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Only farm owner can add admins
    (asserts! (is-eq tx-sender (get owner farm)) ERR_UNAUTHORIZED)

    ;; Add admin
    (map-set farm-distribution-admins
      { farm-id: farm-id, admin: admin-address }
      { added-at: stacks-block-height }
    )

    ;; Emit event
    (print {
      event: "distribution-admin-added",
      farm-id: farm-id,
      admin: admin-address
    })
    (ok true)
  )
)

;; @desc Remove a distribution admin from a farm
;; @param farm-id: ID of the farm
;; @param admin-address: Principal address of the admin to remove
;; @returns (response bool uint) - true on success, error code on failure
(define-public (remove-distribution-admin (farm-id uint) (admin-address principal))
  (let
    (
      (farm (unwrap! (map-get? distribution-farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Only farm owner can remove admins
    (asserts! (is-eq tx-sender (get owner farm)) ERR_UNAUTHORIZED)

    ;; Cannot remove the owner
    (asserts! (not (is-eq admin-address (get owner farm))) ERR_UNAUTHORIZED)

    ;; Remove admin
    (map-delete farm-distribution-admins { farm-id: farm-id, admin: admin-address })

    ;; Emit event
    (print {
      event: "distribution-admin-removed",
      farm-id: farm-id,
      admin: admin-address
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - MEMBER SHARE REGISTRATION
;; ============================================================================

;; @desc Register or update a member's shares for distribution calculations
;; @param farm-id: ID of the farm
;; @param member: Member's principal address
;; @param share-count: Number of shares the member holds
;; @returns (response bool uint) - true on success, error code on failure
(define-public (register-member-shares (farm-id uint) (member principal) (share-count uint))
  (let
    (
      (farm (unwrap! (map-get? distribution-farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (current-shares (default-to u0 
        (match (map-get? farm-member-shares { farm-id: farm-id, member: member })
          shares (some (get share-count shares))
          none
        )))
      (farm-shares (unwrap! (map-get? farm-total-shares { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (current-total (get total-shares farm-shares))
    )
    ;; Only admins can register member shares
    (asserts! (is-distribution-admin farm-id) ERR_UNAUTHORIZED)

    ;; Update member shares
    (map-set farm-member-shares
      { farm-id: farm-id, member: member }
      { 
        share-count: share-count,
        registered-at: stacks-block-height
      }
    )

    ;; Update total shares (subtract old, add new)
    (map-set farm-total-shares
      { farm-id: farm-id }
      { total-shares: (+ (- current-total current-shares) share-count) }
    )

    ;; Emit event
    (print {
      event: "member-shares-registered",
      farm-id: farm-id,
      member: member,
      share-count: share-count
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - DISTRIBUTION MANAGEMENT
;; ============================================================================

;; @desc Create a new distribution
;; @param farm-id: ID of the farm
;; @param total-quantity: Total quantity to distribute
;; @param unit: Unit of measurement (e.g., "lbs", "boxes", "units")
;; @param distribution-date: Block height when distribution occurs
;; @param metadata-uri: URI for additional metadata
;; @returns (response uint uint) - Distribution ID on success, error code on failure
(define-public (create-distribution 
  (farm-id uint) 
  (total-quantity uint) 
  (unit (string-ascii 32))
  (distribution-date uint)
  (metadata-uri (string-ascii 512)))
  (let
    (
      (farm (unwrap! (map-get? distribution-farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (distribution-id (var-get distribution-id-nonce))
      (claim-deadline (+ distribution-date (var-get claim-expiration-blocks)))
    )
    ;; Only admins can create distributions
    (asserts! (is-distribution-admin farm-id) ERR_UNAUTHORIZED)

    ;; Validate inputs
    (asserts! (> total-quantity u0) ERR_INVALID_AMOUNT)
    (asserts! (> (len unit) u0) ERR_INVALID_UNIT)

    ;; Create distribution record
    (map-set distributions
      { distribution-id: distribution-id }
      {
        farm-id: farm-id,
        created-by: tx-sender,
        distribution-date: distribution-date,
        total-quantity: total-quantity,
        allocated-quantity: u0,
        claimed-quantity: u0,
        unit: unit,
        status: STATUS_SCHEDULED,
        claim-deadline: claim-deadline,
        metadata-uri: metadata-uri,
        created-at: stacks-block-height
      }
    )

    ;; Update farm distribution count
    (map-set distribution-farms
      { farm-id: farm-id }
      (merge farm { total-distributions: (+ (get total-distributions farm) u1) })
    )

    ;; Increment distribution ID counter
    (var-set distribution-id-nonce (+ distribution-id u1))

    ;; Emit event
    (print {
      event: "distribution-created",
      distribution-id: distribution-id,
      farm-id: farm-id,
      total-quantity: total-quantity,
      unit: unit,
      distribution-date: distribution-date,
      claim-deadline: claim-deadline
    })
    (ok distribution-id)
  )
)

;; @desc Activate a scheduled distribution (makes it available for claims)
;; @param distribution-id: ID of the distribution to activate
;; @returns (response bool uint) - true on success, error code on failure
(define-public (activate-distribution (distribution-id uint))
  (let
    (
      (distribution (unwrap! (map-get? distributions { distribution-id: distribution-id }) ERR_DISTRIBUTION_NOT_FOUND))
    )
    ;; Only admins can activate
    (asserts! (is-distribution-admin (get farm-id distribution)) ERR_UNAUTHORIZED)

    ;; Must be in scheduled status
    (asserts! (is-eq (get status distribution) STATUS_SCHEDULED) ERR_INVALID_STATUS)

    ;; Update status
    (map-set distributions
      { distribution-id: distribution-id }
      (merge distribution { status: STATUS_ACTIVE })
    )

    ;; Emit event
    (print {
      event: "distribution-activated",
      distribution-id: distribution-id,
      farm-id: (get farm-id distribution)
    })
    (ok true)
  )
)

;; @desc Mark a distribution as completed
;; @param distribution-id: ID of the distribution to complete
;; @returns (response bool uint) - true on success, error code on failure
(define-public (complete-distribution (distribution-id uint))
  (let
    (
      (distribution (unwrap! (map-get? distributions { distribution-id: distribution-id }) ERR_DISTRIBUTION_NOT_FOUND))
    )
    ;; Only admins can complete
    (asserts! (is-distribution-admin (get farm-id distribution)) ERR_UNAUTHORIZED)

    ;; Must be in active status
    (asserts! (is-eq (get status distribution) STATUS_ACTIVE) ERR_INVALID_STATUS)

    ;; Update status
    (map-set distributions
      { distribution-id: distribution-id }
      (merge distribution { status: STATUS_COMPLETED })
    )

    ;; Emit event
    (print {
      event: "distribution-completed",
      distribution-id: distribution-id,
      farm-id: (get farm-id distribution),
      claimed-quantity: (get claimed-quantity distribution),
      total-quantity: (get total-quantity distribution)
    })
    (ok true)
  )
)

;; @desc Cancel a distribution
;; @param distribution-id: ID of the distribution to cancel
;; @returns (response bool uint) - true on success, error code on failure
(define-public (cancel-distribution (distribution-id uint))
  (let
    (
      (distribution (unwrap! (map-get? distributions { distribution-id: distribution-id }) ERR_DISTRIBUTION_NOT_FOUND))
    )
    ;; Only admins can cancel
    (asserts! (is-distribution-admin (get farm-id distribution)) ERR_UNAUTHORIZED)

    ;; Cannot cancel completed distributions
    (asserts! (not (is-eq (get status distribution) STATUS_COMPLETED)) ERR_INVALID_STATUS)

    ;; Update status
    (map-set distributions
      { distribution-id: distribution-id }
      (merge distribution { status: STATUS_CANCELLED })
    )

    ;; Emit event
    (print {
      event: "distribution-cancelled",
      distribution-id: distribution-id,
      farm-id: (get farm-id distribution)
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - ALLOCATION MANAGEMENT
;; ============================================================================

;; @desc Allocate distribution to a specific member
;; @param distribution-id: ID of the distribution
;; @param member: Member's principal address
;; @param quantity: Quantity to allocate
;; @returns (response bool uint) - true on success, error code on failure
(define-public (allocate-to-member (distribution-id uint) (member principal) (quantity uint))
  (let
    (
      (distribution (unwrap! (map-get? distributions { distribution-id: distribution-id }) ERR_DISTRIBUTION_NOT_FOUND))
      (current-allocation (default-to 
        { allocated-quantity: u0, claimed-quantity: u0, claim-date: none, status: ALLOC_STATUS_PENDING }
        (map-get? member-allocations { distribution-id: distribution-id, member: member })))
      (new-allocated (+ (get allocated-quantity distribution) quantity))
    )
    ;; Only admins can allocate
    (asserts! (is-distribution-admin (get farm-id distribution)) ERR_UNAUTHORIZED)

    ;; Validate quantity
    (asserts! (> quantity u0) ERR_INVALID_AMOUNT)

    ;; Cannot over-allocate
    (asserts! (<= new-allocated (get total-quantity distribution)) ERR_OVER_ALLOCATION)

    ;; Distribution must be scheduled or active
    (asserts! 
      (or 
        (is-eq (get status distribution) STATUS_SCHEDULED)
        (is-eq (get status distribution) STATUS_ACTIVE)
      ) 
      ERR_INVALID_STATUS
    )

    ;; Update or create allocation
    (map-set member-allocations
      { distribution-id: distribution-id, member: member }
      {
        allocated-quantity: (+ (get allocated-quantity current-allocation) quantity),
        claimed-quantity: (get claimed-quantity current-allocation),
        claim-date: (get claim-date current-allocation),
        status: ALLOC_STATUS_PENDING
      }
    )

    ;; Update distribution allocated quantity
    (map-set distributions
      { distribution-id: distribution-id }
      (merge distribution { allocated-quantity: new-allocated })
    )

    ;; Emit event
    (print {
      event: "allocation-made",
      distribution-id: distribution-id,
      member: member,
      quantity: quantity,
      total-allocated: (+ (get allocated-quantity current-allocation) quantity)
    })
    (ok true)
  )
)

;; @desc Automatically allocate based on member share percentages
;; @param distribution-id: ID of the distribution
;; @param member: Member's principal address
;; @returns (response bool uint) - true on success, error code on failure
(define-public (auto-allocate-by-shares (distribution-id uint) (member principal))
  (let
    (
      (distribution (unwrap! (map-get? distributions { distribution-id: distribution-id }) ERR_DISTRIBUTION_NOT_FOUND))
      (farm-id (get farm-id distribution))
      (member-shares (unwrap! (map-get? farm-member-shares { farm-id: farm-id, member: member }) ERR_MEMBER_NOT_FOUND))
      (quantity (calculate-member-allocation farm-id member (get total-quantity distribution)))
    )
    ;; Only admins can auto-allocate
    (asserts! (is-distribution-admin farm-id) ERR_UNAUTHORIZED)

    ;; Must have a valid allocation amount
    (asserts! (> quantity u0) ERR_INVALID_AMOUNT)

    ;; Call allocate-to-member
    (allocate-to-member distribution-id member quantity)
  )
)

;; @desc Adjust an existing allocation
;; @param distribution-id: ID of the distribution
;; @param member: Member's principal address
;; @param new-quantity: New total allocation quantity
;; @returns (response bool uint) - true on success, error code on failure
(define-public (adjust-allocation (distribution-id uint) (member principal) (new-quantity uint))
  (let
    (
      (distribution (unwrap! (map-get? distributions { distribution-id: distribution-id }) ERR_DISTRIBUTION_NOT_FOUND))
      (allocation (unwrap! (map-get? member-allocations { distribution-id: distribution-id, member: member }) ERR_ALLOCATION_NOT_FOUND))
      (old-quantity (get allocated-quantity allocation))
      (quantity-diff (if (> new-quantity old-quantity) 
        (- new-quantity old-quantity) 
        u0))
      (new-total-allocated (+ (- (get allocated-quantity distribution) old-quantity) new-quantity))
    )
    ;; Only admins can adjust
    (asserts! (is-distribution-admin (get farm-id distribution)) ERR_UNAUTHORIZED)

    ;; Cannot adjust if already claimed
    (asserts! (is-eq (get status allocation) ALLOC_STATUS_PENDING) ERR_ALREADY_CLAIMED)

    ;; Cannot over-allocate
    (asserts! (<= new-total-allocated (get total-quantity distribution)) ERR_OVER_ALLOCATION)

    ;; Distribution must be scheduled or active
    (asserts! 
      (or 
        (is-eq (get status distribution) STATUS_SCHEDULED)
        (is-eq (get status distribution) STATUS_ACTIVE)
      ) 
      ERR_INVALID_STATUS
    )

    ;; Update allocation
    (map-set member-allocations
      { distribution-id: distribution-id, member: member }
      (merge allocation { allocated-quantity: new-quantity })
    )

    ;; Update distribution allocated quantity
    (map-set distributions
      { distribution-id: distribution-id }
      (merge distribution { allocated-quantity: new-total-allocated })
    )

    ;; Emit event
    (print {
      event: "allocation-adjusted",
      distribution-id: distribution-id,
      member: member,
      old-quantity: old-quantity,
      new-quantity: new-quantity
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - CLAIMING
;; ============================================================================

;; @desc Claim distribution allocation
;; @param distribution-id: ID of the distribution to claim
;; @returns (response bool uint) - true on success, error code on failure
(define-public (claim-distribution (distribution-id uint))
  (let
    (
      (distribution (unwrap! (map-get? distributions { distribution-id: distribution-id }) ERR_DISTRIBUTION_NOT_FOUND))
      (allocation (unwrap! (map-get? member-allocations { distribution-id: distribution-id, member: tx-sender }) ERR_ALLOCATION_NOT_FOUND))
    )
    ;; Distribution must be active
    (asserts! (is-eq (get status distribution) STATUS_ACTIVE) ERR_DISTRIBUTION_NOT_ACTIVE)

    ;; Allocation must be pending
    (asserts! (is-eq (get status allocation) ALLOC_STATUS_PENDING) ERR_ALREADY_CLAIMED)

    ;; Check claim deadline
    (asserts! (< stacks-block-height (get claim-deadline distribution)) ERR_CLAIM_EXPIRED)

    ;; Must have allocated quantity
    (asserts! (> (get allocated-quantity allocation) u0) ERR_NO_ALLOCATION)

    ;; Update allocation
    (map-set member-allocations
      { distribution-id: distribution-id, member: tx-sender }
      {
        allocated-quantity: (get allocated-quantity allocation),
        claimed-quantity: (get allocated-quantity allocation),
        claim-date: (some stacks-block-height),
        status: ALLOC_STATUS_CLAIMED
      }
    )

    ;; Update distribution claimed quantity
    (map-set distributions
      { distribution-id: distribution-id }
      (merge distribution { 
        claimed-quantity: (+ (get claimed-quantity distribution) (get allocated-quantity allocation))
      })
    )

    ;; Emit event
    (print {
      event: "distribution-claimed",
      distribution-id: distribution-id,
      member: tx-sender,
      claimed-quantity: (get allocated-quantity allocation),
      unit: (get unit distribution)
    })
    (ok true)
  )
)

;; @desc Mark an allocation as expired (admin only)
;; @param distribution-id: ID of the distribution
;; @param member: Member's principal address
;; @returns (response bool uint) - true on success, error code on failure
(define-public (expire-allocation (distribution-id uint) (member principal))
  (let
    (
      (distribution (unwrap! (map-get? distributions { distribution-id: distribution-id }) ERR_DISTRIBUTION_NOT_FOUND))
      (allocation (unwrap! (map-get? member-allocations { distribution-id: distribution-id, member: member }) ERR_ALLOCATION_NOT_FOUND))
    )
    ;; Only admins can expire allocations
    (asserts! (is-distribution-admin (get farm-id distribution)) ERR_UNAUTHORIZED)

    ;; Allocation must be pending
    (asserts! (is-eq (get status allocation) ALLOC_STATUS_PENDING) ERR_ALREADY_CLAIMED)

    ;; Must be past claim deadline
    (asserts! (>= stacks-block-height (get claim-deadline distribution)) ERR_INVALID_STATUS)

    ;; Update allocation status
    (map-set member-allocations
      { distribution-id: distribution-id, member: member }
      (merge allocation { status: ALLOC_STATUS_EXPIRED })
    )

    ;; Emit event
    (print {
      event: "allocation-expired",
      distribution-id: distribution-id,
      member: member,
      unclaimed-quantity: (get allocated-quantity allocation)
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - SCHEDULE MANAGEMENT
;; ============================================================================

;; @desc Set or update distribution schedule for a farm
;; @param farm-id: ID of the farm
;; @param frequency: Frequency string (e.g., "weekly", "biweekly", "monthly")
;; @param interval-blocks: Number of blocks between distributions
;; @param next-distribution-block: Block height of next scheduled distribution
;; @returns (response bool uint) - true on success, error code on failure
(define-public (set-distribution-schedule 
  (farm-id uint) 
  (frequency (string-ascii 32))
  (interval-blocks uint)
  (next-distribution-block uint))
  (let
    (
      (farm (unwrap! (map-get? distribution-farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Only admins can set schedule
    (asserts! (is-distribution-admin farm-id) ERR_UNAUTHORIZED)

    ;; Validate interval
    (asserts! (> interval-blocks u0) ERR_INVALID_AMOUNT)

    ;; Set schedule
    (map-set distribution-schedules
      { farm-id: farm-id }
      {
        frequency: frequency,
        interval-blocks: interval-blocks,
        next-distribution-block: next-distribution-block,
        is-active: true,
        last-distribution-id: none
      }
    )

    ;; Emit event
    (print {
      event: "distribution-schedule-set",
      farm-id: farm-id,
      frequency: frequency,
      interval-blocks: interval-blocks,
      next-distribution-block: next-distribution-block
    })
    (ok true)
  )
)

;; @desc Pause distribution schedule
;; @param farm-id: ID of the farm
;; @returns (response bool uint) - true on success, error code on failure
(define-public (pause-schedule (farm-id uint))
  (let
    (
      (schedule (unwrap! (map-get? distribution-schedules { farm-id: farm-id }) ERR_SCHEDULE_NOT_FOUND))
    )
    ;; Only admins can pause
    (asserts! (is-distribution-admin farm-id) ERR_UNAUTHORIZED)

    ;; Update schedule
    (map-set distribution-schedules
      { farm-id: farm-id }
      (merge schedule { is-active: false })
    )

    ;; Emit event
    (print {
      event: "schedule-paused",
      farm-id: farm-id
    })
    (ok true)
  )
)

;; @desc Resume distribution schedule
;; @param farm-id: ID of the farm
;; @returns (response bool uint) - true on success, error code on failure
(define-public (resume-schedule (farm-id uint))
  (let
    (
      (schedule (unwrap! (map-get? distribution-schedules { farm-id: farm-id }) ERR_SCHEDULE_NOT_FOUND))
    )
    ;; Only admins can resume
    (asserts! (is-distribution-admin farm-id) ERR_UNAUTHORIZED)

    ;; Update schedule
    (map-set distribution-schedules
      { farm-id: farm-id }
      (merge schedule { is-active: true })
    )

    ;; Emit event
    (print {
      event: "schedule-resumed",
      farm-id: farm-id
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - ADMIN
;; ============================================================================

;; @desc Update the default claim expiration period
;; @param new-expiration-blocks: New expiration period in blocks
;; @returns (response bool uint) - true on success, error code on failure
(define-public (set-claim-expiration-blocks (new-expiration-blocks uint))
  (begin
    ;; Only contract owner can update
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Validate
    (asserts! (> new-expiration-blocks u0) ERR_INVALID_AMOUNT)

    ;; Update
    (var-set claim-expiration-blocks new-expiration-blocks)

    ;; Emit event
    (print {
      event: "claim-expiration-updated",
      new-expiration-blocks: new-expiration-blocks
    })
    (ok true)
  )
)

;; ============================================================================
;; READ-ONLY FUNCTIONS
;; ============================================================================

;; @desc Get farm information
;; @param farm-id: ID of the farm
;; @returns (optional {...}) - Farm data or none if not found
(define-read-only (get-farm (farm-id uint))
  (map-get? distribution-farms { farm-id: farm-id })
)

;; @desc Get distribution details
;; @param distribution-id: ID of the distribution
;; @returns (optional {...}) - Distribution data or none if not found
(define-read-only (get-distribution (distribution-id uint))
  (map-get? distributions { distribution-id: distribution-id })
)

;; @desc Get member allocation for a distribution
;; @param distribution-id: ID of the distribution
;; @param member: Member's principal address
;; @returns (optional {...}) - Allocation data or none if not found
(define-read-only (get-member-allocation (distribution-id uint) (member principal))
  (map-get? member-allocations { distribution-id: distribution-id, member: member })
)

;; @desc Get distribution schedule for a farm
;; @param farm-id: ID of the farm
;; @returns (optional {...}) - Schedule data or none if not found
(define-read-only (get-distribution-schedule (farm-id uint))
  (map-get? distribution-schedules { farm-id: farm-id })
)

;; @desc Get member's registered shares for a farm
;; @param farm-id: ID of the farm
;; @param member: Member's principal address
;; @returns (optional {...}) - Member shares data or none if not found
(define-read-only (get-member-shares (farm-id uint) (member principal))
  (map-get? farm-member-shares { farm-id: farm-id, member: member })
)

;; @desc Get total shares for a farm
;; @param farm-id: ID of the farm
;; @returns uint - Total shares count
(define-read-only (get-total-shares (farm-id uint))
  (default-to u0
    (match (map-get? farm-total-shares { farm-id: farm-id })
      shares (some (get total-shares shares))
      none
    )
  )
)

;; @desc Check if an address is a distribution admin for a farm
;; @param farm-id: ID of the farm
;; @param admin: Address to check
;; @returns bool - true if address is distribution admin
(define-read-only (is-farm-distribution-admin (farm-id uint) (admin principal))
  (or 
    (match (map-get? distribution-farms { farm-id: farm-id })
      farm (is-eq admin (get owner farm))
      false
    )
    (is-some (map-get? farm-distribution-admins { farm-id: farm-id, admin: admin }))
  )
)

;; @desc Check if a distribution can be claimed
;; @param distribution-id: ID of the distribution
;; @returns bool - true if distribution is claimable
(define-read-only (is-distribution-claimable (distribution-id uint))
  (match (map-get? distributions { distribution-id: distribution-id })
    distribution (and 
      (is-eq (get status distribution) STATUS_ACTIVE)
      (< stacks-block-height (get claim-deadline distribution))
    )
    false
  )
)

;; @desc Calculate member's share percentage (in basis points)
;; @param farm-id: ID of the farm
;; @param member: Member's principal address
;; @returns uint - Share percentage in basis points (10000 = 100%)
(define-read-only (get-member-share-percentage (farm-id uint) (member principal))
  (let
    (
      (member-shares (default-to u0 
        (match (map-get? farm-member-shares { farm-id: farm-id, member: member })
          shares (some (get share-count shares))
          none
        )))
      (total-shares (default-to u1 
        (match (map-get? farm-total-shares { farm-id: farm-id })
          shares (some (get total-shares shares))
          none
        )))
    )
    (if (is-eq total-shares u0)
      u0
      (/ (* member-shares u10000) total-shares)
    )
  )
)

;; @desc Get the current claim expiration period
;; @returns uint - Claim expiration period in blocks
(define-read-only (get-claim-expiration-period)
  (var-get claim-expiration-blocks)
)

;; @desc Check if a member's allocation has expired
;; @param distribution-id: ID of the distribution
;; @param member: Member's principal address
;; @returns bool - true if allocation has expired
(define-read-only (is-allocation-expired (distribution-id uint) (member principal))
  (match (map-get? distributions { distribution-id: distribution-id })
    distribution (match (map-get? member-allocations { distribution-id: distribution-id, member: member })
      allocation (and 
        (is-eq (get status allocation) ALLOC_STATUS_PENDING)
        (>= stacks-block-height (get claim-deadline distribution))
      )
      false
    )
    false
  )
)

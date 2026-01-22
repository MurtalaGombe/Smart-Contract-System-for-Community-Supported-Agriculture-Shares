;; title: csa-registry
;; version: 1.0.0
;; summary: Central registry for CSA farms, members, and their relationships
;; description: Foundation contract that manages farm registration, member onboarding,
;;              and role-based access control for the CSA share system.

;; traits
;;

;; token definitions
;;

;; constants
;;

;; Error codes
(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_FARM_NOT_FOUND (err u101))
(define-constant ERR_FARM_ALREADY_EXISTS (err u102))
(define-constant ERR_INVALID_FARM_NAME (err u103))
(define-constant ERR_INVALID_LOCATION (err u104))
(define-constant ERR_MEMBER_NOT_FOUND (err u105))
(define-constant ERR_MEMBER_ALREADY_EXISTS (err u106))
(define-constant ERR_FARM_INACTIVE (err u107))
(define-constant ERR_ADMIN_NOT_FOUND (err u108))
(define-constant ERR_ADMIN_ALREADY_EXISTS (err u109))
(define-constant ERR_INVALID_STATUS (err u110))
(define-constant ERR_CANNOT_REMOVE_OWNER (err u111))

;; Contract owner
(define-constant CONTRACT_OWNER tx-sender)

;; Valid member statuses
(define-constant STATUS_ACTIVE "active")
(define-constant STATUS_INACTIVE "inactive")
(define-constant STATUS_SUSPENDED "suspended")

;; data vars
;;

;; Counter for farm IDs
(define-data-var farm-id-nonce uint u0)

;; data maps
;;

;; Farm registry - stores all farm information
(define-map farms
  { farm-id: uint }
  {
    owner: principal,
    name: (string-ascii 256),
    location: (string-ascii 512),
    created-at: uint,
    is-active: bool,
    total-members: uint,
    metadata-uri: (string-ascii 512)
  }
)

;; Member registry - stores member information per farm
(define-map members
  { farm-id: uint, member-address: principal }
  {
    joined-at: uint,
    status: (string-ascii 32),
    share-tier: (string-ascii 64),
    metadata-uri: (string-ascii 512)
  }
)

;; Farm admins - stores admin privileges per farm
(define-map farm-admins
  { farm-id: uint, admin-address: principal }
  { added-at: uint }
)

;; public functions
;;

;; @desc Register a new CSA farm
;; @param name: Farm name (1-256 characters)
;; @param location: Farm location (1-512 characters)
;; @param metadata-uri: URI for additional farm metadata
;; @returns (response uint uint) - Farm ID on success, error code on failure
(define-public (register-farm (name (string-ascii 256)) (location (string-ascii 512)) (metadata-uri (string-ascii 512)))
  (let
    (
      (new-farm-id (var-get farm-id-nonce))
    )
    ;; Validate inputs
    (asserts! (> (len name) u0) ERR_INVALID_FARM_NAME)
    (asserts! (> (len location) u0) ERR_INVALID_LOCATION)

    ;; Store farm data
    (map-set farms
      { farm-id: new-farm-id }
      {
        owner: tx-sender,
        name: name,
        location: location,
        created-at: stacks-block-height,
        is-active: true,
        total-members: u0,
        metadata-uri: metadata-uri
      }
    )

    ;; Add owner as first admin
    (map-set farm-admins
      { farm-id: new-farm-id, admin-address: tx-sender }
      { added-at: stacks-block-height }
    )

    ;; Increment farm ID counter
    (var-set farm-id-nonce (+ new-farm-id u1))

    ;; Emit event and return farm ID
    (print {
      event: "farm-registered",
      farm-id: new-farm-id,
      owner: tx-sender,
      name: name,
      location: location
    })
    (ok new-farm-id)
  )
)

;; @desc Add a member to a farm
;; @param farm-id: ID of the farm
;; @param member-address: Principal address of the member to add
;; @param share-tier: Share tier/package name
;; @param metadata-uri: URI for additional member metadata
;; @returns (response bool uint) - true on success, error code on failure
(define-public (add-member (farm-id uint) (member-address principal) (share-tier (string-ascii 64)) (metadata-uri (string-ascii 512)))
  (let
    (
      (farm (unwrap! (map-get? farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Verify farm is active
    (asserts! (get is-active farm) ERR_FARM_INACTIVE)

    ;; Verify caller is farm admin
    (asserts! (is-farm-admin farm-id tx-sender) ERR_UNAUTHORIZED)

    ;; Verify member doesn't already exist
    (asserts! (is-none (map-get? members { farm-id: farm-id, member-address: member-address })) ERR_MEMBER_ALREADY_EXISTS)

    ;; Add member
    (map-set members
      { farm-id: farm-id, member-address: member-address }
      {
        joined-at: stacks-block-height,
        status: STATUS_ACTIVE,
        share-tier: share-tier,
        metadata-uri: metadata-uri
      }
    )

    ;; Update farm member count
    (map-set farms
      { farm-id: farm-id }
      (merge farm { total-members: (+ (get total-members farm) u1) })
    )

    ;; Emit event
    (print {
      event: "member-added",
      farm-id: farm-id,
      member-address: member-address,
      share-tier: share-tier
    })
    (ok true)
  )
)

;; @desc Remove a member from a farm
;; @param farm-id: ID of the farm
;; @param member-address: Principal address of the member to remove
;; @returns (response bool uint) - true on success, error code on failure
(define-public (remove-member (farm-id uint) (member-address principal))
  (let
    (
      (farm (unwrap! (map-get? farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (member (unwrap! (map-get? members { farm-id: farm-id, member-address: member-address }) ERR_MEMBER_NOT_FOUND))
    )
    ;; Verify farm is active
    (asserts! (get is-active farm) ERR_FARM_INACTIVE)

    ;; Verify caller is farm admin
    (asserts! (is-farm-admin farm-id tx-sender) ERR_UNAUTHORIZED)

    ;; Remove member
    (map-delete members { farm-id: farm-id, member-address: member-address })

    ;; Update farm member count
    (map-set farms
      { farm-id: farm-id }
      (merge farm { total-members: (- (get total-members farm) u1) })
    )

    ;; Emit event
    (print {
      event: "member-removed",
      farm-id: farm-id,
      member-address: member-address
    })
    (ok true)
  )
)

;; @desc Update member status (active, inactive, suspended)
;; @param farm-id: ID of the farm
;; @param member-address: Principal address of the member
;; @param new-status: New status string
;; @returns (response bool uint) - true on success, error code on failure
(define-public (update-member-status (farm-id uint) (member-address principal) (new-status (string-ascii 32)))
  (let
    (
      (farm (unwrap! (map-get? farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
      (member (unwrap! (map-get? members { farm-id: farm-id, member-address: member-address }) ERR_MEMBER_NOT_FOUND))
    )
    ;; Verify caller is farm admin
    (asserts! (is-farm-admin farm-id tx-sender) ERR_UNAUTHORIZED)

    ;; Validate status
    (asserts! (or (is-eq new-status STATUS_ACTIVE) (or (is-eq new-status STATUS_INACTIVE) (is-eq new-status STATUS_SUSPENDED))) ERR_INVALID_STATUS)

    ;; Update member status
    (map-set members
      { farm-id: farm-id, member-address: member-address }
      (merge member { status: new-status })
    )

    ;; Emit event
    (print {
      event: "member-status-updated",
      farm-id: farm-id,
      member-address: member-address,
      new-status: new-status
    })
    (ok true)
  )
)

;; @desc Add a farm admin
;; @param farm-id: ID of the farm
;; @param admin-address: Principal address of the admin to add
;; @returns (response bool uint) - true on success, error code on failure
(define-public (add-farm-admin (farm-id uint) (admin-address principal))
  (let
    (
      (farm (unwrap! (map-get? farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Verify caller is farm owner
    (asserts! (is-eq tx-sender (get owner farm)) ERR_UNAUTHORIZED)

    ;; Verify admin doesn't already exist
    (asserts! (is-none (map-get? farm-admins { farm-id: farm-id, admin-address: admin-address })) ERR_ADMIN_ALREADY_EXISTS)

    ;; Add admin
    (map-set farm-admins
      { farm-id: farm-id, admin-address: admin-address }
      { added-at: stacks-block-height }
    )

    ;; Emit event
    (print {
      event: "admin-added",
      farm-id: farm-id,
      admin-address: admin-address
    })
    (ok true)
  )
)

;; @desc Remove a farm admin
;; @param farm-id: ID of the farm
;; @param admin-address: Principal address of the admin to remove
;; @returns (response bool uint) - true on success, error code on failure
(define-public (remove-farm-admin (farm-id uint) (admin-address principal))
  (let
    (
      (farm (unwrap! (map-get? farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Verify caller is farm owner
    (asserts! (is-eq tx-sender (get owner farm)) ERR_UNAUTHORIZED)

    ;; Cannot remove farm owner
    (asserts! (not (is-eq admin-address (get owner farm))) ERR_CANNOT_REMOVE_OWNER)

    ;; Verify admin exists
    (asserts! (is-some (map-get? farm-admins { farm-id: farm-id, admin-address: admin-address })) ERR_ADMIN_NOT_FOUND)

    ;; Remove admin
    (map-delete farm-admins { farm-id: farm-id, admin-address: admin-address })

    ;; Emit event
    (print {
      event: "admin-removed",
      farm-id: farm-id,
      admin-address: admin-address
    })
    (ok true)
  )
)

;; @desc Toggle farm active status
;; @param farm-id: ID of the farm
;; @param is-active: New active status
;; @returns (response bool uint) - true on success, error code on failure
(define-public (set-farm-active (farm-id uint) (is-active bool))
  (let
    (
      (farm (unwrap! (map-get? farms { farm-id: farm-id }) ERR_FARM_NOT_FOUND))
    )
    ;; Verify caller is farm owner
    (asserts! (is-eq tx-sender (get owner farm)) ERR_UNAUTHORIZED)

    ;; Update farm status
    (map-set farms
      { farm-id: farm-id }
      (merge farm { is-active: is-active })
    )

    ;; Emit event
    (print {
      event: "farm-status-updated",
      farm-id: farm-id,
      is-active: is-active
    })
    (ok true)
  )
)

;; read only functions
;;

;; @desc Get farm details by ID
;; @param farm-id: ID of the farm
;; @returns (optional {...}) - Farm data if found, none otherwise
(define-read-only (get-farm (farm-id uint))
  (map-get? farms { farm-id: farm-id })
)

;; @desc Get member details
;; @param farm-id: ID of the farm
;; @param member-address: Principal address of the member
;; @returns (optional {...}) - Member data if found, none otherwise
(define-read-only (get-member (farm-id uint) (member-address principal))
  (map-get? members { farm-id: farm-id, member-address: member-address })
)

;; @desc Check if an address is a farm admin
;; @param farm-id: ID of the farm
;; @param admin-address: Principal address to check
;; @returns bool - true if admin, false otherwise
(define-read-only (is-farm-admin (farm-id uint) (admin-address principal))
  (is-some (map-get? farm-admins { farm-id: farm-id, admin-address: admin-address }))
)

;; @desc Check if an address is a farm member
;; @param farm-id: ID of the farm
;; @param member-address: Principal address to check
;; @returns bool - true if member, false otherwise
(define-read-only (is-farm-member (farm-id uint) (member-address principal))
  (is-some (map-get? members { farm-id: farm-id, member-address: member-address }))
)

;; @desc Check if a member is active
;; @param farm-id: ID of the farm
;; @param member-address: Principal address to check
;; @returns bool - true if member is active, false otherwise
(define-read-only (is-member-active (farm-id uint) (member-address principal))
  (match (map-get? members { farm-id: farm-id, member-address: member-address })
    member (is-eq (get status member) STATUS_ACTIVE)
    false
  )
)

;; @desc Get the current farm ID nonce (next farm ID to be assigned)
;; @returns uint - Current farm ID nonce
(define-read-only (get-farm-id-nonce)
  (var-get farm-id-nonce)
)

;; @desc Get farm owner
;; @param farm-id: ID of the farm
;; @returns (optional principal) - Farm owner if found, none otherwise
(define-read-only (get-farm-owner (farm-id uint))
  (match (map-get? farms { farm-id: farm-id })
    farm (some (get owner farm))
    none
  )
)

;; @desc Get total members count for a farm
;; @param farm-id: ID of the farm
;; @returns (optional uint) - Total members if farm found, none otherwise
(define-read-only (get-farm-member-count (farm-id uint))
  (match (map-get? farms { farm-id: farm-id })
    farm (some (get total-members farm))
    none
  )
)

;; @desc Check if farm is active
;; @param farm-id: ID of the farm
;; @returns bool - true if farm is active, false otherwise
(define-read-only (is-farm-active (farm-id uint))
  (match (map-get? farms { farm-id: farm-id })
    farm (get is-active farm)
    false
  )
)

;; @desc Get contract owner
;; @returns principal - Contract owner address
(define-read-only (get-contract-owner)
  CONTRACT_OWNER
)

;; private functions
;;


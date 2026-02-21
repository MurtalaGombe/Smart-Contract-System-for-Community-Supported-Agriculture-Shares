;; title: governance
;; version: 1.0.0
;; summary: DAO-style governance for platform-wide decisions and dispute resolution
;; description: Implements decentralized governance for CSA platform operations.
;;              Enables community participation through proposals, voting, and
;;              transparent dispute resolution. Voting power is proportional to
;;              share ownership. This contract is designed to be modular and
;;              independent, maintaining its own registry of eligible voters.

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

;; Error codes - using 500 series to avoid conflicts with other contracts
(define-constant ERR_UNAUTHORIZED (err u500))
(define-constant ERR_PROPOSAL_NOT_FOUND (err u501))
(define-constant ERR_ALREADY_VOTED (err u502))
(define-constant ERR_VOTING_CLOSED (err u503))
(define-constant ERR_PROPOSAL_NOT_PASSED (err u504))
(define-constant ERR_PROPOSAL_ALREADY_EXECUTED (err u505))
(define-constant ERR_INVALID_TITLE (err u506))
(define-constant ERR_INVALID_DESCRIPTION (err u507))
(define-constant ERR_INVALID_TYPE (err u508))
(define-constant ERR_DISPUTE_NOT_FOUND (err u509))
(define-constant ERR_DISPUTE_ALREADY_RESOLVED (err u510))
(define-constant ERR_INVALID_AMOUNT (err u511))
(define-constant ERR_INSUFFICIENT_VOTING_POWER (err u512))
(define-constant ERR_VOTING_STILL_ACTIVE (err u513))
(define-constant ERR_INVALID_RESOLUTION (err u514))
(define-constant ERR_VOTER_NOT_REGISTERED (err u515))
(define-constant ERR_VOTER_ALREADY_REGISTERED (err u516))
(define-constant ERR_INVALID_FARM_ID (err u517))
(define-constant ERR_PROPOSAL_NOT_ACTIVE (err u518))
(define-constant ERR_DISPUTE_NOT_OPEN (err u519))

;; Contract owner - the deployer of this contract
(define-constant CONTRACT_OWNER tx-sender)

;; Proposal type constants
(define-constant TYPE_PARAMETER "parameter")
(define-constant TYPE_UPGRADE "upgrade")
(define-constant TYPE_DISPUTE "dispute")
(define-constant TYPE_GENERAL "general")

;; Proposal status constants
(define-constant STATUS_ACTIVE "active")
(define-constant STATUS_PASSED "passed")
(define-constant STATUS_REJECTED "rejected")
(define-constant STATUS_EXECUTED "executed")

;; Dispute status constants
(define-constant DISPUTE_STATUS_OPEN "open")
(define-constant DISPUTE_STATUS_RESOLVED "resolved")
(define-constant DISPUTE_STATUS_DISMISSED "dismissed")

;; Default configuration
(define-constant DEFAULT_VOTING_PERIOD u1440) ;; ~10 days at 10 min/block
(define-constant DEFAULT_MIN_VOTES_TO_PASS u1) ;; Minimum votes to consider proposal valid
(define-constant DEFAULT_QUORUM_PERCENTAGE u20) ;; 20% of registered voters must vote

;; ============================================================================
;; DATA VARIABLES
;; ============================================================================

;; Counter for proposal IDs (auto-incrementing)
(define-data-var proposal-id-nonce uint u0)

;; Counter for dispute IDs (auto-incrementing)
(define-data-var dispute-id-nonce uint u0)

;; Voting period in blocks
(define-data-var voting-period-blocks uint DEFAULT_VOTING_PERIOD)

;; Minimum voting power required to create a proposal
(define-data-var min-proposal-threshold uint u1)

;; Total registered voters (for quorum calculation)
(define-data-var total-registered-voters uint u0)

;; ============================================================================
;; DATA MAPS
;; ============================================================================

;; Governance proposals
(define-map proposals
  { proposal-id: uint }
  {
    proposer: principal,
    title: (string-ascii 256),
    description: (string-ascii 1024),
    proposal-type: (string-ascii 32),
    status: (string-ascii 32),
    created-at: uint,
    voting-deadline: uint,
    votes-for: uint,
    votes-against: uint,
    total-voters-at-creation: uint,
    executed-at: (optional uint),
    metadata-uri: (string-ascii 512)
  }
)

;; Vote records - tracks individual votes per proposal
(define-map votes
  { proposal-id: uint, voter: principal }
  {
    vote: bool,
    voting-power: uint,
    voted-at: uint
  }
)

;; Dispute records
(define-map disputes
  { dispute-id: uint }
  {
    farm-id: uint,
    complainant: principal,
    respondent: principal,
    description: (string-ascii 1024),
    status: (string-ascii 32),
    resolution: (string-ascii 512),
    created-at: uint,
    resolved-at: (optional uint),
    resolved-by: (optional principal),
    linked-proposal-id: (optional uint)
  }
)

;; Registered voters with their voting power
(define-map registered-voters
  { voter: principal }
  {
    voting-power: uint,
    registered-at: uint,
    is-active: bool
  }
)

;; ============================================================================
;; PRIVATE FUNCTIONS
;; ============================================================================

;; @desc Check if a proposal type is valid
;; @param proposal-type: Type string to validate
;; @returns bool - true if valid type
(define-private (is-valid-proposal-type (proposal-type (string-ascii 32)))
  (or
    (is-eq proposal-type TYPE_PARAMETER)
    (or
      (is-eq proposal-type TYPE_UPGRADE)
      (or
        (is-eq proposal-type TYPE_DISPUTE)
        (is-eq proposal-type TYPE_GENERAL)
      )
    )
  )
)

;; @desc Get voter's voting power (defaults to 0 if not registered)
;; @param voter: Principal to check
;; @returns uint - Voting power
(define-private (get-voting-power (voter principal))
  (match (map-get? registered-voters { voter: voter })
    voter-data (if (get is-active voter-data) (get voting-power voter-data) u0)
    u0
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - VOTER REGISTRATION
;; ============================================================================

;; @desc Register a voter with specified voting power (admin only)
;; @param voter: Principal address of the voter
;; @param voting-power: Voting power to assign (typically based on share ownership)
;; @returns (response bool uint) - true on success, error code on failure
;; @events voter-registered
(define-public (register-voter (voter principal) (voting-power uint))
  (begin
    ;; Only contract owner can register voters
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Validate voting power
    (asserts! (> voting-power u0) ERR_INVALID_AMOUNT)

    ;; Check if voter already registered
    (asserts! (is-none (map-get? registered-voters { voter: voter })) ERR_VOTER_ALREADY_REGISTERED)

    ;; Register voter
    (map-set registered-voters
      { voter: voter }
      {
        voting-power: voting-power,
        registered-at: stacks-block-height,
        is-active: true
      }
    )

    ;; Increment total voters
    (var-set total-registered-voters (+ (var-get total-registered-voters) u1))

    ;; Emit event
    (print {
      event: "voter-registered",
      voter: voter,
      voting-power: voting-power,
      block-height: stacks-block-height
    })
    (ok true)
  )
)

;; @desc Update a voter's voting power (admin only)
;; @param voter: Principal address of the voter
;; @param new-voting-power: New voting power to assign
;; @returns (response bool uint) - true on success, error code on failure
;; @events voter-power-updated
(define-public (update-voter-power (voter principal) (new-voting-power uint))
  (let
    (
      (voter-data (unwrap! (map-get? registered-voters { voter: voter }) ERR_VOTER_NOT_REGISTERED))
    )
    ;; Only contract owner can update voting power
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Validate new voting power
    (asserts! (> new-voting-power u0) ERR_INVALID_AMOUNT)

    ;; Update voting power
    (map-set registered-voters
      { voter: voter }
      (merge voter-data { voting-power: new-voting-power })
    )

    ;; Emit event
    (print {
      event: "voter-power-updated",
      voter: voter,
      new-voting-power: new-voting-power
    })
    (ok true)
  )
)

;; @desc Deactivate a voter (admin only)
;; @param voter: Principal address of the voter
;; @returns (response bool uint) - true on success, error code on failure
;; @events voter-deactivated
(define-public (deactivate-voter (voter principal))
  (let
    (
      (voter-data (unwrap! (map-get? registered-voters { voter: voter }) ERR_VOTER_NOT_REGISTERED))
    )
    ;; Only contract owner can deactivate voters
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Deactivate voter
    (map-set registered-voters
      { voter: voter }
      (merge voter-data { is-active: false })
    )

    ;; Decrement total voters
    (var-set total-registered-voters (- (var-get total-registered-voters) u1))

    ;; Emit event
    (print {
      event: "voter-deactivated",
      voter: voter
    })
    (ok true)
  )
)

;; @desc Reactivate a voter (admin only)
;; @param voter: Principal address of the voter
;; @returns (response bool uint) - true on success, error code on failure
;; @events voter-reactivated
(define-public (reactivate-voter (voter principal))
  (let
    (
      (voter-data (unwrap! (map-get? registered-voters { voter: voter }) ERR_VOTER_NOT_REGISTERED))
    )
    ;; Only contract owner can reactivate voters
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Must be currently inactive
    (asserts! (not (get is-active voter-data)) ERR_VOTER_ALREADY_REGISTERED)

    ;; Reactivate voter
    (map-set registered-voters
      { voter: voter }
      (merge voter-data { is-active: true })
    )

    ;; Increment total voters
    (var-set total-registered-voters (+ (var-get total-registered-voters) u1))

    ;; Emit event
    (print {
      event: "voter-reactivated",
      voter: voter
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - PROPOSAL MANAGEMENT
;; ============================================================================

;; @desc Create a new governance proposal
;; @param title: Proposal title (1-256 characters)
;; @param description: Proposal description (1-1024 characters)
;; @param proposal-type: Type of proposal ("parameter", "upgrade", "dispute", "general")
;; @param metadata-uri: URI for additional proposal metadata
;; @returns (response uint uint) - Proposal ID on success, error code on failure
;; @events proposal-created
(define-public (create-proposal 
  (title (string-ascii 256)) 
  (description (string-ascii 1024))
  (proposal-type (string-ascii 32))
  (metadata-uri (string-ascii 512)))
  (let
    (
      (proposal-id (var-get proposal-id-nonce))
      (caller-power (get-voting-power tx-sender))
      (deadline (+ stacks-block-height (var-get voting-period-blocks)))
    )
    ;; Validate inputs
    (asserts! (> (len title) u0) ERR_INVALID_TITLE)
    (asserts! (> (len description) u0) ERR_INVALID_DESCRIPTION)
    (asserts! (is-valid-proposal-type proposal-type) ERR_INVALID_TYPE)

    ;; Verify proposer has sufficient voting power
    (asserts! (>= caller-power (var-get min-proposal-threshold)) ERR_INSUFFICIENT_VOTING_POWER)

    ;; Create proposal
    (map-set proposals
      { proposal-id: proposal-id }
      {
        proposer: tx-sender,
        title: title,
        description: description,
        proposal-type: proposal-type,
        status: STATUS_ACTIVE,
        created-at: stacks-block-height,
        voting-deadline: deadline,
        votes-for: u0,
        votes-against: u0,
        total-voters-at-creation: (var-get total-registered-voters),
        executed-at: none,
        metadata-uri: metadata-uri
      }
    )

    ;; Increment proposal ID counter
    (var-set proposal-id-nonce (+ proposal-id u1))

    ;; Emit event
    (print {
      event: "proposal-created",
      proposal-id: proposal-id,
      proposer: tx-sender,
      title: title,
      proposal-type: proposal-type,
      voting-deadline: deadline
    })
    (ok proposal-id)
  )
)

;; @desc Vote on an active proposal
;; @param proposal-id: ID of the proposal to vote on
;; @param vote-for: true = vote for, false = vote against
;; @returns (response bool uint) - true on success, error code on failure
;; @events vote-cast
(define-public (vote-on-proposal (proposal-id uint) (vote-for bool))
  (let
    (
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR_PROPOSAL_NOT_FOUND))
      (caller-power (get-voting-power tx-sender))
    )
    ;; Verify proposal is active
    (asserts! (is-eq (get status proposal) STATUS_ACTIVE) ERR_PROPOSAL_NOT_ACTIVE)

    ;; Verify voting period hasn't expired
    (asserts! (< stacks-block-height (get voting-deadline proposal)) ERR_VOTING_CLOSED)

    ;; Verify voter has voting power
    (asserts! (> caller-power u0) ERR_INSUFFICIENT_VOTING_POWER)

    ;; Verify voter hasn't already voted
    (asserts! (is-none (map-get? votes { proposal-id: proposal-id, voter: tx-sender })) ERR_ALREADY_VOTED)

    ;; Record vote
    (map-set votes
      { proposal-id: proposal-id, voter: tx-sender }
      {
        vote: vote-for,
        voting-power: caller-power,
        voted-at: stacks-block-height
      }
    )

    ;; Update proposal vote tallies (weighted by voting power)
    (if vote-for
      (map-set proposals
        { proposal-id: proposal-id }
        (merge proposal { votes-for: (+ (get votes-for proposal) caller-power) })
      )
      (map-set proposals
        { proposal-id: proposal-id }
        (merge proposal { votes-against: (+ (get votes-against proposal) caller-power) })
      )
    )

    ;; Emit event
    (print {
      event: "vote-cast",
      proposal-id: proposal-id,
      voter: tx-sender,
      vote-for: vote-for,
      voting-power: caller-power
    })
    (ok true)
  )
)

;; @desc Finalize a proposal after voting period ends
;; @param proposal-id: ID of the proposal to finalize
;; @returns (response bool uint) - true on success, error code on failure
;; @events proposal-finalized
(define-public (finalize-proposal (proposal-id uint))
  (let
    (
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR_PROPOSAL_NOT_FOUND))
    )
    ;; Proposal must still be in active status
    (asserts! (is-eq (get status proposal) STATUS_ACTIVE) ERR_PROPOSAL_NOT_ACTIVE)

    ;; Voting period must have ended
    (asserts! (>= stacks-block-height (get voting-deadline proposal)) ERR_VOTING_STILL_ACTIVE)

    ;; Determine outcome: passed if votes-for > votes-against and min votes met
    (if (and 
          (> (get votes-for proposal) (get votes-against proposal))
          (>= (+ (get votes-for proposal) (get votes-against proposal)) (var-get min-proposal-threshold))
        )
      ;; Proposal passed
      (begin
        (map-set proposals
          { proposal-id: proposal-id }
          (merge proposal { status: STATUS_PASSED })
        )
        (print {
          event: "proposal-finalized",
          proposal-id: proposal-id,
          outcome: "passed",
          votes-for: (get votes-for proposal),
          votes-against: (get votes-against proposal)
        })
        (ok true)
      )
      ;; Proposal rejected
      (begin
        (map-set proposals
          { proposal-id: proposal-id }
          (merge proposal { status: STATUS_REJECTED })
        )
        (print {
          event: "proposal-finalized",
          proposal-id: proposal-id,
          outcome: "rejected",
          votes-for: (get votes-for proposal),
          votes-against: (get votes-against proposal)
        })
        (ok true)
      )
    )
  )
)

;; @desc Execute a passed proposal (admin only)
;; @param proposal-id: ID of the proposal to execute
;; @returns (response bool uint) - true on success, error code on failure
;; @events proposal-executed
(define-public (execute-proposal (proposal-id uint))
  (let
    (
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR_PROPOSAL_NOT_FOUND))
    )
    ;; Only contract owner can execute proposals
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Proposal must have passed
    (asserts! (is-eq (get status proposal) STATUS_PASSED) ERR_PROPOSAL_NOT_PASSED)

    ;; Mark as executed
    (map-set proposals
      { proposal-id: proposal-id }
      (merge proposal { 
        status: STATUS_EXECUTED,
        executed-at: (some stacks-block-height)
      })
    )

    ;; Emit event
    (print {
      event: "proposal-executed",
      proposal-id: proposal-id,
      executed-by: tx-sender,
      proposal-type: (get proposal-type proposal),
      block-height: stacks-block-height
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - DISPUTE MANAGEMENT
;; ============================================================================

;; @desc File a new dispute
;; @param farm-id: ID of the farm related to the dispute
;; @param respondent: Principal of the party being disputed
;; @param description: Detailed description of the dispute (1-1024 characters)
;; @returns (response uint uint) - Dispute ID on success, error code on failure
;; @events dispute-filed
(define-public (file-dispute 
  (farm-id uint)
  (respondent principal) 
  (description (string-ascii 1024)))
  (let
    (
      (dispute-id (var-get dispute-id-nonce))
    )
    ;; Validate inputs
    (asserts! (> (len description) u0) ERR_INVALID_DESCRIPTION)

    ;; Complainant cannot dispute themselves
    (asserts! (not (is-eq tx-sender respondent)) ERR_UNAUTHORIZED)

    ;; Create dispute record
    (map-set disputes
      { dispute-id: dispute-id }
      {
        farm-id: farm-id,
        complainant: tx-sender,
        respondent: respondent,
        description: description,
        status: DISPUTE_STATUS_OPEN,
        resolution: "",
        created-at: stacks-block-height,
        resolved-at: none,
        resolved-by: none,
        linked-proposal-id: none
      }
    )

    ;; Increment dispute ID counter
    (var-set dispute-id-nonce (+ dispute-id u1))

    ;; Emit event
    (print {
      event: "dispute-filed",
      dispute-id: dispute-id,
      farm-id: farm-id,
      complainant: tx-sender,
      respondent: respondent
    })
    (ok dispute-id)
  )
)

;; @desc Resolve a dispute (admin only)
;; @param dispute-id: ID of the dispute to resolve
;; @param resolution: Resolution description (1-512 characters)
;; @returns (response bool uint) - true on success, error code on failure
;; @events dispute-resolved
(define-public (resolve-dispute (dispute-id uint) (resolution (string-ascii 512)))
  (let
    (
      (dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) ERR_DISPUTE_NOT_FOUND))
    )
    ;; Only contract owner can resolve disputes
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Dispute must be open
    (asserts! (is-eq (get status dispute) DISPUTE_STATUS_OPEN) ERR_DISPUTE_NOT_OPEN)

    ;; Validate resolution
    (asserts! (> (len resolution) u0) ERR_INVALID_RESOLUTION)

    ;; Update dispute
    (map-set disputes
      { dispute-id: dispute-id }
      (merge dispute {
        status: DISPUTE_STATUS_RESOLVED,
        resolution: resolution,
        resolved-at: (some stacks-block-height),
        resolved-by: (some tx-sender)
      })
    )

    ;; Emit event
    (print {
      event: "dispute-resolved",
      dispute-id: dispute-id,
      resolved-by: tx-sender,
      resolution: resolution
    })
    (ok true)
  )
)

;; @desc Dismiss a dispute (admin only)
;; @param dispute-id: ID of the dispute to dismiss
;; @param reason: Reason for dismissal (1-512 characters)
;; @returns (response bool uint) - true on success, error code on failure
;; @events dispute-dismissed
(define-public (dismiss-dispute (dispute-id uint) (reason (string-ascii 512)))
  (let
    (
      (dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) ERR_DISPUTE_NOT_FOUND))
    )
    ;; Only contract owner can dismiss disputes
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Dispute must be open
    (asserts! (is-eq (get status dispute) DISPUTE_STATUS_OPEN) ERR_DISPUTE_NOT_OPEN)

    ;; Validate reason
    (asserts! (> (len reason) u0) ERR_INVALID_RESOLUTION)

    ;; Update dispute
    (map-set disputes
      { dispute-id: dispute-id }
      (merge dispute {
        status: DISPUTE_STATUS_DISMISSED,
        resolution: reason,
        resolved-at: (some stacks-block-height),
        resolved-by: (some tx-sender)
      })
    )

    ;; Emit event
    (print {
      event: "dispute-dismissed",
      dispute-id: dispute-id,
      dismissed-by: tx-sender,
      reason: reason
    })
    (ok true)
  )
)

;; @desc Link a dispute to a governance proposal
;; @param dispute-id: ID of the dispute
;; @param proposal-id: ID of the linked proposal
;; @returns (response bool uint) - true on success, error code on failure
;; @events dispute-linked-to-proposal
(define-public (link-dispute-to-proposal (dispute-id uint) (proposal-id uint))
  (let
    (
      (dispute (unwrap! (map-get? disputes { dispute-id: dispute-id }) ERR_DISPUTE_NOT_FOUND))
      (proposal (unwrap! (map-get? proposals { proposal-id: proposal-id }) ERR_PROPOSAL_NOT_FOUND))
    )
    ;; Only contract owner can link disputes
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Dispute must be open
    (asserts! (is-eq (get status dispute) DISPUTE_STATUS_OPEN) ERR_DISPUTE_NOT_OPEN)

    ;; Update dispute with linked proposal
    (map-set disputes
      { dispute-id: dispute-id }
      (merge dispute { linked-proposal-id: (some proposal-id) })
    )

    ;; Emit event
    (print {
      event: "dispute-linked-to-proposal",
      dispute-id: dispute-id,
      proposal-id: proposal-id
    })
    (ok true)
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - ADMIN CONFIGURATION
;; ============================================================================

;; @desc Update the voting period for new proposals
;; @param new-period-blocks: New voting period in blocks
;; @returns (response bool uint) - true on success, error code on failure
;; @events voting-period-updated
(define-public (set-voting-period (new-period-blocks uint))
  (begin
    ;; Only contract owner can update
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Validate period
    (asserts! (> new-period-blocks u0) ERR_INVALID_AMOUNT)

    ;; Update period
    (var-set voting-period-blocks new-period-blocks)

    ;; Emit event
    (print {
      event: "voting-period-updated",
      new-period-blocks: new-period-blocks,
      updated-by: tx-sender
    })
    (ok true)
  )
)

;; @desc Update the minimum voting power required to create proposals
;; @param new-threshold: New minimum threshold
;; @returns (response bool uint) - true on success, error code on failure
;; @events proposal-threshold-updated
(define-public (set-proposal-threshold (new-threshold uint))
  (begin
    ;; Only contract owner can update
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)

    ;; Validate threshold
    (asserts! (> new-threshold u0) ERR_INVALID_AMOUNT)

    ;; Update threshold
    (var-set min-proposal-threshold new-threshold)

    ;; Emit event
    (print {
      event: "proposal-threshold-updated",
      new-threshold: new-threshold,
      updated-by: tx-sender
    })
    (ok true)
  )
)

;; ============================================================================
;; READ-ONLY FUNCTIONS
;; ============================================================================

;; @desc Get proposal details
;; @param proposal-id: ID of the proposal
;; @returns (optional {...}) - Proposal data or none if not found
(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals { proposal-id: proposal-id })
)

;; @desc Get vote details for a specific voter on a proposal
;; @param proposal-id: ID of the proposal
;; @param voter: Principal of the voter
;; @returns (optional {...}) - Vote data or none if not voted
(define-read-only (get-vote (proposal-id uint) (voter principal))
  (map-get? votes { proposal-id: proposal-id, voter: voter })
)

;; @desc Check if an address has voted on a proposal
;; @param proposal-id: ID of the proposal
;; @param voter: Principal to check
;; @returns bool - true if the address has voted
(define-read-only (has-voted (proposal-id uint) (voter principal))
  (is-some (map-get? votes { proposal-id: proposal-id, voter: voter }))
)

;; @desc Check if a proposal has passed
;; @param proposal-id: ID of the proposal
;; @returns bool - true if proposal status is "passed" or "executed"
(define-read-only (is-proposal-passed (proposal-id uint))
  (match (map-get? proposals { proposal-id: proposal-id })
    proposal (or 
      (is-eq (get status proposal) STATUS_PASSED)
      (is-eq (get status proposal) STATUS_EXECUTED)
    )
    false
  )
)

;; @desc Get dispute details
;; @param dispute-id: ID of the dispute
;; @returns (optional {...}) - Dispute data or none if not found
(define-read-only (get-dispute (dispute-id uint))
  (map-get? disputes { dispute-id: dispute-id })
)

;; @desc Get voter registration details
;; @param voter: Principal of the voter
;; @returns (optional {...}) - Voter data or none if not registered
(define-read-only (get-voter (voter principal))
  (map-get? registered-voters { voter: voter })
)

;; @desc Check if a voter is registered and active
;; @param voter: Principal to check
;; @returns bool - true if voter is registered and active
(define-read-only (is-active-voter (voter principal))
  (match (map-get? registered-voters { voter: voter })
    voter-data (get is-active voter-data)
    false
  )
)

;; @desc Get proposal vote tallies
;; @param proposal-id: ID of the proposal
;; @returns (optional { votes-for: uint, votes-against: uint }) - Vote tallies
(define-read-only (get-proposal-votes (proposal-id uint))
  (match (map-get? proposals { proposal-id: proposal-id })
    proposal (some {
      votes-for: (get votes-for proposal),
      votes-against: (get votes-against proposal)
    })
    none
  )
)

;; @desc Get the current voting period in blocks
;; @returns uint - Voting period in blocks
(define-read-only (get-voting-period)
  (var-get voting-period-blocks)
)

;; @desc Get the minimum proposal threshold
;; @returns uint - Minimum voting power to create proposals
(define-read-only (get-proposal-threshold)
  (var-get min-proposal-threshold)
)

;; @desc Get the total number of registered voters
;; @returns uint - Total registered voter count
(define-read-only (get-total-voters)
  (var-get total-registered-voters)
)

;; @desc Get the current proposal ID nonce (next proposal ID)
;; @returns uint - Current proposal nonce
(define-read-only (get-proposal-count)
  (var-get proposal-id-nonce)
)

;; @desc Get the current dispute ID nonce (next dispute ID)
;; @returns uint - Current dispute nonce
(define-read-only (get-dispute-count)
  (var-get dispute-id-nonce)
)

;; @desc Check if voting is still active for a proposal
;; @param proposal-id: ID of the proposal
;; @returns bool - true if the proposal is active and voting hasn't closed
(define-read-only (is-voting-active (proposal-id uint))
  (match (map-get? proposals { proposal-id: proposal-id })
    proposal (and 
      (is-eq (get status proposal) STATUS_ACTIVE)
      (< stacks-block-height (get voting-deadline proposal))
    )
    false
  )
)

;; @desc Get contract owner
;; @returns principal - Contract owner address
(define-read-only (get-contract-owner)
  CONTRACT_OWNER
)

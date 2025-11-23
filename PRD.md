# Product Requirements Document (PRD)
## Smart-Contract-System-for-Community-Supported-Agriculture-Shares

**Version:** 1.0  
**Date:** October 2024  
**Status:** Draft  
**Technology Stack:** Stacks Blockchain, Clarity Smart Contracts, Stacks.js, Node.js, TypeScript

---

## 1. Executive Summary

### Project Overview and Vision

The Smart-Contract-System-for-Community-Supported-Agriculture-Shares is a blockchain-based platform built on the Stacks blockchain that revolutionizes how Community Supported Agriculture (CSA) operations manage shares, distributions, and member relationships. By leveraging Clarity smart contracts and Bitcoin's security through Stacks, this system provides transparent, immutable, and automated management of agricultural share systems.

**Vision:** To democratize agricultural financing and create a trustless, transparent ecosystem where farmers and CSA members can engage in fair, automated share management without intermediaries.

### Target Users

1. **Farmers/Farm Operators:** CSA farm owners who manage share programs and coordinate distributions
2. **CSA Members/Shareholders:** Individuals who purchase agricultural shares and receive regular produce distributions
3. **Farm Administrators:** Staff managing day-to-day operations, distributions, and member communications
4. **Cooperative Managers:** Organizations overseeing multiple CSA operations
5. **Blockchain Participants:** Users interacting with the system via Stacks wallets (Hiro Wallet, Leather, etc.)

### Key Business Objectives

- **Transparency:** Provide immutable records of share ownership, distributions, and farm operations
- **Automation:** Reduce manual administrative overhead through smart contract automation
- **Trust:** Enable trustless interactions between farmers and members through blockchain verification
- **Scalability:** Support multiple CSA operations on a single platform
- **Accessibility:** Lower barriers to entry for small and medium-sized farms
- **Compliance:** Maintain regulatory compliance with agricultural and securities regulations

### Success Metrics

- Number of active CSA operations on the platform
- Total value of shares managed through smart contracts
- Member satisfaction and retention rates
- Transaction throughput and system uptime (>99.5%)
- Smart contract security audit scores
- Time to complete share distributions (target: <24 hours)
- Cost savings vs. traditional CSA management systems

---

## 2. Problem Statement

### Current Challenges in Traditional CSA Share Management

**Manual Administration Burden:**
- Share tracking relies on spreadsheets and manual record-keeping
- Distribution scheduling requires constant communication and coordination
- Payment processing is time-consuming and error-prone
- Member verification and access control are difficult to manage at scale

**Trust and Transparency Issues:**
- Members have limited visibility into farm operations and share allocation
- Disputes over distributions or share terms are difficult to resolve
- No immutable record of transactions or agreements
- Farmers must maintain centralized databases vulnerable to loss or tampering

**Financial Inefficiencies:**
- High transaction costs for payment processing
- Delayed settlements and fund transfers
- Limited access to financing for seasonal operations
- Difficulty managing multiple payment methods

**Scalability Constraints:**
- Current systems don't scale efficiently for multi-farm cooperatives
- Difficult to manage cross-farm share transfers or trading
- Limited interoperability between different CSA management systems

### Why Blockchain/Smart Contracts Are the Appropriate Solution

**Immutability & Transparency:**
- All transactions and share allocations are permanently recorded on the blockchain
- Members can independently verify their share ownership and distribution history
- Eliminates disputes through transparent, auditable records

**Automation & Efficiency:**
- Smart contracts automatically execute distribution logic based on predefined conditions
- Reduces manual intervention and associated errors
- Enables real-time settlement and fund transfers

**Decentralization & Trust:**
- Removes need for centralized intermediaries
- Farmers and members interact directly through trustless smart contracts
- Bitcoin-backed security through Stacks provides additional assurance

**Cost Reduction:**
- Eliminates intermediary fees
- Reduces administrative overhead
- Enables micropayments and fractional share ownership

**Interoperability:**
- Stacks blockchain enables cross-contract interactions
- Supports integration with other DeFi protocols
- Enables share trading and secondary markets

---

## 3. System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
│  (Next.js/React Web App + Mobile Wallet Integration)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API Layer                           │
│  (Node.js/Express - Indexing, Notifications, Off-chain)    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Stacks.js Integration Layer                     │
│  (Transaction Building, Wallet Connection, Contract Calls)  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Stacks Blockchain (Testnet/Mainnet)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Smart Contracts (Clarity)                    │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │ 1. CSA-Registry (Farm & Member Management)      │ │   │
│  │  │ 2. Share-Token (SIP-010 Token Standard)         │ │   │
│  │  │ 3. Distribution-Manager (Produce Distribution)  │ │   │
│  │  │ 4. Payment-Processor (Fund Management)          │ │   │
│  │  │ 5. Governance (DAO-style Operations)            │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Bitcoin Network (Settlement Layer)              │
│  (Stacks settles to Bitcoin for final security)             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Blockchain** | Stacks (STX) | Smart contract execution, Bitcoin-backed security |
| **Smart Contracts** | Clarity | Immutable business logic, automated operations |
| **Frontend** | Next.js, React, TypeScript | User interface, wallet integration |
| **Backend** | Node.js, Express, TypeScript | API, indexing, notifications |
| **Blockchain Integration** | Stacks.js, @stacks/transactions | Contract interaction, transaction building |
| **Wallet Integration** | Hiro Wallet, Leather | User authentication, transaction signing |
| **Database** | PostgreSQL | Off-chain data indexing, user profiles |
| **Testing** | Vitest, Clarinet SDK | Unit and integration testing |
| **Deployment** | Docker, Clarinet | Contract deployment and management |

### Integration Points and Data Flow

**User Registration & Authentication:**
1. User connects wallet (Hiro/Leather)
2. Frontend captures Stacks address
3. Backend creates user profile linked to address
4. User gains access to dashboard

**Share Purchase Flow:**
1. Member selects share package
2. Frontend builds transaction via Stacks.js
3. User signs transaction in wallet
4. Smart contract executes, mints share tokens
5. Backend indexes transaction and updates UI

**Distribution Management Flow:**
1. Farmer initiates distribution via admin panel
2. Smart contract calculates allocations based on share ownership
3. Distribution contract executes automated transfers
4. Backend notifies members of available produce
5. Members claim their distribution via frontend

**Payment Processing:**
1. Member initiates payment for share
2. Stacks.js builds STX transfer transaction
3. Transaction settles on Stacks blockchain
4. Bitcoin network provides final settlement
5. Backend confirms payment and updates records

---

## 4. Smart Contract Specifications

### Deployment Order & Justification

Smart contracts must be deployed in the following order to ensure proper initialization and dependency resolution:

1. **CSA-Registry** (Foundation - no dependencies)
2. **Share-Token** (Depends on CSA-Registry for farm verification)
3. **Payment-Processor** (Depends on CSA-Registry and Share-Token)
4. **Distribution-Manager** (Depends on Share-Token and Payment-Processor)
5. **Governance** (Depends on all other contracts)

This sequence ensures each contract can properly reference and interact with previously deployed contracts.

---

### 4.1 CSA-Registry Contract

**Contract Name:** `csa-registry`

**Purpose:**
Central registry for all CSA farms, members, and their relationships. Serves as the foundational contract that other contracts reference for authorization and data validation.

**Business Justification:**
- Single source of truth for farm and member information
- Enables role-based access control across all contracts
- Allows efficient querying of farm and member data
- Supports multi-farm operations and cooperatives

**Data Structures:**

```clarity
;; Maps and Variables
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

(define-map members
  { farm-id: uint, member-address: principal }
  {
    joined-at: uint,
    status: (string-ascii 32), ;; "active", "inactive", "suspended"
    share-tier: (string-ascii 64),
    metadata-uri: (string-ascii 512)
  }
)

(define-map farm-admins
  { farm-id: uint, admin-address: principal }
  { role: (string-ascii 32) } ;; "owner", "manager", "distributor"
)

(define-data-var next-farm-id uint u0)
(define-data-var contract-owner principal tx-sender)
```

**Public Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `register-farm` | `name`, `location`, `metadata-uri` | `(response uint uint)` | Register new CSA farm, returns farm-id |
| `add-member` | `farm-id`, `member-address`, `share-tier` | `(response bool uint)` | Add member to farm |
| `remove-member` | `farm-id`, `member-address` | `(response bool uint)` | Remove member from farm |
| `update-farm-status` | `farm-id`, `is-active` | `(response bool uint)` | Activate/deactivate farm |
| `add-farm-admin` | `farm-id`, `admin-address`, `role` | `(response bool uint)` | Grant admin role to address |
| `remove-farm-admin` | `farm-id`, `admin-address` | `(response bool uint)` | Revoke admin role |
| `update-member-status` | `farm-id`, `member-address`, `status` | `(response bool uint)` | Update member status |

**Read-Only Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `get-farm` | `farm-id` | `(optional {...})` | Retrieve farm details |
| `get-member` | `farm-id`, `member-address` | `(optional {...})` | Retrieve member details |
| `is-farm-admin` | `farm-id`, `address` | `bool` | Check if address is farm admin |
| `is-farm-member` | `farm-id`, `member-address` | `bool` | Check if address is farm member |
| `get-farm-member-count` | `farm-id` | `uint` | Get total members in farm |

**Events/Traits:**
- Custom events: `farm-registered`, `member-added`, `member-removed`, `admin-added`, `admin-removed`

**Security Considerations:**
- Only contract owner can register farms initially
- Farm owners can manage their own farm admins
- Members can only be added by farm admins
- Suspension mechanism prevents unauthorized access
- All state changes emit events for off-chain indexing

**Dependencies:** None (foundation contract)

---

### 4.2 Share-Token Contract

**Contract Name:** `share-token`

**Purpose:**
Implements SIP-010 fungible token standard for CSA shares. Each farm's shares are represented as tokens, enabling fractional ownership, trading, and automated distribution.

**Business Justification:**
- Standardized token interface enables interoperability
- Supports fractional share ownership
- Enables secondary market for share trading
- Automated dividend/distribution mechanisms
- Integrates with DeFi protocols

**Data Structures:**

```clarity
;; SIP-010 Token Implementation
(define-fungible-token csa-share)

(define-map token-metadata
  { farm-id: uint }
  {
    name: (string-ascii 256),
    symbol: (string-ascii 32),
    decimals: uint,
    total-supply: uint,
    price-per-share: uint ;; in microSTX
  }
)

(define-map farm-token-balances
  { farm-id: uint, holder: principal }
  { balance: uint }
)

(define-map token-allowances
  { farm-id: uint, owner: principal, spender: principal }
  { amount: uint }
)

(define-data-var contract-owner principal tx-sender)
```

**Public Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `mint-shares` | `farm-id`, `recipient`, `amount` | `(response bool uint)` | Mint new shares for farm |
| `burn-shares` | `farm-id`, `amount` | `(response bool uint)` | Burn shares (redemption) |
| `transfer` | `farm-id`, `recipient`, `amount` | `(response bool uint)` | Transfer shares between members |
| `approve` | `farm-id`, `spender`, `amount` | `(response bool uint)` | Approve spender allowance |
| `transfer-from` | `farm-id`, `sender`, `recipient`, `amount` | `(response bool uint)` | Transfer on behalf of owner |
| `update-share-price` | `farm-id`, `new-price` | `(response bool uint)` | Update share price (admin only) |

**Read-Only Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `get-balance` | `farm-id`, `holder` | `uint` | Get share balance |
| `get-total-supply` | `farm-id` | `uint` | Get total shares issued |
| `get-allowance` | `farm-id`, `owner`, `spender` | `uint` | Get approved allowance |
| `get-token-metadata` | `farm-id` | `(optional {...})` | Get token details |
| `get-share-price` | `farm-id` | `uint` | Get current share price |

**Events/Traits:**
- SIP-010 trait implementation
- Events: `transfer`, `mint`, `burn`, `approval`

**Security Considerations:**
- Only farm admins can mint/burn shares
- Transfer restrictions prevent unauthorized share movement
- Allowance mechanism prevents unlimited spending
- Price updates require admin authorization
- Reentrancy protection through Clarity's design

**Dependencies:** CSA-Registry (for farm and admin verification)

---

### 4.3 Payment-Processor Contract

**Contract Name:** `payment-processor`

**Purpose:**
Manages all financial transactions including share purchases, refunds, and fund distribution. Handles STX payments and maintains escrow for pending distributions.

**Business Justification:**
- Centralized payment handling reduces errors
- Escrow mechanism protects both farmers and members
- Automated refund processing
- Transparent fee structure
- Audit trail for all financial transactions

**Data Structures:**

```clarity
(define-map farm-balances
  { farm-id: uint }
  {
    total-collected: uint,
    total-distributed: uint,
    pending-distribution: uint,
    farm-owner: principal
  }
)

(define-map member-payments
  { farm-id: uint, member: principal }
  {
    amount-paid: uint,
    payment-date: uint,
    status: (string-ascii 32) ;; "completed", "pending", "refunded"
  }
)

(define-map escrow-accounts
  { escrow-id: uint }
  {
    farm-id: uint,
    amount: uint,
    release-date: uint,
    recipient: principal,
    status: (string-ascii 32)
  }
)

(define-data-var next-escrow-id uint u0)
(define-data-var platform-fee-percentage uint u2) ;; 2% platform fee
(define-data-var contract-owner principal tx-sender)
```

**Public Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `process-share-purchase` | `farm-id`, `amount`, `share-count` | `(response uint uint)` | Process STX payment for shares |
| `request-refund` | `farm-id`, `amount` | `(response bool uint)` | Request refund for shares |
| `approve-refund` | `farm-id`, `member`, `amount` | `(response bool uint)` | Approve refund (admin only) |
| `create-escrow` | `farm-id`, `amount`, `release-date`, `recipient` | `(response uint uint)` | Create escrow for distribution |
| `release-escrow` | `escrow-id` | `(response bool uint)` | Release escrowed funds |
| `withdraw-farm-balance` | `farm-id`, `amount` | `(response bool uint)` | Withdraw collected funds (owner only) |
| `set-platform-fee` | `new-fee-percentage` | `(response bool uint)` | Update platform fee (contract owner only) |

**Read-Only Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `get-farm-balance` | `farm-id` | `(optional {...})` | Get farm's collected funds |
| `get-member-payment-history` | `farm-id`, `member` | `(optional {...})` | Get member's payment record |
| `get-escrow-details` | `escrow-id` | `(optional {...})` | Get escrow account details |
| `calculate-platform-fee` | `amount` | `uint` | Calculate fee for amount |

**Events/Traits:**
- Events: `payment-received`, `refund-processed`, `escrow-created`, `escrow-released`, `withdrawal`

**Security Considerations:**
- Only farm admins can approve refunds
- Escrow prevents premature fund release
- Platform fee is transparent and configurable
- All transactions are immutable and auditable
- Prevents double-spending through Clarity's design

**Dependencies:** CSA-Registry (for farm and admin verification)

---

### 4.4 Distribution-Manager Contract

**Contract Name:** `distribution-manager`

**Purpose:**
Manages produce distribution schedules, allocation calculations, and member claims. Automates the distribution of shares and tracks fulfillment.

**Business Justification:**
- Automates complex distribution logic
- Ensures fair allocation based on share ownership
- Tracks distribution history for accountability
- Enables partial distributions and adjustments
- Supports multiple distribution types (weekly, seasonal, etc.)

**Data Structures:**

```clarity
(define-map distributions
  { distribution-id: uint }
  {
    farm-id: uint,
    distribution-date: uint,
    total-quantity: uint,
    unit: (string-ascii 32), ;; "lbs", "boxes", "units"
    status: (string-ascii 32), ;; "scheduled", "active", "completed"
    metadata-uri: (string-ascii 512)
  }
)

(define-map member-allocations
  { distribution-id: uint, member: principal }
  {
    allocated-quantity: uint,
    claimed-quantity: uint,
    claim-date: (optional uint),
    status: (string-ascii 32) ;; "pending", "claimed", "expired"
  }
)

(define-map distribution-schedule
  { farm-id: uint }
  {
    frequency: (string-ascii 32), ;; "weekly", "biweekly", "monthly"
    next-distribution-date: uint,
    is-active: bool
  }
)

(define-data-var next-distribution-id uint u0)
(define-data-var claim-expiration-days uint u14) ;; 14 days to claim
```

**Public Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `create-distribution` | `farm-id`, `total-quantity`, `unit`, `metadata-uri` | `(response uint uint)` | Create new distribution |
| `allocate-shares` | `distribution-id`, `member`, `quantity` | `(response bool uint)` | Allocate distribution to member |
| `auto-allocate-by-shares` | `distribution-id` | `(response bool uint)` | Auto-allocate based on share ownership |
| `claim-distribution` | `distribution-id` | `(response bool uint)` | Member claims their allocation |
| `mark-distribution-complete` | `distribution-id` | `(response bool uint)` | Mark distribution as completed |
| `set-distribution-schedule` | `farm-id`, `frequency`, `next-date` | `(response bool uint)` | Set recurring distribution schedule |
| `adjust-allocation` | `distribution-id`, `member`, `new-quantity` | `(response bool uint)` | Adjust member allocation (admin only) |

**Read-Only Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `get-distribution` | `distribution-id` | `(optional {...})` | Get distribution details |
| `get-member-allocation` | `distribution-id`, `member` | `(optional {...})` | Get member's allocation |
| `get-distribution-schedule` | `farm-id` | `(optional {...})` | Get farm's distribution schedule |
| `calculate-member-share` | `distribution-id`, `member` | `uint` | Calculate member's share percentage |
| `get-unclaimed-distributions` | `farm-id`, `member` | `(list 100 uint)` | Get member's unclaimed distributions |

**Events/Traits:**
- Events: `distribution-created`, `allocation-made`, `distribution-claimed`, `distribution-completed`

**Security Considerations:**
- Only farm admins can create distributions
- Auto-allocation prevents manual errors
- Expiration dates prevent indefinite claims
- Adjustment audit trail for transparency
- Prevents over-allocation through validation

**Dependencies:** CSA-Registry, Share-Token (for share balance verification)

---

### 4.5 Governance Contract

**Contract Name:** `governance`

**Purpose:**
Implements DAO-style governance for platform-wide decisions, parameter updates, and dispute resolution. Enables community participation in system evolution.

**Business Justification:**
- Decentralized decision-making
- Community-driven platform evolution
- Transparent parameter management
- Dispute resolution mechanism
- Prevents single point of failure

**Data Structures:**

```clarity
(define-map proposals
  { proposal-id: uint }
  {
    proposer: principal,
    title: (string-ascii 256),
    description: (string-ascii 1024),
    proposal-type: (string-ascii 32), ;; "parameter", "upgrade", "dispute"
    status: (string-ascii 32), ;; "active", "passed", "rejected", "executed"
    created-at: uint,
    voting-deadline: uint,
    votes-for: uint,
    votes-against: uint
  }
)

(define-map votes
  { proposal-id: uint, voter: principal }
  { vote: bool } ;; true = for, false = against
)

(define-map disputes
  { dispute-id: uint }
  {
    farm-id: uint,
    complainant: principal,
    respondent: principal,
    description: (string-ascii 1024),
    status: (string-ascii 32), ;; "open", "resolved", "dismissed"
    resolution: (string-ascii 512)
  }
)

(define-data-var next-proposal-id uint u0)
(define-data-var next-dispute-id uint u0)
(define-data-var voting-period-blocks uint u1440) ;; ~10 days
(define-data-var min-proposal-threshold uint u100) ;; minimum STX to propose
```

**Public Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `create-proposal` | `title`, `description`, `proposal-type` | `(response uint uint)` | Create governance proposal |
| `vote-on-proposal` | `proposal-id`, `vote` | `(response bool uint)` | Cast vote on proposal |
| `execute-proposal` | `proposal-id` | `(response bool uint)` | Execute passed proposal |
| `file-dispute` | `farm-id`, `respondent`, `description` | `(response uint uint)` | File dispute for resolution |
| `resolve-dispute` | `dispute-id`, `resolution` | `(response bool uint)` | Resolve dispute (governance only) |
| `update-voting-period` | `new-period-blocks` | `(response bool uint)` | Update voting period (governance only) |

**Read-Only Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `get-proposal` | `proposal-id` | `(optional {...})` | Get proposal details |
| `get-proposal-votes` | `proposal-id` | `(optional {...})` | Get vote counts |
| `has-voted` | `proposal-id`, `voter` | `bool` | Check if address voted |
| `get-dispute` | `dispute-id` | `(optional {...})` | Get dispute details |
| `is-proposal-passed` | `proposal-id` | `bool` | Check if proposal passed |

**Events/Traits:**
- Events: `proposal-created`, `vote-cast`, `proposal-executed`, `dispute-filed`, `dispute-resolved`

**Security Considerations:**
- Voting power tied to share ownership
- Proposal threshold prevents spam
- Voting period prevents rushed decisions
- Dispute resolution is transparent and auditable
- Multi-sig execution for critical changes

**Dependencies:** CSA-Registry, Share-Token (for voting power calculation)

---

## 5. User Roles and Permissions

### Role Definitions

| Role | Description | Primary Responsibilities |
|------|-------------|------------------------|
| **Farm Owner** | Founder and primary operator of CSA farm | Register farm, manage admins, approve distributions, withdraw funds |
| **Farm Manager** | Delegated administrator for farm operations | Manage members, create distributions, handle disputes |
| **Distributor** | Responsible for physical distribution logistics | Mark distributions complete, adjust allocations |
| **CSA Member** | Individual who purchased shares | Purchase shares, claim distributions, view history |
| **Platform Admin** | Oversees entire platform | Update platform fees, resolve disputes, manage governance |
| **Cooperative Manager** | Manages multiple farms | Coordinate cross-farm operations, aggregate reporting |

### Permission Matrix

| Action | Farm Owner | Farm Manager | Distributor | CSA Member | Platform Admin |
|--------|-----------|-------------|------------|-----------|---------------|
| Register Farm | ✓ | ✗ | ✗ | ✗ | ✓ |
| Add/Remove Members | ✓ | ✓ | ✗ | ✗ | ✓ |
| Create Distribution | ✓ | ✓ | ✗ | ✗ | ✗ |
| Mark Distribution Complete | ✓ | ✓ | ✓ | ✗ | ✗ |
| Claim Distribution | ✗ | ✗ | ✗ | ✓ | ✗ |
| Purchase Shares | ✗ | ✗ | ✗ | ✓ | ✗ |
| Approve Refunds | ✓ | ✓ | ✗ | ✗ | ✓ |
| Withdraw Funds | ✓ | ✗ | ✗ | ✗ | ✗ |
| Update Platform Fees | ✗ | ✗ | ✗ | ✗ | ✓ |
| Resolve Disputes | ✓ | ✓ | ✗ | ✗ | ✓ |
| Create Proposals | ✓ | ✓ | ✗ | ✓ | ✓ |
| Vote on Proposals | ✓ | ✓ | ✗ | ✓ | ✓ |

---

## 6. User Stories and Use Cases

### Use Case 1: Farm Registration and Setup

**Actor:** Farmer (Farm Owner)

**Preconditions:**
- Farmer has Stacks wallet with sufficient STX for transaction fees
- Farmer is familiar with blockchain concepts

**Main Flow:**
1. Farmer connects wallet to platform
2. Farmer navigates to "Register Farm"
3. Farmer enters farm details (name, location, metadata)
4. System calls `register-farm` smart contract function
5. Farmer signs transaction in wallet
6. Farm is registered and assigned unique farm-id
7. Farmer is automatically set as farm owner
8. Farmer can now add members and create distributions

**Postconditions:**
- Farm exists in CSA-Registry contract
- Farmer has admin privileges
- Farm is ready for member onboarding

**Edge Cases:**
- Farmer enters invalid location data → validation error
- Transaction fails due to insufficient gas → user prompted to retry
- Farmer attempts to register duplicate farm → system prevents duplicate

---

### Use Case 2: Member Purchases Share

**Actor:** CSA Member

**Preconditions:**
- Farm is registered and active
- Member has Stacks wallet with sufficient STX
- Member is not already a member of the farm

**Main Flow:**
1. Member browses available farms
2. Member selects farm and views share packages
3. Member selects share tier and quantity
4. System calculates total cost (shares × price + platform fee)
5. Member initiates purchase
6. Stacks.js builds transaction for STX transfer
7. Member signs transaction in wallet
8. Payment-Processor contract receives payment
9. Share-Token contract mints shares to member
10. CSA-Registry adds member to farm
11. Member receives confirmation and can view share balance

**Postconditions:**
- Member owns shares in farm
- Payment recorded in Payment-Processor
- Member can claim distributions
- Member appears in farm's member list

**Edge Cases:**
- Member has insufficient STX → transaction fails
- Farm reaches maximum member capacity → purchase rejected
- Member attempts to purchase while suspended → transaction fails
- Network congestion causes transaction delay → user can check status

---

### Use Case 3: Farmer Creates and Allocates Distribution

**Actor:** Farm Owner/Manager

**Preconditions:**
- Farm is registered with active members
- Farmer has produce ready for distribution
- Distribution date is scheduled

**Main Flow:**
1. Farmer navigates to "Create Distribution"
2. Farmer enters distribution details (quantity, unit, metadata)
3. System calls `create-distribution` smart contract function
4. Distribution is created with unique distribution-id
5. Farmer selects allocation method:
   - **Option A:** Auto-allocate based on share ownership
   - **Option B:** Manually allocate to specific members
6. For auto-allocation:
   - System calculates each member's share percentage
   - System calls `auto-allocate-by-shares` function
   - Each member receives proportional allocation
7. For manual allocation:
   - Farmer specifies member and quantity
   - System calls `allocate-shares` for each member
8. Distribution is marked as "active"
9. Members receive notification of available distribution
10. Members have 14 days to claim their allocation

**Postconditions:**
- Distribution exists in Distribution-Manager contract
- All members have allocations
- Members can claim their shares
- Distribution history is recorded

**Edge Cases:**
- Farmer attempts to allocate more than total quantity → validation error
- Member is suspended → allocation skipped
- Farmer adjusts allocation after initial creation → system allows adjustment with audit trail
- Distribution expires unclaimed → system marks as expired

---

### Use Case 4: Member Claims Distribution

**Actor:** CSA Member

**Preconditions:**
- Distribution is active
- Member has allocation for distribution
- Member has not already claimed
- Claim period has not expired

**Main Flow:**
1. Member views dashboard showing available distributions
2. Member selects distribution to claim
3. System displays allocation details
4. Member clicks "Claim Distribution"
5. System calls `claim-distribution` smart contract function
6. Smart contract verifies:
   - Member has allocation
   - Claim period not expired
   - Member hasn't already claimed
7. Allocation is marked as "claimed"
8. Claim date is recorded
9. Member receives confirmation with pickup/delivery details
10. Farmer receives notification of claim

**Postconditions:**
- Member's allocation is marked as claimed
- Claim date is recorded on blockchain
- Member can view claim history
- Farmer knows which members claimed

**Edge Cases:**
- Member attempts to claim twice → transaction fails
- Claim period has expired → member cannot claim
- Member is suspended → claim rejected
- Network error during claim → user can retry

---

### Use Case 5: Dispute Resolution

**Actor:** CSA Member or Farmer

**Preconditions:**
- Dispute has arisen (e.g., missing distribution, incorrect allocation)
- Both parties have Stacks wallets

**Main Flow:**
1. Complainant navigates to "File Dispute"
2. Complainant selects dispute type and enters description
3. System calls `file-dispute` smart contract function
4. Dispute is created with unique dispute-id
5. Respondent is notified of dispute
6. Both parties can provide evidence/comments
7. Platform governance reviews dispute
8. Governance votes on resolution
9. If passed, resolution is executed
10. Both parties are notified of outcome
11. Dispute is marked as "resolved"

**Postconditions:**
- Dispute is recorded on blockchain
- Resolution is transparent and immutable
- Both parties have record of resolution
- Corrective actions (refunds, reallocations) are executed

**Edge Cases:**
- Respondent disputes the claim → extended review period
- Evidence is insufficient → dispute dismissed
- Multiple disputes from same member → pattern flagged
- Dispute involves platform fee → platform admin reviews

---

### Use Case 6: Governance Proposal and Voting

**Actor:** Farm Owner, CSA Member, or Platform Admin

**Preconditions:**
- Proposer has minimum STX threshold
- Proposal is about platform parameter or upgrade
- Voting period is active

**Main Flow:**
1. Proposer creates proposal with title and description
2. System calls `create-proposal` smart contract function
3. Proposal is created with voting deadline (10 days)
4. Eligible voters (share holders) are notified
5. Voters review proposal details
6. Voters cast votes via `vote-on-proposal` function
7. Voting period ends
8. System tallies votes
9. If votes-for > votes-against:
   - Proposal is marked as "passed"
   - Proposer can execute proposal
10. If votes-against ≥ votes-for:
    - Proposal is marked as "rejected"

**Postconditions:**
- Proposal result is recorded on blockchain
- Passed proposals are executed
- All votes are transparent and auditable
- Platform parameters are updated if applicable

**Edge Cases:**
- Voter attempts to vote twice → transaction fails
- Voting deadline passes → voting closes
- Proposal is controversial → extended discussion period
- Execution fails → proposal marked as failed

---

## 7. Frontend/Backend Integration Requirements

### Stacks.js Integration Patterns

**Wallet Connection:**
```typescript
// Connect to Hiro Wallet or Leather
const userSession = new UserSession({ appConfig });
const authenticated = userSession.isUserSignedIn();
const userAddress = userSession.loadUserData().profile.stxAddress.mainnet;
```

**Contract Interaction:**
```typescript
// Build and send contract call
const tx = await makeContractCall({
  contractAddress: "ST...",
  contractName: "csa-registry",
  functionName: "register-farm",
  functionArgs: [stringAsciiCV("Farm Name"), ...],
  senderKey: privateKey,
  network: new StacksTestnet(),
});
```

**Read-Only Calls:**
```typescript
// Query contract state without transaction
const result = await callReadOnlyFunction({
  contractAddress: "ST...",
  contractName: "csa-registry",
  functionName: "get-farm",
  functionArgs: [uintCV(farmId)],
  network: new StacksTestnet(),
});
```

### Required API Endpoints

**Farm Management:**
- `POST /api/farms` - Create farm (calls smart contract)
- `GET /api/farms/:farmId` - Get farm details
- `GET /api/farms` - List all farms
- `PUT /api/farms/:farmId` - Update farm (calls smart contract)
- `GET /api/farms/:farmId/members` - List farm members

**Member Management:**
- `POST /api/farms/:farmId/members` - Add member (calls smart contract)
- `DELETE /api/farms/:farmId/members/:memberAddress` - Remove member
- `GET /api/members/:memberAddress` - Get member profile
- `PUT /api/members/:memberAddress` - Update member profile

**Share Management:**
- `POST /api/shares/purchase` - Purchase shares (calls smart contract)
- `GET /api/shares/:farmId/balance/:memberAddress` - Get share balance
- `GET /api/shares/:farmId/price` - Get current share price
- `POST /api/shares/transfer` - Transfer shares (calls smart contract)

**Distribution Management:**
- `POST /api/distributions` - Create distribution (calls smart contract)
- `GET /api/distributions/:distributionId` - Get distribution details
- `POST /api/distributions/:distributionId/allocate` - Allocate shares
- `POST /api/distributions/:distributionId/claim` - Claim distribution
- `GET /api/members/:memberAddress/distributions` - Get member's distributions

**Payment Management:**
- `POST /api/payments/process` - Process payment (calls smart contract)
- `GET /api/payments/history/:memberAddress` - Get payment history
- `POST /api/payments/refund` - Request refund
- `GET /api/farms/:farmId/balance` - Get farm balance

**Governance:**
- `POST /api/governance/proposals` - Create proposal
- `GET /api/governance/proposals/:proposalId` - Get proposal details
- `POST /api/governance/proposals/:proposalId/vote` - Vote on proposal
- `GET /api/governance/disputes/:disputeId` - Get dispute details

### Wallet Connection Requirements

**Supported Wallets:**
- Hiro Wallet (primary)
- Leather Wallet (secondary)
- Future: Xverse, Magic Eden

**Connection Flow:**
1. User clicks "Connect Wallet"
2. Frontend detects available wallets
3. User selects wallet
4. Wallet extension opens
5. User approves connection
6. Frontend receives user's Stacks address
7. Backend creates/updates user profile
8. User is authenticated and can interact with contracts

**Transaction Signing:**
- All contract calls require user signature
- Wallet extension handles signing
- Frontend displays transaction details before signing
- User can review and approve/reject

### Off-Chain Data Indexing

**Backend Responsibilities:**
- Index all smart contract events
- Maintain read-optimized database
- Provide fast API responses
- Send notifications to users
- Generate reports and analytics

**Indexed Data:**
- Farm registrations and updates
- Member additions and removals
- Share transfers and balances
- Distribution creations and claims
- Payment transactions
- Governance proposals and votes
- Disputes and resolutions

---

## 8. Testing Strategy

### Unit Testing Approach for Clarity Contracts

**Testing Framework:** Vitest + Clarinet SDK

**Test Structure:**
```typescript
describe("CSA-Registry Contract", () => {
  let simnet: SimnetClient;
  
  beforeEach(async () => {
    simnet = await initSimnet();
  });

  describe("register-farm", () => {
    it("should register a new farm", async () => {
      const result = await simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [stringAsciiCV("Test Farm"), stringAsciiCV("Location")]
      );
      expect(result).toBeOk();
    });

    it("should reject invalid farm name", async () => {
      const result = await simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [stringAsciiCV(""), stringAsciiCV("Location")]
      );
      expect(result).toBeErr();
    });
  });
});
```

**Test Coverage Goals:**
- Unit tests: >90% code coverage
- Integration tests: All contract interactions
- Edge cases: Boundary conditions, error scenarios
- Security tests: Authorization, reentrancy, overflow

### Integration Testing Requirements

**Cross-Contract Testing:**
- Share-Token minting when member added
- Payment-Processor escrow when distribution created
- Distribution-Manager allocation based on share ownership
- Governance voting with share-based voting power

**End-to-End Scenarios:**
1. Farm registration → member addition → share purchase → distribution → claim
2. Payment processing → escrow creation → fund release
3. Dispute filing → governance voting → resolution execution

### Test Scenarios for Critical Business Logic

| Scenario | Test Case | Expected Result |
|----------|-----------|-----------------|
| **Share Purchase** | Member purchases 10 shares at 100 STX each | 1000 STX transferred, 10 shares minted |
| **Distribution Allocation** | 100 units distributed to 10 members with equal shares | Each member allocated 10 units |
| **Refund Processing** | Member requests refund for 5 shares | Refund approved, shares burned, STX returned |
| **Dispute Resolution** | Governance votes on dispute | Majority vote determines resolution |
| **Expired Claim** | Member attempts to claim after 14 days | Claim rejected, allocation marked expired |
| **Suspended Member** | Suspended member attempts to claim | Claim rejected |
| **Over-Allocation** | Farmer attempts to allocate more than available | Transaction fails, validation error |
| **Double Claim** | Member attempts to claim same distribution twice | Second claim rejected |

---

## 9. Deployment Plan

### Deployment Order and Justification

**Phase 1: Foundation Contracts (Week 1)**

1. **CSA-Registry** (Deploy First)
   - **Justification:** No dependencies; serves as foundation for all other contracts
   - **Actions:** Deploy, verify, test basic functionality
   - **Validation:** Confirm farm registration works

2. **Share-Token** (Deploy Second)
   - **Justification:** Depends on CSA-Registry for farm verification
   - **Actions:** Deploy, link to CSA-Registry, test minting
   - **Validation:** Confirm SIP-010 compliance

**Phase 2: Financial Contracts (Week 2)**

3. **Payment-Processor** (Deploy Third)
   - **Justification:** Depends on CSA-Registry and Share-Token
   - **Actions:** Deploy, configure fees, test payment flow
   - **Validation:** Confirm STX transfers and escrow

4. **Distribution-Manager** (Deploy Fourth)
   - **Justification:** Depends on Share-Token and Payment-Processor
   - **Actions:** Deploy, test allocation logic
   - **Validation:** Confirm distribution calculations

**Phase 3: Governance (Week 3)**

5. **Governance** (Deploy Last)
   - **Justification:** Depends on all other contracts
   - **Actions:** Deploy, configure voting parameters
   - **Validation:** Confirm proposal and voting mechanisms

### Testnet Deployment Strategy

**Testnet Phases:**

1. **Alpha Testing (Internal)**
   - Deploy all contracts to Stacks Testnet
   - Run comprehensive test suite
   - Verify all contract interactions
   - Duration: 1 week

2. **Beta Testing (Limited Users)**
   - Invite 10-20 beta testers
   - Test real-world scenarios
   - Gather feedback
   - Monitor contract performance
   - Duration: 2 weeks

3. **Public Testnet**
   - Open to all developers
   - Publish documentation
   - Monitor for issues
   - Collect community feedback
   - Duration: 2 weeks

### Mainnet Deployment Checklist

**Pre-Deployment:**
- [ ] All contracts pass security audit
- [ ] 100% test coverage achieved
- [ ] Gas optimization completed
- [ ] Documentation finalized
- [ ] Incident response plan created
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested

**Deployment Day:**
- [ ] Deploy CSA-Registry
- [ ] Verify deployment on blockchain explorer
- [ ] Deploy Share-Token
- [ ] Deploy Payment-Processor
- [ ] Deploy Distribution-Manager
- [ ] Deploy Governance
- [ ] Run smoke tests
- [ ] Monitor for errors

**Post-Deployment:**
- [ ] Monitor contract activity
- [ ] Respond to user issues
- [ ] Publish deployment announcement
- [ ] Begin marketing campaign
- [ ] Onboard first farms
- [ ] Collect metrics and feedback

---

## 10. Future Enhancements

### Potential Features for Future Iterations

**Phase 2 Features:**
- **Secondary Market:** Enable share trading between members
- **Fractional Shares:** Support sub-unit share ownership
- **Multi-Signature Wallets:** Enhanced security for farm operations
- **Mobile App:** Native iOS/Android applications
- **SMS Notifications:** Text alerts for distributions and updates

**Phase 3 Features:**
- **DeFi Integration:** Lending protocols for seasonal financing
- **NFT Certificates:** Digital certificates for share ownership
- **DAO Expansion:** Full decentralized governance
- **Cross-Farm Cooperatives:** Manage multiple farms as single entity
- **Marketplace:** Buy/sell produce directly between farms and consumers

**Phase 4 Features:**
- **IoT Integration:** Real-time farm data on blockchain
- **Sustainability Tracking:** Carbon credits and environmental metrics
- **Insurance Products:** Blockchain-based crop insurance
- **Staking Rewards:** Incentivize long-term participation
- **Interchain Bridges:** Connect to other blockchains

### Scalability Considerations

**On-Chain Scalability:**
- Utilize Stacks' Bitcoin settlement for security
- Implement batching for multiple transactions
- Optimize contract storage usage
- Consider Stacks 2.1 improvements

**Off-Chain Scalability:**
- Implement caching layer for frequently accessed data
- Use database indexing for fast queries
- Implement pagination for large datasets
- Consider IPFS for metadata storage

**User Experience Scalability:**
- Implement transaction queuing
- Provide real-time status updates
- Optimize frontend performance
- Support multiple languages

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **CSA** | Community Supported Agriculture - direct relationship between farmers and consumers |
| **Share** | Ownership stake in farm's produce for a season |
| **Distribution** | Regular allocation of produce to members |
| **Stacks** | Layer 2 blockchain that settles to Bitcoin |
| **Clarity** | Smart contract language for Stacks blockchain |
| **SIP-010** | Stacks Improvement Proposal for fungible token standard |
| **Escrow** | Temporary holding of funds pending conditions |
| **Governance** | Community-based decision-making process |
| **Mainnet** | Production blockchain network |
| **Testnet** | Testing blockchain network |

---

## Appendix B: References

- [Stacks Documentation](https://docs.stacks.co)
- [Clarity Language Guide](https://docs.stacks.co/concepts/clarity)
- [Stacks.js Documentation](https://docs.stacks.co/build-apps/overview)
- [SIP-010 Fungible Token Standard](https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md)
- [USDA CSA Resources](https://www.nal.usda.gov/farms-and-agricultural-production-systems/community-supported-agriculture)
- [Clarity Best Practices](https://www.certik.com/resources/blog/clarity-best-practices-and-checklist)

---

**Document Version:** 1.0  
**Last Updated:** October 2024  
**Next Review:** January 2025


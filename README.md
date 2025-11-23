# Smart-Contract-System-for-Community-Supported-Agriculture-Shares

A blockchain-based platform built on the Stacks blockchain that revolutionizes how Community Supported Agriculture (CSA) operations manage shares, distributions, and member relationships. This system leverages Clarity smart contracts and Bitcoin's security through Stacks to provide transparent, immutable, and automated management of agricultural share systems.

## Features

- **Transparent Share Management:** Immutable records of share ownership, distributions, and farm operations on the blockchain
- **Automated Distribution:** Smart contract automation reduces manual administrative overhead and enables real-time settlement
- **Trustless Interactions:** Enable trustless interactions between farmers and members through blockchain verification
- **Multi-Farm Support:** Manage multiple CSA operations on a single platform with cooperative capabilities
- **SIP-010 Token Standard:** Share tokens follow the Stacks fungible token standard for interoperability
- **Governance System:** DAO-style governance for community-driven platform evolution and dispute resolution
- **Payment Processing:** Automated STX payment handling with escrow mechanisms for security
- **Member Management:** Role-based access control for farmers, administrators, and members
- **Distribution Tracking:** Automated allocation calculations based on share ownership with claim tracking
- **Dispute Resolution:** Transparent, blockchain-based dispute resolution mechanism

## Technology Stack

- **Blockchain:** Stacks (STX) - Layer 2 blockchain settling to Bitcoin
- **Smart Contracts:** Clarity - Decidable smart contract language optimized for security
- **Smart Contract Framework:** Clarinet 2.x - Development and testing framework
- **Testing:** Vitest 3.1.3 - Unit and integration testing framework
- **Blockchain Integration:** Stacks.js (@stacks/transactions 7.0.6) - JavaScript SDK for contract interaction
- **Runtime:** Node.js 18+ with ES modules support
- **Language:** TypeScript with strict type checking
- **Build Tools:** Vite configuration for optimal development experience

## Smart Contracts

The system consists of five modular smart contracts deployed in a specific order to ensure proper initialization and dependency resolution:

### 1. CSA-Registry (Foundation)
Central registry for all CSA farms, members, and their relationships. Serves as the foundational contract that other contracts reference for authorization and data validation. Manages farm registration, member onboarding, and role-based access control.

**Key Functions:** `register-farm`, `add-member`, `remove-member`, `add-farm-admin`, `is-farm-member`

### 2. Share-Token (SIP-010 Implementation)
Implements the Stacks fungible token standard for CSA shares. Each farm's shares are represented as tokens, enabling fractional ownership, trading, and automated distribution mechanisms.

**Key Functions:** `mint-shares`, `burn-shares`, `transfer`, `approve`, `transfer-from`, `get-balance`

### 3. Payment-Processor (Financial Management)
Manages all financial transactions including share purchases, refunds, and fund distribution. Handles STX payments and maintains escrow for pending distributions with transparent fee structure.

**Key Functions:** `process-share-purchase`, `request-refund`, `approve-refund`, `create-escrow`, `release-escrow`, `withdraw-farm-balance`

### 4. Distribution-Manager (Produce Distribution)
Manages produce distribution schedules, allocation calculations, and member claims. Automates the distribution of shares and tracks fulfillment with support for multiple distribution types.

**Key Functions:** `create-distribution`, `allocate-shares`, `auto-allocate-by-shares`, `claim-distribution`, `mark-distribution-complete`, `set-distribution-schedule`

### 5. Governance (DAO Operations)
Implements DAO-style governance for platform-wide decisions, parameter updates, and dispute resolution. Enables community participation in system evolution with transparent voting mechanisms.

**Key Functions:** `create-proposal`, `vote-on-proposal`, `execute-proposal`, `file-dispute`, `resolve-dispute`

For detailed specifications of each contract including data structures, function signatures, security considerations, and dependencies, refer to [PRD.md](./PRD.md) Section 4.

## Prerequisites

- **Node.js:** Version 18.0.0 or higher (with npm 9.0.0+)
- **Clarinet:** Version 2.0.0 or higher (install via `cargo install clarinet` or download from [Hiro Systems](https://github.com/hirosystems/clarinet))
- **Git:** For cloning the repository
- **Stacks Wallet:** Hiro Wallet or Leather Wallet for testnet/mainnet interaction
- **Docker:** Optional, for running local Stacks devnet

Verify installations:

```bash
node --version
npm --version
clarinet --version
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/Smart-Contract-System-for-Community-Supported-Agriculture-Shares.git
cd Smart-Contract-System-for-Community-Supported-Agriculture-Shares
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `@hirosystems/clarinet-sdk` (3.0.2) - Clarinet SDK for testing
- `@stacks/transactions` (7.0.6) - Stacks transaction building
- `vitest` (3.1.3) - Test runner
- `vitest-environment-clarinet` (2.3.0) - Clarinet test environment
- `chokidar-cli` (3.0.0) - File watching for development

### 3. Verify Installation

```bash
npm run test
```

This should run the test suite successfully (currently empty as contracts are not yet implemented).

### 4. Environment Configuration

Network configurations are located in the `settings/` directory:

- `settings/Devnet.toml` - Local development network with pre-funded test accounts
- `settings/Testnet.toml` - Stacks testnet configuration (create from template)
- `settings/Mainnet.toml` - Stacks mainnet configuration (create from template)

Pre-configured devnet accounts are available in `settings/Devnet.toml` with addresses and mnemonics for testing.

## Development

### Running Clarinet Console

The Clarinet console provides an interactive REPL for testing contracts:

```bash
clarinet console
```

In the console, you can:
- Call contract functions
- Query contract state
- Test contract logic interactively
- Inspect transaction results

Example console session:

```clarity
(contract-call? .csa-registry register-farm "Test Farm" "Location")
(contract-call? .csa-registry get-farm u0)
```

### Running Tests

Execute the test suite:

```bash
npm run test
```

Run tests with coverage and cost reports:

```bash
npm run test:report
```

Watch mode - automatically re-run tests on file changes:

```bash
npm run test:watch
```

### Checking Contracts

Validate contract syntax and check for issues:

```bash
clarinet check
```

This runs the Clarity checker with configured analysis passes (check_checker enabled with strict settings).

### Using the Devnet

Start a local Stacks devnet with Bitcoin integration:

```bash
clarinet devnet start
```

The devnet provides:
- Local Stacks blockchain node
- Bitcoin node for settlement
- Stacks API on port 3999
- Stacks Explorer on port 8000
- Pre-funded test accounts from `settings/Devnet.toml`

Stop the devnet:

```bash
clarinet devnet stop
```

## Testing

### Unit Testing with Vitest

Tests are written in TypeScript using Vitest and the Clarinet SDK. The test environment automatically initializes the simnet (simulated network) and provides Clarity value helpers.

### Test Structure

Create test files in the `tests/` directory with `.ts` extension:

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("CSA-Registry Contract", () => {
  let simnet: SimnetClient;

  beforeEach(async () => {
    simnet = await initSimnet();
  });

  it("should register a new farm", async () => {
    const result = await simnet.callPublicFn(
      "csa-registry",
      "register-farm",
      [stringAsciiCV("Test Farm"), stringAsciiCV("Location")]
    );
    expect(result).toBeOk();
  });

  it("should retrieve farm details", async () => {
    const result = await simnet.callReadOnlyFn(
      "csa-registry",
      "get-farm",
      [uintCV(0)]
    );
    expect(result).toBeOk();
  });
});
```

### Available Clarity Value Helpers

The Clarinet SDK provides helpers for creating Clarity values:

- `uintCV(value)` - Unsigned integer
- `intCV(value)` - Signed integer
- `stringAsciiCV(value)` - ASCII string
- `stringUtf8CV(value)` - UTF-8 string
- `bufferCV(value)` - Buffer
- `boolCV(value)` - Boolean
- `principalCV(address)` - Principal/address
- `listCV(values)` - List
- `tupleCV(fields)` - Tuple

### Custom Matchers

Vitest provides custom matchers for Clarity values:

```typescript
expect(result).toBeOk();
expect(result).toBeErr();
expect(result).toBeUint(100);
expect(result).toBeAscii("test");
```

### Integration Testing

Test cross-contract interactions and complex workflows:

```typescript
it("should process share purchase flow", async () => {
  // 1. Register farm
  const farmResult = await simnet.callPublicFn(
    "csa-registry",
    "register-farm",
    [stringAsciiCV("Farm"), stringAsciiCV("Location")]
  );

  // 2. Add member
  const memberResult = await simnet.callPublicFn(
    "csa-registry",
    "add-member",
    [uintCV(0), principalCV(member), stringAsciiCV("basic")]
  );

  // 3. Process payment
  const paymentResult = await simnet.callPublicFn(
    "payment-processor",
    "process-share-purchase",
    [uintCV(0), uintCV(1000), uintCV(10)]
  );

  expect(paymentResult).toBeOk();
});
```

### Test Coverage

Generate coverage reports:

```bash
npm run test:report
```

This generates:
- Coverage report showing line, branch, and function coverage
- Cost report showing gas/execution costs for each contract
- Reports are saved in the project root

## Deployment

### Deployment Order

Smart contracts must be deployed in the following order to ensure proper initialization and dependency resolution. See [PRD.md](./PRD.md) Section 9 for detailed justification:

1. **CSA-Registry** - Foundation contract (no dependencies)
2. **Share-Token** - Depends on CSA-Registry
3. **Payment-Processor** - Depends on CSA-Registry and Share-Token
4. **Distribution-Manager** - Depends on Share-Token and Payment-Processor
5. **Governance** - Depends on all other contracts

### Testnet Deployment

Deploy to Stacks testnet for public testing:

```bash
clarinet deployments generate --testnet
```

This creates deployment files in `.deployments/testnet/` with contract addresses.

Deploy contracts:

```bash
clarinet deployments apply --testnet
```

Verify deployment on Stacks Explorer: https://testnet.explorer.stacks.co/

### Mainnet Deployment

Before mainnet deployment, complete the checklist in [PRD.md](./PRD.md) Section 9:

- All contracts pass security audit
- 100% test coverage achieved
- Gas optimization completed
- Documentation finalized
- Incident response plan created
- Monitoring and alerting configured

Deploy to mainnet:

```bash
clarinet deployments generate --mainnet
clarinet deployments apply --mainnet
```

Verify deployment on Stacks Explorer: https://explorer.stacks.co/

## Usage Examples

### Connecting to Wallet and Interacting with Contracts

Using Stacks.js to interact with deployed contracts:

```typescript
import { UserSession, AppConfig } from "@stacks/auth";
import { makeContractCall, callReadOnlyFunction } from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";

// Initialize wallet connection
const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

// Connect wallet
if (!userSession.isUserSignedIn()) {
  await userSession.signUserIn();
}

const userAddress = userSession.loadUserData().profile.stxAddress.testnet;
```

### Register a Farm

```typescript
const registerFarmTx = await makeContractCall({
  contractAddress: "ST...",
  contractName: "csa-registry",
  functionName: "register-farm",
  functionArgs: [
    stringAsciiCV("Sunny Valley Farm"),
    stringAsciiCV("California, USA")
  ],
  senderKey: privateKey,
  network: new StacksTestnet(),
});
```

### Query Farm Details

```typescript
const farmDetails = await callReadOnlyFunction({
  contractAddress: "ST...",
  contractName: "csa-registry",
  functionName: "get-farm",
  functionArgs: [uintCV(0)],
  network: new StacksTestnet(),
});
```

### Purchase Shares

```typescript
const purchaseTx = await makeContractCall({
  contractAddress: "ST...",
  contractName: "payment-processor",
  functionName: "process-share-purchase",
  functionArgs: [
    uintCV(0),           // farm-id
    uintCV(100000000),   // amount in microSTX (1 STX = 1,000,000 microSTX)
    uintCV(10)           // share-count
  ],
  senderKey: privateKey,
  network: new StacksTestnet(),
});
```

### Create Distribution

```typescript
const createDistributionTx = await makeContractCall({
  contractAddress: "ST...",
  contractName: "distribution-manager",
  functionName: "create-distribution",
  functionArgs: [
    uintCV(0),                    // farm-id
    uintCV(100),                  // total-quantity
    stringAsciiCV("lbs"),         // unit
    stringAsciiCV("ipfs://...")   // metadata-uri
  ],
  senderKey: privateKey,
  network: new StacksTestnet(),
});
```

For more examples and detailed API documentation, refer to [Stacks.js Documentation](https://docs.stacks.co/build-apps/overview).

## Project Structure

```
Smart-Contract-System-for-Community-Supported-Agriculture-Shares/
├── README.md                          # This file
├── PRD.md                             # Product Requirements Document
├── Clarinet.toml                      # Clarinet project configuration
├── package.json                       # Node.js dependencies and scripts
├── tsconfig.json                      # TypeScript configuration
├── vitest.config.js                   # Vitest test runner configuration
├── .gitignore                         # Git ignore rules
├── .gitattributes                     # Git attributes
│
├── contracts/                         # Clarity smart contracts
│   ├── csa-registry.clar             # Farm and member registry
│   ├── share-token.clar              # SIP-010 fungible token
│   ├── payment-processor.clar        # Payment and escrow management
│   ├── distribution-manager.clar     # Distribution and allocation
│   └── governance.clar               # DAO governance
│
├── tests/                             # Test files
│   ├── csa-registry.test.ts          # CSA-Registry tests
│   ├── share-token.test.ts           # Share-Token tests
│   ├── payment-processor.test.ts     # Payment-Processor tests
│   ├── distribution-manager.test.ts  # Distribution-Manager tests
│   └── governance.test.ts            # Governance tests
│
├── settings/                          # Network configurations
│   ├── Devnet.toml                   # Local devnet configuration
│   ├── Testnet.toml                  # Stacks testnet configuration
│   └── Mainnet.toml                  # Stacks mainnet configuration
│
├── .vscode/                           # VS Code configuration
│   ├── settings.json                 # Editor settings
│   └── tasks.json                    # Build and test tasks
│
└── .cache/                            # Clarinet cache (generated)
```

## Contributing

Contributions are welcome. Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow Clarity best practices** from [CertiK's Clarity Best Practices](https://www.certik.com/resources/blog/clarity-best-practices-and-checklist)
3. **Write comprehensive tests** for all new functionality
4. **Ensure all tests pass** before submitting a pull request
5. **Document changes** in code comments and update relevant documentation
6. **Follow the deployment order** when adding new contracts
7. **Request security review** for any changes to contract logic

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and run tests
npm run test

# Check contracts
clarinet check

# Commit changes
git commit -m "feat: description of changes"

# Push and create pull request
git push origin feature/your-feature-name
```

## License

ISC License - See package.json for details

## Resources

### Official Documentation
- [Stacks Documentation](https://docs.stacks.co) - Complete Stacks blockchain documentation
- [Clarity Language Guide](https://docs.stacks.co/concepts/clarity) - Clarity smart contract language reference
- [Stacks.js Documentation](https://docs.stacks.co/build-apps/overview) - JavaScript SDK for Stacks
- [SIP-010 Fungible Token Standard](https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md) - Token standard specification

### Development Tools
- [Clarinet Documentation](https://docs.stacks.co/clarinet) - Smart contract development framework
- [Hiro Systems](https://www.hiro.so) - Stacks ecosystem tools and services
- [Clarity Best Practices](https://www.certik.com/resources/blog/clarity-best-practices-and-checklist) - Security best practices

### Community Resources
- [Stacks Discord](https://discord.gg/stacks) - Community support and discussion
- [Stacks Forum](https://forum.stacks.org) - Technical discussions
- [Stacks GitHub](https://github.com/stacks-network) - Open source repositories

### Project Documentation
- [PRD.md](./PRD.md) - Comprehensive Product Requirements Document with detailed specifications
- [Stacks Explorer Testnet](https://testnet.explorer.stacks.co) - View testnet transactions and contracts
- [Stacks Explorer Mainnet](https://explorer.stacks.co) - View mainnet transactions and contracts

---

**Version:** 1.0.0  
**Last Updated:** October 2024  
**Status:** Development


import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

// Contract name constant
const CONTRACT_NAME = "payment-processor";

// Error codes from the contract
const ERR_UNAUTHORIZED = 300;
const ERR_FARM_NOT_FOUND = 301;
const ERR_INVALID_AMOUNT = 302;
const ERR_INSUFFICIENT_BALANCE = 303;
const ERR_ESCROW_NOT_FOUND = 304;
const ERR_ESCROW_NOT_RELEASABLE = 305;
const ERR_PAYMENT_NOT_FOUND = 306;
const ERR_INVALID_FEE_PERCENTAGE = 307;
const ERR_REFUND_ALREADY_PROCESSED = 308;
const ERR_INVALID_STATUS = 309;
const ERR_FARM_ALREADY_EXISTS = 310;
const ERR_ESCROW_ALREADY_RELEASED = 311;
const ERR_WITHDRAWAL_EXCEEDS_AVAILABLE = 312;
const ERR_SELF_TRANSFER = 314;

describe("Payment Processor Contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  // ============================================================================
  // FARM REGISTRATION TESTS
  // ============================================================================
  describe("Farm Registration for Payments", () => {
    it("should register a farm for payments successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent duplicate farm registration", () => {
      // Register first time
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );

      // Try to register again
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_FARM_ALREADY_EXISTS));
    });

    it("should set caller as farm owner and admin", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );

      // Check if owner is admin
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-farm-payment-admin",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeBool(true);
    });

    it("should retrieve farm balance after registration", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-farm-balance",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(wallet1),
          "total-collected": Cl.uint(0),
          "total-distributed": Cl.uint(0),
          "available-balance": Cl.uint(0),
          "is-active": Cl.bool(true),
          "created-at": Cl.uint(simnet.blockHeight)
        })
      );
    });
  });

  // ============================================================================
  // PAYMENT ADMIN TESTS
  // ============================================================================
  describe("Payment Admin Management", () => {
    beforeEach(() => {
      // Register a farm for testing
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );
    });

    it("should allow farm owner to add payment admin", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "add-payment-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify admin was added
      const { result: isAdmin } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-farm-payment-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(isAdmin).toBeBool(true);
    });

    it("should prevent non-owner from adding payment admin", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "add-payment-admin",
        [Cl.uint(0), Cl.principal(wallet3)],
        wallet2 // Not the owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should allow farm owner to remove payment admin", () => {
      // First add an admin
      simnet.callPublicFn(
        CONTRACT_NAME,
        "add-payment-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      // Then remove the admin
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "remove-payment-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify admin was removed
      const { result: isAdmin } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-farm-payment-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(isAdmin).toBeBool(false);
    });

    it("should prevent non-owner from removing payment admin", () => {
      // Add an admin first
      simnet.callPublicFn(
        CONTRACT_NAME,
        "add-payment-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      // Try to remove as non-owner
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "remove-payment-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet3 // Not the owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });
  });

  // ============================================================================
  // SHARE PURCHASE TESTS
  // ============================================================================
  describe("Share Purchase Processing", () => {
    beforeEach(() => {
      // Register a farm for testing
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );
    });

    it("should process share purchase successfully", () => {
      const sharesCount = 10;
      const pricePerShare = 1000000; // 1 STX in microSTX

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(sharesCount), Cl.uint(pricePerShare)],
        wallet2
      );

      // Should return payment ID 0
      expect(result).toBeOk(Cl.uint(0));
    });

    it("should increment payment ID for each purchase", () => {
      // First purchase
      const { result: result1 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(5), Cl.uint(1000000)],
        wallet2
      );
      expect(result1).toBeOk(Cl.uint(0));

      // Second purchase
      const { result: result2 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(3), Cl.uint(1000000)],
        wallet3
      );
      expect(result2).toBeOk(Cl.uint(1));
    });

    it("should reject purchase with zero shares", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(0), Cl.uint(1000000)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should reject purchase with zero price", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(10), Cl.uint(0)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should reject purchase for non-existent farm", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(999), Cl.uint(10), Cl.uint(1000000)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_FARM_NOT_FOUND));
    });

    it("should update farm balance after purchase", () => {
      const sharesCount = 10;
      const pricePerShare = 1000000;
      const totalAmount = sharesCount * pricePerShare;
      const platformFee = Math.floor((totalAmount * 200) / 10000); // 2%
      const farmAmount = totalAmount - platformFee;

      simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(sharesCount), Cl.uint(pricePerShare)],
        wallet2
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-available-balance",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeUint(farmAmount);
    });

    it("should record payment details correctly", () => {
      const sharesCount = 10;
      const pricePerShare = 1000000;

      simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(sharesCount), Cl.uint(pricePerShare)],
        wallet2
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-payment",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          "farm-id": Cl.uint(0),
          member: Cl.principal(wallet2),
          "amount-paid": Cl.uint(sharesCount * pricePerShare),
          "shares-purchased": Cl.uint(sharesCount),
          "payment-date": Cl.uint(simnet.blockHeight),
          status: Cl.stringAscii("completed"),
          "refund-amount": Cl.uint(0)
        })
      );
    });
  });

  // ============================================================================
  // REFUND TESTS
  // ============================================================================
  describe("Refund Processing", () => {
    beforeEach(() => {
      // Register a farm and process a purchase
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(10), Cl.uint(1000000)],
        wallet2
      );
    });

    it("should allow member to request refund", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "request-refund",
        [Cl.uint(0)],
        wallet2
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent non-payer from requesting refund", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "request-refund",
        [Cl.uint(0)],
        wallet3 // Not the original payer
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should update payment status to pending after refund request", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "request-refund",
        [Cl.uint(0)],
        wallet2
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-payment",
        [Cl.uint(0)],
        wallet1
      );

      // Verify the payment exists and has pending status
      // The result should be Some(tuple) with status "pending"
      expect(result).toBeSome(
        Cl.tuple({
          "farm-id": Cl.uint(0),
          member: Cl.principal(wallet2),
          "amount-paid": Cl.uint(10000000),
          "shares-purchased": Cl.uint(10),
          "payment-date": Cl.uint(5), // Block height after beforeEach
          status: Cl.stringAscii("pending"),
          "refund-amount": Cl.uint(0)
        })
      );
    });

    it("should allow admin to approve refund", () => {
      // Request refund first
      simnet.callPublicFn(
        CONTRACT_NAME,
        "request-refund",
        [Cl.uint(0)],
        wallet2
      );

      // Approve refund as admin
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "approve-refund",
        [Cl.uint(0), Cl.uint(5000000)], // Partial refund
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent non-admin from approving refund", () => {
      // Request refund first
      simnet.callPublicFn(
        CONTRACT_NAME,
        "request-refund",
        [Cl.uint(0)],
        wallet2
      );

      // Try to approve as non-admin
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "approve-refund",
        [Cl.uint(0), Cl.uint(5000000)],
        wallet3 // Not an admin
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject refund approval without pending request", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "approve-refund",
        [Cl.uint(0), Cl.uint(5000000)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_STATUS));
    });
  });

  // ============================================================================
  // ESCROW TESTS
  // ============================================================================
  describe("Escrow Management", () => {
    beforeEach(() => {
      // Register a farm for testing
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );
    });

    it("should create escrow successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(5000000),
          Cl.principal(wallet2),
          Cl.uint(100), // Release after 100 blocks
          Cl.stringAscii("Test escrow for produce delivery")
        ],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(0));
    });

    it("should increment escrow ID for each new escrow", () => {
      // First escrow
      const { result: result1 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(5000000),
          Cl.principal(wallet2),
          Cl.uint(100),
          Cl.stringAscii("Escrow 1")
        ],
        wallet1
      );
      expect(result1).toBeOk(Cl.uint(0));

      // Second escrow
      const { result: result2 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(3000000),
          Cl.principal(wallet3),
          Cl.uint(50),
          Cl.stringAscii("Escrow 2")
        ],
        wallet1
      );
      expect(result2).toBeOk(Cl.uint(1));
    });

    it("should reject escrow with zero amount", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(0),
          Cl.principal(wallet2),
          Cl.uint(100),
          Cl.stringAscii("Invalid escrow")
        ],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should reject escrow to self", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(5000000),
          Cl.principal(wallet1), // Same as depositor
          Cl.uint(100),
          Cl.stringAscii("Self escrow")
        ],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_SELF_TRANSFER));
    });

    it("should report escrow as not releasable before release block", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(5000000),
          Cl.principal(wallet2),
          Cl.uint(100),
          Cl.stringAscii("Test escrow")
        ],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-escrow-releasable",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeBool(false);
    });

    it("should prevent release before release block", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(5000000),
          Cl.principal(wallet2),
          Cl.uint(100),
          Cl.stringAscii("Test escrow")
        ],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "release-escrow",
        [Cl.uint(0)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_ESCROW_NOT_RELEASABLE));
    });

    it("should allow depositor to cancel escrow before release block", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(5000000),
          Cl.principal(wallet2),
          Cl.uint(100),
          Cl.stringAscii("Test escrow")
        ],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "cancel-escrow",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent non-depositor from cancelling escrow", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-escrow",
        [
          Cl.uint(0),
          Cl.uint(5000000),
          Cl.principal(wallet2),
          Cl.uint(100),
          Cl.stringAscii("Test escrow")
        ],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "cancel-escrow",
        [Cl.uint(0)],
        wallet2 // Not the depositor
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });
  });

  // ============================================================================
  // WITHDRAWAL TESTS
  // ============================================================================
  describe("Farm Balance Withdrawals", () => {
    beforeEach(() => {
      // Register a farm and process a purchase
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "process-share-purchase",
        [Cl.uint(0), Cl.uint(10), Cl.uint(1000000)],
        wallet2
      );
    });

    it("should allow farm owner to withdraw balance", () => {
      // Calculate expected balance (minus 2% fee)
      const totalAmount = 10 * 1000000;
      const platformFee = Math.floor((totalAmount * 200) / 10000);
      const availableBalance = totalAmount - platformFee;
      const withdrawAmount = availableBalance / 2;

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "withdraw-farm-balance",
        [Cl.uint(0), Cl.uint(withdrawAmount)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent non-owner from withdrawing", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "withdraw-farm-balance",
        [Cl.uint(0), Cl.uint(1000000)],
        wallet2 // Not the owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject withdrawal exceeding available balance", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "withdraw-farm-balance",
        [Cl.uint(0), Cl.uint(100000000000)], // More than available
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_WITHDRAWAL_EXCEEDS_AVAILABLE));
    });

    it("should reject zero amount withdrawal", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "withdraw-farm-balance",
        [Cl.uint(0), Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should update balance after withdrawal", () => {
      const totalAmount = 10 * 1000000;
      const platformFee = Math.floor((totalAmount * 200) / 10000);
      const availableBalance = totalAmount - platformFee;
      const withdrawAmount = 5000000;

      simnet.callPublicFn(
        CONTRACT_NAME,
        "withdraw-farm-balance",
        [Cl.uint(0), Cl.uint(withdrawAmount)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-available-balance",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeUint(availableBalance - withdrawAmount);
    });
  });

  // ============================================================================
  // PLATFORM FEE TESTS
  // ============================================================================
  describe("Platform Fee Management", () => {
    it("should return correct initial platform fee", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-platform-fee",
        [],
        deployer
      );

      expect(result).toBeUint(200); // 2% = 200 basis points
    });

    it("should allow contract owner to update platform fee", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-platform-fee",
        [Cl.uint(300)], // 3%
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify fee was updated
      const { result: newFee } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-platform-fee",
        [],
        deployer
      );

      expect(newFee).toBeUint(300);
    });

    it("should prevent non-owner from updating platform fee", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-platform-fee",
        [Cl.uint(300)],
        wallet1 // Not contract owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject fee above maximum (10%)", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-platform-fee",
        [Cl.uint(1500)], // 15% - above max
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_FEE_PERCENTAGE));
    });

    it("should calculate platform fee correctly", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "calculate-platform-fee",
        [Cl.uint(10000000)], // 10 STX
        deployer
      );

      // 2% of 10 STX = 0.2 STX = 200000 microSTX
      expect(result).toBeUint(200000);
    });
  });

  // ============================================================================
  // TREASURY TESTS
  // ============================================================================
  describe("Treasury Management", () => {
    it("should return deployer as initial treasury address", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-treasury-address",
        [],
        deployer
      );

      expect(result).toBePrincipal(deployer);
    });

    it("should allow contract owner to update treasury address", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-treasury-address",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify treasury was updated
      const { result: newTreasury } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-treasury-address",
        [],
        deployer
      );

      expect(newTreasury).toBePrincipal(wallet1);
    });

    it("should prevent non-owner from updating treasury address", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-treasury-address",
        [Cl.principal(wallet2)],
        wallet1 // Not contract owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });
  });

  // ============================================================================
  // READ-ONLY FUNCTION TESTS
  // ============================================================================
  describe("Read-Only Functions", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-payments",
        [Cl.uint(0)],
        wallet1
      );
    });

    it("should return none for non-existent farm balance", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-farm-balance",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should return none for non-existent payment", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-payment",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should return none for non-existent escrow", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-escrow",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should return false for non-existent escrow releasability", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-escrow-releasable",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeBool(false);
    });

    it("should return zero for non-existent farm available balance", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-available-balance",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeUint(0);
    });
  });
});

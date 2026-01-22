import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

// Contract name constant
const CONTRACT_NAME = "distribution-manager";

// Error codes from the contract
const ERR_UNAUTHORIZED = 400;
const ERR_FARM_NOT_FOUND = 401;
const ERR_DISTRIBUTION_NOT_FOUND = 402;
const ERR_ALLOCATION_NOT_FOUND = 403;
const ERR_INVALID_AMOUNT = 404;
const ERR_INVALID_STATUS = 405;
const ERR_ALREADY_CLAIMED = 406;
const ERR_CLAIM_EXPIRED = 407;
const ERR_DISTRIBUTION_NOT_ACTIVE = 408;
const ERR_FARM_ALREADY_EXISTS = 409;
const ERR_OVER_ALLOCATION = 410;
const ERR_NO_ALLOCATION = 412;
const ERR_INVALID_UNIT = 413;
const ERR_SCHEDULE_NOT_FOUND = 414;
const ERR_MEMBER_NOT_FOUND = 415;

describe("Distribution Manager Contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  // ============================================================================
  // FARM REGISTRATION TESTS
  // ============================================================================
  describe("Farm Registration for Distributions", () => {
    it("should register a farm for distributions successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Sunny Valley Farm")],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should prevent duplicate farm registration", () => {
      // Register first time
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Farm 1")],
        wallet1
      );

      // Try to register again
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Farm 1 Again")],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_FARM_ALREADY_EXISTS));
    });

    it("should set caller as farm owner and admin", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );

      // Check if owner is admin
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-farm-distribution-admin",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeBool(true);
    });

    it("should retrieve farm details after registration", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-farm",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(wallet1),
          name: Cl.stringAscii("Test Farm"),
          "is-active": Cl.bool(true),
          "total-distributions": Cl.uint(0),
          "created-at": Cl.uint(simnet.blockHeight)
        })
      );
    });
  });

  // ============================================================================
  // DISTRIBUTION ADMIN TESTS
  // ============================================================================
  describe("Distribution Admin Management", () => {
    beforeEach(() => {
      // Register a farm for testing
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );
    });

    it("should allow farm owner to add distribution admin", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "add-distribution-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify admin was added
      const { result: isAdmin } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-farm-distribution-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(isAdmin).toBeBool(true);
    });

    it("should prevent non-owner from adding distribution admin", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "add-distribution-admin",
        [Cl.uint(0), Cl.principal(wallet3)],
        wallet2 // Not the owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should allow farm owner to remove distribution admin", () => {
      // First add an admin
      simnet.callPublicFn(
        CONTRACT_NAME,
        "add-distribution-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      // Then remove the admin
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "remove-distribution-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify admin was removed
      const { result: isAdmin } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-farm-distribution-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(isAdmin).toBeBool(false);
    });
  });

  // ============================================================================
  // MEMBER SHARE REGISTRATION TESTS
  // ============================================================================
  describe("Member Share Registration", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );
    });

    it("should register member shares successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(10)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should update total shares after registration", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(10)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-shares",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeUint(10);
    });

    it("should update member shares correctly", () => {
      // First registration
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(10)],
        wallet1
      );

      // Update shares
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(15)],
        wallet1
      );

      const { result: memberShares } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-member-shares",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      // Check share-count is 15
      expect(memberShares).toBeSome(
        Cl.tuple({
          "share-count": Cl.uint(15),
          "registered-at": Cl.uint(simnet.blockHeight)
        })
      );

      // Total should also be updated (15, not 10+15)
      const { result: totalShares } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-shares",
        [Cl.uint(0)],
        wallet1
      );

      expect(totalShares).toBeUint(15);
    });

    it("should prevent non-admin from registering member shares", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet3), Cl.uint(10)],
        wallet2 // Not an admin
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should calculate member share percentage correctly", () => {
      // Register two members with shares
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(30)],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet3), Cl.uint(70)],
        wallet1
      );

      // wallet2 should have 30% (3000 basis points)
      const { result: percentage2 } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-member-share-percentage",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(percentage2).toBeUint(3000);

      // wallet3 should have 70% (7000 basis points)
      const { result: percentage3 } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-member-share-percentage",
        [Cl.uint(0), Cl.principal(wallet3)],
        wallet1
      );

      expect(percentage3).toBeUint(7000);
    });
  });

  // ============================================================================
  // DISTRIBUTION CREATION TESTS
  // ============================================================================
  describe("Distribution Creation", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );
    });

    it("should create distribution successfully", () => {
      const distributionDate = simnet.blockHeight + 100;
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(1000),
          Cl.stringAscii("lbs"),
          Cl.uint(distributionDate),
          Cl.stringAscii("https://metadata.farm/dist1")
        ],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(0));
    });

    it("should increment distribution ID for each new distribution", () => {
      // First distribution
      const { result: result1 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(1000),
          Cl.stringAscii("lbs"),
          Cl.uint(simnet.blockHeight + 100),
          Cl.stringAscii("")
        ],
        wallet1
      );
      expect(result1).toBeOk(Cl.uint(0));

      // Second distribution
      const { result: result2 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(500),
          Cl.stringAscii("boxes"),
          Cl.uint(simnet.blockHeight + 200),
          Cl.stringAscii("")
        ],
        wallet1
      );
      expect(result2).toBeOk(Cl.uint(1));
    });

    it("should reject distribution with zero quantity", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(0),
          Cl.stringAscii("lbs"),
          Cl.uint(simnet.blockHeight + 100),
          Cl.stringAscii("")
        ],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should reject distribution with empty unit", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(1000),
          Cl.stringAscii(""),
          Cl.uint(simnet.blockHeight + 100),
          Cl.stringAscii("")
        ],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_UNIT));
    });

    it("should prevent non-admin from creating distribution", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(1000),
          Cl.stringAscii("lbs"),
          Cl.uint(simnet.blockHeight + 100),
          Cl.stringAscii("")
        ],
        wallet2 // Not an admin
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });
  });

  // ============================================================================
  // DISTRIBUTION STATUS TESTS
  // ============================================================================
  describe("Distribution Status Management", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(1000),
          Cl.stringAscii("lbs"),
          Cl.uint(simnet.blockHeight + 100),
          Cl.stringAscii("")
        ],
        wallet1
      );
    });

    it("should activate distribution successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "activate-distribution",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify it's claimable
      const { result: claimable } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-distribution-claimable",
        [Cl.uint(0)],
        wallet1
      );

      expect(claimable).toBeBool(true);
    });

    it("should complete distribution successfully", () => {
      // First activate
      simnet.callPublicFn(
        CONTRACT_NAME,
        "activate-distribution",
        [Cl.uint(0)],
        wallet1
      );

      // Then complete
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "complete-distribution",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should cancel distribution successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "cancel-distribution",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should reject completing non-active distribution", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "complete-distribution",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_STATUS));
    });
  });

  // ============================================================================
  // ALLOCATION TESTS
  // ============================================================================
  describe("Allocation Management", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(1000),
          Cl.stringAscii("lbs"),
          Cl.uint(simnet.blockHeight + 100),
          Cl.stringAscii("")
        ],
        wallet1
      );
    });

    it("should allocate to member successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(100)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should track allocated quantity correctly", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(300)],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(0), Cl.principal(wallet3), Cl.uint(200)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-distribution",
        [Cl.uint(0)],
        wallet1
      );

      // Verify distribution data exists with correct allocated quantity (500)
      // The result type is "some" for optional some
      expect(result.type).toBe("some");
    });

    it("should reject over-allocation", () => {
      // Allocate 800
      simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(800)],
        wallet1
      );

      // Try to allocate 300 more (total would be 1100, max is 1000)
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(0), Cl.principal(wallet3), Cl.uint(300)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_OVER_ALLOCATION));
    });

    it("should reject allocation with zero quantity", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should adjust allocation successfully", () => {
      // Initial allocation
      simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(300)],
        wallet1
      );

      // Adjust allocation
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "adjust-allocation",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(500)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify new allocation
      const { result: allocation } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-member-allocation",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(allocation).toBeSome(
        Cl.tuple({
          "allocated-quantity": Cl.uint(500),
          "claimed-quantity": Cl.uint(0),
          "claim-date": Cl.none(),
          status: Cl.stringAscii("pending")
        })
      );
    });

    it("should auto-allocate based on member shares", () => {
      // Register member shares first
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(50)], // 50%
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-member-shares",
        [Cl.uint(0), Cl.principal(wallet3), Cl.uint(50)], // 50%
        wallet1
      );

      // Auto-allocate for wallet2 (should get 500 out of 1000)
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "auto-allocate-by-shares",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify allocation amount
      const { result: allocation } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-member-allocation",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(allocation).toBeSome(
        Cl.tuple({
          "allocated-quantity": Cl.uint(500),
          "claimed-quantity": Cl.uint(0),
          "claim-date": Cl.none(),
          status: Cl.stringAscii("pending")
        })
      );
    });
  });

  // ============================================================================
  // CLAIMING TESTS
  // ============================================================================
  describe("Distribution Claiming", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(1000),
          Cl.stringAscii("lbs"),
          Cl.uint(simnet.blockHeight + 100),
          Cl.stringAscii("")
        ],
        wallet1
      );

      // Allocate to wallet2
      simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.uint(300)],
        wallet1
      );

      // Activate distribution
      simnet.callPublicFn(
        CONTRACT_NAME,
        "activate-distribution",
        [Cl.uint(0)],
        wallet1
      );
    });

    it("should allow member to claim distribution", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-distribution",
        [Cl.uint(0)],
        wallet2
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should update allocation status after claim", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-distribution",
        [Cl.uint(0)],
        wallet2
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-member-allocation",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          "allocated-quantity": Cl.uint(300),
          "claimed-quantity": Cl.uint(300),
          "claim-date": Cl.some(Cl.uint(simnet.blockHeight)),
          status: Cl.stringAscii("claimed")
        })
      );
    });

    it("should reject double claim", () => {
      // First claim
      simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-distribution",
        [Cl.uint(0)],
        wallet2
      );

      // Try to claim again
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-distribution",
        [Cl.uint(0)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_ALREADY_CLAIMED));
    });

    it("should reject claim without allocation", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-distribution",
        [Cl.uint(0)],
        wallet3 // No allocation for wallet3
      );

      expect(result).toBeErr(Cl.uint(ERR_ALLOCATION_NOT_FOUND));
    });

    it("should reject claim for non-active distribution", () => {
      // Create a new distribution that's not activated
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-distribution",
        [
          Cl.uint(0),
          Cl.uint(500),
          Cl.stringAscii("boxes"),
          Cl.uint(simnet.blockHeight + 200),
          Cl.stringAscii("")
        ],
        wallet1
      );

      // Allocate to wallet3
      simnet.callPublicFn(
        CONTRACT_NAME,
        "allocate-to-member",
        [Cl.uint(1), Cl.principal(wallet3), Cl.uint(100)],
        wallet1
      );

      // Try to claim without activation
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "claim-distribution",
        [Cl.uint(1)],
        wallet3
      );

      expect(result).toBeErr(Cl.uint(ERR_DISTRIBUTION_NOT_ACTIVE));
    });
  });

  // ============================================================================
  // SCHEDULE TESTS
  // ============================================================================
  describe("Distribution Schedule Management", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );
    });

    it("should set distribution schedule successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-distribution-schedule",
        [
          Cl.uint(0),
          Cl.stringAscii("weekly"),
          Cl.uint(1008), // ~7 days in blocks
          Cl.uint(simnet.blockHeight + 100)
        ],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should retrieve schedule correctly", () => {
      // Capture the expected next-distribution-block before the call
      const nextDistributionBlock = simnet.blockHeight + 100;
      
      simnet.callPublicFn(
        CONTRACT_NAME,
        "set-distribution-schedule",
        [
          Cl.uint(0),
          Cl.stringAscii("weekly"),
          Cl.uint(1008),
          Cl.uint(nextDistributionBlock)
        ],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-distribution-schedule",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          frequency: Cl.stringAscii("weekly"),
          "interval-blocks": Cl.uint(1008),
          "next-distribution-block": Cl.uint(nextDistributionBlock),
          "is-active": Cl.bool(true),
          "last-distribution-id": Cl.none()
        })
      );
    });

    it("should pause schedule successfully", () => {
      // Set schedule first
      simnet.callPublicFn(
        CONTRACT_NAME,
        "set-distribution-schedule",
        [
          Cl.uint(0),
          Cl.stringAscii("weekly"),
          Cl.uint(1008),
          Cl.uint(simnet.blockHeight + 100)
        ],
        wallet1
      );

      // Pause
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "pause-schedule",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should resume schedule successfully", () => {
      // Set schedule
      simnet.callPublicFn(
        CONTRACT_NAME,
        "set-distribution-schedule",
        [
          Cl.uint(0),
          Cl.stringAscii("weekly"),
          Cl.uint(1008),
          Cl.uint(simnet.blockHeight + 100)
        ],
        wallet1
      );

      // Pause
      simnet.callPublicFn(
        CONTRACT_NAME,
        "pause-schedule",
        [Cl.uint(0)],
        wallet1
      );

      // Resume
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "resume-schedule",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should reject invalid interval", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-distribution-schedule",
        [
          Cl.uint(0),
          Cl.stringAscii("weekly"),
          Cl.uint(0), // Invalid
          Cl.uint(simnet.blockHeight + 100)
        ],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });
  });

  // ============================================================================
  // ADMIN FUNCTIONS TESTS
  // ============================================================================
  describe("Admin Functions", () => {
    it("should allow contract owner to update claim expiration", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-claim-expiration-blocks",
        [Cl.uint(3000)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify
      const { result: expiration } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-claim-expiration-period",
        [],
        deployer
      );

      expect(expiration).toBeUint(3000);
    });

    it("should prevent non-owner from updating claim expiration", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-claim-expiration-blocks",
        [Cl.uint(3000)],
        wallet1 // Not contract owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject zero expiration blocks", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-claim-expiration-blocks",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });
  });

  // ============================================================================
  // READ-ONLY FUNCTION TESTS
  // ============================================================================
  describe("Read-Only Functions", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-farm-for-distributions",
        [Cl.uint(0), Cl.stringAscii("Test Farm")],
        wallet1
      );
    });

    it("should return none for non-existent farm", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-farm",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should return none for non-existent distribution", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-distribution",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should return none for non-existent allocation", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-member-allocation",
        [Cl.uint(999), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should return none for non-existent schedule", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-distribution-schedule",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should return false for non-admin check", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-farm-distribution-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeBool(false);
    });

    it("should return false for non-claimable distribution check", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-distribution-claimable",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeBool(false);
    });

    it("should return zero for member with no shares", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-member-share-percentage",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeUint(0);
    });

    it("should return default claim expiration period", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-claim-expiration-period",
        [],
        wallet1
      );

      expect(result).toBeUint(2016); // DEFAULT_CLAIM_EXPIRATION_BLOCKS
    });
  });
});

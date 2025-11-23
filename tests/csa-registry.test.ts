import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("CSA-Registry Contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("Farm Registration", () => {
    it("should register a new farm successfully", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [
          Cl.stringAscii("Sunny Valley Farm"),
          Cl.stringAscii("California, USA"),
          Cl.stringAscii("https://metadata.farm/1")
        ],
        deployer
      );

      expect(result).toBeOk(Cl.uint(0));
    });

    it("should increment farm ID for each new farm", () => {
      // Register first farm
      const { result: result1 } = simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [
          Cl.stringAscii("Farm 1"),
          Cl.stringAscii("Location 1"),
          Cl.stringAscii("")
        ],
        wallet1
      );
      expect(result1).toBeOk(Cl.uint(0));

      // Register second farm
      const { result: result2 } = simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [
          Cl.stringAscii("Farm 2"),
          Cl.stringAscii("Location 2"),
          Cl.stringAscii("")
        ],
        wallet2
      );
      expect(result2).toBeOk(Cl.uint(1));
    });

    it("should reject farm registration with empty name", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [
          Cl.stringAscii(""),
          Cl.stringAscii("California, USA"),
          Cl.stringAscii("")
        ],
        deployer
      );

      expect(result).toBeErr(Cl.uint(103)); // ERR_INVALID_FARM_NAME
    });

    it("should reject farm registration with empty location", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [
          Cl.stringAscii("Sunny Valley Farm"),
          Cl.stringAscii(""),
          Cl.stringAscii("")
        ],
        deployer
      );

      expect(result).toBeErr(Cl.uint(104)); // ERR_INVALID_LOCATION
    });

    it("should automatically add farm owner as admin", () => {
      // Register farm
      simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [
          Cl.stringAscii("Test Farm"),
          Cl.stringAscii("Test Location"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      // Check if owner is admin
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "is-farm-admin",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeBool(true);
    });
  });

  describe("Get Farm Details", () => {
    beforeEach(() => {
      // Register a farm for testing
      simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [
          Cl.stringAscii("Test Farm"),
          Cl.stringAscii("Test Location"),
          Cl.stringAscii("https://metadata.farm/test")
        ],
        wallet1
      );
    });

    it("should retrieve farm details correctly", () => {
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "get-farm",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(wallet1),
          name: Cl.stringAscii("Test Farm"),
          location: Cl.stringAscii("Test Location"),
          "created-at": Cl.uint(simnet.blockHeight),
          "is-active": Cl.bool(true),
          "total-members": Cl.uint(0),
          "metadata-uri": Cl.stringAscii("https://metadata.farm/test")
        })
      );
    });

    it("should return none for non-existent farm", () => {
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "get-farm",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });
  });

  describe("Member Management", () => {
    beforeEach(() => {
      // Register a farm
      simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [
          Cl.stringAscii("Test Farm"),
          Cl.stringAscii("Test Location"),
          Cl.stringAscii("")
        ],
        wallet1
      );
    });

    it("should add a member successfully", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [
          Cl.uint(0),
          Cl.principal(wallet2),
          Cl.stringAscii("Premium"),
          Cl.stringAscii("https://metadata.member/1")
        ],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should increment total members count when adding member", () => {
      // Add first member
      simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet1
      );

      // Check member count
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "get-farm-member-count",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(Cl.uint(1));
    });

    it("should reject adding member to non-existent farm", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(999), Cl.principal(wallet2), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(101)); // ERR_FARM_NOT_FOUND
    });

    it("should reject adding member by non-admin", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet3), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet2 // wallet2 is not an admin
      );

      expect(result).toBeErr(Cl.uint(100)); // ERR_UNAUTHORIZED
    });

    it("should reject adding duplicate member", () => {
      // Add member first time
      simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet1
      );

      // Try to add same member again
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Premium"), Cl.stringAscii("")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(106)); // ERR_MEMBER_ALREADY_EXISTS
    });

    it("should retrieve member details correctly", () => {
      // Add member
      simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [
          Cl.uint(0),
          Cl.principal(wallet2),
          Cl.stringAscii("Premium"),
          Cl.stringAscii("https://metadata.member/1")
        ],
        wallet1
      );

      // Get member details
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "get-member",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          "joined-at": Cl.uint(simnet.blockHeight),
          status: Cl.stringAscii("active"),
          "share-tier": Cl.stringAscii("Premium"),
          "metadata-uri": Cl.stringAscii("https://metadata.member/1")
        })
      );
    });

    it("should remove a member successfully", () => {
      // Add member
      simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet1
      );

      // Remove member
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "remove-member",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should decrement total members count when removing member", () => {
      // Add member
      simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet1
      );

      // Remove member
      simnet.callPublicFn(
        "csa-registry",
        "remove-member",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      // Check member count
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "get-farm-member-count",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(Cl.uint(0));
    });

    it("should reject removing non-existent member", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "remove-member",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(105)); // ERR_MEMBER_NOT_FOUND
    });
  });

  describe("Member Status Updates", () => {
    beforeEach(() => {
      // Register farm and add member
      simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [Cl.stringAscii("Test Farm"), Cl.stringAscii("Test Location"), Cl.stringAscii("")],
        wallet1
      );
      simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet1
      );
    });

    it("should update member status to inactive", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "update-member-status",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("inactive")],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should update member status to suspended", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "update-member-status",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("suspended")],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should reject invalid status", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "update-member-status",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("invalid-status")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(110)); // ERR_INVALID_STATUS
    });

    it("should reject status update by non-admin", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "update-member-status",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("inactive")],
        wallet3 // not an admin
      );

      expect(result).toBeErr(Cl.uint(100)); // ERR_UNAUTHORIZED
    });
  });

  describe("Admin Management", () => {
    beforeEach(() => {
      // Register farm
      simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [Cl.stringAscii("Test Farm"), Cl.stringAscii("Test Location"), Cl.stringAscii("")],
        wallet1
      );
    });

    it("should add a farm admin successfully", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "add-farm-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should verify new admin has admin privileges", () => {
      // Add admin
      simnet.callPublicFn(
        "csa-registry",
        "add-farm-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      // Check admin status
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "is-farm-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeBool(true);
    });

    it("should reject adding admin by non-owner", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "add-farm-admin",
        [Cl.uint(0), Cl.principal(wallet3)],
        wallet2 // not the owner
      );

      expect(result).toBeErr(Cl.uint(100)); // ERR_UNAUTHORIZED
    });

    it("should reject adding duplicate admin", () => {
      // Add admin first time
      simnet.callPublicFn(
        "csa-registry",
        "add-farm-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      // Try to add same admin again
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "add-farm-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(109)); // ERR_ADMIN_ALREADY_EXISTS
    });

    it("should remove a farm admin successfully", () => {
      // Add admin
      simnet.callPublicFn(
        "csa-registry",
        "add-farm-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      // Remove admin
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "remove-farm-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should reject removing farm owner as admin", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "remove-farm-admin",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(111)); // ERR_CANNOT_REMOVE_OWNER
    });

    it("should reject removing non-existent admin", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "remove-farm-admin",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(108)); // ERR_ADMIN_NOT_FOUND
    });
  });

  describe("Farm Status Management", () => {
    beforeEach(() => {
      // Register farm
      simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [Cl.stringAscii("Test Farm"), Cl.stringAscii("Test Location"), Cl.stringAscii("")],
        wallet1
      );
    });

    it("should deactivate farm successfully", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "set-farm-active",
        [Cl.uint(0), Cl.bool(false)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should verify farm is inactive after deactivation", () => {
      // Deactivate farm
      simnet.callPublicFn(
        "csa-registry",
        "set-farm-active",
        [Cl.uint(0), Cl.bool(false)],
        wallet1
      );

      // Check farm status
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "is-farm-active",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeBool(false);
    });

    it("should reject adding members to inactive farm", () => {
      // Deactivate farm
      simnet.callPublicFn(
        "csa-registry",
        "set-farm-active",
        [Cl.uint(0), Cl.bool(false)],
        wallet1
      );

      // Try to add member
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(107)); // ERR_FARM_INACTIVE
    });

    it("should reject farm status change by non-owner", () => {
      const { result } = simnet.callPublicFn(
        "csa-registry",
        "set-farm-active",
        [Cl.uint(0), Cl.bool(false)],
        wallet2 // not the owner
      );

      expect(result).toBeErr(Cl.uint(100)); // ERR_UNAUTHORIZED
    });
  });

  describe("Read-Only Functions", () => {
    beforeEach(() => {
      // Register farm
      simnet.callPublicFn(
        "csa-registry",
        "register-farm",
        [Cl.stringAscii("Test Farm"), Cl.stringAscii("Test Location"), Cl.stringAscii("")],
        wallet1
      );
    });

    it("should return correct farm ID nonce", () => {
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "get-farm-id-nonce",
        [],
        wallet1
      );

      expect(result).toBeUint(1);
    });

    it("should return farm owner correctly", () => {
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "get-farm-owner",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(Cl.principal(wallet1));
    });

    it("should return contract owner", () => {
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "get-contract-owner",
        [],
        wallet1
      );

      expect(result).toBePrincipal(deployer);
    });

    it("should check if member is active", () => {
      // Add member
      simnet.callPublicFn(
        "csa-registry",
        "add-member",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Basic"), Cl.stringAscii("")],
        wallet1
      );

      // Check if member is active
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "is-member-active",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeBool(true);
    });

    it("should return false for non-member when checking is-farm-member", () => {
      const { result } = simnet.callReadOnlyFn(
        "csa-registry",
        "is-farm-member",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeBool(false);
    });
  });
});

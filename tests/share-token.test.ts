import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("Share-Token Contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("SIP-010 Compliance", () => {
    it("should return correct token name", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-name",
        [],
        wallet1
      );

      expect(result).toBeOk(Cl.stringAscii("CSA Share Token"));
    });

    it("should return correct token symbol", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-symbol",
        [],
        wallet1
      );

      expect(result).toBeOk(Cl.stringAscii("CSAS"));
    });

    it("should return correct decimals", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-decimals",
        [],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(6));
    });

    it("should return zero balance for new account", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-balance",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(0));
    });

    it("should return zero total supply initially", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-total-supply",
        [],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(0));
    });

    it("should return token URI", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-token-uri",
        [],
        wallet1
      );

      expect(result).toBeOk(Cl.some(Cl.stringUtf8("https://csa-shares.io/token-metadata")));
    });
  });

  describe("Farm Token Initialization", () => {
    it("should initialize farm token metadata successfully", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "initialize-farm-token",
        [
          Cl.uint(0),
          Cl.stringAscii("Sunny Valley Shares"),
          Cl.stringAscii("SVS"),
          Cl.uint(1000000) // 1 STX per share
        ],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should reject initialization by non-owner", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "initialize-farm-token",
        [
          Cl.uint(0),
          Cl.stringAscii("Test Farm Shares"),
          Cl.stringAscii("TFS"),
          Cl.uint(500000)
        ],
        wallet1 // not the contract owner
      );

      expect(result).toBeErr(Cl.uint(200)); // ERR_UNAUTHORIZED
    });

    it("should retrieve farm token metadata correctly", () => {
      // Initialize farm token
      simnet.callPublicFn(
        "share-token",
        "initialize-farm-token",
        [
          Cl.uint(0),
          Cl.stringAscii("Sunny Valley Shares"),
          Cl.stringAscii("SVS"),
          Cl.uint(1000000)
        ],
        deployer
      );

      // Get metadata
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-farm-token-metadata",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Sunny Valley Shares"),
          symbol: Cl.stringAscii("SVS"),
          decimals: Cl.uint(6),
          "total-supply": Cl.uint(0),
          "price-per-share": Cl.uint(1000000),
          "metadata-frozen": Cl.bool(false)
        })
      );
    });
  });

  describe("Minter Authorization", () => {
    it("should authorize a minter successfully", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should verify minter is authorized", () => {
      // Authorize minter
      simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );

      // Check authorization
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "is-authorized-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeBool(true);
    });

    it("should reject authorization by non-owner", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1 // not the owner
      );

      expect(result).toBeErr(Cl.uint(200)); // ERR_UNAUTHORIZED
    });

    it("should revoke minter successfully", () => {
      // Authorize minter first
      simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );

      // Revoke minter
      const { result } = simnet.callPublicFn(
        "share-token",
        "revoke-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should verify minter is not authorized after revocation", () => {
      // Authorize and then revoke
      simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );
      simnet.callPublicFn(
        "share-token",
        "revoke-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );

      // Check authorization
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "is-authorized-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeBool(false);
    });
  });

  describe("Minting Shares", () => {
    beforeEach(() => {
      // Initialize farm token and authorize minter
      simnet.callPublicFn(
        "share-token",
        "initialize-farm-token",
        [Cl.uint(0), Cl.stringAscii("Test Shares"), Cl.stringAscii("TS"), Cl.uint(1000000)],
        deployer
      );
      simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );
    });

    it("should mint shares successfully", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1 // authorized minter
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should update recipient balance after minting", () => {
      // Mint shares
      simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1
      );

      // Check balance
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-balance",
        [Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(100000000));
    });

    it("should update farm-specific balance after minting", () => {
      // Mint shares
      simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1
      );

      // Check farm balance
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-farm-balance",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeUint(100000000);
    });

    it("should update total supply after minting", () => {
      // Mint shares
      simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1
      );

      // Check total supply
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-total-supply",
        [],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(100000000));
    });

    it("should update farm total supply after minting", () => {
      // Mint shares
      simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1
      );

      // Check farm total supply
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-farm-total-supply",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(Cl.uint(100000000));
    });

    it("should reject minting by unauthorized caller", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet3 // not authorized
      );

      expect(result).toBeErr(Cl.uint(200)); // ERR_UNAUTHORIZED
    });

    it("should reject minting zero amount", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(204)); // ERR_INVALID_AMOUNT
    });

    it("should reject minting for non-existent farm", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(999), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(203)); // ERR_FARM_NOT_FOUND
    });
  });

  describe("Burning Shares", () => {
    beforeEach(() => {
      // Initialize farm token, authorize minter, and mint shares
      simnet.callPublicFn(
        "share-token",
        "initialize-farm-token",
        [Cl.uint(0), Cl.stringAscii("Test Shares"), Cl.stringAscii("TS"), Cl.uint(1000000)],
        deployer
      );
      simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );
      simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1
      );
    });

    it("should burn shares successfully by holder", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "burn-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2)],
        wallet2 // holder burning their own shares
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should burn shares successfully by authorized minter", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "burn-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2)],
        wallet1 // authorized minter
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should update balance after burning", () => {
      // Burn shares
      simnet.callPublicFn(
        "share-token",
        "burn-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2)],
        wallet2
      );

      // Check balance
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-balance",
        [Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(50000000));
    });

    it("should update total supply after burning", () => {
      // Burn shares
      simnet.callPublicFn(
        "share-token",
        "burn-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2)],
        wallet2
      );

      // Check total supply
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-total-supply",
        [],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(50000000));
    });

    it("should reject burning by unauthorized caller", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "burn-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2)],
        wallet3 // not authorized
      );

      expect(result).toBeErr(Cl.uint(200)); // ERR_UNAUTHORIZED
    });

    it("should reject burning more than balance", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "burn-shares",
        [Cl.uint(0), Cl.uint(200000000), Cl.principal(wallet2)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(202)); // ERR_INSUFFICIENT_BALANCE
    });

    it("should reject burning zero amount", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "burn-shares",
        [Cl.uint(0), Cl.uint(0), Cl.principal(wallet2)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(204)); // ERR_INVALID_AMOUNT
    });
  });

  describe("SIP-010 Transfer", () => {
    beforeEach(() => {
      // Initialize farm token, authorize minter, and mint shares
      simnet.callPublicFn(
        "share-token",
        "initialize-farm-token",
        [Cl.uint(0), Cl.stringAscii("Test Shares"), Cl.stringAscii("TS"), Cl.uint(1000000)],
        deployer
      );
      simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );
      simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1
      );
    });

    it("should transfer tokens successfully", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer",
        [
          Cl.uint(50000000),
          Cl.principal(wallet2),
          Cl.principal(wallet3),
          Cl.none()
        ],
        wallet2
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should transfer tokens with memo", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer",
        [
          Cl.uint(50000000),
          Cl.principal(wallet2),
          Cl.principal(wallet3),
          Cl.some(Cl.bufferFromUtf8("Payment for produce"))
        ],
        wallet2
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should update sender balance after transfer", () => {
      // Transfer tokens
      simnet.callPublicFn(
        "share-token",
        "transfer",
        [Cl.uint(50000000), Cl.principal(wallet2), Cl.principal(wallet3), Cl.none()],
        wallet2
      );

      // Check sender balance
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-balance",
        [Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(50000000));
    });

    it("should update recipient balance after transfer", () => {
      // Transfer tokens
      simnet.callPublicFn(
        "share-token",
        "transfer",
        [Cl.uint(50000000), Cl.principal(wallet2), Cl.principal(wallet3), Cl.none()],
        wallet2
      );

      // Check recipient balance
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-balance",
        [Cl.principal(wallet3)],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(50000000));
    });

    it("should reject transfer by non-owner", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer",
        [Cl.uint(50000000), Cl.principal(wallet2), Cl.principal(wallet3), Cl.none()],
        wallet1 // not the token owner
      );

      expect(result).toBeErr(Cl.uint(201)); // ERR_NOT_TOKEN_OWNER
    });

    it("should reject transfer of zero amount", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer",
        [Cl.uint(0), Cl.principal(wallet2), Cl.principal(wallet3), Cl.none()],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(204)); // ERR_INVALID_AMOUNT
    });

    it("should reject transfer to self", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer",
        [Cl.uint(50000000), Cl.principal(wallet2), Cl.principal(wallet2), Cl.none()],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(206)); // ERR_INVALID_PRINCIPAL
    });
  });

  describe("Farm-Specific Transfer", () => {
    beforeEach(() => {
      // Initialize farm token, authorize minter, and mint shares
      simnet.callPublicFn(
        "share-token",
        "initialize-farm-token",
        [Cl.uint(0), Cl.stringAscii("Test Shares"), Cl.stringAscii("TS"), Cl.uint(1000000)],
        deployer
      );
      simnet.callPublicFn(
        "share-token",
        "authorize-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        deployer
      );
      simnet.callPublicFn(
        "share-token",
        "mint-shares",
        [Cl.uint(0), Cl.uint(100000000), Cl.principal(wallet2)],
        wallet1
      );
    });

    it("should transfer farm shares successfully", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer-farm-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2), Cl.principal(wallet3)],
        wallet2
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should update sender farm balance after transfer", () => {
      // Transfer shares
      simnet.callPublicFn(
        "share-token",
        "transfer-farm-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2), Cl.principal(wallet3)],
        wallet2
      );

      // Check sender farm balance
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-farm-balance",
        [Cl.uint(0), Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeUint(50000000);
    });

    it("should update recipient farm balance after transfer", () => {
      // Transfer shares
      simnet.callPublicFn(
        "share-token",
        "transfer-farm-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2), Cl.principal(wallet3)],
        wallet2
      );

      // Check recipient farm balance
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-farm-balance",
        [Cl.uint(0), Cl.principal(wallet3)],
        wallet1
      );

      expect(result).toBeUint(50000000);
    });

    it("should reject farm transfer by non-owner", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer-farm-shares",
        [Cl.uint(0), Cl.uint(50000000), Cl.principal(wallet2), Cl.principal(wallet3)],
        wallet1 // not the token owner
      );

      expect(result).toBeErr(Cl.uint(201)); // ERR_NOT_TOKEN_OWNER
    });

    it("should reject farm transfer with insufficient balance", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer-farm-shares",
        [Cl.uint(0), Cl.uint(200000000), Cl.principal(wallet2), Cl.principal(wallet3)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(202)); // ERR_INSUFFICIENT_BALANCE
    });

    it("should reject farm transfer of zero amount", () => {
      const { result } = simnet.callPublicFn(
        "share-token",
        "transfer-farm-shares",
        [Cl.uint(0), Cl.uint(0), Cl.principal(wallet2), Cl.principal(wallet3)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(204)); // ERR_INVALID_AMOUNT
    });
  });

  describe("Read-Only Functions", () => {
    beforeEach(() => {
      // Initialize farm token
      simnet.callPublicFn(
        "share-token",
        "initialize-farm-token",
        [Cl.uint(0), Cl.stringAscii("Test Shares"), Cl.stringAscii("TS"), Cl.uint(1000000)],
        deployer
      );
    });

    it("should return contract owner", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-contract-owner",
        [],
        wallet1
      );

      expect(result).toBePrincipal(deployer);
    });

    it("should return share price for farm", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-share-price",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(Cl.uint(1000000));
    });

    it("should return none for non-existent farm metadata", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-farm-token-metadata",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should return zero for non-existent farm balance", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "get-farm-balance",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeUint(0);
    });

    it("should return false for non-authorized minter", () => {
      const { result } = simnet.callReadOnlyFn(
        "share-token",
        "is-authorized-minter",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeBool(false);
    });
  });
});

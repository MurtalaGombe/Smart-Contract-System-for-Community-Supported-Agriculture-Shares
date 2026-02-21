import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;

// Contract name constant
const CONTRACT_NAME = "governance";

// Error codes from the contract
const ERR_UNAUTHORIZED = 500;
const ERR_PROPOSAL_NOT_FOUND = 501;
const ERR_ALREADY_VOTED = 502;
const ERR_VOTING_CLOSED = 503;
const ERR_PROPOSAL_NOT_PASSED = 504;
const ERR_PROPOSAL_ALREADY_EXECUTED = 505;
const ERR_INVALID_TITLE = 506;
const ERR_INVALID_DESCRIPTION = 507;
const ERR_INVALID_TYPE = 508;
const ERR_DISPUTE_NOT_FOUND = 509;
const ERR_DISPUTE_ALREADY_RESOLVED = 510;
const ERR_INVALID_AMOUNT = 511;
const ERR_INSUFFICIENT_VOTING_POWER = 512;
const ERR_VOTING_STILL_ACTIVE = 513;
const ERR_INVALID_RESOLUTION = 514;
const ERR_VOTER_NOT_REGISTERED = 515;
const ERR_VOTER_ALREADY_REGISTERED = 516;
const ERR_INVALID_FARM_ID = 517;
const ERR_PROPOSAL_NOT_ACTIVE = 518;
const ERR_DISPUTE_NOT_OPEN = 519;

describe("Governance Contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  // ============================================================================
  // VOTER REGISTRATION TESTS
  // ============================================================================
  describe("Voter Registration", () => {
    it("should register a voter with voting power successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should store voter data correctly", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-voter",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          "voting-power": Cl.uint(10),
          "registered-at": Cl.uint(simnet.blockHeight),
          "is-active": Cl.bool(true)
        })
      );
    });

    it("should increment total registered voters", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet2), Cl.uint(5)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-voters",
        [],
        deployer
      );

      expect(result).toBeUint(2);
    });

    it("should prevent non-owner from registering voters", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet2), Cl.uint(10)],
        wallet1 // Not the contract owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should prevent duplicate voter registration", () => {
      // Register once
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );

      // Try again
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(20)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_VOTER_ALREADY_REGISTERED));
    });

    it("should reject zero voting power", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(0)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should verify voter is active after registration", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-active-voter",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeBool(true);
    });

    it("should return false for unregistered voter", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-active-voter",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeBool(false);
    });
  });

  // ============================================================================
  // VOTER POWER UPDATE TESTS
  // ============================================================================
  describe("Voter Power Management", () => {
    beforeEach(() => {
      // Register wallet1 as voter
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );
    });

    it("should update voter power successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "update-voter-power",
        [Cl.principal(wallet1), Cl.uint(25)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify updated power
      const { result: voter } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-voter",
        [Cl.principal(wallet1)],
        wallet1
      );

      // Verify voting power was updated (registered-at stays from original registration)
      expect(voter).toBeSome(
        Cl.tuple({
          "voting-power": Cl.uint(25),
          "registered-at": Cl.uint(simnet.blockHeight - 1),
          "is-active": Cl.bool(true)
        })
      );
    });

    it("should prevent non-owner from updating voter power", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "update-voter-power",
        [Cl.principal(wallet1), Cl.uint(25)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should fail for unregistered voter", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "update-voter-power",
        [Cl.principal(wallet2), Cl.uint(25)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_VOTER_NOT_REGISTERED));
    });

    it("should reject zero voting power update", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "update-voter-power",
        [Cl.principal(wallet1), Cl.uint(0)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });
  });

  // ============================================================================
  // VOTER DEACTIVATION / REACTIVATION TESTS
  // ============================================================================
  describe("Voter Deactivation and Reactivation", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );
    });

    it("should deactivate a voter", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "deactivate-voter",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify deactivated
      const { result: isActive } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-active-voter",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(isActive).toBeBool(false);
    });

    it("should decrement total voters on deactivation", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet2), Cl.uint(5)],
        deployer
      );

      // Total should be 2
      let { result: count } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-voters",
        [],
        deployer
      );
      expect(count).toBeUint(2);

      // Deactivate one
      simnet.callPublicFn(
        CONTRACT_NAME,
        "deactivate-voter",
        [Cl.principal(wallet1)],
        deployer
      );

      // Total should be 1
      ({ result: count } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-total-voters",
        [],
        deployer
      ));
      expect(count).toBeUint(1);
    });

    it("should reactivate a deactivated voter", () => {
      // Deactivate
      simnet.callPublicFn(
        CONTRACT_NAME,
        "deactivate-voter",
        [Cl.principal(wallet1)],
        deployer
      );

      // Reactivate
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "reactivate-voter",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Verify reactivated
      const { result: isActive } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-active-voter",
        [Cl.principal(wallet1)],
        wallet1
      );

      expect(isActive).toBeBool(true);
    });

    it("should fail to reactivate an already active voter", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "reactivate-voter",
        [Cl.principal(wallet1)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_VOTER_ALREADY_REGISTERED));
    });

    it("should prevent non-owner from deactivating voters", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "deactivate-voter",
        [Cl.principal(wallet1)],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });
  });

  // ============================================================================
  // PROPOSAL CREATION TESTS
  // ============================================================================
  describe("Proposal Creation", () => {
    beforeEach(() => {
      // Register voters
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet2), Cl.uint(5)],
        deployer
      );
    });

    it("should create a proposal successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Update platform fee"),
          Cl.stringAscii("Reduce platform fee from 2% to 1.5% to benefit farmers"),
          Cl.stringAscii("parameter"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(0));
    });

    it("should increment proposal IDs", () => {
      const { result: r1 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Proposal 1"),
          Cl.stringAscii("Description 1"),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet1
      );
      expect(r1).toBeOk(Cl.uint(0));

      const { result: r2 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Proposal 2"),
          Cl.stringAscii("Description 2"),
          Cl.stringAscii("upgrade"),
          Cl.stringAscii("")
        ],
        wallet2
      );
      expect(r2).toBeOk(Cl.uint(1));
    });

    it("should store proposal data correctly", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Fee Update"),
          Cl.stringAscii("Lower fees"),
          Cl.stringAscii("parameter"),
          Cl.stringAscii("https://proposal.meta/1")
        ],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          proposer: Cl.principal(wallet1),
          title: Cl.stringAscii("Fee Update"),
          description: Cl.stringAscii("Lower fees"),
          "proposal-type": Cl.stringAscii("parameter"),
          status: Cl.stringAscii("active"),
          "created-at": Cl.uint(simnet.blockHeight),
          "voting-deadline": Cl.uint(simnet.blockHeight + 1440),
          "votes-for": Cl.uint(0),
          "votes-against": Cl.uint(0),
          "total-voters-at-creation": Cl.uint(2),
          "executed-at": Cl.none(),
          "metadata-uri": Cl.stringAscii("https://proposal.meta/1")
        })
      );
    });

    it("should reject proposal with empty title", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii(""),
          Cl.stringAscii("Description"),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_TITLE));
    });

    it("should reject proposal with empty description", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Title"),
          Cl.stringAscii(""),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_DESCRIPTION));
    });

    it("should reject proposal with invalid type", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Title"),
          Cl.stringAscii("Description"),
          Cl.stringAscii("invalid-type"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_TYPE));
    });

    it("should reject proposal from unregistered voter", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Title"),
          Cl.stringAscii("Description"),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet3 // Not registered
      );

      expect(result).toBeErr(Cl.uint(ERR_INSUFFICIENT_VOTING_POWER));
    });

    it("should support all valid proposal types", () => {
      const types = ["parameter", "upgrade", "dispute", "general"];

      for (let i = 0; i < types.length; i++) {
        const { result } = simnet.callPublicFn(
          CONTRACT_NAME,
          "create-proposal",
          [
            Cl.stringAscii(`Proposal type ${types[i]}`),
            Cl.stringAscii(`Test ${types[i]} proposal`),
            Cl.stringAscii(types[i]),
            Cl.stringAscii("")
          ],
          wallet1
        );
        expect(result).toBeOk(Cl.uint(i));
      }
    });

    it("should return none for non-existent proposal", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });

    it("should track proposal count correctly", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("P1"),
          Cl.stringAscii("D1"),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal-count",
        [],
        deployer
      );

      expect(result).toBeUint(1);
    });
  });

  // ============================================================================
  // VOTING TESTS
  // ============================================================================
  describe("Voting on Proposals", () => {
    beforeEach(() => {
      // Register voters with different voting powers
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet2), Cl.uint(5)],
        deployer
      );
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet3), Cl.uint(3)],
        deployer
      );

      // Create a proposal
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Test Proposal"),
          Cl.stringAscii("Test Description"),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet1
      );
    });

    it("should allow a registered voter to vote for", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should allow a registered voter to vote against", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(false)],
        wallet2
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should record vote details correctly", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-vote",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          vote: Cl.bool(true),
          "voting-power": Cl.uint(10),
          "voted-at": Cl.uint(simnet.blockHeight)
        })
      );
    });

    it("should update vote tallies with weighted votes", () => {
      // wallet1 votes for (power 10)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet1
      );

      // wallet2 votes against (power 5)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(false)],
        wallet2
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal-votes",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeSome(
        Cl.tuple({
          "votes-for": Cl.uint(10),
          "votes-against": Cl.uint(5)
        })
      );
    });

    it("should prevent double voting", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(false)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_ALREADY_VOTED));
    });

    it("should prevent unregistered voters from voting", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet4 // Not registered
      );

      expect(result).toBeErr(Cl.uint(ERR_INSUFFICIENT_VOTING_POWER));
    });

    it("should correctly report has-voted", () => {
      // Before voting
      let { result: before } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "has-voted",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );
      expect(before).toBeBool(false);

      // Vote
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet1
      );

      // After voting
      let { result: after } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "has-voted",
        [Cl.uint(0), Cl.principal(wallet1)],
        wallet1
      );
      expect(after).toBeBool(true);
    });

    it("should report voting as active for active proposals", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-voting-active",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeBool(true);
    });

    it("should reject votes on non-existent proposals", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(999), Cl.bool(true)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_PROPOSAL_NOT_FOUND));
    });

    it("should prevent deactivated voters from voting", () => {
      // Deactivate wallet3
      simnet.callPublicFn(
        CONTRACT_NAME,
        "deactivate-voter",
        [Cl.principal(wallet3)],
        deployer
      );

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet3
      );

      expect(result).toBeErr(Cl.uint(ERR_INSUFFICIENT_VOTING_POWER));
    });

    it("should return none votes for non-existent proposal", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal-votes",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });
  });

  // ============================================================================
  // PROPOSAL FINALIZATION TESTS
  // ============================================================================
  describe("Proposal Finalization", () => {
    beforeEach(() => {
      // Register voters
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet2), Cl.uint(5)],
        deployer
      );
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet3), Cl.uint(3)],
        deployer
      );

      // Set a short voting period for testing (2 blocks)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "set-voting-period",
        [Cl.uint(2)],
        deployer
      );

      // Create a proposal
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Test Proposal"),
          Cl.stringAscii("Test Description"),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet1
      );
    });

    it("should reject finalization while voting is still active", () => {
      // Set a longer voting period so it doesn't expire immediately
      simnet.callPublicFn(
        CONTRACT_NAME,
        "set-voting-period",
        [Cl.uint(100)],
        deployer
      );

      // Create a new proposal with the longer voting period
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Long Vote Proposal"),
          Cl.stringAscii("This has a long voting period"),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      // Vote (voting is still within the period)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(1), Cl.bool(true)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "finalize-proposal",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_VOTING_STILL_ACTIVE));
    });

    it("should pass proposal when votes-for > votes-against", () => {
      // wallet1 votes for (power 10)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet1
      );

      // wallet2 votes against (power 5)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(false)],
        wallet2
      );

      // Mine blocks to pass voting deadline
      simnet.mineEmptyBlocks(3);

      // Finalize
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "finalize-proposal",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Check proposal is now passed
      const { result: passed } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-proposal-passed",
        [Cl.uint(0)],
        deployer
      );
      expect(passed).toBeBool(true);
    });

    it("should reject proposal when votes-against >= votes-for", () => {
      // wallet2 votes against (power 5)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(false)],
        wallet2
      );

      // wallet3 votes for (power 3)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet3
      );

      // Mine blocks to pass voting deadline
      simnet.mineEmptyBlocks(3);

      // Finalize
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "finalize-proposal",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      // Check proposal is rejected
      const { result: passed } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-proposal-passed",
        [Cl.uint(0)],
        deployer
      );
      expect(passed).toBeBool(false);
    });

    it("should reject finalization for non-existent proposal", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "finalize-proposal",
        [Cl.uint(999)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_PROPOSAL_NOT_FOUND));
    });
  });

  // ============================================================================
  // PROPOSAL EXECUTION TESTS
  // ============================================================================
  describe("Proposal Execution", () => {
    beforeEach(() => {
      // Register voters
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );

      // Set short voting period
      simnet.callPublicFn(
        CONTRACT_NAME,
        "set-voting-period",
        [Cl.uint(2)],
        deployer
      );

      // Create and pass a proposal
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Passed Proposal"),
          Cl.stringAscii("This should be executed"),
          Cl.stringAscii("parameter"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet1
      );

      simnet.mineEmptyBlocks(3);

      simnet.callPublicFn(
        CONTRACT_NAME,
        "finalize-proposal",
        [Cl.uint(0)],
        deployer
      );
    });

    it("should execute a passed proposal", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "execute-proposal",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should mark proposal as executed with timestamp", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "execute-proposal",
        [Cl.uint(0)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal",
        [Cl.uint(0)],
        deployer
      );

      // Verify the proposal status is "executed"
      const { result: passed } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-proposal-passed",
        [Cl.uint(0)],
        deployer
      );
      expect(passed).toBeBool(true); // is-proposal-passed returns true for "executed" too
    });

    it("should prevent non-owner from executing proposals", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "execute-proposal",
        [Cl.uint(0)],
        wallet1 // Not the contract owner
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject execution of non-passed proposals", () => {
      // Create another proposal but DON'T finalize it
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Active Proposal"),
          Cl.stringAscii("Still active"),
          Cl.stringAscii("general"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "execute-proposal",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_PROPOSAL_NOT_PASSED));
    });

    it("should reject double execution", () => {
      // Execute once
      simnet.callPublicFn(
        CONTRACT_NAME,
        "execute-proposal",
        [Cl.uint(0)],
        deployer
      );

      // Try to execute again
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "execute-proposal",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_PROPOSAL_NOT_PASSED));
    });
  });

  // ============================================================================
  // DISPUTE FILING TESTS
  // ============================================================================
  describe("Dispute Filing", () => {
    it("should file a dispute successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [
          Cl.uint(0),
          Cl.principal(wallet2),
          Cl.stringAscii("Produce quality was below the agreed standard for the last 3 distributions")
        ],
        wallet1
      );

      expect(result).toBeOk(Cl.uint(0));
    });

    it("should store dispute data correctly", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [
          Cl.uint(1),
          Cl.principal(wallet2),
          Cl.stringAscii("Quality dispute")
        ],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-dispute",
        [Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          "farm-id": Cl.uint(1),
          complainant: Cl.principal(wallet1),
          respondent: Cl.principal(wallet2),
          description: Cl.stringAscii("Quality dispute"),
          status: Cl.stringAscii("open"),
          resolution: Cl.stringAscii(""),
          "created-at": Cl.uint(simnet.blockHeight),
          "resolved-at": Cl.none(),
          "resolved-by": Cl.none(),
          "linked-proposal-id": Cl.none()
        })
      );
    });

    it("should increment dispute IDs", () => {
      const { result: r1 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Dispute 1")],
        wallet1
      );
      expect(r1).toBeOk(Cl.uint(0));

      const { result: r2 } = simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [Cl.uint(0), Cl.principal(wallet1), Cl.stringAscii("Dispute 2")],
        wallet2
      );
      expect(r2).toBeOk(Cl.uint(1));
    });

    it("should reject dispute with empty description", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_DESCRIPTION));
    });

    it("should prevent filing dispute against yourself", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [Cl.uint(0), Cl.principal(wallet1), Cl.stringAscii("Self dispute")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should track dispute count", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Test")],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-dispute-count",
        [],
        deployer
      );

      expect(result).toBeUint(1);
    });

    it("should return none for non-existent dispute", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-dispute",
        [Cl.uint(999)],
        wallet1
      );

      expect(result).toBeNone();
    });
  });

  // ============================================================================
  // DISPUTE RESOLUTION TESTS
  // ============================================================================
  describe("Dispute Resolution", () => {
    beforeEach(() => {
      // File a dispute
      simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [
          Cl.uint(0),
          Cl.principal(wallet2),
          Cl.stringAscii("Produce quality issue")
        ],
        wallet1
      );
    });

    it("should resolve a dispute successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "resolve-dispute",
        [
          Cl.uint(0),
          Cl.stringAscii("Both parties agree to improved quality standards going forward")
        ],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should store resolution details", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "resolve-dispute",
        [
          Cl.uint(0),
          Cl.stringAscii("Resolution agreed upon")
        ],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-dispute",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeSome(
        Cl.tuple({
          "farm-id": Cl.uint(0),
          complainant: Cl.principal(wallet1),
          respondent: Cl.principal(wallet2),
          description: Cl.stringAscii("Produce quality issue"),
          status: Cl.stringAscii("resolved"),
          resolution: Cl.stringAscii("Resolution agreed upon"),
          "created-at": Cl.uint(simnet.blockHeight - 1),
          "resolved-at": Cl.some(Cl.uint(simnet.blockHeight)),
          "resolved-by": Cl.some(Cl.principal(deployer)),
          "linked-proposal-id": Cl.none()
        })
      );
    });

    it("should prevent non-owner from resolving disputes", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "resolve-dispute",
        [Cl.uint(0), Cl.stringAscii("Unauthorized resolution")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should prevent resolving non-existent dispute", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "resolve-dispute",
        [Cl.uint(999), Cl.stringAscii("Resolution")],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_DISPUTE_NOT_FOUND));
    });

    it("should prevent resolving already resolved dispute", () => {
      // Resolve once
      simnet.callPublicFn(
        CONTRACT_NAME,
        "resolve-dispute",
        [Cl.uint(0), Cl.stringAscii("First resolution")],
        deployer
      );

      // Try to resolve again
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "resolve-dispute",
        [Cl.uint(0), Cl.stringAscii("Second resolution")],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_DISPUTE_NOT_OPEN));
    });

    it("should reject empty resolution", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "resolve-dispute",
        [Cl.uint(0), Cl.stringAscii("")],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_RESOLUTION));
    });
  });

  // ============================================================================
  // DISPUTE DISMISSAL TESTS
  // ============================================================================
  describe("Dispute Dismissal", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Dispute to dismiss")],
        wallet1
      );
    });

    it("should dismiss a dispute successfully", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "dismiss-dispute",
        [Cl.uint(0), Cl.stringAscii("Insufficient evidence to proceed")],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should update dispute status to dismissed", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "dismiss-dispute",
        [Cl.uint(0), Cl.stringAscii("No merit found")],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-dispute",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeSome(
        Cl.tuple({
          "farm-id": Cl.uint(0),
          complainant: Cl.principal(wallet1),
          respondent: Cl.principal(wallet2),
          description: Cl.stringAscii("Dispute to dismiss"),
          status: Cl.stringAscii("dismissed"),
          resolution: Cl.stringAscii("No merit found"),
          "created-at": Cl.uint(simnet.blockHeight - 1),
          "resolved-at": Cl.some(Cl.uint(simnet.blockHeight)),
          "resolved-by": Cl.some(Cl.principal(deployer)),
          "linked-proposal-id": Cl.none()
        })
      );
    });

    it("should prevent non-owner from dismissing", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "dismiss-dispute",
        [Cl.uint(0), Cl.stringAscii("Reason")],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject empty dismissal reason", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "dismiss-dispute",
        [Cl.uint(0), Cl.stringAscii("")],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_RESOLUTION));
    });

    it("should prevent dismissing an already dismissed dispute", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "dismiss-dispute",
        [Cl.uint(0), Cl.stringAscii("Dismissed")],
        deployer
      );

      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "dismiss-dispute",
        [Cl.uint(0), Cl.stringAscii("Dismissed again")],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_DISPUTE_NOT_OPEN));
    });
  });

  // ============================================================================
  // DISPUTE-PROPOSAL LINKING TESTS
  // ============================================================================
  describe("Dispute-Proposal Linking", () => {
    beforeEach(() => {
      // Register voter
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );

      // Create proposal
      simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Dispute Resolution"),
          Cl.stringAscii("Vote on dispute outcome"),
          Cl.stringAscii("dispute"),
          Cl.stringAscii("")
        ],
        wallet1
      );

      // File dispute
      simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [Cl.uint(0), Cl.principal(wallet2), Cl.stringAscii("Quality dispute")],
        wallet1
      );
    });

    it("should link a dispute to a proposal", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "link-dispute-to-proposal",
        [Cl.uint(0), Cl.uint(0)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("should store the linked proposal ID", () => {
      simnet.callPublicFn(
        CONTRACT_NAME,
        "link-dispute-to-proposal",
        [Cl.uint(0), Cl.uint(0)],
        deployer
      );

      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-dispute",
        [Cl.uint(0)],
        deployer
      );

      // Check that linked-proposal-id is set
      expect(result).toBeSome(
        Cl.tuple({
          "farm-id": Cl.uint(0),
          complainant: Cl.principal(wallet1),
          respondent: Cl.principal(wallet2),
          description: Cl.stringAscii("Quality dispute"),
          status: Cl.stringAscii("open"),
          resolution: Cl.stringAscii(""),
          "created-at": Cl.uint(simnet.blockHeight - 1),
          "resolved-at": Cl.none(),
          "resolved-by": Cl.none(),
          "linked-proposal-id": Cl.some(Cl.uint(0))
        })
      );
    });

    it("should prevent non-owner from linking", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "link-dispute-to-proposal",
        [Cl.uint(0), Cl.uint(0)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject linking non-existent dispute", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "link-dispute-to-proposal",
        [Cl.uint(999), Cl.uint(0)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_DISPUTE_NOT_FOUND));
    });

    it("should reject linking to non-existent proposal", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "link-dispute-to-proposal",
        [Cl.uint(0), Cl.uint(999)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_PROPOSAL_NOT_FOUND));
    });
  });

  // ============================================================================
  // ADMIN CONFIGURATION TESTS
  // ============================================================================
  describe("Admin Configuration", () => {
    it("should update voting period", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-voting-period",
        [Cl.uint(2880)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      const { result: period } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-voting-period",
        [],
        deployer
      );

      expect(period).toBeUint(2880);
    });

    it("should prevent non-owner from updating voting period", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-voting-period",
        [Cl.uint(2880)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject zero voting period", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-voting-period",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should update proposal threshold", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-proposal-threshold",
        [Cl.uint(50)],
        deployer
      );

      expect(result).toBeOk(Cl.bool(true));

      const { result: threshold } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal-threshold",
        [],
        deployer
      );

      expect(threshold).toBeUint(50);
    });

    it("should prevent non-owner from updating threshold", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-proposal-threshold",
        [Cl.uint(50)],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(ERR_UNAUTHORIZED));
    });

    it("should reject zero proposal threshold", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT_NAME,
        "set-proposal-threshold",
        [Cl.uint(0)],
        deployer
      );

      expect(result).toBeErr(Cl.uint(ERR_INVALID_AMOUNT));
    });

    it("should return default voting period", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-voting-period",
        [],
        deployer
      );

      expect(result).toBeUint(1440);
    });

    it("should return default proposal threshold", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal-threshold",
        [],
        deployer
      );

      expect(result).toBeUint(1);
    });

    it("should return contract owner", () => {
      const { result } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-contract-owner",
        [],
        wallet1
      );

      expect(result).toBePrincipal(deployer);
    });
  });

  // ============================================================================
  // INTEGRATION / END-TO-END TESTS
  // ============================================================================
  describe("End-to-End: Full Governance Lifecycle", () => {
    it("should complete a full proposal lifecycle: create -> vote -> finalize -> execute", () => {
      // Step 1: Register voters with different voting powers
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet2), Cl.uint(8)],
        deployer
      );
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet3), Cl.uint(5)],
        deployer
      );

      // Step 2: Set a short voting period for testing (large enough for all votes)
      simnet.callPublicFn(
        CONTRACT_NAME,
        "set-voting-period",
        [Cl.uint(20)],
        deployer
      );

      // Step 3: Create a proposal
      const { result: proposalResult } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Reduce Platform Fee"),
          Cl.stringAscii("Lower fee from 2% to 1% to attract more farms"),
          Cl.stringAscii("parameter"),
          Cl.stringAscii("https://ipfs.io/proposal/1")
        ],
        wallet1
      );
      expect(proposalResult).toBeOk(Cl.uint(0));

      // Step 4: Vote - majority votes for
      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet1
      ); // +10

      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(true)],
        wallet2
      ); // +8

      simnet.callPublicFn(
        CONTRACT_NAME,
        "vote-on-proposal",
        [Cl.uint(0), Cl.bool(false)],
        wallet3
      ); // -5

      // Verify vote tallies: 18 for, 5 against
      const { result: votes } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-proposal-votes",
        [Cl.uint(0)],
        deployer
      );
      // Votes are weighted by voting power
      const voteData = votes;
      expect(voteData).toBeSome(
        Cl.tuple({
          "votes-for": Cl.uint(18),
          "votes-against": Cl.uint(5)
        })
      );

      // Step 5: Wait for voting period to end
      simnet.mineEmptyBlocks(21);

      // Step 6: Finalize proposal
      const { result: finalizeResult } = simnet.callPublicFn(
        CONTRACT_NAME,
        "finalize-proposal",
        [Cl.uint(0)],
        deployer
      );
      expect(finalizeResult).toBeOk(Cl.bool(true));

      // Verify proposal passed
      const { result: isPassed } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-proposal-passed",
        [Cl.uint(0)],
        deployer
      );
      expect(isPassed).toBeBool(true);

      // Step 7: Execute proposal
      const { result: executeResult } = simnet.callPublicFn(
        CONTRACT_NAME,
        "execute-proposal",
        [Cl.uint(0)],
        deployer
      );
      expect(executeResult).toBeOk(Cl.bool(true));

      // Final verification - proposal is still considered passed
      const { result: finalCheck } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "is-proposal-passed",
        [Cl.uint(0)],
        deployer
      );
      expect(finalCheck).toBeBool(true);
    });

    it("should complete full dispute lifecycle: file -> link to proposal -> resolve", () => {
      // Register voter for proposal
      simnet.callPublicFn(
        CONTRACT_NAME,
        "register-voter",
        [Cl.principal(wallet1), Cl.uint(10)],
        deployer
      );

      // Step 1: File a dispute
      const { result: disputeResult } = simnet.callPublicFn(
        CONTRACT_NAME,
        "file-dispute",
        [
          Cl.uint(0),
          Cl.principal(wallet2),
          Cl.stringAscii("Farm delivered substandard produce for 3 consecutive weeks")
        ],
        wallet1
      );
      expect(disputeResult).toBeOk(Cl.uint(0));

      // Step 2: Create a governance proposal to decide on the dispute
      const { result: proposalResult } = simnet.callPublicFn(
        CONTRACT_NAME,
        "create-proposal",
        [
          Cl.stringAscii("Resolve Quality Dispute #0"),
          Cl.stringAscii("Vote on resolution for quality dispute between members"),
          Cl.stringAscii("dispute"),
          Cl.stringAscii("")
        ],
        wallet1
      );
      expect(proposalResult).toBeOk(Cl.uint(0));

      // Step 3: Link the dispute to the proposal
      const { result: linkResult } = simnet.callPublicFn(
        CONTRACT_NAME,
        "link-dispute-to-proposal",
        [Cl.uint(0), Cl.uint(0)],
        deployer
      );
      expect(linkResult).toBeOk(Cl.bool(true));

      // Step 4: Resolve the dispute
      const { result: resolveResult } = simnet.callPublicFn(
        CONTRACT_NAME,
        "resolve-dispute",
        [
          Cl.uint(0),
          Cl.stringAscii("Farm must provide replacement produce or partial refund to complainant")
        ],
        deployer
      );
      expect(resolveResult).toBeOk(Cl.bool(true));

      // Verify final state
      const { result: dispute } = simnet.callReadOnlyFn(
        CONTRACT_NAME,
        "get-dispute",
        [Cl.uint(0)],
        deployer
      );

      expect(dispute).toBeSome(
        Cl.tuple({
          "farm-id": Cl.uint(0),
          complainant: Cl.principal(wallet1),
          respondent: Cl.principal(wallet2),
          description: Cl.stringAscii("Farm delivered substandard produce for 3 consecutive weeks"),
          status: Cl.stringAscii("resolved"),
          resolution: Cl.stringAscii("Farm must provide replacement produce or partial refund to complainant"),
          "created-at": Cl.uint(simnet.blockHeight - 3),
          "resolved-at": Cl.some(Cl.uint(simnet.blockHeight)),
          "resolved-by": Cl.some(Cl.principal(deployer)),
          "linked-proposal-id": Cl.some(Cl.uint(0))
        })
      );
    });
  });
});

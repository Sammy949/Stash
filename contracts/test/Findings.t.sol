// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {StashVault} from "../src/StashVault.sol";

/// Demonstrations for the review. Each test PASSES by exhibiting the behaviour
/// described in its name — these document reality, they are not regressions.
contract FindingsTest is Test {
    StashVault vault;
    address ada = address(0xA11CE);

    function setUp() public {
        vault = new StashVault();
        vm.deal(ada, 100 ether);
    }

    /// FINDING 1 (FIXED) — this is why the key must be the goal's immutable
    /// record id and never its display name. Two different strings are two
    /// different slots; if the app passed a renameable name, editing it would
    /// leave real ETH in a slot the UI no longer looks at.
    function test_F1_differentKeyIsADifferentSlot() public {
        bytes32 oldId = vault.goalIdFor(ada, "laptop");
        bytes32 newId = vault.goalIdFor(ada, "Laptop");  // one capital letter

        vm.prank(ada);
        vault.deposit{value: 5 ether}(oldId);

        assertEq(vault.lockedOf(ada, oldId), 5 ether, "money is here...");
        assertEq(vault.lockedOf(ada, newId), 0, "...but the renamed goal sees nothing");

        // The app would now show a 0 balance for a goal holding 5 ETH.
        emit log_named_uint("stranded wei", vault.lockedOf(ada, oldId));
    }

    /// FINDING 2 — ETH force-fed via selfdestruct is unattributable and stuck.
    /// No receive/fallback blocks *normal* sends, but selfdestruct cannot be
    /// refused. Nobody's earmark is harmed; the surplus is simply unrecoverable.
    function test_F2_forceFedEthIsPermanentlyStuck() public {
        // id computed FIRST: goalIdFor is itself a call, so computing it inline
        // would consume the prank and the deposit would come from this test
        // contract instead of Ada.
        bytes32 id = vault.goalIdFor(ada, "laptop");
        vm.prank(ada);
        vault.deposit{value: 1 ether}(id);

        ForceFeeder f = new ForceFeeder{value: 3 ether}();
        f.detonate(payable(address(vault)));

        assertEq(address(vault).balance, 4 ether, "contract holds 4");
        assertEq(vault.lockedOf(ada, id), 1 ether, "only 1 is claimable");
        // 3 ETH is now unreachable by any function on this contract.
    }

    /// KILLED — abi.encodePacked collision.
    /// The classic ambiguity needs TWO adjacent dynamic types. Here the address
    /// is fixed-width and first, so the first 20 bytes are unambiguously the
    /// owner and everything after is the name. No collision is constructible.
    function test_killed_noEncodePackedCollision() public view {
        address bob = address(0xB0B);
        // Same combined byte-length, different split: must NOT collide.
        assertTrue(vault.goalIdFor(ada, "ab") != vault.goalIdFor(bob, "ab"));
        assertTrue(vault.goalIdFor(ada, "abc") != vault.goalIdFor(ada, "ab"));
        // Concatenation ambiguity would need the owner to be dynamic too.
        assertEq(vault.goalIdFor(ada, "laptop"), keccak256(abi.encodePacked(ada, "laptop")));
    }

    /// KILLED — cross-user access. goalId is namespaced under msg.sender, so a
    /// deliberately colliding id still cannot reach another person's funds.
    function test_killed_arbitraryGoalIdCannotReachAnotherUser() public {
        bytes32 adasId = vault.goalIdFor(ada, "laptop");
        vm.prank(ada);
        vault.deposit{value: 2 ether}(adasId);

        address mallory = address(0xBAD);
        vm.deal(mallory, 1 ether);
        vm.startPrank(mallory);
        vault.deposit{value: 1 ether}(adasId);           // same id, different owner
        vault.withdraw(adasId, 1 ether);                 // gets back only their own
        vm.expectRevert(abi.encodeWithSelector(StashVault.InsufficientLocked.selector, 1, 0));
        vault.withdraw(adasId, 1);
        vm.stopPrank();

        assertEq(vault.lockedOf(ada, adasId), 2 ether, "Ada untouched");
    }
}

contract ForceFeeder {
    constructor() payable {}
    function detonate(address payable to) external { selfdestruct(to); }
}

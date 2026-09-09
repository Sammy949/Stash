// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {StashVault} from "../src/StashVault.sol";

/// Re-enters withdraw() from its receive hook. If effects did not land before
/// the external call, this would drain the slot twice.
contract Reentrant {
    StashVault public vault;
    bytes32 public goalId;
    bool private attacking;

    constructor(StashVault v) { vault = v; }

    function lock(bytes32 id) external payable {
        goalId = id;
        vault.deposit{value: msg.value}(id);
    }

    function attack(uint256 amount) external {
        attacking = true;
        vault.withdraw(goalId, amount);
    }

    receive() external payable {
        if (attacking) {
            attacking = false;
            // Second bite. Must revert: the balance is already written down.
            try vault.withdraw(goalId, msg.value) {} catch {}
        }
    }
}

/// Refuses ETH, to prove a failed transfer reverts rather than silently
/// zeroing someone's earmark.
contract Rejector {
    StashVault public vault;
    constructor(StashVault v) { vault = v; }
    function lock(bytes32 id) external payable { vault.deposit{value: msg.value}(id); }
    function pull(bytes32 id, uint256 amt) external { vault.withdraw(id, amt); }
    receive() external payable { revert("nope"); }
}

contract StashVaultTest is Test {
    StashVault vault;
    address ada = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 laptop;
    bytes32 rent;

    function setUp() public {
        vault = new StashVault();
        laptop = vault.goalIdFor(ada, "laptop");
        rent = vault.goalIdFor(ada, "rent");
        vm.deal(ada, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_depositLocksAndAccumulates() public {
        vm.startPrank(ada);
        vault.deposit{value: 1 ether}(laptop);
        vault.deposit{value: 0.5 ether}(laptop);
        vm.stopPrank();
        assertEq(vault.lockedOf(ada, laptop), 1.5 ether);
        assertEq(address(vault).balance, 1.5 ether);
    }

    function test_withdrawReturnsFundsAndReducesLock() public {
        vm.startPrank(ada);
        vault.deposit{value: 2 ether}(laptop);
        uint256 before = ada.balance;
        vault.withdraw(laptop, 0.75 ether);
        vm.stopPrank();
        assertEq(ada.balance, before + 0.75 ether);
        assertEq(vault.lockedOf(ada, laptop), 1.25 ether);
    }

    /// The property that makes this non-custodial.
    function test_cannotTouchAnotherPersonsEarmark() public {
        vm.prank(ada);
        vault.deposit{value: 1 ether}(laptop);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(StashVault.InsufficientLocked.selector, 1 ether, 0));
        vault.withdraw(laptop, 1 ether);

        assertEq(vault.lockedOf(ada, laptop), 1 ether);
    }

    /// Goals must not bleed into each other.
    function test_goalsAreIsolated() public {
        vm.startPrank(ada);
        vault.deposit{value: 1 ether}(laptop);
        vm.expectRevert(abi.encodeWithSelector(StashVault.InsufficientLocked.selector, 1 ether, 0));
        vault.withdraw(rent, 1 ether);
        vm.stopPrank();
    }

    function test_rejectsZeroValueDepositAndWithdraw() public {
        vm.startPrank(ada);
        vm.expectRevert(StashVault.ZeroAmount.selector);
        vault.deposit{value: 0}(laptop);
        vm.expectRevert(StashVault.ZeroAmount.selector);
        vault.withdraw(laptop, 0);
        vm.stopPrank();
    }

    function test_cannotOverdraw() public {
        vm.startPrank(ada);
        vault.deposit{value: 1 ether}(laptop);
        vm.expectRevert(abi.encodeWithSelector(StashVault.InsufficientLocked.selector, 1 ether + 1, 1 ether));
        vault.withdraw(laptop, 1 ether + 1);
        vm.stopPrank();
    }

    function test_reentrancyCannotDrain() public {
        Reentrant att = new Reentrant(vault);
        bytes32 id = vault.goalIdFor(address(att), "greed");
        vm.deal(address(this), 5 ether);
        att.lock{value: 1 ether}(id);

        // Another user's funds sit in the same contract; they must survive.
        vm.prank(ada);
        vault.deposit{value: 3 ether}(laptop);

        att.attack(1 ether);

        assertEq(vault.lockedOf(address(att), id), 0, "attacker slot must be spent exactly once");
        assertEq(address(att).balance, 1 ether, "attacker got no more than it locked");
        assertEq(vault.lockedOf(ada, laptop), 3 ether, "victim untouched");
        assertEq(address(vault).balance, 3 ether);
    }

    function test_failedTransferRevertsRatherThanLosingTheEarmark() public {
        Rejector r = new Rejector(vault);
        bytes32 id = vault.goalIdFor(address(r), "stuck");
        vm.deal(address(this), 2 ether);
        r.lock{value: 1 ether}(id);

        vm.expectRevert(StashVault.TransferFailed.selector);
        r.pull(id, 1 ether);

        assertEq(vault.lockedOf(address(r), id), 1 ether, "earmark must survive a failed send");
    }

    function test_plainEthTransferIsRejected() public {
        vm.prank(ada);
        (bool ok, ) = address(vault).call{value: 1 ether}("");
        assertFalse(ok, "unattributable ETH must not be accepted");
    }

    function test_goalIdMatchesOffchainDerivation() public view {
        assertEq(laptop, keccak256(abi.encodePacked(ada, "laptop")));
        assertTrue(laptop != vault.goalIdFor(bob, "laptop"), "same name, different owner");
    }

    function testFuzz_lockThenFullWithdrawIsLossless(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(ada, amount);
        vm.startPrank(ada);
        vault.deposit{value: amount}(laptop);
        vault.withdraw(laptop, amount);
        vm.stopPrank();
        assertEq(ada.balance, amount);
        assertEq(vault.lockedOf(ada, laptop), 0);
    }
}

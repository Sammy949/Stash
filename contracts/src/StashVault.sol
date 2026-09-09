// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title StashVault — a non-custodial earmark for a savings goal.
/// @notice Locks ETH against a goal so it is deliberately harder to spend.
///
/// The design constraint is honesty. Stash's balance is a fiat ledger the user
/// tells Stash about; this contract is the one place where an earmark stops
/// being an accounting entry and becomes something the user genuinely cannot
/// casually raid. It holds real value on Base, and nothing else about Stash
/// claims to be onchain.
///
/// Deliberately NOT here:
/// - no owner, admin, pause or upgrade path. There is no key that can move
///   another person's funds, including the deployer's. A savings vault with an
///   admin escape hatch is not a savings vault.
/// - no lock period or penalty. Making withdrawal impossible would make this
///   custody, and a student who genuinely needs rent must be able to take their
///   own money back. The friction IS the product; a wall would be a liability.
/// - no token support. ETH only, because that is what the demo moves and every
///   extra path is more to get wrong.
///
/// `goalId` is computed off-chain as keccak256(abi.encodePacked(owner, key)),
/// where `key` is the goal's IMMUTABLE record id — never its display name.
/// That distinction is load-bearing: deriving from the name meant renaming a
/// goal in Stash pointed the app at a different slot, so a vault holding real
/// ETH read as empty and the only route back was retyping the original string
/// exactly. The record id survives renames, so the slot does too.
///
/// The chain still learns only that an address locked funds against an opaque
/// 32-byte id, and nothing about what the person is saving for.
contract StashVault {
    /// @dev owner => goalId => wei locked.
    mapping(address => mapping(bytes32 => uint256)) private _locked;

    event Deposited(address indexed owner, bytes32 indexed goalId, uint256 amount, uint256 total);
    event Withdrawn(address indexed owner, bytes32 indexed goalId, uint256 amount, uint256 remaining);

    error ZeroAmount();
    error InsufficientLocked(uint256 requested, uint256 available);
    error TransferFailed();

    /// @notice Lock ETH against `goalId` for the caller.
    function deposit(bytes32 goalId) external payable {
        if (msg.value == 0) revert ZeroAmount();
        uint256 total = _locked[msg.sender][goalId] + msg.value;
        _locked[msg.sender][goalId] = total;
        emit Deposited(msg.sender, goalId, msg.value, total);
    }

    /// @notice Withdraw part or all of the caller's own earmark.
    /// @dev Checks-effects-interactions: the balance is written down BEFORE the
    ///      call out, so a reentrant callee re-enters against the reduced
    ///      figure and cannot drain the slot.
    function withdraw(bytes32 goalId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 available = _locked[msg.sender][goalId];
        if (amount > available) revert InsufficientLocked(amount, available);

        uint256 remaining = available - amount;
        _locked[msg.sender][goalId] = remaining;

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, goalId, amount, remaining);
    }

    /// @notice Wei locked by `owner` against `goalId`.
    function lockedOf(address owner, bytes32 goalId) external view returns (uint256) {
        return _locked[owner][goalId];
    }

    /// @notice The id Stash derives for a goal. Provided so the client and the
    ///         chain can never disagree about how an id is built.
    /// @param key The goal's IMMUTABLE record id, NOT its display name. Passing
    ///        a renameable string here is how an earmark gets stranded.
    function goalIdFor(address owner, string calldata key) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, key));
    }

    /// @dev No receive/fallback on purpose. ETH sent without naming a goal
    ///      would be unattributable and therefore unwithdrawable — better to
    ///      reject it than to silently swallow someone's money.
}

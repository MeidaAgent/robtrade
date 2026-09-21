// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPrivacyVerifier} from "./interfaces/IPrivacyVerifier.sol";

/// @title PrivacyPool
/// @notice Native-asset commitment pool designed to be paired with an audited ZK verifier.
/// @dev This repository intentionally separates the proof verifier from the pool. The root
///      manager is an interim scaffold: production should replace it with a trustless,
///      independently-audited commitment-tree/root update mechanism.
contract PrivacyPool {
    error NotOwner();
    error NotRootManager();
    error ZeroAddress();
    error InvalidAmount();
    error CommitmentExists();
    error UnknownRoot();
    error NullifierAlreadyUsed();
    error InvalidProof();
    error InsufficientPoolBalance();
    error TransferFailed();
    error InvalidVerifier();

    address public owner;
    address public rootManager;
    IPrivacyVerifier public verifier;
    bool public depositsEnabled = true;
    bool public withdrawalsEnabled;

    bytes32 public currentRoot;
    uint256 public totalShielded;

    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public knownRoots;
    mapping(bytes32 => bool) public nullifierUsed;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RootManagerUpdated(address indexed previousManager, address indexed newManager);
    event VerifierUpdated(address indexed previousVerifier, address indexed newVerifier);
    event WithdrawalStateUpdated(bool enabled);
    event DepositsStateUpdated(bool enabled);
    event RootUpdated(bytes32 indexed previousRoot, bytes32 indexed newRoot);
    event Shield(bytes32 indexed commitment, uint256 amount);
    event Unshield(bytes32 indexed nullifier, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRootManager() {
        if (msg.sender != rootManager) revert NotRootManager();
        _;
    }

    constructor(address initialRootManager) {
        if (initialRootManager == address(0)) revert ZeroAddress();
        owner = msg.sender;
        rootManager = initialRootManager;
        emit OwnershipTransferred(address(0), msg.sender);
        emit RootManagerUpdated(address(0), initialRootManager);
    }

    receive() external payable {
        revert();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setRootManager(address newManager) external onlyOwner {
        if (newManager == address(0)) revert ZeroAddress();
        emit RootManagerUpdated(rootManager, newManager);
        rootManager = newManager;
    }

    function setVerifier(address newVerifier) external onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();
        address previous = address(verifier);
        verifier = IPrivacyVerifier(newVerifier);
        emit VerifierUpdated(previous, newVerifier);
    }

    function setWithdrawalsEnabled(bool enabled) external onlyOwner {
        if (enabled && address(verifier) == address(0)) revert InvalidVerifier();
        withdrawalsEnabled = enabled;
        emit WithdrawalStateUpdated(enabled);
    }

    function setDepositsEnabled(bool enabled) external onlyOwner {
        depositsEnabled = enabled;
        emit DepositsStateUpdated(enabled);
    }

    /// @dev Interim off-chain tree bridge. The caller must be the configured root manager.
    ///      Do not use a discretionary root manager as the final trust model for mainnet funds.
    function registerRoot(bytes32 newRoot) external onlyRootManager {
        if (newRoot == bytes32(0)) revert UnknownRoot();
        knownRoots[newRoot] = true;
        bytes32 previous = currentRoot;
        currentRoot = newRoot;
        emit RootUpdated(previous, newRoot);
    }

    function shield(bytes32 commitment) external payable {
        if (!depositsEnabled) revert InvalidAmount();
        if (commitment == bytes32(0)) revert InvalidAmount();
        if (msg.value == 0) revert InvalidAmount();
        if (commitments[commitment]) revert CommitmentExists();

        commitments[commitment] = true;
        totalShielded += msg.value;
        emit Shield(commitment, msg.value);
    }

    /// @notice Withdraw a note proven by the external ZK verifier.
    /// @param publicInputs [root, nullifier, recipient, amount].
    function unshield(
        bytes calldata proof,
        bytes32 root,
        bytes32 nullifier,
        address recipient,
        uint256 amount
    ) external {
        if (!withdrawalsEnabled) revert InvalidVerifier();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (!knownRoots[root]) revert UnknownRoot();
        if (nullifierUsed[nullifier]) revert NullifierAlreadyUsed();
        if (address(verifier) == address(0)) revert InvalidVerifier();
        if (address(this).balance < amount) revert InsufficientPoolBalance();

        uint256[] memory publicInputs = new uint256[](4);
        publicInputs[0] = uint256(root);
        publicInputs[1] = uint256(nullifier);
        publicInputs[2] = uint256(uint160(recipient));
        publicInputs[3] = amount;

        if (!verifier.verifyProof(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[nullifier] = true;
        totalShielded -= amount;
        (bool ok, ) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Unshield(nullifier, recipient, amount);
    }

    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifierUsed[nullifier];
    }

    function isKnownRoot(bytes32 root) external view returns (bool) {
        return knownRoots[root];
    }
}

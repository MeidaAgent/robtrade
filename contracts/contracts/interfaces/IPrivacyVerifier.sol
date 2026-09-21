// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPrivacyVerifier {
    /// @dev publicInputs must be ordered exactly as [root, nullifier, recipient, amount].
    function verifyProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool);
}

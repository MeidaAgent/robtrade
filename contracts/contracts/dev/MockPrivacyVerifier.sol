// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPrivacyVerifier} from "../interfaces/IPrivacyVerifier.sol";

/// @dev DEV/LOCAL ONLY. Never deploy this verifier for real funds.
///      It treats proof bytes as keccak256(proof)==publicInputs[1], allowing deterministic
///      contract-flow testing without pretending to implement ZK verification.
contract MockPrivacyVerifier is IPrivacyVerifier {
    function verifyProof(bytes calldata proof, uint256[] calldata publicInputs) external pure returns (bool) {
        return publicInputs.length == 4 && uint256(keccak256(proof)) == publicInputs[1];
    }
}

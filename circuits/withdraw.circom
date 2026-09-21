/*
  Privacy note / withdrawal circuit specification.

  Target proving system: Groth16/Plonk-compatible Circom stack with circomlib Poseidon.
  The exact generated verifier must be produced from this circuit and pinned build inputs.

  Private inputs:
    secret
    pathElements[DEPTH]
    pathIndices[DEPTH]

  Public inputs:
    root
    nullifier
    recipient
    amount

  Commitment = Poseidon(secret, amount)
  Nullifier  = Poseidon(secret, recipient, DOMAIN)

  The circuit proves knowledge of a secret whose commitment is a member of the supplied
  Merkle path while binding the withdrawal amount and recipient to the nullifier.

  NOTE: This source is intentionally not shipped with generated proving/verifier keys.
  Generate those artifacts with a pinned toolchain, retain toxic-waste handling procedures,
  and independently audit the final circuit before enabling mainnet withdrawals.
*/

pragma circom 2.1.6;
include "circomlib/circuits/poseidon.circom";

template Withdraw(DEPTH) {
    signal input secret;
    signal input amount;
    signal input recipient;
    signal input pathElements[DEPTH];
    signal input pathIndices[DEPTH];

    signal input root;
    signal input nullifier;

    signal commitment;
    signal current[DEPTH + 1];

    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== secret;
    commitmentHash.inputs[1] <== amount;
    commitment <== commitmentHash.out;
    current[0] <== commitment;

    for (var i = 0; i < DEPTH; i++) {
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        component node = Poseidon(2);
        node.inputs[0] <== current[i] + pathIndices[i] * (pathElements[i] - current[i]);
        node.inputs[1] <== pathElements[i] + pathIndices[i] * (current[i] - pathElements[i]);
        current[i + 1] <== node.out;
    }

    current[DEPTH] === root;

    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== secret;
    nullifierHash.inputs[1] <== recipient;
    nullifierHash.inputs[2] <== 4663; // Robinhood Chain target domain separator.
    nullifierHash.out === nullifier;
}

component main {public [root, nullifier, recipient, amount]} = Withdraw(20);

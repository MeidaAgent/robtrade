# ZK circuit layer

The protocol uses a 20-level Poseidon Merkle tree and binds withdrawals to:

- the registered Merkle `root`,
- a one-time `nullifier`,
- the destination `recipient`,
- the withdrawn `amount`.

The browser/backend must never send `secret` to the API. The client generates and retains the note; only a proof and public inputs are sent to the chain.

## What still must be generated

Circom source alone is not a deployable verifier. A pinned build must generate:

- R1CS/WASM witness artifacts,
- proving key / proving artifacts appropriate for the selected proving system,
- verification key,
- Solidity verifier implementing `IPrivacyVerifier`.

The final circuit and generated verifier must be independently reviewed before real-money use. The included contract intentionally keeps this as a hard boundary rather than embedding an unaudited cryptographic implementation.

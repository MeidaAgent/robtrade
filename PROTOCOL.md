# Protocol implementation plan

## Target

The supplied application configuration targets Robinhood Chain with chain id `4663`.

## Native vault flow

1. Browser generates a private note.
2. Browser derives a commitment from the note.
3. Browser sends `shield(commitment)` with the native amount.
4. `PrivacyPool` records the commitment and emits `Shield(commitment, amount)` without an indexed depositor field.
5. Browser optionally uploads only an encrypted note blob to the API. The API never receives the plaintext secret.
6. The indexer records the chain event and associates it with the user's encrypted-note metadata when available.

## Withdrawal flow

1. Browser reconstructs a Merkle witness from its private note and the commitment tree.
2. A ZK circuit proves knowledge of the note, membership in the registered root, and binding to the recipient/amount/nullifier.
3. Browser submits the proof and public inputs to `PrivacyPool.unshield`.
4. The verifier contract checks the proof.
5. The pool checks root validity and nullifier freshness before paying the recipient.

## Current hard boundary

The repository contains the pool interface and circuit source, but not the generated ZK proving/verifier artifacts or an independently audited trustless root-management implementation. Until those artifacts exist, `PRIVACY_MODE` must remain `scaffold` and withdrawals must remain disabled.

## Private swaps

Public aggregator execution and privacy-preserving execution are separate products. The existing 0x route is a public wallet swap adapter with server-side transaction reconciliation. A private swap requires a shielded executor/relayer plus an audited accounting model that preserves note privacy through the execution leg.

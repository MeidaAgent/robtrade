# Privacy protocol layer — Robinhood Chain target

This folder is the protocol foundation for the project. The application is configured for the Robinhood Chain target (`CHAIN_ID=4663` in the supplied project configuration).

## Contracts

- `PrivacyPool.sol` — native-asset commitment pool, nullifier registry, ZK-verifier adapter and root registry.
- `interfaces/IPrivacyVerifier.sol` — stable boundary for the generated/audited ZK verifier.
- `dev/MockPrivacyVerifier.sol` — **local/dev only** verifier for exercising the transaction flow. It is intentionally not a privacy system and must never be used for real funds.

## Important production boundary

The pool contract deliberately does not invent a cryptographic verifier. A production deployment needs:

1. an audited ZK circuit and proving system,
2. a generated verifier contract implementing `IPrivacyVerifier`,
3. a trustless/audited commitment tree and root-update mechanism,
4. a tested client/relayer flow that prevents transaction-level linkage where the protocol claims unlinkability.

The interim `rootManager` exists so the complete application can be developed and tested without hiding this trust boundary.

## Build/deploy

The repository includes Solidity source only so it is easy to move into the project's preferred toolchain. Before deployment, compile and run an independent contract test suite with a pinned Solidity compiler. Do not treat source presence as an audit or deployment approval.

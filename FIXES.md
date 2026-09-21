# Fixed build

## Application/security fixes

- SIWE domain, URI, chain, issued-at and expiry validation.
- Atomic one-time nonce consumption.
- JWT issuer/audience/algorithm restrictions.
- Per-route auth/vault/swap rate limits and request timeouts.
- Server-issued single-use swap quotes with expiry.
- Swap transaction reconciliation against logged-in wallet, chain, target, calldata and native value.
- Settlement receipt reconciliation and BigInt-safe JSON serialization.
- Vault history BigInt-safe serialization.
- Durable shielded-pool indexer with event-level identity, block checkpointing, confirmations and reorg rewind.
- Vault note attachment only after receipt and `Shield(commitment)` verification.
- Client-side encrypted note storage payload using PBKDF2 + AES-GCM; plaintext secrets are not sent to the API.
- Added migration, Docker database, CI and regression tests.
- Added a real contract foundation and an explicit ZK circuit layer instead of leaving only a placeholder ABI.

## Frontend fixes

- Repaired static routes and internal navigation.
- Removed PyWebCopy URL rewrites from frontend artifacts.
- Added functional wallet/SIWE/app shell.
- Added native vault note creation + shield flow.
- Added encrypted-note attachment and history screens.
- Trade flow remains explicitly public-wallet execution until a private executor/relayer exists.

## Deliberate cryptographic boundary

The contract/circuit source is a protocol foundation, not a security audit. The repository does not claim a production ZK verifier or trustless root-management design exists merely because source files are present. `PRIVACY_MODE=scaffold` is therefore the safe default.

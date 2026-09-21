# Backend — Robinhood Chain privacy app foundation

Backend non-custodial untuk wallet auth, native-asset vault transactions, encrypted note metadata, swap quote/order reconciliation, settlement tracking, dan event indexing. Target chain di konfigurasi project adalah Robinhood Chain (`CHAIN_ID=4663`).

## Current implementation

- SIWE auth dengan domain/URI/chain binding dan one-time nonce atomic.
- JWT verification dengan issuer/audience/algorithm restrictions.
- Native-asset `PrivacyPool` contract source + verifier interface tersedia di `../contracts`.
- Browser membuat note secret secara lokal dan mengenkripsi note dengan PBKDF2 + AES-256-GCM sebelum opsional disimpan sebagai ciphertext di API.
- `/vault/notes/attach` memverifikasi receipt + `Shield(commitment)` sebelum menyimpan metadata.
- Vault history BigInt-safe.
- Indexer durable dengan backfill, checkpoint, finality confirmations, event-level identity, dan reorg rewind.
- Swap quote disimpan server-side, single-use, dan submit diverifikasi terhadap `from`, `chainId`, `to`, `data`, dan `value`.
- Settlement direkonsiliasi terhadap receipt.

## Privacy protocol boundary

Contract dan circuit source adalah **foundation**, bukan audit approval. Production withdrawal membutuhkan generated/audited ZK verifier yang mengimplementasikan `IPrivacyVerifier`, commitment-tree/root mechanism yang trustless atau diaudit, proving artifacts yang dipin, dan private execution/relayer bila produk menjanjikan unlinkability terhadap transaksi wallet.

`PRIVACY_MODE=scaffold` adalah default. Set `PRIVACY_MODE=production` hanya setelah verifier + deployment yang sudah diuji tersedia. Backend reports `privacyReady=true` hanya jika mode production dan pool/verifier address terkonfigurasi.

## Local setup

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm run typecheck
npm test
npm run dev
```

Production: generate client, run `prisma deploy`, build TypeScript, lalu start server.

## Contract layer

```text
../contracts/contracts/PrivacyPool.sol
../contracts/contracts/interfaces/IPrivacyVerifier.sol
../contracts/contracts/dev/MockPrivacyVerifier.sol   # LOCAL ONLY
```

`contracts/scripts/deploy.mjs` can deploy the pool after `npm install` + `npm run compile`. The mock verifier is deliberately labelled development-only and must never secure real funds.

## ZK layer

```text
../circuits/withdraw.circom
```

The circuit binds a 20-level Poseidon Merkle path to `root`, `nullifier`, `recipient`, and `amount`. Generated proving/verifier artifacts are intentionally not bundled; they must be produced with a pinned toolchain and independently reviewed before a real-money deployment.

## Swap status

The current `/swap` route is a **public-wallet execution adapter**. It is safe against the previous client-spoofing problem, but it is not a privacy-preserving swap. Do not market it as a private trade until a shielded execution path exists.

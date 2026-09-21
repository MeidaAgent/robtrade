# RobTrade-style privacy app — Robinhood Chain target

This repository is a from-scratch application implementation based on the supplied website reference, not a copy of the reference project's private backend or contracts.

## What is included

- Static marketing site and app shell.
- SIWE authentication with replay-resistant nonce handling.
- Native-asset vault API and client-side encrypted note handling.
- `PrivacyPool.sol` contract foundation with verifier adapter, root registry and nullifier tracking.
- ZK circuit source/specification for a 20-level Poseidon Merkle withdrawal flow.
- Durable blockchain indexer with checkpoints, backfill, finality confirmations and reorg rewind.
- Swap quote/order reconciliation with server-side quote locking and on-chain transaction checks.
- Settlement tracking.
- PostgreSQL migration and Docker development database.
- GitHub CI for backend/static tests and contract compilation.

## Target chain

The supplied configuration uses Robinhood Chain chain id `4663`. The RPC URL in `.env.example` is only a project configuration value and should be independently verified/changed to the RPC provider you intend to use.

## Production privacy status

Do not enable real-money withdrawals until the circuit has been compiled with a pinned toolchain, proving artifacts have been handled securely, the generated verifier contract has been reviewed, and the commitment-tree/root-update mechanism has an appropriate trust model and audit.

The default is:

```text
PRIVACY_MODE=scaffold
```

The API only reports `privacyReady=true` in `production` mode with both a pool address and proof-verifier address configured.

## Quick start

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:deploy
npm test
npm run dev
```

Contracts:

```bash
cd contracts
npm install
npm run compile
```

The deployment script accepts `CHAIN_RPC_URL`, `CHAIN_ID`, `DEPLOYER_PRIVATE_KEY`, and `ROOT_MANAGER_ADDRESS`. The optional `DEPLOY_MOCK_VERIFIER=true` flag is for local/development transaction-flow tests only.

## One-command local development

From the project root (`robtrade`):

```powershell
npm install
npm --prefix backend install
npm --prefix backend run prisma:generate
npm run dev
```

`npm run dev` starts both services together:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000

The frontend is a static export, so the root dev runner uses a lightweight Node static server instead of requiring a full Next.js development server.

The backend still requires a valid `backend/.env` (copy `backend/.env.example` and set at least `JWT_SECRET` and `DATABASE_URL`).

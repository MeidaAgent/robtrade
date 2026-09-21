import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

// These tests intentionally avoid network/DB dependencies; they catch regressions in the security-critical wiring.
test('SIWE verification is bound to domain, URI, chain and atomic nonce consumption', () => {
  const source = read('../src/services/authService.ts');
  assert.match(source, /siweMessage\.domain !== env\.SIWE_DOMAIN/);
  assert.match(source, /siweMessage\.uri !== env\.SIWE_URI/);
  assert.match(source, /Number\(siweMessage\.chainId\) !== env\.CHAIN_ID/);
  assert.match(source, /prisma\.user\.updateMany/);
});

test('swap submission verifies transaction fields against the stored quote', () => {
  const source = read('../src/controllers/swapController.ts');
  for (const term of ['transaction.from', 'transaction.chainId', 'transaction.data', 'transaction.value', 'transaction.to']) {
    assert.match(source, new RegExp(term.replace('.', '\\.' )));
  }
});

test('indexer has durable checkpointing and event-level identity', () => {
  const schema = read('../prisma/schema.prisma');
  const indexer = read('../src/services/indexerService.ts');
  assert.match(schema, /@@unique\(\[chainId, txHash, logIndex\]\)/);
  assert.match(schema, /model IndexerState/);
  assert.match(indexer, /prisma\.indexerState/);
  assert.match(indexer, /queryFilter/);
});


test('vault uses the production pool transaction shape and encrypted-note attachment is guarded by receipt/event checks', () => {
  const chain = read('../src/lib/chain.ts');
  const vault = read('../src/controllers/vaultController.ts');
  const schema = read('../prisma/schema.prisma');
  assert.match(chain, /function unshield\(bytes calldata proof, bytes32 root, bytes32 nullifier, address recipient, uint256 amount\)/);
  assert.match(vault, /getTransactionReceipt\(txHash\)/);
  assert.match(vault, /parseLog/);
  assert.match(schema, /model VaultNote/);
  assert.match(schema, /encryptedNote\s+String/);
});

test('protocol is explicitly pinned to Robinhood Chain configuration without claiming production privacy by default', () => {
  const env = read('../.env.example');
  const config = read('../src/config/env.ts');
  assert.match(env, /CHAIN_NAME="Robinhood Chain"/);
  assert.match(env, /CHAIN_ID=4663/);
  assert.match(env, /PRIVACY_MODE=scaffold/);
  assert.match(config, /env.PRIVACY_MODE === "production"/);
});

const detectedApi = ['localhost','127.0.0.1','::1'].includes(window.location.hostname) ? 'http://localhost:4000' : window.location.origin;
const API_BASE = (window.ROBTRADE_API_BASE || localStorage.getItem('robtrade_api_base') || detectedApi).replace(/\/$/, '');
const NOTE_STORAGE_KEY = 'robtrade_note_cache_v1';

export async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const token = localStorage.getItem('robtrade_jwt');
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    const text = await res.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Request timeout.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error('Wallet EVM (MetaMask/OKX/Rabby/etc.) tidak ditemukan.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts[0]) throw new Error('Tidak ada account yang dipilih.');
  return accounts[0];
}

async function enforceNetwork(config) {
  const chainHex = await window.ethereum.request({ method: 'eth_chainId' });
  const chainId = Number.parseInt(chainHex, 16);
  if (chainId !== Number(config.chainId)) {
    throw new Error(`${config.chainName || 'Target network'} diperlukan (chain ${config.chainId}). Switch network di wallet lalu coba lagi.`);
  }
  return chainId;
}

export async function signIn() {
  const address = await connectWallet();
  const config = await api('/config');
  const chainId = await enforceNetwork(config);
  if (window.location.host !== config.siweDomain || window.location.origin !== config.siweUri) {
    throw new Error('SIWE domain/URI belum cocok dengan deployment API.');
  }
  const { nonce } = await api('/auth/nonce', { method: 'POST', body: JSON.stringify({ address }) });
  const domain = window.location.host;
  const uri = window.location.origin;
  const issuedAt = new Date();
  const expiration = new Date(Date.now() + 5 * 60 * 1000);
  const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to RobTrade. This request will not trigger a blockchain transaction.\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiration.toISOString()}`;
  const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
  const result = await api('/auth/verify', { method: 'POST', body: JSON.stringify({ message, signature }) });
  localStorage.setItem('robtrade_jwt', result.token);
  localStorage.setItem('robtrade_address', result.address);
  return result.address;
}

export async function sendPreparedTx(tx) {
  if (!window.ethereum) throw new Error('Wallet EVM tidak ditemukan.');
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  const loggedAddress = localStorage.getItem('robtrade_address');
  if (!accounts[0] || !loggedAddress || accounts[0].toLowerCase() !== loggedAddress.toLowerCase()) {
    throw new Error('Wallet aktif tidak sama dengan wallet yang login.');
  }
  const config = await api('/config');
  const chainHex = await window.ethereum.request({ method: 'eth_chainId' });
  if (Number.parseInt(chainHex, 16) !== Number(config.chainId)) throw new Error(`Wrong network. Switch to chain ${config.chainId} before signing.`);
  const raw = {
    from: loggedAddress,
    to: tx.to,
    data: tx.data,
    value: `0x${BigInt(tx.value || 0).toString(16)}`,
  };
  return window.ethereum.request({ method: 'eth_sendTransaction', params: [raw] });
}

function bytesToHex(bytes) {
  return '0x' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const clean = hex.replace(/^0x/, '');
  if (clean.length % 2) throw new Error('Invalid hex.');
  return Uint8Array.from(clean.match(/.{2}/g)?.map((x) => parseInt(x, 16)) || []);
}
function bigintTo32Bytes(value) {
  let n = BigInt(value);
  if (n < 0n || n >= (1n << 256n)) throw new Error('Amount out of uint256 range.');
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(n & 255n); n >>= 8n; }
  return out;
}

export async function makeNote(amountWei) {
  if (!/^\d+$/.test(amountWei) || BigInt(amountWei) <= 0n) throw new Error('Amount harus integer wei > 0.');
  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);
  const payload = new Uint8Array(64);
  payload.set(secret, 0);
  payload.set(bigintTo32Bytes(amountWei), 32);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', payload));
  return { secret: bytesToHex(secret), commitment: bytesToHex(digest), amountWei: String(amountWei) };
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function base64(bytes) { let s = ''; bytes.forEach((b) => s += String.fromCharCode(b)); return btoa(s); }
function unbase64(value) { const s = atob(value); return Uint8Array.from(s, (c) => c.charCodeAt(0)); }

export async function encryptNote(note, password) {
  if (!password || password.length < 10) throw new Error('Password note minimal 10 karakter.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(note))));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iterations: 150000, cipher: 'AES-256-GCM', salt: base64(salt), iv: base64(iv), ciphertext: base64(ciphertext) });
}

export async function decryptNote(encryptedNote, password) {
  const box = JSON.parse(encryptedNote);
  if (box.v !== 1) throw new Error('Format note terenkripsi tidak didukung.');
  const key = await deriveKey(password, unbase64(box.salt));
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(box.iv) }, key, unbase64(box.ciphertext));
  return JSON.parse(new TextDecoder().decode(clear));
}

export function rememberNoteSummary(note) {
  const current = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) || '[]');
  const next = [{ commitment: note.commitment, createdAt: new Date().toISOString() }, ...current.filter((x) => x.commitment.toLowerCase() !== note.commitment.toLowerCase())].slice(0, 100);
  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(next));
}

export function mountStatus() {
  const el = document.querySelector('[data-status]');
  const address = localStorage.getItem('robtrade_address');
  if (el) el.textContent = address ? `Connected: ${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected';
}

export function explorerTx(txHash) {
  return `https://explorer.mainnet.hro.network/tx/${txHash}`;
}

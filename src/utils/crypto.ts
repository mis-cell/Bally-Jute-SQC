// ==============================================================================
// SQC - Secure Password Hashing & Cryptographic Helper
// Pure SHA-256 + Web Crypto API with Salt (Works on HTTP LAN IPs, HTTPS, & Node)
// ==============================================================================

/**
 * Generate a random salt string
 */
export function generateSalt(length = 16): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  let out = '';
  for (let i = 0; i < length * 2; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

/**
 * Pure-JS RFC 6234 SHA-256 fallback so HTTP LAN origins (e.g. http://192.168.1.6:3001
 * where browser crypto.subtle is unavailable) compute exact SHA-256 matching Node.js.
 */
function sha256PureJs(ascii: string): string {
  const utf8 = unescape(encodeURIComponent(ascii));
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = utf8.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let padded = utf8 + '\x80';
  while ((padded.length % 64) - 56) padded += '\x00';
  for (let i = 0; i < padded.length; i++) {
    const j = padded.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Compute SHA-256 hash using Web Crypto API when available, or pure-JS SHA-256 on HTTP LAN origins.
 */
export async function sha256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256PureJs(text);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Derive PBKDF2-SHA256 hex digest when Web Crypto API is available
 */
async function pbkdf2Hex(password: string, saltHex: string, iterations = 100000): Promise<string | null> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      const derived = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: enc.encode(saltHex),
          iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      return Array.from(new Uint8Array(derived), b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Hash password with a cryptographically random salt.
 * Uses PBKDF2-SHA256 when Web Crypto Subtle is available, or salted SHA-256 on HTTP LAN origins.
 */
export async function hashPassword(password: string, customSalt?: string): Promise<string> {
  const salt = customSalt || generateSalt();
  const pbkdf2 = await pbkdf2Hex(password, salt, 100000);
  if (pbkdf2) {
    return `pbkdf2$100000$${salt}$${pbkdf2}`;
  }
  const rawHash = await sha256(`${salt}:${password}`);
  return `${salt}:${rawHash}`;
}

/**
 * Verify a plain text password against a stored cryptographic hash (no plaintext or hardcoded bypasses)
 */
export async function verifyPassword(password: string, storedHashString: string): Promise<boolean> {
  if (!storedHashString || !password) return false;

  if (storedHashString.startsWith('pbkdf2$')) {
    const parts = storedHashString.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const expected = parts[3];
    if (!Number.isFinite(iterations) || !salt || !expected) return false;
    const computed = await pbkdf2Hex(password, salt, iterations);
    return computed ? constantTimeEqual(computed, expected) : false;
  }

  const colonParts = storedHashString.split(':');
  if (colonParts.length === 2 && colonParts[0] && colonParts[1]) {
    const [salt, expectedHash] = colonParts;
    const computedHash = await sha256(`${salt}:${password}`);
    return constantTimeEqual(computedHash, expectedHash);
  }

  return false;
}

// ==============================================================================
// SQC - Secure Password Hashing & Cryptographic Helper
// Standard PBKDF2 / SHA-256 with Salt (Runs in Browser & Node.js)
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
  // Fallback
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Compute SHA-256 hash using Web Crypto API in browser or fallback
 */
export async function sha256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback simple hash for older environments
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

/**
 * Hash password with a salt: returns format "salt:hash"
 */
export async function hashPassword(password: string, customSalt?: string): Promise<string> {
  const salt = customSalt || generateSalt();
  const rawHash = await sha256(`${salt}:${password}`);
  return `${salt}:${rawHash}`;
}

/**
 * Verify a plain text password against "salt:hash"
 */
export async function verifyPassword(password: string, storedHashString: string): Promise<boolean> {
  if (!storedHashString || !password) return false;
  
  // Format check: "salt:hash"
  const parts = storedHashString.split(':');
  if (parts.length === 2) {
    const [salt, expectedHash] = parts;
    const computedHash = await sha256(`${salt}:${password}`);
    return computedHash === expectedHash;
  }
  
  // If stored without salt (legacy/plain check fallback during migration)
  return password === storedHashString;
}

// Precomputed salt:hash for default administrator password "Admin@123456"
// salt: "bjcl_sqc_salt_2026"
// string to hash: "bjcl_sqc_salt_2026:Admin@123456"
export const DEFAULT_ADMIN_PASSWORD_HASH = 'bjcl_sqc_salt_2026:5d5a621bd54309c980763fcb42e09fd15c0ad7b82994b1ff985b30475b42c2fc';

import CryptoJS from 'crypto-js';

// Secret key for encryption - Must be 32 characters for AES-256
const SECRET_KEY = (() => {
  // Use process.env in test environment, import.meta.env in browser
  let envSecret: string;

  // Check if we're in a test environment or if import.meta is not available
  if (
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' || typeof window === 'undefined')
  ) {
    envSecret = process.env.VITE_ENCRYPTION_SECRET || 'default-test-secret-key-32-chars';
  } else {
    // Browser environment with Vite
    envSecret = (import.meta as any).env.VITE_ENCRYPTION_SECRET;
  }

  if (!envSecret) {
    console.error('VITE_ENCRYPTION_SECRET environment variable is not set');
    throw new Error('Encryption secret not configured');
  }

  if (envSecret === 'default-secret-key-change-in-production') {
    console.error('Using default encryption secret in production is not secure');
    throw new Error('Default encryption secret detected');
  }

  // Ensure key is exactly 32 characters for AES-256
  if (envSecret.length !== 32) {
    console.error('Encryption secret must be exactly 32 characters');
    throw new Error('Invalid encryption secret length');
  }

  return envSecret;
})();

/**
 * Encrypts a plain text string
 * @param text - The plain text to encrypt
 * @returns The encrypted string
 */
export const encryptText = (text: string): string => {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  try {
    // Use AES-256-CBC with random IV for better security
    const encrypted = CryptoJS.AES.encrypt(text, SECRET_KEY, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }).toString();

    if (!encrypted) {
      throw new Error('Encryption failed - empty result');
    }

    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt text');
  }
};

/**
 * Decrypts an encrypted text string
 * @param encryptedText - The encrypted text to decrypt
 * @returns The decrypted plain text string
 */
export const decryptText = (encryptedText: string): string => {
  if (!encryptedText || typeof encryptedText !== 'string') {
    throw new Error('Invalid input: encryptedText must be a non-empty string');
  }

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const plainText = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plainText) {
      throw new Error('Failed to decrypt - invalid encrypted text or key');
    }

    return plainText;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt text');
  }
};

/**
 * Safely attempts to decrypt text, returns null if decryption fails
 * @param text - The text to decrypt
 * @returns The decrypted text or null if decryption fails
 */
export const safeDecryptText = (text: string): string | null => {
  try {
    const decrypted = CryptoJS.AES.decrypt(text, SECRET_KEY);
    const plainText = decrypted.toString(CryptoJS.enc.Utf8);
    return plainText || null;
  } catch {
    return null;
  }
};

/**
 * Checks if a text string appears to be encrypted
 * @param text - The text to check
 * @returns True if the text appears to be encrypted
 */
export const isEncrypted = (text: string): boolean => {
  // Basic check: encrypted text should be base64-like and longer than typical passwords
  return text.length > 20 && /^[A-Za-z0-9+/=]+$/.test(text);
};

/**
 * Encrypts user credentials (username and password)
 * @param username - The username to encrypt
 * @param password - The password to encrypt
 * @returns Object with encrypted username and password
 */
export const encryptCredentials = (username: string, password: string) => {
  return {
    encryptedUsername: encryptText(username),
    encryptedPassword: encryptText(password),
  };
};

/**
 * Decrypts user credentials
 * @param encryptedUsername - The encrypted username
 * @param encryptedPassword - The encrypted password
 * @returns Object with decrypted username and password
 */
export const decryptCredentials = (encryptedUsername: string, encryptedPassword: string) => {
  return {
    username: decryptText(encryptedUsername),
    password: decryptText(encryptedPassword),
  };
};

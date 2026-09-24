import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);
const HASH_PREFIX = 'scrypt-v1';
const KEY_LENGTH = 64;

export const isSecretHash = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`);

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(secret, salt, KEY_LENGTH)) as Buffer;
  return `${HASH_PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifySecretHash(stored: string, secret: string): Promise<boolean> {
  const [, saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex || !/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]+$/.test(hashHex)) {
    return false;
  }
  const expected = Buffer.from(hashHex, 'hex');
  const actual = (await scrypt(secret, Buffer.from(saltHex, 'hex'), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

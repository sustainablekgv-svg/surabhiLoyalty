const CryptoJS = require('crypto-js');

const SECRET_KEY = "a1b2c3d4e5f67890a1b2c3d4e5f67890";
const text = "test-password-123";

// Client-side encryption logic (using passphrase)
const encrypted = CryptoJS.AES.encrypt(text, SECRET_KEY, {
  mode: CryptoJS.mode.CBC,
  padding: CryptoJS.pad.Pkcs7,
}).toString();

console.log("Encrypted (Client Style):", encrypted);

// Server-side decryption logic
const decrypted = CryptoJS.AES.decrypt(encrypted, SECRET_KEY, {
  mode: CryptoJS.mode.CBC,
  padding: CryptoJS.pad.Pkcs7,
});
const plainText = decrypted.toString(CryptoJS.enc.Utf8);

console.log("Decrypted (Server Style):", plainText);

if (plainText === text) {
  console.log("SUCCESS: Encryption/Decryption matches!");
} else {
  console.log("FAILURE: Encryption/Decryption DOES NOT match!");
}

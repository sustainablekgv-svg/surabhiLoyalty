import CryptoJS from 'crypto-js';
import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDgNnZa1vTimvFDjEfFOZgVTpVauxOD4Qk",
  authDomain: "surabhiloyalty-uat.firebaseapp.com",
  projectId: "surabhiloyalty-uat",
  storageBucket: "surabhiloyalty-uat.firebasestorage.app",
  messagingSenderId: "982120866650",
  appId: "1:982120866650:web:e2ddca85aba34ab89bc963"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SECRET_KEY = "a1b2c3d4e5f67890a1b2c3d4e5f67890";

const isEncrypted = (text) => {
  return text && text.length > 20 && /^[A-Za-z0-9+/=]+$/.test(text);
};

const safeDecryptText = (text) => {
  try {
    const decrypted = CryptoJS.AES.decrypt(text, SECRET_KEY, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const plainText = decrypted.toString(CryptoJS.enc.Utf8);
    return plainText || null;
  } catch (e) {
    return null;
  }
};

async function main() {
  // console.log("Fetching staff from UAT...");
  try {
    const querySnapshot = await getDocs(collection(db, 'staff'));
    // console.log(`Found ${querySnapshot.size} staff members.`);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const mobile = data.staffMobile;
      const pwd = data.staffPassword;
      const role = data.role;
      const name = data.staffName;
      
      let pwdStatus = "Plaintext";
      let decryptedPwd = pwd;
      
      if (isEncrypted(pwd)) {
        decryptedPwd = safeDecryptText(pwd);
        pwdStatus = decryptedPwd ? "Decrypted successfully" : "DECRYPTION FAILED";
      }
      
      // console.log(`- ${name} (${role}) Mobile: ${mobile} | Status: ${pwdStatus} | Pwd Length: ${pwd?.length}`);
      if (pwdStatus === "DECRYPTION FAILED") {
        // console.log(`  Raw encrypted value: ${pwd}`);
      } else {
        // console.log(`  Decrypted value: ${decryptedPwd}`);
      }
    });
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

main();

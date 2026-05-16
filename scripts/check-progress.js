import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const uatKeyPath = path.resolve(process.cwd(), 'scripts', 'uat-key.json');
const uatKey = JSON.parse(fs.readFileSync(uatKeyPath, "utf8"));
const uatApp = initializeApp({ credential: cert(uatKey) }, "uat-check");
const uatDb = getFirestore(uatApp);

async function check() {
    const products = await uatDb.collection('products').get();
    console.log(`UAT Products count: ${products.size}`);
}

check().catch(console.error);

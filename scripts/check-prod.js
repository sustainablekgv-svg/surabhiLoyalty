import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const prodKeyPath = path.resolve(process.cwd(), 'scripts', 'prod-key.json');
const prodKey = JSON.parse(fs.readFileSync(prodKeyPath, "utf8"));
const prodApp = initializeApp({ credential: cert(prodKey) }, "prod-check");
const prodDb = getFirestore(prodApp);

async function check() {
    const products = await prodDb.collection('products').get();
    console.log(`PROD Products count: ${products.size}`);
}

check().catch(console.error);

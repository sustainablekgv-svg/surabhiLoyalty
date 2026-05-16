import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const uatKeyPath = path.resolve(process.cwd(), 'scripts', 'uat-key.json');
const uatKey = JSON.parse(fs.readFileSync(uatKeyPath, "utf8"));
const uatApp = initializeApp({ credential: cert(uatKey) }, "uat-final-check");
const uatDb = getFirestore(uatApp);

async function check() {
    const collections = await uatDb.listCollections();
    for (const col of collections) {
        const snap = await col.get();
        console.log(`Collection ${col.id}: ${snap.size} documents`);
    }
}

check().catch(console.error);

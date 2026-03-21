import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Firebase Admin SDK bypasses Spark plan billing limits by acting as a top-level admin
// directly fetching and pushing documents instead of relying on GCP Background Export duties.

const prodKeyPath = path.resolve(process.cwd(), 'scripts', 'prod-key.json');
const uatKeyPath = path.resolve(process.cwd(), 'scripts', 'uat-key.json');

if (!fs.existsSync(prodKeyPath) || !fs.existsSync(uatKeyPath)) {
    console.error("ERROR: Service account keys not found.");
    console.error("Please download them from Firebase Console -> Project Settings -> Service Accounts");
    console.error("Save them directly as 'scripts/prod-key.json' and 'scripts/uat-key.json'");
    process.exit(1);
}

const prodKey = JSON.parse(fs.readFileSync(prodKeyPath, "utf8"));
const uatKey = JSON.parse(fs.readFileSync(uatKeyPath, "utf8"));

const prodApp = initializeApp({ credential: cert(prodKey) }, "prod");
const uatApp = initializeApp({ credential: cert(uatKey) }, "uat");

const prodDb = getFirestore(prodApp);
const uatDb = getFirestore(uatApp);

async function copyCollection(srcCol, destCol) {
    const docs = await srcCol.get();
    for (const doc of docs.docs) {
        // console.log(`Copying document: ${doc.ref.path}`);
        await destCol.doc(doc.id).set(doc.data());
        
        // Copy subcollections recursively
        const subCollections = await doc.ref.listCollections();
        for (const subCol of subCollections) {
            await copyCollection(subCol, destCol.doc(doc.id).collection(subCol.id));
        }
    }
}

async function migrate() {
    // console.log("Starting Firestore migration (Spark Plan Compatible)...");
    const collections = await prodDb.listCollections();
    
    for (const col of collections) {
        console.log(`Migrating top-level collection: ${col.id}`);
        await copyCollection(col, uatDb.collection(col.id));
    }
    
    // console.log("Firestore Migration complete!");
}

migrate().catch(console.error);

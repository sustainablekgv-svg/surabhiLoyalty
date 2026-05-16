import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

/**
 * Surabhi Loyalty League - Slug Generation & Migration Script
 * 
 * This script:
 * 1. Connects to Production Firestore.
 * 2. Generates unique slugs for all Products, Brands, and Categories that don't have them.
 * 3. Verifies slug uniqueness across each collection.
 * 4. Migrates all data (including newly generated slugs) to the UAT environment.
 */

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

// Initialize Apps
const prodApp = initializeApp({ credential: cert(prodKey) }, "prod");
const uatApp = initializeApp({ credential: cert(uatKey) }, "uat");

const prodDb = getFirestore(prodApp);
const uatDb = getFirestore(uatApp);

/** --- Slug Utilities --- **/
function generateSlug(name) {
    if (!name) return 'unnamed';
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function ensureUniqueSlugs(db, collectionName) {
    console.log(`\n--- Processing Slugs for: ${collectionName} ---`);
    const colRef = db.collection(collectionName);
    const snapshot = await colRef.get();
    const docs = snapshot.docs;

    let updatedCount = 0;
    const existingSlugs = new Set();

    // First pass: identify existing slugs
    docs.forEach(doc => {
        const data = doc.data();
        if (data.slug) existingSlugs.add(data.slug);
    });

    // Second pass: generate and update missing slugs
    for (const doc of docs) {
        const data = doc.data();
        if (!data.slug) {
            let baseSlug = generateSlug(data.name || data.title || 'item');
            let uniqueSlug = baseSlug;
            let counter = 1;

            // Collision detection within the set
            while (existingSlugs.has(uniqueSlug)) {
                uniqueSlug = `${baseSlug}-${counter}`;
                counter++;
            }

            console.log(`  Generating slug for [${doc.id}]: "${data.name || 'No Name'}" -> ${uniqueSlug}`);
            await doc.ref.update({ 
                slug: uniqueSlug, 
                updatedAt: FieldValue.serverTimestamp() 
            });
            
            existingSlugs.add(uniqueSlug);
            updatedCount++;
        }
    }
    console.log(`Completed ${collectionName}. Generated ${updatedCount} slugs.`);
}

/** --- Migration Utilities --- **/
async function copyCollection(srcCol, destCol) {
    const docs = await srcCol.get();
    for (const doc of docs.docs) {
        process.stdout.write(`.`); // Progress indicator
        await destCol.doc(doc.id).set(doc.data());
        
        // Copy subcollections recursively
        const subCollections = await doc.ref.listCollections();
        for (const subCol of subCollections) {
            await copyCollection(subCol, destCol.doc(doc.id).collection(subCol.id));
        }
    }
}

async function runProcess() {
    try {
        console.log("Starting Slug Generation on Production...");
        
        // 1. Generate Slugs in Prod for relevant collections
        const slugCollections = ['products', 'brands', 'categories'];
        for (const colName of slugCollections) {
            await ensureUniqueSlugs(prodDb, colName);
        }

        console.log("\nSlug generation complete on Production.");
        console.log("\nStarting Migration to UAT...");

        // 2. Migrate all collections to UAT
        const collections = await prodDb.listCollections();
        for (const col of collections) {
            console.log(`\nMigrating collection: ${col.id}`);
            await copyCollection(col, uatDb.collection(col.id));
        }

        console.log("\n\nSUCCESS: Slug generation and UAT migration complete!");
        process.exit(0);
    } catch (error) {
        console.error("\n\nFATAL ERROR:", error);
        process.exit(1);
    }
}

runProcess();

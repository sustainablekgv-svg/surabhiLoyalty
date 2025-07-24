import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

admin.initializeApp();
const db = getFirestore();

// Helper function to get current quarter start date
function getCurrentQuarterStart(): Date {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  
  if (month < 3) return new Date(year, 0, 1); // Q1 (Jan-Mar)
  if (month < 6) return new Date(year, 3, 1); // Q2 (Apr-Jun)
  if (month < 9) return new Date(year, 6, 1); // Q3 (Jul-Sep)
  return new Date(year, 9, 1); // Q4 (Oct-Dec)
}

// Scheduled function to run at the start of each quarter
export const checkQuarterlyCriteria = onSchedule({
  schedule: '0 0 1 1,4,7,10 *', // Runs at 00:00 on Jan 1, Apr 1, Jul 1, Oct 1
  timeZone: 'Asia/Kolkata', // Adjust to your timezone
}, async () => {  // Removed the unused event parameter
  const customersRef = db.collection('customers');
  let batch = db.batch();
  const batchSize = 500; // Firestore batch limit
  
  try {
    // Get all customers
    const snapshot = await customersRef.get();
    const now = admin.firestore.Timestamp.now();
    let operationCount = 0;

    for (const doc of snapshot.docs) {
      const customer = doc.data();
      const quarterlyTotal = customer.quarterlyPurchaseTotal || 0;
      
      batch.update(doc.ref, {
        coinsFrozen: quarterlyTotal < 2000,
        quarterlyPurchaseTotal: 0,
        lastQuarterCheck: now,
        currentQuarterStart: admin.firestore.Timestamp.fromDate(getCurrentQuarterStart())
      });

      operationCount++;

      // Commit batch if we reach the limit
      if (operationCount % batchSize === 0) {
        await batch.commit();
        batch = db.batch(); // Start a new batch
      }
    }

    // Commit any remaining operations
    if (operationCount % batchSize !== 0) {
      await batch.commit();
    }

    console.log(`Successfully processed ${operationCount} customers`);
    return; // Changed from return null to just return
  } catch (error) {
    console.error('Error processing quarterly check:', error);
    throw error;
  }
});
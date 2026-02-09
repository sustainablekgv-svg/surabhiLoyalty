import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';

// Define CustomerType interface for proper typing
interface CustomerType {
  quartersPast?: number;
  cumTotal?: number;
  isStudent?: boolean;
  joinedDate?: admin.firestore.Timestamp;
  coinsFrozen?: boolean;
  lastQuarterCheck?: admin.firestore.Timestamp;
  cummulativeTarget?: number;
  targetMet?: boolean;
}

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

export const checkQuarterlyCriteria = functions.scheduler.onSchedule(
  {
    schedule: '0 0 1 1,4,7,10 *',
    // schedule: '*/10 * * * *',
    timeZone: 'Asia/Kolkata',
  },
  async event => {
    const customersSnapshot = await db.collection('Customers').get();

    const updates: Promise<any>[] = [];

    customersSnapshot.forEach(doc  => {
      const data = doc.data() as CustomerType;

      const joinedDate = data.joinedDate?.toDate();
      if (!joinedDate) return;

      // Increment quartersPast for each customer every time this function runs
      const currentQuartersPast = (data.quartersPast || 0) + 1;

      // Calculate quarterly target: First quarter has no target, subsequent quarters: 2000 * (quarters-1)
      const isStudent = data.isStudent || false;
      const cumTotal = data.cumTotal || 0;
      let cummulativeTarget = 0;
      let coinsFrozen = false;
      let targetMet = true;

      // First quarter after joining has no target requirement
      // if (currentQuartersPast === 1) {
      //   cummulativeTarget = 0;
      //   targetMet = true;
      //   coinsFrozen = false;
      // } else {
      // For subsequent quarters: cumulative target = 2000 * (quarters completed - 1)
      cummulativeTarget = isStudent ? 500 * currentQuartersPast : 2000 * currentQuartersPast;
      targetMet = cumTotal >= cummulativeTarget;
      coinsFrozen = !targetMet; // Freeze coins if cumulative target not met
      // }

      updates.push(
        doc.ref.update({
          quartersPast: currentQuartersPast,
          cummulativeTarget: cummulativeTarget,
          targetMet,
          coinsFrozen,
          lastQuarterCheck: admin.firestore.Timestamp.now(),
        })
      );
    });

    await Promise.all(updates);
    // console.log('Quarterly eligibility check completed');
  }
);

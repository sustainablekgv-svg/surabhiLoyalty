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

    customersSnapshot.forEach(doc => {
      const data = doc.data() as CustomerType;

      const joinedDate = data.joinedDate?.toDate();
      if (!joinedDate) return;

      const cumTotal = data.cumTotal || 0;

      // Only customers who have actually started spending (lifetime cumTotal > 0)
      // accrue quarterly targets. Customers with no spend yet are left untouched
      // so the 2k/quarter target does not pile up against them.
      if (cumTotal <= 0) {
        return;
      }

      // Increment quartersPast for active spenders only
      const currentQuartersPast = (data.quartersPast || 0) + 1;

      // Cumulative target = 2000 * quartersPast
      const cummulativeTarget = 2000 * currentQuartersPast;
      const targetMet = cumTotal >= cummulativeTarget;
      const coinsFrozen = !targetMet;

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

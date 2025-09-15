import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';

admin.initializeApp();
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
      const data = doc.data() as any;

      const joinedDate = data.joinedDate?.toDate();
      if (!joinedDate) return;

      // Increment quartersPast for each customer every time this function runs
      const currentQuartersPast = (data.quartersPast || 0) + 1;

      // For first quarter, no target. For subsequent quarters, target is 2000 * quartersPast
      const cumTotal = data.cumTotal || 0;
      let coinsFrozen = false;

      if (currentQuartersPast > 1) {
        const expectedSpend = 2000 * currentQuartersPast;
        coinsFrozen = cumTotal < expectedSpend;
      }

      const now = new Date();
      updates.push(
        doc.ref.update({
          quartersPast: currentQuartersPast,
          coinsFrozen,
          saleElgibility: !coinsFrozen,
          lastQuarterCheck: admin.firestore.Timestamp.now(),
          currentQuarterStart: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
        })
      );
    });

    await Promise.all(updates);
    console.log('Quarterly eligibility check completed');
  }
);

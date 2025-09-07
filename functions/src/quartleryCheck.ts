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

      // Calculate how many quarters passed since joining
      const now = new Date();
      const quartersSinceJoining =
        Math.floor(
          ((now.getFullYear() - joinedDate.getFullYear()) * 12 +
            (now.getMonth() - joinedDate.getMonth())) /
            3
        ) + 1;

      const expectedSpend = 2000 * quartersSinceJoining;
      const cumTotal = data.cumTotal || 0;

      const carriedForwardTarget = expectedSpend > cumTotal ? expectedSpend - cumTotal : 0;

      const targetMet = cumTotal >= expectedSpend;

      updates.push(
        doc.ref.update({
          quarterlyTarget: expectedSpend,
          carriedForwardTarget,
          targetMet,
          saleElgibility: targetMet,
          lastQuarterCheck: admin.firestore.Timestamp.now(),
          currentQuarterStart: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
        })
      );
    });

    await Promise.all(updates);
    console.log('Quarterly eligibility check completed');
  }
);

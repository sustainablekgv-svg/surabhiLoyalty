cat > /mnt/documents/externalSale.ts << 'FIREBASE_EOF'
/**
 * Firebase Cloud Function: processSaleFromExternal
 * 
 * Deploy this in your surabhiLoyalty Firebase project:
 *   functions/src/externalSale.ts
 * 
 * Then export it from functions/src/index.ts:
 *   export { processSaleFromExternal } from "./externalSale";
 * 
 * Deploy: firebase deploy --only functions:processSaleFromExternal
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const SYNC_SECRET = functions.config().sync?.secret || process.env.FIREBASE_SYNC_SECRET;

const customRound = (n: number) => Math.round(n * 100) / 100;

interface SaleRequest {
  customerMobile: string;
  customerName: string;
  amount: number;
  spvEntered: number;
  coinsUsed: number;
  paymentMethod: string; // "online" | "cod" | "cash"
  invoiceId: string;
  items: any[];
  processedBy: string;
  source: string; // "online" | "pos"
  totalCartValue: number;
}

export const processSaleFromExternal = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "content-type, x-sync-secret");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  // Auth via shared secret
  const secret = req.headers["x-sync-secret"] as string;
  if (!secret || secret !== SYNC_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const body = req.body as SaleRequest;
    const {
      customerMobile, customerName, amount, spvEntered,
      coinsUsed, paymentMethod, invoiceId, processedBy,
      source, totalCartValue,
    } = body;

    if (!customerMobile || !amount) {
      res.status(400).json({ error: "customerMobile and amount are required" });
      return;
    }

    const isPOS = source === "pos";
    const syncTimestamp = admin.firestore.Timestamp.now();

    // ── Fetch store document ──────────────────────────────────────
    const storesSnap = await db.collection("stores")
      .where("storeName", "==", "Sustainable KGV").limit(1).get();

    if (storesSnap.empty) throw new Error("Store 'Sustainable KGV' not found");
    const storeRef = storesSnap.docs[0].ref;
    const storeData = storesSnap.docs[0].data();

    const cashOnlyCommission = storeData.cashOnlyCommission ?? 10;
    const referralCommission = storeData.referralCommission ?? 6;
    const sevaCommission = storeData.sevaCommission ?? 2;
    const shippingCommission = storeData.shippingCommission ?? 0;
    const bonusPercentage = storeData.bonusPercentage ?? 0;
    const storeName = storeData.storeName ?? "Sustainable KGV";
    const isDemoStore = storeData.demoStore ?? false;

    // ── Fetch customer document ───────────────────────────────────
    const custSnap = await db.collection("Customers")
      .where("customerMobile", "==", customerMobile).limit(1).get();

    const customerExists = !custSnap.empty;
    const custRef = customerExists ? custSnap.docs[0].ref : null;
    const custData = customerExists ? custSnap.docs[0].data() : {} as any;

    const prevSurabhiBalance = custData.surabhiBalance ?? 0;
    const prevSevaBalance = custData.sevaBalance ?? 0;
    const prevSevaTotal = custData.sevaTotal ?? 0;
    const prevShippingBalance = custData.shippingBalance ?? 0;
    const prevShippingTotal = custData.shippingTotal ?? 0;
    const prevWalletBalance = custData.walletBalance ?? 0;
    const prevCumTotal = custData.cumTotal ?? 0;
    const prevSurbhiTotal = custData.surbhiTotal ?? 0;
    const customerReferredBy = custData.referredBy ?? "";
    const customerStoreLocation = custData.storeLocation ?? storeName;
    const isStudent = custData.isStudent ?? false;
    const prevSaleElgibility = custData.saleElgibility ?? false;

    // ── Calculations ──────────────────────────────────────────────
    const coinDiscount = coinsUsed ?? 0;
    const adjustedSpv = amount > 0
      ? customRound(((amount - coinDiscount) * spvEntered) / amount)
      : 0;

    const surabhiEarnedAdj = customRound(adjustedSpv * (cashOnlyCommission / 100));
    const sevaContribution = customRound(adjustedSpv * (sevaCommission / 100));
    const referralEarnedAdj = customRound(adjustedSpv * (referralCommission / 100));
    const shippingCreditsEarned = customRound(adjustedSpv * (shippingCommission / 100));

    const adminCutTx = customRound(
      adjustedSpv * ((cashOnlyCommission + referralCommission + sevaCommission + shippingCommission + bonusPercentage) / 100)
    );

    const cashPayment = isPOS ? (amount - coinDiscount) : amount;
    const credit = cashPayment;
    const debit = customRound(amount - adminCutTx);

    // Customer balance updates
    const newSurabhiBalance = customRound(prevSurabhiBalance - coinDiscount + surabhiEarnedAdj);
    const newSevaBalance = customRound(prevSevaBalance + sevaContribution);
    const newSevaTotal = customRound(prevSevaTotal + sevaContribution);
    const newShippingBalance = customRound(prevShippingBalance + shippingCreditsEarned);
    const newShippingTotal = customRound(prevShippingTotal + shippingCreditsEarned);
    const additionToCumTotal = totalCartValue || amount;
    const newCumTotal = customRound(prevCumTotal + additionToCumTotal);

    // Store balance increments
    const storeBalanceIncrement = customRound(credit - debit);

    const remarks = isPOS
      ? `Cash sale for ${customerName} (${customerMobile})`
      : `Online sale for ${customerName} via Order #${invoiceId} (Processed by ${processedBy})`;

    // ── Run all 7 operations in a batch / transaction ─────────────
    const batch = db.batch();

    // 1. AccountTx
    const accountTxRef = db.collection("AccountTx").doc();
    batch.set(accountTxRef, {
      createdAt: syncTimestamp,
      storeName,
      type: "sale",
      amount: customRound(amount),
      invoiceId,
      demoStore: isDemoStore,
      customerName,
      customerMobile,
      credit: customRound(credit),
      adminCut: customRound(adminCutTx),
      adminProfit: customRound(adminCutTx),
      debit: customRound(debit),
      sevaBalance: customRound((storeData.storeSevaBalance ?? 0) + sevaContribution),
      currentBalance: customRound((storeData.storeCurrentBalance ?? 0) + storeBalanceIncrement),
      adminCurrentBalance: customRound((storeData.adminCurrentBalance ?? 0) - storeBalanceIncrement),
      remarks,
      spvEntered: customRound(spvEntered),
      adjustedSpv: customRound(adjustedSpv),
      shippingCredit: shippingCreditsEarned,
      shippingDebit: 0,
      shippingBalance: customRound(newShippingBalance),
    });

    // 2. CustomerTx (buyer)
    const custTxRef = db.collection("CustomerTx").doc();
    batch.set(custTxRef, {
      type: "sale",
      customerMobile,
      customerName,
      demoStore: isDemoStore,
      storeLocation: customerStoreLocation,
      storeName,
      createdAt: syncTimestamp,
      paymentMethod,
      processedBy,
      invoiceId,
      remarks: `Online Order #${invoiceId} (Processed by ${processedBy})`,
      amount: customRound(amount),
      surabhiEarned: customRound(surabhiEarnedAdj),
      sevaEarned: customRound(sevaContribution),
      referralEarned: 0,
      referredBy: customerReferredBy,
      adminProft: customRound(adminCutTx),
      spvEntered: customRound(spvEntered),
      adjustedSpv: customRound(adjustedSpv),
      surabhiEarnedAdj: customRound(surabhiEarnedAdj),
      sevaEarnedAdj: customRound(sevaContribution),
      surabhiUsed: customRound(coinDiscount),
      walletDeduction: 0,
      cashPayment: customRound(cashPayment),
      previousBalance: {
        walletBalance: customRound(prevWalletBalance),
        surabhiBalance: customRound(prevSurabhiBalance),
        shippingBalance: customRound(prevShippingBalance),
      },
      newBalance: {
        walletBalance: customRound(prevWalletBalance),
        surabhiBalance: customRound(newSurabhiBalance),
        shippingBalance: customRound(newShippingBalance),
      },
      walletCredit: 0,
      walletDebit: 0,
      walletBalance: customRound(prevWalletBalance),
      surabhiDebit: customRound(coinDiscount),
      surabhiCredit: customRound(surabhiEarnedAdj),
      surabhiBalance: customRound(newSurabhiBalance),
      sevaCredit: customRound(sevaContribution),
      sevaDebit: 0,
      sevaBalance: customRound(newSevaBalance),
      sevaTotal: customRound(newSevaTotal),
      shippingCredit: shippingCreditsEarned,
      shippingDebit: 0,
      shippingBalance: customRound(newShippingBalance),
      shippingTotal: customRound(newShippingTotal),
      storeSevaBalance: customRound((storeData.storeSevaBalance ?? 0) + sevaContribution),
    });

    // 3. Update SevaPool (only non-demo)
    if (!isDemoStore) {
      const sevaPoolRef = db.doc("SevaPool/main");
      batch.update(sevaPoolRef, {
        currentSevaBalance: FieldValue.increment(sevaContribution),
        contributionsCurrentMonth: FieldValue.increment(1),
        totalContributions: FieldValue.increment(1),
      });
    }

    // 4. Update Customer document
    if (custRef) {
      const custUpdate: any = {
        surabhiBalance: customRound(newSurabhiBalance),
        surbhiTotal: customRound(prevSurbhiTotal + surabhiEarnedAdj),
        sevaBalance: customRound(newSevaBalance),
        sevaTotal: customRound(newSevaTotal),
        cumTotal: customRound(newCumTotal),
        shippingBalance: customRound(newShippingBalance),
        shippingTotal: customRound(newShippingTotal),
        lastTransactionDate: syncTimestamp,
      };
      const isEligible = isStudent ? newCumTotal >= 499 : newCumTotal >= 999;
      if (isEligible && !prevSaleElgibility) {
        custUpdate.saleElgibility = true;
      }
      batch.update(custRef, custUpdate);
    }

    // 5. Update store document
    batch.update(storeRef, {
      storeCurrentBalance: FieldValue.increment(storeBalanceIncrement),
      adminCurrentBalance: FieldValue.increment(-storeBalanceIncrement),
      storeSevaBalance: FieldValue.increment(sevaContribution),
      adminStoreProfit: FieldValue.increment(adminCutTx),
    });

    // 7. Activity log for sale
    const activityRef = db.collection("Activity").doc();
    batch.set(activityRef, {
      type: "sale",
      remarks: `Online Purchase of ₹${amount} by ${customerName}`,
      amount: customRound(amount),
      customerName,
      customerMobile,
      storeLocation: storeName,
      createdAt: syncTimestamp,
      demoStore: isDemoStore,
    });

    // Commit the batch
    await batch.commit();

    // 6. Handle referrer (separate batch since we need to query)
    if (customerReferredBy && referralEarnedAdj > 0) {
      try {
        const referrerSnap = await db.collection("Customers")
          .where("customerMobile", "==", customerReferredBy).limit(1).get();

        if (!referrerSnap.empty) {
          const referrerRef = referrerSnap.docs[0].ref;
          const referrerData = referrerSnap.docs[0].data();

          const referrerBatch = db.batch();

          // Update referrer balances
          referrerBatch.update(referrerRef, {
            surabhiBalance: FieldValue.increment(referralEarnedAdj),
            surabhiReferral: FieldValue.increment(referralEarnedAdj),
            surbhiTotal: FieldValue.increment(referralEarnedAdj),
          });

          // Create referrer CustomerTx
          const referrerTxRef = db.collection("CustomerTx").doc();
          referrerBatch.set(referrerTxRef, {
            type: "referral",
            customerMobile: referrerData.customerMobile ?? customerReferredBy,
            customerName: referrerData.customerName ?? "",
            demoStore: isDemoStore,
            storeLocation: referrerData.storeLocation ?? storeName,
            storeName: referrerData.storeLocation ?? storeName,
            createdAt: syncTimestamp,
            paymentMethod: "admin",
            processedBy,
            invoiceId,
            remarks: `Referral bonus for online order by ${customerName}`,
            amount: 0,
            surabhiEarned: customRound(referralEarnedAdj),
            sevaEarned: 0,
            referralEarned: customRound(referralEarnedAdj),
            referredBy: "",
            adminProft: 0,
            spvEntered: 0,
            adjustedSpv: 0,
            surabhiEarnedAdj: 0,
            sevaEarnedAdj: 0,
            surabhiUsed: 0,
            walletDeduction: 0,
            cashPayment: 0,
            previousBalance: {
              walletBalance: customRound(referrerData.walletBalance ?? 0),
              surabhiBalance: customRound(referrerData.surabhiBalance ?? 0),
            },
            newBalance: {
              walletBalance: customRound(referrerData.walletBalance ?? 0),
              surabhiBalance: customRound((referrerData.surabhiBalance ?? 0) + referralEarnedAdj),
            },
            walletCredit: 0,
            walletDebit: 0,
            walletBalance: customRound(referrerData.walletBalance ?? 0),
            surabhiDebit: 0,
            surabhiCredit: customRound(referralEarnedAdj),
            surabhiBalance: customRound((referrerData.surabhiBalance ?? 0) + referralEarnedAdj),
            sevaCredit: 0,
            sevaDebit: 0,
            sevaBalance: customRound(referrerData.sevaBalance ?? 0),
            sevaTotal: customRound(referrerData.sevaTotal ?? 0),
            storeSevaBalance: 0,
          });

          // Activity log for referral
          const refActivityRef = db.collection("Activity").doc();
          referrerBatch.set(refActivityRef, {
            type: "referral",
            remarks: `Referral bonus from Online Order`,
            amount: customRound(referralEarnedAdj),
            customerMobile: referrerData.customerMobile ?? customerReferredBy,
            customerName: referrerData.customerName ?? "",
            createdAt: syncTimestamp,
            demoStore: isDemoStore,
          });

          await referrerBatch.commit();
          console.log(`Referrer ${customerReferredBy} credited ${referralEarnedAdj}`);
        }
      } catch (e) {
        console.error("Referrer processing failed (non-critical):", e);
      }
    }

    res.status(200).json({
      success: true,
      invoiceId,
      accountTxId: accountTxRef.id,
      customerTxId: custTxRef.id,
    });
  } catch (err: any) {
    console.error("processSaleFromExternal error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
FIREBASE_EOF
echo "Done"

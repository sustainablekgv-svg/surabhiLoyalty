import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

export const syncNplSales = functions.https.onRequest(async (req, res) => {
    // 1. Verify Secret
    const syncSecret = process.env.NPL_SYNC_SECRET || 'npl_surabhi_secret_2025';
    const providedSecret = req.headers['x-sync-secret'];

    if (!providedSecret || providedSecret !== syncSecret) {
        res.status(401).json({ error: 'Unauthorized: Invalid sync secret' });
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const payload = req.body;
    const {
        customerMobile,
        invoiceId,
        totalSellingPrice,
        totalSpv,
        coinDiscount,
        adjustedSpv,
        finalTotal
    } = payload;

    if (!customerMobile) {
        res.status(400).json({ error: 'Missing customerMobile' });
        return;
    }

    try {
        // 2. Find Customer
        const customersRef = db.collection('Customers');
        const q = customersRef.where('customerMobile', '==', customerMobile).limit(1);
        const snapshot = await q.get();

        let customerDoc = snapshot.empty ? null : snapshot.docs[0];
        let customerData = customerDoc ? customerDoc.data() : null;
        let customerId = customerDoc ? customerDoc.id : null;

        // Create basic customer profile if they don't exist
        if (!customerDoc) {
            const newCustomer = {
                customerMobile,
                customerName: 'NPL Customer',
                walletBalance: 0,
                surabhiBalance: 0,
                sevaBalanceCurrentMonth: 0,
                sevaTotal: 0,
                cumTotal: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'npl_sync'
            };
            const newDocRef = await customersRef.add(newCustomer);
            customerId = newDocRef.id;
            customerData = newCustomer;
            console.log(`Created new customer: ${customerMobile}`);
        }

        // 3. Coin Math exactly as specified:
        const spv = Number(totalSpv) || 0;
        const adjSpv = Number(adjustedSpv) || spv;
        const buyerCoins = Math.round(adjSpv * 0.10);
        const referrerCoins = Math.round(adjSpv * 0.06);
        const sevaCoins = Math.round(adjSpv * 0.02);
        
        const usedCoins = Number(coinDiscount) || 0;
        const transactionAmount = Number(finalTotal) || 0;
        const cashPayment = Math.max(0, transactionAmount - usedCoins);

        // Calculate new balances
        const prevSurabhiBalance = Number(customerData?.surabhiBalance) || 0;
        const newSurabhiBalance = prevSurabhiBalance - usedCoins + buyerCoins;
        
        const prevSevaBalance = Number(customerData?.sevaBalanceCurrentMonth) || 0;
        const newSevaBalance = prevSevaBalance + sevaCoins;


        // 4. Update Customer Document
        await customersRef.doc(customerId!).update({
            surabhiBalance: admin.firestore.FieldValue.increment(buyerCoins - usedCoins),
            sevaBalanceCurrentMonth: admin.firestore.FieldValue.increment(sevaCoins),
            sevaTotal: admin.firestore.FieldValue.increment(sevaCoins),
            cumTotal: admin.firestore.FieldValue.increment(transactionAmount),
            lastTransactionDate: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 5. Create CustomerTx
        const customerTxData = {
            type: 'sale',
            customerMobile,
            customerName: customerData?.customerName || 'NPL Customer',
            demoStore: false,
            storeLocation: 'NPL Online',
            storeName: 'NPL Integration',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentMethod: 'online',
            processedBy: 'NPL Sync',
            invoiceId: invoiceId || `NPL-${Date.now()}`,
            remarks: `External NPL Sale`,
            amount: transactionAmount,
            surabhiEarned: buyerCoins,
            sevaEarned: sevaCoins,
            referralEarned: 0,
            referredBy: customerData?.referredBy || '',
            spvEntered: spv,
            adjustedSpv: adjSpv,
            surabhiUsed: usedCoins,
            cashPayment: cashPayment,
            previousBalance: {
                walletBalance: Number(customerData?.walletBalance) || 0,
                surabhiBalance: prevSurabhiBalance,
            },
            newBalance: {
                walletBalance: Number(customerData?.walletBalance) || 0,
                surabhiBalance: newSurabhiBalance,
            },
            surabhiDebit: usedCoins,
            surabhiCredit: buyerCoins,
            surabhiBalance: newSurabhiBalance,
            sevaCredit: sevaCoins,
            sevaDebit: 0,
            sevaBalance: newSevaBalance,
            source: 'npl_sync'
        };
        await db.collection('CustomerTx').add(customerTxData);

        // 6. Handle Referrer
        if (customerData?.referredBy && referrerCoins > 0) {
            const refQuery = await customersRef.where('customerMobile', '==', customerData.referredBy).limit(1).get();
            if (!refQuery.empty) {
                const referrerDoc = refQuery.docs[0];
                const referrerData = referrerDoc.data();
                
                await referrerDoc.ref.update({
                    surabhiBalance: admin.firestore.FieldValue.increment(referrerCoins),
                    surabhiReferral: admin.firestore.FieldValue.increment(referrerCoins),
                    surbhiTotal: admin.firestore.FieldValue.increment(referrerCoins),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                const prevRefSurabhiBalance = Number(referrerData.surabhiBalance) || 0;
                
                await db.collection('CustomerTx').add({
                    type: 'referral',
                    customerMobile: referrerData.customerMobile,
                    customerName: referrerData.customerName,
                    storeName: 'NPL Integration',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    paymentMethod: 'admin',
                    processedBy: 'NPL Sync',
                    invoiceId: invoiceId || '',
                    remarks: `Referral bonus from NPL Sale by ${customerData?.customerName || 'NPL Customer'}`,
                    amount: 0,
                    surabhiEarned: referrerCoins,
                    sevaEarned: 0,
                    referralEarned: referrerCoins,
                    surabhiCredit: referrerCoins,
                    surabhiBalance: prevRefSurabhiBalance + referrerCoins,
                    previousBalance: {
                        walletBalance: Number(referrerData.walletBalance) || 0,
                        surabhiBalance: prevRefSurabhiBalance,
                    },
                    newBalance: {
                        walletBalance: Number(referrerData.walletBalance) || 0,
                        surabhiBalance: prevRefSurabhiBalance + referrerCoins,
                    }
                });
            }
        }

        // 7. Activity Log
        await db.collection('Activity').add({
            type: 'sale',
            remarks: `NPL Purchase of ₹${transactionAmount} by ${customerData?.customerName || 'NPL Customer'}`,
            amount: transactionAmount,
            customerName: customerData?.customerName || 'NPL Customer',
            customerMobile: customerMobile,
            storeLocation: 'NPL Integration',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'npl_sync'
        });

        // 8. Order Record
        // We'll record a simplified version of the order so it appears in Admin
        const orderData = {
            order_number: invoiceId || `NPL-${Date.now()}`,
            customer: {
                customerMobile,
                customerName: customerData?.customerName || 'NPL Customer',
                id: customerId
            },
            total_amount: transactionAmount,
            total_cart_value: Number(totalSellingPrice) || transactionAmount,
            total_spv: spv,
            coin_discount: usedCoins,
            paymentMethod: 'online',
            items: [],
            source: 'npl_sync',
            status: 'delivered',
            paymentStatus: 'paid',
            orderDate: admin.firestore.FieldValue.serverTimestamp(),
            actual_total_spv: adjSpv,
            deliveryCharge: 0,
            deliveryAddress: null,
            paymentId: null,
            netCashPayment: cashPayment,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            storeName: 'NPL Integration',
            processedBy: 'NPL Sync',
            firebase_synced: true
        };
        await db.collection('orders').doc(orderData.order_number).set(orderData);

        // Send Success
        res.status(200).json({ success: true, message: 'NPL Sale synced successfully' });
    } catch (error) {
        console.error('Error syncing NPL sale:', error);
        res.status(500).json({ error: 'Internal server error while syncing sale' });
    }
});

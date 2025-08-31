# Quarterly Sales Target Testing Guide

This guide will help you test the newly implemented quarterly sales target functionality for `surabhCoins` usage.

## Overview of Features to Test

✅ **Customer Registration with joinedDate**
✅ **Quarterly Target Calculation** (quarters since joining × 2000)
✅ **Coin Usage Restriction** (only when target met)
✅ **Target Carryforward Logic**
✅ **Firebase Function for Quarterly Checks**

## Testing Steps

### 1. Test Customer Registration with joinedDate

**Steps:**

1. Navigate to the Staff dashboard
2. Go to "User Registration" section
3. Register a new customer with these details:
   - Name: "Test Customer 1"
   - Phone: "9999999999"
   - Role: "customer"
4. Check Firestore database to verify the new customer has:
   - `joinedDate`: Current timestamp
   - `quarterlyTarget`: 0 (initial)
   - `targetMet`: false
   - `carriedForwardTarget`: 0

**Expected Result:** New customer should be created with all quarterly target fields properly initialized.

### 2. Test Quarterly Target Calculation

**Steps:**

1. In Firestore, manually check the `quarterlyTargets.ts` logic:
   - For a customer joined today: target should be 2000 (1 quarter × 2000)
   - For a customer joined 6 months ago: target should be 4000 (2 quarters × 2000)
   - For a customer joined 1 year ago: target should be 8000 (4 quarters × 2000)

**Expected Result:** Target calculation should be accurate based on elapsed quarters since joining.

### 3. Test Coin Usage Restriction (Target Not Met)

**Steps:**

1. Create a test customer or use existing one
2. Ensure their `cumTotal` is less than their `quarterlyTarget`
3. Add some `surabhiCredit` to their wallet (e.g., 500 coins)
4. Go to Sales Management
5. Try to create a sale using `surabhiCoins`
6. Attempt to use coins in the payment

**Expected Result:**

- Should show error message preventing coin usage
- Sale should not allow `surabhiCoins` to be deducted
- Error message should indicate quarterly target not met

### 4. Test Coin Usage Allowance (Target Met)

**Steps:**

1. Create a test customer or modify existing one
2. Set their `cumTotal` to be greater than or equal to their `quarterlyTarget`
3. Set `targetMet` to `true` in Firestore
4. Add some `surabhiCredit` to their wallet
5. Go to Sales Management
6. Create a sale and try to use `surabhiCoins`

**Expected Result:**

- Should allow coin usage without restrictions
- Coins should be deducted normally from wallet
- Sale should process successfully

### 5. Test Firebase Function Deployment

**Steps:**

1. Deploy Firebase functions:
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions
   ```
2. Check Firebase Console for successful deployment
3. Verify the `checkQuarterlyCriteria` function is scheduled correctly

**Expected Result:** Function should deploy successfully and be scheduled to run quarterly.

### 6. Test Target Carryforward Logic

**Steps:**

1. Create a test scenario in Firestore:
   - Customer with `quarterlyTarget`: 4000
   - Customer with `cumTotal`: 3000 (target not met)
   - Customer with `carriedForwardTarget`: 0
2. Manually trigger the quarterly check function or simulate it
3. Check the updated customer data

**Expected Result:**

- `targetMet` should be `false`
- `carriedForwardTarget` should be 1000 (4000 - 3000)
- `coinsFrozen` should be `true`

## Manual Testing Scenarios

### Scenario A: New Customer Journey

1. Register new customer → Check joinedDate stored
2. Customer makes purchases → Check cumTotal increases
3. Customer tries to use coins before meeting target → Should be blocked
4. Customer reaches target → Should be able to use coins

### Scenario B: Quarterly Transition

1. Customer with unmet target at quarter end
2. Run quarterly check function
3. Verify carryforward calculation
4. Next quarter: target should include carryforward amount

### Scenario C: Legacy Customer Handling

1. Existing customer without `joinedDate`
2. Quarterly function should skip them gracefully
3. No errors should occur

## Database Verification Points

Check these fields in Firestore for each test customer:

```javascript
{
  // Existing fields
  customerName: "Test Customer",
  cumTotal: 0,
  surabhiCredit: 0,

  // New quarterly target fields
  joinedDate: Timestamp,
  quarterlyTarget: number,
  targetMet: boolean,
  carriedForwardTarget: number,
  coinsFrozen: boolean,
  lastQuarterCheck: Timestamp,
  currentQuarterStart: Timestamp
}
```

## Troubleshooting

**If coin usage is not being blocked:**

- Check if `hasMetQuarterlyTarget` function is being called in SalesManagement
- Verify customer's `targetMet` field in database
- Check browser console for any JavaScript errors

**If quarterly function fails:**

- Check Firebase Functions logs
- Verify all customers have required fields
- Check for any Firestore permission issues

**If target calculation seems wrong:**

- Verify `joinedDate` is stored correctly
- Check `getQuartersElapsed` function logic
- Ensure timezone handling is correct

## Success Criteria

✅ New customers get `joinedDate` and quarterly fields
✅ Coin usage blocked when target not met
✅ Coin usage allowed when target met
✅ Quarterly function runs without errors
✅ Target carryforward works correctly
✅ Legacy customers handled gracefully

Once all tests pass, the quarterly sales target system is ready for production use!

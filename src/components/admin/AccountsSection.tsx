import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, Search } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

import { ActivityType, SalesTransaction, StoreType } from '@/types/types';
interface AccountEntry {
  id: string;
  date: Date;
  type: 'recharge' | 'sale' | 'commission';
  credit: number;
  debit: number;
  balance: number;
  remarks: string;
  storeLocation: string;
  referenceId: string;
}

export const Accounts = () => {
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');

  const fetchAccountData = async () => {
    try {
      setLoading(true);
      
      // Fetch stores first to get commission rates
      const storesSnapshot = await getDocs(collection(db, 'stores'));
      const stores = storesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as StoreType[];
      
      // Fetch recharges
      const rechargesQuery = query(
        collection(db, 'Activity'),
        where('type', '==', 'recharge'),
        orderBy('date', 'desc')
      );
      const rechargesSnapshot = await getDocs(rechargesQuery);
      
      // Fetch sales transactions
      const transactionsQuery = query(
        collection(db, 'transactions'),
        orderBy('timestamp', 'desc')
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      // Process all data into account entries
      const accountEntries: AccountEntry[] = [];
      let runningBalance = 0;
      
      // Process recharges (credit to admin)
      rechargesSnapshot.forEach(doc => {
        const recharge = doc.data() as ActivityType;
        const store = stores.find(s => s.location === recharge.location);
        const commission = store ? recharge.amount * (store.walletCommission / 100) : 0;
        
        // Recharge entry (credit to admin)
        accountEntries.push({
          id: doc.id,
          date: recharge.date instanceof Timestamp ? recharge.date.toDate() : new Date(),
          type: 'recharge',
          credit: recharge.amount || 0,
          debit: 0,
          balance: runningBalance += recharge.amount || 0,
          remarks: recharge.description,
          storeLocation: recharge.location,
          referenceId: doc.id
        });
        
        // Commission entry (debit from store)
        if (commission > 0) {
          accountEntries.push({
            id: `commission_${doc.id}`,
            date: recharge.date instanceof Timestamp ? recharge.date.toDate() : new Date(),
            type: 'commission',
            credit: 0,
            debit: commission,
            balance: runningBalance -= commission,
            remarks: `Commission for recharge (${store?.walletCommission}%)`,
            storeLocation: recharge.location,
            referenceId: doc.id
          });
        }
      });
      
      // Process sales transactions
      transactionsSnapshot.forEach(doc => {
        const transaction = doc.data() as SalesTransaction;
        const store = stores.find(s => s.name === transaction.storeLocation);

        const transactionDate = transaction.createdAt ? 
        (typeof transaction.createdAt === 'string' ? new Date(transaction.createdAt) :
        (transaction.createdAt instanceof Timestamp ? transaction.createdAt.toDate() : new Date())) :
        new Date();
        
        // Calculate commissions
        const walletCommission = store ? 
          transaction.walletDeduction * (store.walletCommission / 100) : 0;
        const surabhiCommission = store ? 
          transaction.surabhiCoinsUsed * (store.surabhiCommission / 100) : 0;
        const sevaCommission = store ? 
          (transaction.amount * (store.sevaCommission / 100)) : 0;
        
        // Sales entry (credit to store)
          accountEntries.push({
            id: doc.id,
            date: transactionDate,
            type: 'sale',
            credit: transaction.amount || 0,
            debit: 0,
            balance: runningBalance += transaction.amount || 0,
            remarks: `Sale to ${transaction.customerName || 'Customer'} (${transaction.paymentMethod || 'unknown'})`,
            storeLocation: transaction.storeLocation || 'Unknown',
            referenceId: doc.id
        });
        
        // Commission entries (debit from store)
        if (walletCommission > 0) {
          accountEntries.push({
            id: `wallet_comm_${doc.id}`,
            date: transaction.createdAt instanceof Timestamp ? transaction.createdAt.toDate() : new Date(),
            type: 'commission',
            credit: 0,
            debit: walletCommission,
            balance: runningBalance -= walletCommission,
            remarks: `Wallet commission (${store?.walletCommission}%)`,
            storeLocation: transaction.storeLocation,
            referenceId: doc.id
          });
        }
        
        if (surabhiCommission > 0) {
          accountEntries.push({
            id: `surabhi_comm_${doc.id}`,
            date: transaction.createdAt instanceof Timestamp ? transaction.createdAt.toDate() : new Date(),
            type: 'commission',
            credit: 0,
            debit: surabhiCommission,
            balance: runningBalance -= surabhiCommission,
            remarks: `Surabhi coins commission (${store?.surabhiCommission}%)`,
            storeLocation: transaction.storeLocation,
            referenceId: doc.id
          });
        }
        
        if (sevaCommission > 0) {
          accountEntries.push({
            id: `seva_comm_${doc.id}`,
            date: transaction.createdAt instanceof Timestamp ? transaction.createdAt.toDate() : new Date(),
            type: 'commission',
            credit: 0,
            debit: sevaCommission,
            balance: runningBalance -= sevaCommission,
            remarks: `Seva commission (${store?.sevaCommission}%)`,
            storeLocation: transaction.storeLocation,
            referenceId: doc.id
          });
        }
      });
      
      // Sort all entries by date
      accountEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEntries(accountEntries);
      
    } catch (err) {
      console.error('Error fetching account data:', err);
      setError('Failed to load account data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAccountData();
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.storeLocation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStore = storeFilter === 'all' || entry.storeLocation === storeFilter;
    return matchesSearch && matchesStore;
  });

  useEffect(() => {
    fetchAccountData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">{error}</p>
        <Button variant="outline" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Accounts</h2>
          <p className="text-gray-600">Track all financial transactions between admin and stores</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            <div>
              <CardTitle>Recent History</CardTitle>
              <CardDescription>
                {filteredEntries.length} entries found
                {(searchTerm || storeFilter !== 'all') && ' (filtered)'}
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search remarks or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              
              <select 
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="all">All Stores</option>
                {Array.from(new Set(entries.map(e => e.storeLocation))).map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-500">
              <Search className="h-8 w-8" />
              <p>No transactions found</p>
              {(searchTerm || storeFilter !== 'all') && (
                <Button variant="ghost" onClick={() => {
                  setSearchTerm('');
                  setStoreFilter('all');
                }}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {format(entry.date, 'dd MMM yyyy, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        entry.type === 'recharge' ? 'default' :
                        entry.type === 'sale' ? 'secondary' : 'outline'
                      }>
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.storeLocation}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{entry.balance.toFixed(2)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.remarks}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
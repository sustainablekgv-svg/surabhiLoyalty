import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent,
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { 
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

interface Store {
  id: string;
  name: string;
  location: string;
}

import { AccountTx, StoreAccountsProps } from '@/types/types';

const StoreAccounts = ({ storeLocation, userRole }: StoreAccountsProps & { userRole: string }) => {
  const [transactions, setTransactions] = useState<AccountTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingTx, setUpdatingTx] = useState<string | null>(null);

  const isAdmin = userRole === 'admin'; // Assuming 'admin' is the role name for administrators

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      if (!storeLocation) return;
      
      const txQuery = query(
        collection(db, 'AccountTx'),
        where('storeName', '==', storeLocation),
        orderBy('date', 'desc')
      );
      
      const txSnapshot = await getDocs(txQuery);
      const txData: AccountTx[] = [];
      
      txSnapshot.forEach(doc => {
        const data = doc.data();
        txData.push({
          id: doc.id,
          date: data.date,
          storeName: data.storeName,
          type: data.type,
          amount: data.amount || 0,
          debit: data.debit || 0,
          credit: data.credit || 0,
          balance: data.balance || 0,
          description: data.description || '',
          settled: data.settled || false,
          adminCut: data.adminCut || 0
        });
      });
      
      setTransactions(txData);
      
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSettledToggle = async (txId: string, settled: boolean) => {
    if (!isAdmin) return; // Only allow admins to update the settled status
    
    try {
      setUpdatingTx(txId);
      await updateDoc(doc(db, 'AccountTx', txId), {
        settled
      });
      setTransactions(prev => prev.map(tx => 
        tx.id === txId ? {...tx, settled} : tx
      ));
    } catch (err) {
      console.error('Error updating transaction:', err);
    } finally {
      setUpdatingTx(null);
    }
  };

  const formatTimestamp = (timestamp: Timestamp): string => {
    return format(timestamp.toDate(), 'MMM dd, yyyy HH:mm');
  };

  useEffect(() => {
    fetchTransactions();
  }, [storeLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{storeLocation} Transactions</h2>
        <Button variant="outline" onClick={() => {
          setRefreshing(true);
          fetchTransactions();
        }} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Settled</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    {formatTimestamp(tx.date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      tx.type === 'recharge' ? 'default' :
                      tx.type === 'wallet' ? 'secondary' : 'outline'
                    }>
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.amount >= 0 ? '+' : ''}
                    ₹{tx.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {tx.credit > 0 ? `+₹${tx.credit.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {tx.debit > 0 ? `-₹${tx.debit.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{tx.balance.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {updatingTx === tx.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isAdmin ? (
                      <Checkbox
                        checked={Boolean(tx.settled)}
                        onCheckedChange={(checked) => 
                          handleSettledToggle(tx.id, Boolean(checked))
                        }
                        className="h-5 w-5 rounded-md"
                      />
                    ) : (
                      <span>{tx.settled ? '✔️' : '❌'}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {tx.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreAccounts;
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Search, Filter, ShoppingCart, Loader2, Zap, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { collection, query, where, getDocs, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { TransactionsPageProps, ActivityType } from '@/types/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatTimestamp = (timestamp: Timestamp): string => {
  return format(timestamp.toDate(), 'MMM dd, yyyy HH:mm');
};

export const TransactionsPage = ({ storeLocation }: TransactionsPageProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'recharges'>('transactions');

  // Calculate pagination
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredActivities.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredActivities.length / recordsPerPage);

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Handle records per page change
  const handleRecordsPerPageChange = (value: string) => {
    setRecordsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Fetch all activities for current store
  useEffect(() => {
    const fetchActivities = async () => {
      if (!storeLocation) return;

      setIsLoading(true);
      setError(null);

      try {
        const q = query(
          collection(db, 'Activity'),
          where('location', '==', storeLocation)
        );
        const querySnapshot = await getDocs(q);
        const fetchedActivities: ActivityType[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedActivities.push({
            id: doc.id,
            type: data.type,
            description: data.description,
            amount: data.amount || 0,
            user: data.user,
            location: data.location,
            date: data.date as Timestamp
          });
        });

        // Sort by date (newest first)
        fetchedActivities.sort((a, b) => {
          const dateA = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date).getTime();
          const dateB = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date).getTime();
          return dateB - dateA;
        });

        setActivities(fetchedActivities);
        setFilteredActivities(fetchedActivities);
      } catch (err) {
        console.error('Error fetching activities:', err);
        setError('Failed to load activities. Please try again.');
        toast.error('Failed to load activities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [storeLocation]);

  // Apply filters
  useEffect(() => {
    if (!activities.length) return;

    setIsFiltering(true);
    let result = [...activities];

    // Filter by tab
    if (activeTab === 'transactions') {
      result = result.filter(activity => activity.type === 'transaction');
    } else if (activeTab === 'recharges') {
      result = result.filter(activity => activity.type === 'recharge');
    }

    // Search filter (user or description)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (activity) =>
        (activity.user?.toLowerCase().includes(term) ||
          activity.description?.toLowerCase().includes(term))
      );
    }

    // Date range filter
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      result = result.filter((activity) => {
        const activityDate = activity.date instanceof Timestamp
          ? activity.date.toDate()
          : new Date(activity.date);

        if (start && activityDate < start) return false;
        if (end && activityDate > end) return false;
        return true;
      });
    }

    setFilteredActivities(result);
    setCurrentPage(1);
    setIsFiltering(false);
  }, [searchTerm, startDate, endDate, activities, activeTab]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const calculateTotal = () => {
    return filteredActivities.reduce((sum, activity) => sum + (Number(activity.amount) || 0), 0);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'transaction':
        return <ShoppingCart className="h-4 w-4 mr-2" />;
      case 'recharge':
        return <Zap className="h-4 w-4 mr-2" />;
      case 'signup':
        return <UserPlus className="h-4 w-4 mr-2" />;
      default:
        return <Zap className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-full">
          <ShoppingCart className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-gray-600">View transactions and recharges at {storeLocation}</p>
        </div>
      </div>

      {/* Filtering Options */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            Filter Activities
          </CardTitle>
          <CardDescription>
            Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredActivities.length)} of {filteredActivities.length} activity(s) for {storeLocation}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search User/Description</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-10"
                disabled={isLoading}
                max={endDate || undefined}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-10"
                disabled={isLoading}
                min={startDate || undefined}
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="w-full"
              disabled={isLoading || (!searchTerm && !startDate && !endDate)}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      {!isLoading && filteredActivities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-blue-600">Total Activities</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">{filteredActivities.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-green-600">Total Amount</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">₹{calculateTotal().toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-purple-600">Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">
                {filteredActivities.filter(a => a.type === 'transaction').length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-amber-600">Recharges</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold">
                {filteredActivities.filter(a => a.type === 'recharge').length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activity List with Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'transactions' | 'recharges')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="recharges">
            <Zap className="h-4 w-4 mr-2" />
            Recharges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm mt-4">
            <CardContent>
              {error ? (
                <div className="text-center py-8 text-red-500">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                  <p>Loading activities...</p>
                </div>
              ) : isFiltering ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  <p>Applying filters...</p>
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No activities found</p>
                  <p className="mb-4">
                    {activities.length === 0
                      ? 'No activities recorded for this store yet.'
                      : 'No activities match your current filters.'}
                  </p>
                  {activities.length > 0 && (
                    <Button variant="outline" onClick={handleClearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRecords.map((activity) => (
                        <TableRow key={activity.id} className="hover:bg-gray-50">
                          <TableCell>
                            {formatTimestamp(activity.date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              {getActivityIcon(activity.type)}
                              {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{activity.user || '-'}</TableCell>
                          <TableCell>{activity.description || '-'}</TableCell>
                          <TableCell className="text-right">
                            {activity.amount ? `₹${Number(activity.amount).toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recharges">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm mt-4">
            <CardContent>
              {error ? (
                <div className="text-center py-8 text-red-500">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                  <p>Loading activities...</p>
                </div>
              ) : isFiltering ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  <p>Applying filters...</p>
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">No activities found</p>
                  <p className="mb-4">
                    {activities.length === 0
                      ? 'No activities recorded for this store yet.'
                      : 'No activities match your current filters.'}
                  </p>
                  {activities.length > 0 && (
                    <Button variant="outline" onClick={handleClearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRecords.map((activity) => (
                        <TableRow key={activity.id} className="hover:bg-gray-50">
                          <TableCell>
                            {formatTimestamp(activity.date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              {getActivityIcon(activity.type)}
                              {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{activity.user || '-'}</TableCell>
                          <TableCell>{activity.description || '-'}</TableCell>
                          <TableCell className="text-right">
                            {activity.amount ? `₹${Number(activity.amount).toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {filteredActivities.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="recordsPerPage">Records per page:</Label>
            <Select
              value={recordsPerPage.toString()}
              onValueChange={handleRecordsPerPageChange}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show first, last and nearby pages
              if (totalPages <= 5) {
                return i + 1;
              }
              if (currentPage <= 3) {
                return i + 1;
              }
              if (currentPage >= totalPages - 2) {
                return totalPages - 4 + i;
              }
              return currentPage - 2 + i;
            }).map((number) => (
              <Button
                key={number}
                variant={currentPage === number ? "default" : "outline"}
                size="sm"
                onClick={() => paginate(number)}
              >
                {number}
              </Button>
            ))}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span className="px-2">...</span>
            )}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => paginate(totalPages)}
              >
                {totalPages}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, filteredActivities.length)} of {filteredActivities.length} records
          </div>
        </div>
      )}
    </div>
  );
};
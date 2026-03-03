import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CashflowRangeFilter } from './components/CashflowRangeFilter';
import { CashflowTransactionList } from './components/CashflowTransactionList';
import { CashflowReport } from './components/CashflowReport';
import { normalizeCashflowRange, normalizeRangeShift } from '@/lib/cashflow/utils';
import { useCashflowTransactions, useCashflowAccounts, useCashflowCategories } from '@/hooks/useCashflowTransactions';

export default function CashflowPage() {
  const [searchParams] = useSearchParams();
  const range = normalizeCashflowRange(searchParams.get('range') ?? undefined);
  const shift = normalizeRangeShift(searchParams.get('shift') ?? undefined);

  const { data: transactions = [], isLoading: transactionsLoading } = useCashflowTransactions(range, shift);
  const { data: accounts = [], isLoading: accountsLoading } = useCashflowAccounts();
  const { data: categories = [], isLoading: categoriesLoading } = useCashflowCategories();

  const transactionsReady = transactions.length > 0 || !transactionsLoading;
  const accountsReady = accounts.length > 0 || !accountsLoading;
  const categoriesReady = categories.length > 0 || !categoriesLoading;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cashflow</h1>
          <p className="text-sm text-muted-foreground">Theo dõi giao dịch và thêm mới.</p>
        </div>
        <Button asChild>
          <Link to="/cashflow/new">Add Transaction</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Báo cáo nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsReady && accountsReady && categoriesReady ? (
            <CashflowReport />
          ) : (
            <ReportSkeleton />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <p className="text-sm text-muted-foreground">Latest activity</p>
          </div>
          <CashflowRangeFilter value={range} />
        </CardHeader>
        <CardContent>
          {transactionsReady ? (
            <CashflowTransactionList
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              range={range}
              shift={shift}
            />
          ) : (
            <TransactionListSkeleton />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function TransactionListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

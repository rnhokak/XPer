import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CashflowRangeFilter } from './components/CashflowRangeFilter';
import { CashflowAccountFilter } from './components/CashflowAccountFilter';
import { CashflowTransactionList } from './components/CashflowTransactionList';
import { CashflowReport } from './components/CashflowReport';
import { CashflowExpenseLineChart } from './components/CashflowExpenseLineChart';
import { normalizeCashflowRange, normalizeRangeShift } from '@/lib/cashflow/utils';
import { isMyAccount, isPartnerAccount, isOtherAccount } from '@/lib/cashflow/accountBalance';
import { useCashflowTransactions, useCashflowAccounts, useCashflowCategories } from '@/hooks/useCashflowTransactions';

export default function CashflowPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = normalizeCashflowRange(searchParams.get('range') ?? 'month');
  const shift = normalizeRangeShift(searchParams.get('shift') ?? undefined);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const customRange = fromParam && toParam ? { from: fromParam, to: toParam } : undefined;
  const accountFilter = searchParams.get('account') ?? 'my';

  const handleAccountFilterChange = (nextFilter: string) => {
    const params = new URLSearchParams(searchParams);
    if (nextFilter === 'my') {
      params.delete('account');
    } else {
      params.set('account', nextFilter);
    }
    setSearchParams(params, { replace: true });
  };

  const { data: transactions = [], isLoading: transactionsLoading } = useCashflowTransactions(
    range,
    shift,
    undefined,
    customRange
  );
  const { data: monthTransactions = [] } = useCashflowTransactions('month', shift);
  const { data: accounts = [], isLoading: accountsLoading } = useCashflowAccounts();
  const { data: categories = [], isLoading: categoriesLoading } = useCashflowCategories();

  const transactionsReady = transactions.length > 0 || !transactionsLoading;
  const accountsReady = accounts.length > 0 || !accountsLoading;
  const categoriesReady = categories.length > 0 || !categoriesLoading;

  const filteredMonthTransactions = useMemo(() => {
    if (!monthTransactions || monthTransactions.length === 0) return [];
    if (accountFilter === 'all') return monthTransactions;

    const myAccountIds = new Set(accounts.filter((a) => isMyAccount(a.type)).map((a) => a.id));
    const partnerAccountIds = new Set(accounts.filter((a) => isPartnerAccount(a.type)).map((a) => a.id));
    const otherAccountIds = new Set(accounts.filter((a) => isOtherAccount(a.type)).map((a) => a.id));

    if (accountFilter === 'my') {
      return monthTransactions.filter((tx) => (tx.account_id ? myAccountIds.has(tx.account_id) : true));
    }
    if (accountFilter === 'partner') {
      return monthTransactions.filter((tx) => (tx.account_id ? partnerAccountIds.has(tx.account_id) : false));
    }
    if (accountFilter === 'other') {
      return monthTransactions.filter((tx) => (tx.account_id ? otherAccountIds.has(tx.account_id) : false));
    }
    return monthTransactions.filter((tx) => tx.account_id === accountFilter);
  }, [monthTransactions, accountFilter, accounts]);

  const filteredRangeTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    if (accountFilter === 'all') return transactions;

    const myAccountIds = new Set(accounts.filter((a) => isMyAccount(a.type)).map((a) => a.id));
    const partnerAccountIds = new Set(accounts.filter((a) => isPartnerAccount(a.type)).map((a) => a.id));
    const otherAccountIds = new Set(accounts.filter((a) => isOtherAccount(a.type)).map((a) => a.id));

    if (accountFilter === 'my') {
      return transactions.filter((tx) => (tx.account_id ? myAccountIds.has(tx.account_id) : true));
    }
    if (accountFilter === 'partner') {
      return transactions.filter((tx) => (tx.account_id ? partnerAccountIds.has(tx.account_id) : false));
    }
    if (accountFilter === 'other') {
      return transactions.filter((tx) => (tx.account_id ? otherAccountIds.has(tx.account_id) : false));
    }
    return transactions.filter((tx) => tx.account_id === accountFilter);
  }, [transactions, accountFilter, accounts]);

  const chartTransactions = range === 'month' && !customRange ? filteredRangeTransactions : filteredMonthTransactions;

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

      {transactionsReady ? (
        <CashflowExpenseLineChart transactions={chartTransactions} shift={shift} />
      ) : (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-44 w-full" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <p className="text-sm text-muted-foreground">Latest activity</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CashflowAccountFilter
              accounts={accounts}
              value={accountFilter}
              onChange={handleAccountFilterChange}
            />
            <CashflowRangeFilter
              value={range}
              customRange={customRange}
            />
          </div>
        </CardHeader>
        <CardContent>
          {transactionsReady ? (
            <CashflowTransactionList
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              range={range}
              shift={shift}
              customRange={customRange}
              accountFilter={accountFilter}
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

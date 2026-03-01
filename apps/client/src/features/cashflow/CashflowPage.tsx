import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CashflowRangeFilter } from './components/CashflowRangeFilter';
import { CashflowTransactionList } from './components/CashflowTransactionList';
import { CashflowReport } from './components/CashflowReport';
import { CashflowExpenseChart } from './components/CashflowExpenseChart';
import { normalizeCashflowRange, normalizeRangeShift } from '@/lib/cashflow/utils';
import { useCashflowTransactions, useCashflowAccounts, useCashflowCategories } from '@/hooks/useCashflowTransactions';
import { Loader2 } from 'lucide-react';

export default function CashflowPage() {
  const [searchParams] = useSearchParams();
  const range = normalizeCashflowRange(searchParams.get('range') ?? undefined);
  const shift = normalizeRangeShift(searchParams.get('shift') ?? undefined);

  const { data: transactions = [], isLoading: transactionsLoading } = useCashflowTransactions(range, shift);
  const { data: accounts = [], isLoading: accountsLoading } = useCashflowAccounts();
  const { data: categories = [], isLoading: categoriesLoading } = useCashflowCategories();

  const isLoading = transactionsLoading || accountsLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <CashflowReport />
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
          <CashflowTransactionList
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            range={range}
            shift={shift}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chi tiêu theo ngày</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowExpenseChart transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}

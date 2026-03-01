import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CashflowQuickAddForm } from './components/CashflowQuickAddForm';
import { useCashflowAccounts, useCashflowCategories } from '@/hooks/useCashflowTransactions';
import { Loader2 } from 'lucide-react';

export default function CashflowNewPage() {
  const { data: accounts = [], isLoading: accountsLoading } = useCashflowAccounts();
  const { data: categories = [], isLoading: categoriesLoading } = useCashflowCategories();

  const isLoading = accountsLoading || categoriesLoading;

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl overflow-x-hidden px-[2px] sm:px-4 pb-[300px] md:pb-0">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Add Transaction</h1>
        <p className="text-sm text-muted-foreground">Enter transaction details below.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Add</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowQuickAddForm
            categories={categories}
            accounts={accounts}
            defaultAccountId={defaultAccount?.id ?? null}
            defaultCurrency={defaultCurrency}
            useDialog={false}
            range="month"
          />
        </CardContent>
      </Card>
    </div>
  );
}

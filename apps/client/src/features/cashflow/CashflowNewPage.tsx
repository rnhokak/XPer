import { Card, CardContent } from '@/components/ui/card';
import { CashflowQuickAddForm } from './components/CashflowQuickAddForm';
import { useCashflowAccounts, useCashflowCategories } from '@/hooks/useCashflowTransactions';

export default function CashflowNewPage() {
  const { data: accounts = [], isLoading: accountsLoading } = useCashflowAccounts();
  const { data: categories = [], isLoading: categoriesLoading } = useCashflowCategories();

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  return (
    <div className="mx-auto w-full max-w-4xl overflow-x-hidden px-[2px] sm:px-4 pb-[110px] md:pb-0">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Add Transaction</h1>
        <p className="text-sm text-muted-foreground">Enter transaction details below.</p>
      </div>

      <Card>
        <CardContent>
          <CashflowQuickAddForm
            categories={categories}
            accounts={accounts}
            defaultAccountId={defaultAccount?.id ?? null}
            defaultCurrency={defaultCurrency}
            useDialog={false}
            range="month"
            isLoading={accountsLoading || categoriesLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

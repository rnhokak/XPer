import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountsManager } from './components/AccountsManager';
import { useCashflowAccounts } from '@/hooks/useCashflowTransactions';
import { Loader2 } from 'lucide-react';

export default function CashflowAccountsPage() {
  const { data: accounts = [], isLoading } = useCashflowAccounts();

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountsManager accounts={accounts} />
        </CardContent>
      </Card>
    </div>
  );
}

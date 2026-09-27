import { useState, useMemo } from 'react';
import { AccountsManager } from './components/AccountsManager';
import { useCashflowAccounts, useCashflowReportTransactions } from '@/hooks/useCashflowTransactions';
import { useAuth } from '@/hooks/useAuth';
import { useDebtsOverviewData } from '@/hooks/useDebtsData';
import { PartnersManager } from '../debts/components/PartnersManager';
import { Loader2, CreditCard, Users, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMyAccount, isOtherAccount } from '@/lib/cashflow/accountBalance';

type Tab = 'accounts' | 'other' | 'partners';

export default function CashflowAccountsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');
  const { data: accounts = [], isLoading: accountsLoading } = useCashflowAccounts();
  const { data: transactions = [], isLoading: txLoading } = useCashflowReportTransactions();
  const { user, loading: authLoading } = useAuth();
  const { data: debtsData, isLoading: debtsLoading } = useDebtsOverviewData(user?.id ?? '');

  const isLoading = accountsLoading || authLoading || txLoading;

  const myAccounts = useMemo(
    () => accounts.filter((a) => isMyAccount(a.type)),
    [accounts]
  );

  const otherAccounts = useMemo(
    () => accounts.filter((a) => isOtherAccount(a.type)),
    [accounts]
  );

  const partners = debtsData?.partners ?? [];
  const debts = debtsData?.debts ?? [];

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { id: 'accounts' as Tab, label: 'Tài khoản của tôi', icon: CreditCard, count: myAccounts.length },
    { id: 'other' as Tab, label: 'Tài khoản khác', icon: Layers, count: otherAccounts.length },
    { id: 'partners' as Tab, label: 'Đối tác Vay / Nợ', icon: Users, count: partners.length },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Tài khoản & Đối tác
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quản lý tài khoản cá nhân, tài khoản khác và đối tác vay nợ
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98]',
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                  activeTab === tab.id
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-slate-200 text-slate-500'
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'accounts' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Danh sách tài khoản và số dư thực tế theo giao dịch thu/chi/chuyển khoản. Đối với thẻ tín dụng, hệ thống tự động hiển thị dư nợ hoặc số tiền dư trong thẻ.
          </p>
          <AccountsManager accounts={accounts} transactions={transactions} scope="my" />
        </div>
      )}

      {activeTab === 'other' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tài khoản của người khác (ví dụ: tài khoản của Vợ, người thân) dùng để thực hiện chuyển khoản luân chuyển dòng tiền, không tính vào số dư thanh toán cá nhân.
          </p>
          <AccountsManager accounts={accounts} transactions={transactions} scope="other" />
        </div>
      )}

      {activeTab === 'partners' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Đối tác là cá nhân hoặc tổ chức liên quan đến các khoản vay, cho vay và chi tiêu. Quản lý tại đây để theo dõi dư nợ và liên kết giao dịch.
          </p>
          {debtsLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <PartnersManager
              partners={partners}
              debts={debts}
              transactions={transactions}
            />
          )}
        </div>
      )}
    </div>
  );
}

import { CashflowQuickAddForm } from "./components/CashflowQuickAddForm";
import { useCashflowAccounts, useCashflowCategories } from "@/hooks/useCashflowTransactions";
import { useDebtPartners } from "@/hooks/useDebtsData";
import { useAuth } from "@/hooks/useAuth";

export default function CashflowNewPage() {
  const { user } = useAuth();
  const { data: accounts = [], isLoading: accountsLoading } = useCashflowAccounts();
  const { data: categories = [], isLoading: categoriesLoading } = useCashflowCategories();
  const { data: partners = [] } = useDebtPartners(user?.id ?? "");

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  return (
    <div className="mx-auto w-full max-w-xl overflow-x-hidden px-1 sm:px-4 pb-28 md:pb-6">
      <div className="mb-3.5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Thêm giao dịch</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Ghi chép chi tiêu & thu nhập nhanh chóng</p>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-3.5 sm:p-6 shadow-xs">
        <CashflowQuickAddForm
          categories={categories}
          accounts={accounts}
          partners={partners}
          defaultAccountId={defaultAccount?.id ?? null}
          defaultCurrency={defaultCurrency}
          useDialog={false}
          range="month"
          isLoading={accountsLoading || categoriesLoading}
        />
      </div>
    </div>
  );
}

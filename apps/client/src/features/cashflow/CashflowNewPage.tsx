import { useNavigate } from "react-router-dom";
import { CashflowQuickAddForm } from "./components/CashflowQuickAddForm";
import CashflowPage from "./CashflowPage";
import { useCashflowAccounts, useCashflowCategories } from "@/hooks/useCashflowTransactions";
import { useDebtPartners } from "@/hooks/useDebtsData";
import { useAuth } from "@/hooks/useAuth";

export default function CashflowNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: accounts = [], isLoading: accountsLoading } = useCashflowAccounts();
  const { data: categories = [], isLoading: categoriesLoading } = useCashflowCategories();
  const { data: partners = [] } = useDebtPartners(user?.id ?? "");

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? null;
  const defaultCurrency = defaultAccount?.currency ?? "VND";

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/cashflow");
    }
  };

  return (
    <>
      {/* Background cashflow page behind the modal popup */}
      <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">
        <CashflowPage />
      </div>

      <CashflowQuickAddForm
        categories={categories}
        accounts={accounts}
        partners={partners}
        defaultAccountId={defaultAccount?.id ?? null}
        defaultCurrency={defaultCurrency}
        range="month"
        isLoading={accountsLoading || categoriesLoading}
        isModal={true}
        onClose={handleClose}
      />
    </>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "@/features/auth/AuthGate";
import { CashflowListScreen } from "@/features/cashflow/screens/CashflowListScreen";
import { NewTransactionScreen } from "@/features/cashflow/screens/NewTransactionScreen";
import { PlaceholderScreen } from "@/features/cashflow/screens/PlaceholderScreen";

export default function App() {
  return (
    <AuthGate>
      <div className="app-shell min-h-screen">
        <div className="mx-auto max-w-md px-4 pb-16 pt-6">
          <Routes>
            <Route path="/" element={<CashflowListScreen />} />
            <Route path="/new" element={<NewTransactionScreen />} />
            <Route path="/accounts" element={<PlaceholderScreen title="Accounts" />} />
            <Route path="/categories" element={<PlaceholderScreen title="Categories" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </AuthGate>
  );
}

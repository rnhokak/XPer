import { createBrowserRouter } from 'react-router-dom'
import LandingPage from '../features/public/LandingPage'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import CashflowPage from '../features/cashflow/CashflowPage'
import CashflowAccountsPage from '../features/cashflow/CashflowAccountsPage'
import CashflowCategoriesPage from '../features/cashflow/CashflowCategoriesPage'
import CashflowNewPage from '../features/cashflow/CashflowNewPage'
import DebtsPage from '../features/debts/DebtsPage'
import DebtsNewPage from '../features/debts/DebtsNewPage'
import DebtsPartnersPage from '../features/debts/DebtsPartnersPage'
import DebtsDetailPage from '../features/debts/DebtsDetailPage'
import PartnersPage from '../features/partners/PartnersPage'
import PartnersDetailPage from '../features/partners/PartnersDetailPage'
import ReportsPage from '../features/reports/ReportsPage'
import SettingsPage from '../features/settings/SettingsPage'
import SettingsProfilePage from '../features/settings/SettingsProfilePage'
import SettingsReportDatesPage from '../features/settings/SettingsReportDatesPage'
import SettingsTelegramPage from '../features/settings/SettingsTelegramPage'
import TradingDashboardPage from '../features/trading/TradingDashboardPage'
import TradingAccountsPage from '../features/trading/TradingAccountsPage'
import TradingOrdersPage from '../features/trading/TradingOrdersPage'
import TradingFundingPage from '../features/trading/TradingFundingPage'
import TradingLedgerPage from '../features/trading/TradingLedgerPage'
import ProtectedRoute from '../components/auth/ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/',
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/register', element: <RegisterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          
          // Cashflow routes
          { path: 'cashflow', element: <CashflowPage /> },
          { path: 'cashflow/accounts', element: <CashflowAccountsPage /> },
          { path: 'cashflow/categories', element: <CashflowCategoriesPage /> },
          { path: 'cashflow/new', element: <CashflowNewPage /> },
          
          // Debts routes
          { path: 'debts', element: <DebtsPage /> },
          { path: 'debts/new', element: <DebtsNewPage /> },
          { path: 'debts/partners', element: <DebtsPartnersPage /> },
          { path: 'debts/:id', element: <DebtsDetailPage /> },
          
          // Partners routes
          { path: 'partners', element: <PartnersPage /> },
          { path: 'partners/:id', element: <PartnersDetailPage /> },
          
          // Reports routes
          { path: 'reports', element: <ReportsPage /> },
          
          // Settings routes
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/profile', element: <SettingsProfilePage /> },
          { path: 'settings/report-dates', element: <SettingsReportDatesPage /> },
          { path: 'settings/telegram', element: <SettingsTelegramPage /> },
          
          // Trading routes
          { path: 'trading/dashboard', element: <TradingDashboardPage /> },
          { path: 'trading/accounts', element: <TradingAccountsPage /> },
          { path: 'trading/orders', element: <TradingOrdersPage /> },
          { path: 'trading/funding', element: <TradingFundingPage /> },
          { path: 'trading/ledger', element: <TradingLedgerPage /> },
        ],
      },
    ],
  },
])

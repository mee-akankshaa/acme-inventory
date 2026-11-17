import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import ProductCreatePage from './pages/ProductCreatePage'
import ProductEditPage from './pages/ProductEditPage'
import VendorsPage from './pages/VendorsPage'
import VendorCreatePage from './pages/VendorCreatePage'
import VendorDetailPage from './pages/VendorDetailPage'
import VendorEditPage from './pages/VendorEditPage'
import StockInPage from './pages/StockInPage'
import StockOutPage from './pages/StockOutPage'
import StockTransactionsPage from './pages/StockTransactionsPage'
import InventoryPage from './pages/InventoryPage'
import AlertsPage from './pages/AlertsPage'
import AlertSettingsPage from './pages/AlertSettingsPage'
import ReportsPage from './pages/ReportsPage'
import BuyersPage from './pages/BuyersPage'
import BuyerDetailPage from './pages/BuyerDetailPage'
import ProductDetailPage from './pages/ProductDetailPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<ProductCreatePage />} />
            <Route path="/products/:id/edit" element={<ProductEditPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/vendors/new" element={<VendorCreatePage />} />
            <Route path="/vendors/:id" element={<VendorDetailPage />} />
            <Route path="/vendors/:id/edit" element={<VendorEditPage />} />
            <Route path="/stock/in" element={<StockInPage />} />
            <Route path="/stock/out" element={<StockOutPage />} />
            <Route path="/stock/transactions" element={<StockTransactionsPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/settings/alerts" element={<AlertSettingsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/buyers" element={<BuyersPage />} />
            <Route path="/buyers/:id" element={<BuyerDetailPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

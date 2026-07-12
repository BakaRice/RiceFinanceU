import { lazy, Suspense, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { api } from './api/client'
import { getSessionToken } from './api/session'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import AssetsPage from './pages/AssetsPage'
import AssetDetailPage from './pages/AssetDetailPage'
import DcaManagementPage from './pages/DcaManagementPage'
import EntryPage from './pages/EntryPage'
import DataManagementPage from './pages/DataManagementPage'
import ExchangeRatesPage from './pages/ExchangeRatesPage'
import LoginPage from './pages/LoginPage'

const IncomeManagementPage = lazy(() => import('./pages/IncomeManagementPage'))

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getSessionToken()))

  function handleLogin() {
    setIsAuthenticated(true)
  }

  async function handleLogout() {
    await api.logout().catch(() => undefined)
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <Routes>
      <Route element={<Layout onLogout={handleLogout} />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assets/:id" element={<AssetDetailPage />} />
        <Route
          path="/income"
          element={(
            <Suspense fallback={<div className="page-loading">正在加载收入工作表...</div>}>
              <IncomeManagementPage />
            </Suspense>
          )}
        />
        <Route path="/dca" element={<DcaManagementPage />} />
        <Route path="/entry" element={<EntryPage />} />
        <Route path="/data" element={<DataManagementPage />} />
        <Route path="/rates" element={<ExchangeRatesPage />} />
      </Route>
    </Routes>
  )
}

import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { api } from './api/client'
import { getSessionToken } from './api/session'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import AssetsPage from './pages/AssetsPage'
import AssetDetailPage from './pages/AssetDetailPage'
import DcaManagementPage from './pages/DcaManagementPage'
import IncomeManagementPage from './pages/IncomeManagementPage'
import EntryPage from './pages/EntryPage'
import DataManagementPage from './pages/DataManagementPage'
import LoginPage from './pages/LoginPage'

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
        <Route path="/income" element={<IncomeManagementPage />} />
        <Route path="/dca" element={<DcaManagementPage />} />
        <Route path="/entry" element={<EntryPage />} />
        <Route path="/data" element={<DataManagementPage />} />
      </Route>
    </Routes>
  )
}

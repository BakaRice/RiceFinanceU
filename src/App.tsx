import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import AssetsPage from './pages/AssetsPage'
import DepositsPage from './pages/DepositsPage'
import FundsPage from './pages/FundsPage'
import FundDetailPage from './pages/FundDetailPage'
import EntryPage from './pages/EntryPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/deposits" element={<DepositsPage />} />
        <Route path="/funds" element={<FundsPage />} />
        <Route path="/funds/:id" element={<FundDetailPage />} />
        <Route path="/entry" element={<EntryPage />} />
      </Route>
    </Routes>
  )
}

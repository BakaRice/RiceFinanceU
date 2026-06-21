import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import AssetsPage from './pages/AssetsPage'
import EntryPage from './pages/EntryPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/entry" element={<EntryPage />} />
      </Route>
    </Routes>
  )
}

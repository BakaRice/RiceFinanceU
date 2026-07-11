import { NavLink, Outlet } from 'react-router-dom'
import ThemeSelector from './ThemeSelector'
import './Layout.css'

interface LayoutProps {
  onLogout?: () => void
}

const sheetTabs = [
  { to: '/', label: '大盘', end: true },
  { to: '/assets', label: '资产' },
  { to: '/entry', label: '录入' },
  { to: '/income', label: '收入' },
  { to: '/rates', label: '汇率' },
  { to: '/data', label: '数据' },
]

export default function Layout({ onLogout }: LayoutProps) {
  return (
    <div className="workbook-shell" data-testid="financial-workbench">
      <header className="workbook-header">
        <div className="workbook-brand">
          <span className="workbook-mark" aria-hidden="true">RF</span>
          <strong>RiceFinanceU</strong>
        </div>

        <nav className="workbook-tabs" aria-label="工作簿标签">
          {sheetTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => isActive ? 'workbook-tab active' : 'workbook-tab'}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="workbook-account-actions">
          <ThemeSelector variant="sidebar" />
          {onLogout && (
            <button className="workbook-logout" type="button" onClick={onLogout} aria-label="退出登录">
              退出
            </button>
          )}
        </div>
      </header>

      <main className="workbook-content">
        <Outlet />
      </main>
    </div>
  )
}

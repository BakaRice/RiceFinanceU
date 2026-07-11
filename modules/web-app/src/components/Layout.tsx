// src/components/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom'
import './Layout.css'

interface LayoutProps {
  onLogout?: () => void
}

const navItems = [
  {
    to: '/',
    label: '总览',
    icon: <><rect x="4" y="4" width="6" height="7" rx="1" /><rect x="14" y="4" width="6" height="4" rx="1" /><rect x="4" y="15" width="6" height="5" rx="1" /><rect x="14" y="12" width="6" height="8" rx="1" /></>,
  },
  {
    to: '/assets',
    label: '资产管理',
    icon: <><path d="M5 7.5h14v11H5z" /><path d="M8 7.5v-3h8v3M8 12h8M8 15.5h5" /></>,
  },
  {
    to: '/dca',
    label: '定投管理',
    icon: <><path d="M6 12a6 6 0 0 1 10.2-4.3" /><path d="M16.5 4.5v3.8h-3.8" /><path d="M18 12a6 6 0 0 1-10.2 4.3" /><path d="M7.5 19.5v-3.8h3.8" /><path d="M12 9v6M9.8 11.2 12 9l2.2 2.2" /></>,
  },
  {
    to: '/entry',
    label: '快照录入',
    icon: <><path d="M6 4h12v16H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  },
  {
    to: '/data',
    label: '数据管理',
    icon: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  },
]

export default function Layout({ onLogout }: LayoutProps) {
  return (
    <div className="layout">
      <nav className="sidebar" aria-label="主导航">
        <div className="sidebar-brand">
          <span className="sidebar-mark" aria-hidden="true">RF</span>
          <span className="sidebar-brand-copy">
            <strong>Rice Finance</strong>
            <small>资产快照账本</small>
          </span>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                {item.icon}
              </svg>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {onLogout && (
          <div className="sidebar-account">
            <span className="sidebar-account-label">个人账本</span>
            <button className="nav-logout" type="button" onClick={onLogout} aria-label="退出登录">
              退出
            </button>
          </div>
        )}
      </nav>
      <main className="content">
        <div className="content-canvas">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

// src/components/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom'
import './Layout.css'

interface LayoutProps {
  onLogout?: () => void
}

export default function Layout({ onLogout }: LayoutProps) {
  return (
    <div className="layout">
      <nav className="sidebar">
        <h2 className="sidebar-title">资产快照账本</h2>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          总览
        </NavLink>
        <NavLink to="/assets" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          资产管理
        </NavLink>
        <NavLink to="/entry" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          快照录入
        </NavLink>
        <NavLink to="/data" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          数据管理
        </NavLink>
        {onLogout && (
          <button className="nav-logout" type="button" onClick={onLogout}>
            退出
          </button>
        )}
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

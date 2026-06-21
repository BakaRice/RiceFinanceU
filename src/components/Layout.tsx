// src/components/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom'
import './Layout.css'

export default function Layout() {
  return (
    <div className="layout">
      <nav className="sidebar">
        <h2 className="sidebar-title">资产管理</h2>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          总览
        </NavLink>
        <NavLink to="/deposits" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          存款
        </NavLink>
        <NavLink to="/funds" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          基金
        </NavLink>
        <NavLink to="/entry" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          录入
        </NavLink>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

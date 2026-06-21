// src/components/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom'
import './Layout.css'

export default function Layout() {
  return (
    <div className="layout">
      <nav className="sidebar">
        <h2 className="sidebar-title">资产快照账本</h2>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          总览
        </NavLink>
        <NavLink to="/assets" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          资产项
        </NavLink>
        <NavLink to="/entry" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          录入
        </NavLink>
        <hr className="nav-divider" />
        <span className="nav-section-label">旧版（兼容）</span>
        <NavLink to="/deposits" className={({ isActive }) => isActive ? 'nav-item nav-item-old active' : 'nav-item nav-item-old'}>
          存款
        </NavLink>
        <NavLink to="/funds" className={({ isActive }) => isActive ? 'nav-item nav-item-old active' : 'nav-item nav-item-old'}>
          基金
        </NavLink>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

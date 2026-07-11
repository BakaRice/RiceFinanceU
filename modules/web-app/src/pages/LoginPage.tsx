import { useState } from 'react'
import { api } from '../api/client'
import './LoginPage.css'

interface LoginPageProps {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await api.login({ email, password })
      onLogin()
    } catch (e: any) {
      setError(e.message || '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">RF</span>
          <span>
            <strong>Rice Finance</strong>
            <small>PERSONAL LEDGER</small>
          </span>
        </div>
        <div className="login-heading">
          <h1>欢迎回来</h1>
          <p>登录你的资产快照账本</p>
        </div>

        <label className="login-field">
          <span>邮箱</span>
          <input
            type="email"
            value={email}
            autoComplete="username"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="login-field">
          <span>密码</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <div className="login-error" role="alert">{error}</div>}

        <button className="login-submit" type="submit" disabled={submitting}>
          {submitting ? '登录中...' : '登录'}
        </button>
      </form>
    </main>
  )
}

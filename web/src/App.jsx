import { useCallback, useEffect, useState } from 'react'
import { api, getKey, setKey, AuthError } from './api.js'
import Automations from './Automations.jsx'
import Activity from './Activity.jsx'

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getKey()))
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [tab, setTab] = useState('automations')
  const [error, setError] = useState('')

  const handleError = useCallback((err) => {
    if (err instanceof AuthError) {
      setKey('')
      setAuthed(false)
    }
    setError(err.message)
  }, [])

  useEffect(() => {
    if (!authed) return
    api('/accounts')
      .then((list) => {
        setAccounts(list)
        setAccountId((id) => id || list[0]?._id || '')
        setError('')
      })
      .catch(handleError)
  }, [authed, handleError])

  if (!authed) return <KeyLogin error={error} onDone={() => { setError(''); setAuthed(true) }} />

  const account = accounts.find((a) => a._id === accountId)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">💬</span>
          <span>DM Tool</span>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'automations'} onClick={() => setTab('automations')}>Automations</button>
          <button role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>Activity</button>
        </nav>
        <div className="account">
          {accounts.length > 1 ? (
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a._id} value={a._id}>@{a.username}</option>)}
            </select>
          ) : account ? <span className="handle">@{account.username}</span> : null}
          <button className="ghost small" onClick={() => { setKey(''); setAuthed(false) }}>Log out</button>
        </div>
      </header>

      {error && <div className="banner error" role="alert">{error} <button className="ghost small" onClick={() => setError('')}>Dismiss</button></div>}

      <main className="content">
        {!account ? (
          <div className="empty">
            <h2>No Instagram account connected</h2>
            <p>Connect one with <code>POST /api/accounts/connect</code> (see PHASE0-SETUP.md). "Connect Instagram" button comes next.</p>
          </div>
        ) : tab === 'automations' ? (
          <Automations account={account} onError={handleError} />
        ) : (
          <Activity account={account} onError={handleError} />
        )}
      </main>
    </div>
  )
}

function KeyLogin({ error, onDone }) {
  const [value, setValue] = useState('')
  return (
    <div className="login">
      <form
        className="card login-card"
        onSubmit={(e) => {
          e.preventDefault()
          setKey(value.trim())
          onDone()
        }}
      >
        <div className="brand big"><span className="logo" aria-hidden="true">💬</span> DM Tool</div>
        <p className="muted">Enter the <code>ADMIN_API_KEY</code> from your <code>.env</code> file.</p>
        <label className="field">
          <span>Admin key</span>
          <input type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary" disabled={!value.trim()}>Open dashboard</button>
      </form>
    </div>
  )
}

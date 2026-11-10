import { useCallback, useEffect, useState } from 'react'
import { api, getKey, setKey, AuthError } from './api.js'
import Automations from './Automations.jsx'
import Activity from './Activity.jsx'
import Accounts, { Avatar } from './Accounts.jsx'

const SELECTED = 'dmtool.accountId'
const remember = (id) => { try { localStorage.setItem(SELECTED, id) } catch { /* private mode */ } }
const remembered = () => { try { return localStorage.getItem(SELECTED) || '' } catch { return '' } }

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getKey()))
  const [accounts, setAccounts] = useState(null)
  const [accountId, setAccountId] = useState(remembered)
  const [tab, setTab] = useState('automations')
  const [error, setError] = useState('')

  const handleError = useCallback((err) => {
    if (err instanceof AuthError) {
      setKey('')
      setAuthed(false)
    }
    setError(err.message)
  }, [])

  const selectAccount = useCallback((id) => {
    setAccountId(id)
    remember(id)
  }, [])

  // Load accounts; optionally jump to one (e.g. right after adding it).
  const loadAccounts = useCallback((focusId) => {
    return api('/accounts')
      .then((list) => {
        setAccounts(list)
        setError('')
        setAccountId((current) => {
          const next = [focusId, current].find((id) => id && list.some((a) => a._id === id)) || list[0]?._id || ''
          remember(next)
          return next
        })
        if (focusId) setTab('automations')
        if (list.length === 0) setTab('accounts')
      })
      .catch(handleError)
  }, [handleError])

  useEffect(() => {
    if (authed) loadAccounts()
  }, [authed, loadAccounts])

  if (!authed) return <KeyLogin error={error} onDone={() => { setError(''); setAuthed(true) }} />

  const account = accounts?.find((a) => a._id === accountId)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">💬</span>
          <span>DM Tool</span>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'automations'} disabled={!account} onClick={() => setTab('automations')}>Automations</button>
          <button role="tab" aria-selected={tab === 'activity'} disabled={!account} onClick={() => setTab('activity')}>Activity</button>
          <button role="tab" aria-selected={tab === 'accounts'} onClick={() => setTab('accounts')}>Accounts{accounts?.length ? ` (${accounts.length})` : ''}</button>
        </nav>
        <div className="account">
          {account && (
            <label className="switcher">
              <Avatar account={account} size={26} />
              <span className="sr-only">Instagram account</span>
              <select value={accountId} onChange={(e) => selectAccount(e.target.value)}>
                {accounts.map((a) => <option key={a._id} value={a._id}>@{a.username}</option>)}
              </select>
            </label>
          )}
          <button className="ghost small" onClick={() => { setKey(''); setAuthed(false) }}>Log out</button>
        </div>
      </header>

      {error && <div className="banner error" role="alert">{error} <button className="ghost small" onClick={() => setError('')}>Dismiss</button></div>}

      <main className="content">
        {accounts === null ? (
          <p className="muted">Loading…</p>
        ) : tab === 'accounts' || !account ? (
          <Accounts
            accounts={accounts}
            currentId={accountId}
            onSelect={(id) => { selectAccount(id); setTab('automations') }}
            onChanged={loadAccounts}
            onError={handleError}
          />
        ) : tab === 'automations' ? (
          <Automations key={account._id} account={account} onError={handleError} />
        ) : (
          <Activity key={account._id} account={account} onError={handleError} />
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

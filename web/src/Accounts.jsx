import { useEffect, useState } from 'react'
import { api } from './api.js'

export default function Accounts({ accounts, currentId, onSelect, onChanged, onError }) {
  const [adding, setAdding] = useState(accounts.length === 0)

  async function remove(a) {
    const ok = window.confirm(
      `Remove @${a.username}?\n\nThis deletes its ${a.automations} automation(s) and activity log from the tool and stops DMs for it. Your Instagram account itself is not touched. This cannot be undone.`
    )
    if (!ok) return
    try {
      await api(`/accounts/${a._id}`, { method: 'DELETE' })
      onChanged()
    } catch (err) { onError(err) }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Instagram accounts</h1>
          <p className="muted">Each account has its own automations and activity. Switch accounts from the top bar.</p>
        </div>
        {!adding && <button className="primary" onClick={() => setAdding(true)}>+ Add account</button>}
      </div>

      {adding && (
        <AddAccount
          onCancel={accounts.length ? () => setAdding(false) : null}
          onAdded={(id) => { setAdding(false); onChanged(id) }}
        />
      )}

      {accounts.length > 0 && (
        <ul className="account-list">
          {accounts.map((a) => (
            <AccountCard
              key={a._id}
              account={a}
              current={a._id === currentId}
              onOpen={() => onSelect(a._id)}
              onRemove={() => remove(a)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function AccountCard({ account, current, onOpen, onRemove }) {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    let alive = true
    api(`/accounts/${account._id}/health`)
      .then((h) => alive && setHealth(h))
      .catch((err) => alive && setHealth({ ok: false, error: err.message }))
    return () => { alive = false }
  }, [account._id])

  return (
    <li className={`card account-card ${current ? 'current' : ''}`}>
      <Avatar account={account} size={52} />
      <div className="account-main">
        <div className="auto-title">
          <strong>@{account.username}</strong>
          {current && <span className="chip accent">Selected</span>}
        </div>
        {account.name && account.name !== account.username && <div className="muted small">{account.name}</div>}
        <div className="muted small">{account.automations} automation{account.automations === 1 ? '' : 's'} · {account.sent} DMs sent</div>
        <HealthLine health={health} />
      </div>
      <div className="actions">
        {!current && <button className="ghost small" onClick={onOpen}>Open</button>}
        <button className="ghost small danger" onClick={onRemove}>Remove</button>
      </div>
    </li>
  )
}

function HealthLine({ health }) {
  if (!health) return <div className="small muted">Checking connection…</div>
  if (health.ok) return <div className="small"><span className="status good">Connected</span> <span className="muted">comments + messages on</span></div>
  if (!health.tokenOk) return <div className="small"><span className="status bad">Token not working</span> <span className="muted">Generate a new token in Meta and add the account again.</span></div>
  return (
    <div className="small">
      <span className="status wait">Partly connected</span>{' '}
      <span className="muted">Webhooks on: {health.subscribedFields?.join(', ') || 'none'}. Add the account again to fix.</span>
    </div>
  )
}

export function Avatar({ account, size = 28 }) {
  const style = { width: size, height: size }
  return account?.profilePictureUrl
    ? <img className="avatar-img" src={account.profilePictureUrl} alt="" style={style} />
    : <span className="avatar-img placeholder" style={style} aria-hidden="true">{(account?.username || '?')[0].toUpperCase()}</span>
}

function AddAccount({ onCancel, onAdded }) {
  const [igUserId, setIgUserId] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [result, setResult] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      const res = await api('/accounts/connect', { method: 'POST', body: { igUserId: igUserId.trim(), accessToken: token.trim() } })
      setToken('')
      if (res.subscribed) onAdded(res._id)
      else setResult(res)
    } catch (err) {
      setProblem(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="card add-card">
        <h2>@{result.username} was added, but webhooks did not switch on</h2>
        <p className="error-text small">{result.subscribeError}</p>
        <p className="muted small">Turn on "Webhook Subscription" for this account in Meta's Step 2, then open the Accounts page again.</p>
        <button className="primary" onClick={() => onAdded(result._id)}>OK</button>
      </div>
    )
  }

  return (
    <form className="card add-card" onSubmit={submit}>
      <h2>Add an Instagram account</h2>
      <ol className="steps small">
        <li>The account must be a <b>Professional</b> account (Creator or Business).</li>
        <li>Meta app → <b>App roles → Roles → Add People → Instagram Tester</b> → add the username, then accept the invite on instagram.com (Settings → Apps and websites → Tester invites).</li>
        <li>Meta app → <b>Use cases → Customize → API setup with Unified login → 2. Generate access tokens</b> → Add account → <b>Generate token</b>.</li>
        <li>Paste the account ID (the number under the username) and the token below.</li>
      </ol>
      <label className="field">
        <span>Instagram account ID</span>
        <input inputMode="numeric" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} placeholder="1784…" required />
      </label>
      <label className="field">
        <span>Access token</span>
        <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAA…" required />
        <small className="muted">Stored only in your tool's database. Never share it anywhere else.</small>
      </label>
      {problem && <p className="error-text small" role="alert">{problem}</p>}
      <div className="head-actions">
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
        <button className="primary" disabled={busy || !igUserId.trim() || !token.trim()}>{busy ? 'Checking with Meta…' : 'Add account'}</button>
      </div>
    </form>
  )
}

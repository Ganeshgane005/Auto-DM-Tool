import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import Editor from './Editor.jsx'

export default function Automations({ account, onError }) {
  const [items, setItems] = useState(null)
  const [media, setMedia] = useState([])
  const [editing, setEditing] = useState(null) // null | 'new' | automation

  const load = useCallback(() => {
    api(`/automations?accountId=${account._id}`).then(setItems).catch(onError)
  }, [account._id, onError])

  useEffect(() => {
    load()
    api(`/accounts/${account._id}/media`).then(setMedia).catch(() => setMedia([]))
  }, [account._id, load])

  async function toggle(a) {
    try {
      await api(`/automations/${a._id}`, { method: 'PATCH', body: { active: !a.active } })
      load()
    } catch (err) { onError(err) }
  }

  async function remove(a) {
    if (!window.confirm(`Delete "${a.name}"? Its stats are lost. This cannot be undone.`)) return
    try {
      await api(`/automations/${a._id}`, { method: 'DELETE' })
      load()
    } catch (err) { onError(err) }
  }

  if (editing) {
    return (
      <Editor
        account={account}
        media={media}
        automation={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
        onError={onError}
      />
    )
  }

  const totals = (items || []).reduce((t, a) => ({ sent: t.sent + (a.stats?.sent || 0), failed: t.failed + (a.stats?.failed || 0) }), { sent: 0, failed: 0 })

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Automations</h1>
          <p className="muted">When someone comments a keyword, they get a DM.</p>
        </div>
        <button className="primary" onClick={() => setEditing('new')}>+ New automation</button>
      </div>

      <div className="stats-row">
        <Stat label="Automations" value={items ? items.length : '–'} />
        <Stat label="Active" value={items ? items.filter((a) => a.active).length : '–'} />
        <Stat label="DMs sent" value={totals.sent} />
        <Stat label="Failed" value={totals.failed} tone={totals.failed ? 'bad' : ''} />
      </div>

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty card">
          <h2>No automations yet</h2>
          <p className="muted">Create one: pick a keyword like "link", write the DM, done.</p>
          <button className="primary" onClick={() => setEditing('new')}>Create your first automation</button>
        </div>
      ) : (
        <ul className="auto-list">
          {items.map((a) => {
            const post = media.find((m) => m.id === a.mediaId)
            return (
              <li key={a._id} className={`card auto ${a.active ? '' : 'paused'}`}>
                <div className="thumb">
                  {a.mediaId ? (
                    post ? <img src={post.thumbnail_url || post.media_url} alt="" /> : <span>Post</span>
                  ) : <span>Any post</span>}
                </div>
                <div className="auto-main">
                  <div className="auto-title">
                    <strong>{a.name}</strong>
                    {!a.active && <span className="chip">Paused</span>}
                    {a.requireFollow && <span className="chip accent">Followers only</span>}
                  </div>
                  <div className="keywords">
                    {a.keywords.map((k) => <span key={k} className="kw">{k}</span>)}
                    <span className="muted small">{a.matchType === 'exact' ? 'exact match' : 'contains'}</span>
                  </div>
                  <p className="dm-snippet">{a.dmText}</p>
                </div>
                <div className="auto-side">
                  <div className="mini-stats">
                    <span><b>{a.stats?.sent || 0}</b> sent</span>
                    <span className={a.stats?.failed ? 'bad' : ''}><b>{a.stats?.failed || 0}</b> failed</span>
                  </div>
                  <div className="actions">
                    <label className="switch" title={a.active ? 'Pause' : 'Resume'}>
                      <input type="checkbox" checked={a.active} onChange={() => toggle(a)} />
                      <span aria-hidden="true" />
                      <span className="sr-only">Active</span>
                    </label>
                    <button className="ghost small" onClick={() => setEditing(a)}>Edit</button>
                    <button className="ghost small danger" onClick={() => remove(a)}>Delete</button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Stat({ label, value, tone = '' }) {
  return (
    <div className={`card stat ${tone}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

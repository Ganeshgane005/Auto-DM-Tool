import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

const STATUS = {
  sent: { label: 'Link sent', tone: 'good' },
  awaiting_reply: { label: 'Waiting for tap', tone: 'wait' },
  awaiting_follow: { label: 'Asked to follow', tone: 'wait' },
  gave_up: { label: 'Never followed', tone: 'muted' },
  failed: { label: 'Failed', tone: 'bad' },
  pending: { label: 'Processing', tone: 'wait' },
}

export default function Activity({ account, onError }) {
  const [events, setEvents] = useState(null)
  const [names, setNames] = useState({})

  const load = useCallback(() => {
    api(`/events?accountId=${account._id}&limit=100`).then(setEvents).catch(onError)
  }, [account._id, onError])

  useEffect(() => {
    load()
    api(`/automations?accountId=${account._id}`)
      .then((list) => setNames(Object.fromEntries(list.map((a) => [a._id, a.name]))))
      .catch(() => {})
    const timer = setInterval(load, 10000) // refresh every 10 s
    return () => clearInterval(timer)
  }, [account._id, load])

  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Activity</h1>
          <p className="muted">Every matching comment and what happened. Refreshes every 10 seconds.</p>
        </div>
        <button className="ghost" onClick={load}>Refresh</button>
      </div>

      {events === null ? (
        <p className="muted">Loading…</p>
      ) : events.length === 0 ? (
        <div className="empty card"><h2>Nothing yet</h2><p className="muted">When someone comments a keyword, it shows up here.</p></div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>When</th><th>Who</th><th>Comment</th><th>Automation</th><th>Status</th></tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const s = STATUS[e.status] || { label: e.status, tone: '' }
                return (
                  <tr key={e._id}>
                    <td className="nowrap">{timeAgo(e.createdAt)}</td>
                    <td>@{e.commenterUsername || 'unknown'}</td>
                    <td className="comment-cell">{e.commentText}</td>
                    <td>{names[e.automationId] || '—'}</td>
                    <td>
                      <span className={`status ${s.tone}`}>{s.label}</span>
                      {e.followChecks > 0 && <small className="muted"> · asked {e.followChecks}×</small>}
                      {e.error && <div className="error-text small" title={e.error}>{e.error.slice(0, 80)}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function timeAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

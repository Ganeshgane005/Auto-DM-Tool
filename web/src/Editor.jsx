import { useState } from 'react'
import { api, DEFAULTS } from './api.js'

const blank = {
  name: '',
  keywords: [],
  matchType: 'contains',
  mediaId: '',
  dmText: '',
  publicReplies: ['Sent! Check your DMs'],
  requireFollow: false,
  openerText: '',
  buttonLabel: '',
  followText: '',
  followButtonLabel: '',
  active: true,
}

export default function Editor({ account, media, automation, onCancel, onSaved, onError }) {
  const [form, setForm] = useState(() => ({ ...blank, ...(automation || {}) }))
  const [keywordText, setKeywordText] = useState((automation?.keywords || []).join(', '))
  const [repliesText, setRepliesText] = useState((automation?.publicReplies ?? blank.publicReplies).join('\n'))
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  const keywords = keywordText.split(',').map((k) => k.trim()).filter(Boolean)
  const publicReplies = repliesText.split('\n').map((r) => r.trim()).filter(Boolean)

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) return setProblem('Give it a name.')
    if (keywords.length === 0) return setProblem('Add at least one keyword.')
    if (!form.dmText.trim()) return setProblem('Write the DM people will get.')
    setProblem('')
    setSaving(true)
    const body = { ...form, keywords, publicReplies, accountId: account._id }
    try {
      if (automation) await api(`/automations/${automation._id}`, { method: 'PATCH', body })
      else await api('/automations', { method: 'POST', body })
      onSaved()
    } catch (err) {
      onError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="editor" onSubmit={save}>
      <div className="section-head">
        <div>
          <button type="button" className="ghost small back" onClick={onCancel}>← Back</button>
          <h1>{automation ? 'Edit automation' : 'New automation'}</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {problem && <div className="banner error" role="alert">{problem}</div>}

      <div className="editor-grid">
        <div className="editor-form">
          <fieldset className="card">
            <legend>1. Trigger</legend>
            <label className="field">
              <span>Name (only you see this)</span>
              <input value={form.name} onChange={set('name')} placeholder="e.g. Langflow reel" />
            </label>
            <label className="field">
              <span>Keywords (comma separated)</span>
              <input value={keywordText} onChange={(e) => setKeywordText(e.target.value)} placeholder="link, tools, లింక్" />
              <small className="muted">Capital letters don't matter. "Link" matches "link".</small>
            </label>
            <div className="field">
              <span>Match</span>
              <div className="segmented">
                <label><input type="radio" name="match" checked={form.matchType === 'contains'} onChange={() => setForm((f) => ({ ...f, matchType: 'contains' }))} /> Comment contains the keyword</label>
                <label><input type="radio" name="match" checked={form.matchType === 'exact'} onChange={() => setForm((f) => ({ ...f, matchType: 'exact' }))} /> Comment is exactly the keyword</label>
              </div>
            </div>
            <div className="field">
              <span>Which post?</span>
              <div className="post-grid">
                <button type="button" className={`post any ${form.mediaId === '' ? 'selected' : ''}`} onClick={() => setForm((f) => ({ ...f, mediaId: '' }))}>
                  Any post or reel
                </button>
                {media.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={`post ${form.mediaId === m.id ? 'selected' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, mediaId: m.id }))}
                    title={m.caption || m.permalink}
                  >
                    <img src={m.thumbnail_url || m.media_url} alt={m.caption ? m.caption.slice(0, 60) : 'Post'} />
                    {m.media_product_type === 'REELS' && <span className="tag">Reel</span>}
                  </button>
                ))}
              </div>
              {media.length === 0 && <small className="muted">No posts found yet. "Any post" still works.</small>}
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>2. Followers only?</legend>
            <label className="toggle-row">
              <span>
                <strong>Only send the link to followers</strong>
                <small className="muted">They tap a button first; we check they follow @{account.username}. If not, we ask them to follow.</small>
              </span>
              <span className="switch">
                <input type="checkbox" checked={form.requireFollow} onChange={set('requireFollow')} />
                <span aria-hidden="true" />
              </span>
            </label>
            {form.requireFollow && (
              <div className="gate-fields">
                <label className="field">
                  <span>First DM (with a button)</span>
                  <textarea rows="2" value={form.openerText} onChange={set('openerText')} placeholder={DEFAULTS.openerText} />
                </label>
                <label className="field">
                  <span>Button text (max 20)</span>
                  <input maxLength={20} value={form.buttonLabel} onChange={set('buttonLabel')} placeholder={DEFAULTS.buttonLabel} />
                </label>
                <label className="field">
                  <span>"Please follow" message</span>
                  <textarea rows="2" value={form.followText} onChange={set('followText')} placeholder={DEFAULTS.followText} />
                  <small className="muted">{'{username}'} becomes @{account.username}.</small>
                </label>
                <label className="field">
                  <span>Follow button text (max 20)</span>
                  <input maxLength={20} value={form.followButtonLabel} onChange={set('followButtonLabel')} placeholder={DEFAULTS.followButtonLabel} />
                </label>
              </div>
            )}
          </fieldset>

          <fieldset className="card">
            <legend>3. The DM</legend>
            <label className="field">
              <span>Message with your link</span>
              <textarea rows="4" maxLength={1000} value={form.dmText} onChange={set('dmText')} placeholder="Here's the link you asked for: https://…" />
              <small className="muted">{form.dmText.length}/1000</small>
            </label>
            <label className="field">
              <span>Public reply under the comment (one per line, one is picked at random)</span>
              <textarea rows="3" value={repliesText} onChange={(e) => setRepliesText(e.target.value)} placeholder="Sent! Check your DMs" />
              <small className="muted">Leave empty for no public reply. Several variations look less like a bot.</small>
            </label>
          </fieldset>
        </div>

        <aside className="preview card" aria-label="Preview">
          <h3>Preview</h3>
          <div className="phone">
            <div className="comment">
              <span className="avatar" aria-hidden="true" />
              <span><b>someone</b> {keywords[0] || 'link'}</span>
            </div>
            {publicReplies[0] && (
              <div className="comment reply">
                <span className="avatar own" aria-hidden="true" />
                <span><b>{account.username}</b> {publicReplies[0]}</span>
              </div>
            )}
            <div className="chat">
              {form.requireFollow ? (
                <>
                  <Bubble>{form.openerText || DEFAULTS.openerText}</Bubble>
                  <Chip>{form.buttonLabel || DEFAULTS.buttonLabel}</Chip>
                  <Bubble mine>{form.buttonLabel || DEFAULTS.buttonLabel}</Bubble>
                  <p className="chat-note">If they don't follow yet:</p>
                  <Bubble>{(form.followText || DEFAULTS.followText).replace('{username}', account.username)}</Bubble>
                  <Chip>{form.followButtonLabel || DEFAULTS.followButtonLabel}</Chip>
                  <p className="chat-note">Once they follow:</p>
                  <Bubble>{form.dmText || 'Your message with the link'}</Bubble>
                </>
              ) : (
                <Bubble>{form.dmText || 'Your message with the link'}</Bubble>
              )}
            </div>
          </div>
          <p className="muted small">Meta rule: one DM per comment, within 7 days. More messages only after they reply.</p>
        </aside>
      </div>
    </form>
  )
}

const Bubble = ({ children, mine }) => <div className={`bubble ${mine ? 'mine' : ''}`}>{children}</div>
const Chip = ({ children }) => <div className="qr">{children}</div>

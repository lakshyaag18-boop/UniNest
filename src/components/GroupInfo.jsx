import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, Lock, RefreshCw, UserMinus, Users } from 'lucide-react'
import Modal from './Modal'
import {
  listGroupMembers,
  removeGroupMember,
  rotateInviteCode,
  setChatLocked,
  updateGroupDetails,
} from '../lib/store'
import { initials } from '../lib/format'

export default function GroupInfo({ group, userId, displayName, onClose, onGroupUpdate }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState(false)
  const [inviteCode, setInviteCode] = useState(group.invite_code || '')
  const [rotating, setRotating] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  const [name, setName] = useState(group.name || '')
  const [college, setCollege] = useState(group.college || '')
  const [locked, setLocked] = useState(Boolean(group.messages_locked))
  const [savingSettings, setSavingSettings] = useState(false)
  const [togglingLock, setTogglingLock] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    listGroupMembers(group.id)
      .then((rows) => {
        if (active) setMembers(rows)
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load participants.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [group.id])

  const me =
    members.find((member) => (userId ? member.user_id === userId : member.display_name === displayName)) ||
    null
  const isAdmin = Boolean(
    (userId && group.created_by === userId) ||
      me?.role === 'admin' ||
      (me && group.created_by === me.user_id),
  )
  const isCreator = (member) => Boolean(group.created_by && member.user_id === group.created_by)
  const isMe = (member) => (userId ? member.user_id === userId : member.display_name === displayName)

  async function copyCode() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setActionError(`Invite code: ${inviteCode}`)
    }
  }

  async function handleRotate() {
    if (!window.confirm('Generate a new invite code? The current code will stop working.')) return
    setRotating(true)
    setActionError('')
    try {
      const code = await rotateInviteCode(group.id)
      setInviteCode(code)
      setCopied(false)
      onGroupUpdate?.({ invite_code: code })
    } catch (err) {
      setActionError(err.message || 'Could not change the invite code.')
    } finally {
      setRotating(false)
    }
  }

  async function handleRemove(member) {
    if (!window.confirm(`Remove ${member.display_name} from ${group.name}?`)) return
    setRemovingId(member.user_id)
    setActionError('')
    try {
      await removeGroupMember(group.id, member.user_id)
      setMembers((prev) => prev.filter((row) => row.user_id !== member.user_id))
    } catch (err) {
      setActionError(err.message || 'Could not remove that member.')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleSaveDetails(event) {
    event.preventDefault()
    if (!name.trim()) {
      setActionError('Give the group a name.')
      return
    }
    setSavingSettings(true)
    setActionError('')
    try {
      const updated = await updateGroupDetails(group.id, { name, college })
      setName(updated?.name || name.trim())
      setCollege(updated?.college || '')
      onGroupUpdate?.({ name: updated?.name || name.trim(), college: updated?.college || null })
    } catch (err) {
      setActionError(err.message || 'Could not save group settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleToggleLock() {
    const next = !locked
    setTogglingLock(true)
    setActionError('')
    try {
      await setChatLocked(group.id, next)
      setLocked(next)
      onGroupUpdate?.({ messages_locked: next })
    } catch (err) {
      setActionError(err.message || 'Could not change the chat setting.')
    } finally {
      setTogglingLock(false)
    }
  }

  return (
    <Modal title="Group info" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-sage-soft text-lg font-semibold text-sage-dark">
            {initials(group.name)}
          </span>
          <h3 className="mt-3 text-lg font-semibold leading-tight">{group.name}</h3>
          {group.college && <p className="mt-0.5 text-xs text-ink-soft">{group.college}</p>}

          {inviteCode && (
            <div className="mt-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-3 py-1.5 text-[11px] font-medium text-sage-dark transition hover:border-sage/60"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Invite code{' '}
                <span className="font-semibold tracking-[0.2em]">{inviteCode}</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRotate}
                  disabled={rotating}
                  title="Generate a new invite code"
                  aria-label="Generate a new invite code"
                  className="rounded-full border border-line bg-white p-2 text-ink-soft transition hover:border-sage/60 hover:text-sage-dark disabled:opacity-50"
                >
                  {rotating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {actionError && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {actionError}
          </p>
        )}

        <div>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <Users className="size-3.5 text-sage-dark" />
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
              Participants
            </h4>
            {!loading && (
              <span className="rounded-full bg-sage-soft px-1.5 py-0.5 text-[10px] font-semibold text-sage-dark">
                {members.length}
              </span>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-5 text-xs text-ink-soft">
              <Loader2 className="size-4 animate-spin" /> Loading participants…
            </div>
          )}

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {!loading && !error && members.length === 0 && (
            <p className="rounded-2xl bg-cream px-3 py-3 text-center text-xs text-ink-soft">
              No participants yet.
            </p>
          )}

          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {members.map((member) => {
              const admin = member.role === 'admin' || isCreator(member)
              return (
                <li key={member.user_id} className="flex items-center gap-3 bg-white px-3.5 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cream-2 text-[11px] font-semibold text-sage-dark">
                    {initials(member.display_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{member.display_name}</span>
                      {isMe(member) && <span className="text-[11px] text-ink-soft">(you)</span>}
                      {admin && (
                        <span className="shrink-0 rounded-full bg-sage-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sage-dark">
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-ink-soft">
                      {isCreator(member)
                        ? 'Created the group'
                        : admin
                          ? 'Can manage members'
                          : 'Member'}
                    </span>
                  </span>

                  {isAdmin && !isMe(member) && !isCreator(member) && (
                    <button
                      type="button"
                      onClick={() => handleRemove(member)}
                      disabled={removingId === member.user_id}
                      title={`Remove ${member.display_name}`}
                      aria-label={`Remove ${member.display_name}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[10px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {removingId === member.user_id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <UserMinus className="size-3" />
                      )}
                      Remove
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {isAdmin && (
          <div className="space-y-3 border-t border-line pt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
              Admin settings
            </h4>

            <form onSubmit={handleSaveDetails} className="space-y-2">
              <label htmlFor="group-settings-name" className="sr-only">
                Group name
              </label>
              <input
                id="group-settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder="Group name"
                className={inputClass}
              />
              <label htmlFor="group-settings-college" className="sr-only">
                College
              </label>
              <input
                id="group-settings-college"
                value={college}
                onChange={(event) => setCollege(event.target.value)}
                maxLength={60}
                placeholder="College (optional)"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full rounded-2xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-dark disabled:opacity-50"
              >
                {savingSettings ? 'Saving…' : 'Save group details'}
              </button>
            </form>

            <div className="flex items-start justify-between gap-3 rounded-2xl border border-line px-3.5 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Lock className="size-3.5 text-sage-dark" />
                  Only admins can send messages
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
                  Members can still read the chat and their Nest Egg. Admins can turn this off any
                  time.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleLock}
                disabled={togglingLock}
                role="switch"
                aria-checked={locked}
                aria-label="Only admins can send messages"
                className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
                  locked ? 'bg-sage' : 'bg-cream-2'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition ${
                    locked ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] leading-relaxed text-ink-soft">
          {isAdmin
            ? 'You are an admin: you can manage members, group details, the invite code and chat settings.'
            : 'Only group admins can manage the group. Share the invite code to add classmates.'}
        </p>
      </div>
    </Modal>
  )
}

const inputClass =
  'w-full rounded-2xl border border-line bg-cream px-3.5 py-2.5 text-base outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20'

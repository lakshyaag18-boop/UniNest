import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Egg, KeyRound, Loader2, LogOut, Pencil, Plus } from 'lucide-react'
import { Brand } from './Brand'
import Modal from './Modal'
import { createGroup, demoMode, joinGroup } from '../lib/store'
import { initials } from '../lib/format'

export default function Sidebar({
  groups,
  groupsLoading,
  groupsError,
  displayName,
  onGroup,
  onRename,
  onSignOut,
}) {
  const navigate = useNavigate()
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState({ name: '', college: '', code: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState('')

  function openDialog(kind) {
    setForm({ name: '', college: '', code: '' })
    setError('')
    if (kind === 'name') {
      setNewName(displayName)
      setNameError('')
    }
    setDialog(kind)
  }

  function closeDialog() {
    if (busy || nameBusy) return
    setDialog(null)
    setError('')
    setNameError('')
  }

  async function handleCreate(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Give your group a name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const group = await createGroup({ name: form.name, college: form.college })
      onGroup(group)
      setDialog(null)
      navigate(`/g/${group.id}`)
    } catch (err) {
      setError(err.message || 'Could not create that group.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(event) {
    event.preventDefault()
    if (!form.code.trim()) {
      setError('Enter the invite code you were given.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const group = await joinGroup({ code: form.code })
      onGroup(group)
      setDialog(null)
      navigate(`/g/${group.id}`)
    } catch (err) {
      setError(err.message || 'Could not join that group.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRename(event) {
    event.preventDefault()
    if (!newName.trim()) {
      setNameError('Enter a name.')
      return
    }
    setNameBusy(true)
    setNameError('')
    try {
      await onRename(newName.trim())
      setDialog(null)
    } catch (err) {
      setNameError(err.message || 'Could not save your name.')
    } finally {
      setNameBusy(false)
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-4 md:border-b-0 md:pb-2">
        <Brand />
      </div>

      <div className="flex shrink-0 gap-2 px-3 pb-1 pt-3 md:pt-2">
        <button
          type="button"
          onClick={() => openDialog('create')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-sage px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-sage-dark"
        >
          <Plus className="size-4" />
          New group
        </button>
        <button
          type="button"
          onClick={() => openDialog('join')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-line bg-white px-3 py-2.5 text-xs font-semibold text-ink transition hover:border-sage/60"
        >
          <KeyRound className="size-4" />
          Join with code
        </button>
      </div>

      {groupsError && (
        <p className="mx-3 mt-2 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
          {groupsError}
        </p>
      )}

      <p className="shrink-0 px-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
        Your groups
      </p>

      <nav className="scrollbar-slim min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-1">
        {groupsLoading && groups.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-ink-soft">
            <Loader2 className="size-3.5 animate-spin" /> Loading groups…
          </div>
        )}

        {!groupsLoading && groups.length === 0 && (
          <div className="mx-1 rounded-2xl border border-dashed border-line bg-white/50 px-3 py-5 text-center">
            <p className="text-xs font-medium">No groups yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Create one for your class, or join with a code from a friend.
            </p>
          </div>
        )}

        {groups.map((group) => (
          <NavLink
            key={group.id}
            to={`/g/${group.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm transition ${
                isActive ? 'bg-white shadow-sm ring-1 ring-line' : 'hover:bg-white/60'
              }`
            }
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-[11px] font-semibold text-sage-dark">
              {initials(group.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{group.name}</span>
              <span className="block truncate text-[11px] text-ink-soft">
                {group.college || 'Group chat'}
              </span>
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-line px-2 py-2">
        <NavLink
          to="/nest-egg"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-white shadow-sm ring-1 ring-line' : 'hover:bg-white/60'
            }`
          }
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-cream text-sage-dark">
            <Egg className="size-4" />
          </span>
          Nest Egg
        </NavLink>

        <div className="flex items-center gap-2 px-2.5 py-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-sage text-[10px] font-semibold text-white">
            {initials(displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{displayName}</span>
            {demoMode && <span className="block text-[10px] text-ink-soft">Local demo data</span>}
          </span>

          <button
            type="button"
            onClick={() => openDialog('name')}
            title="Change display name"
            aria-label="Change display name"
            className="rounded-full p-1.5 text-ink-soft transition hover:bg-white"
          >
            <Pencil className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-full p-1.5 text-ink-soft transition hover:bg-white"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>

      {dialog === 'create' && (
        <Modal
          title="New group"
          subtitle="You will get a short code to share."
          onClose={closeDialog}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Group name" htmlFor="group-name">
              <input
                id="group-name"
                autoFocus
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={60}
                placeholder="e.g. CS 201 — Section B"
                className={inputClass}
              />
            </Field>
            <Field label="College (optional)" htmlFor="group-college">
              <input
                id="group-college"
                value={form.college}
                onChange={(event) => setForm({ ...form, college: event.target.value })}
                maxLength={60}
                placeholder="e.g. St. Xavier's College"
                className={inputClass}
              />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeDialog}
                className="flex-1 rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-2xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-dark disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialog === 'join' && (
        <Modal
          title="Join a group"
          subtitle="Ask a classmate for the group's invite code."
          onClose={closeDialog}
        >
          <form onSubmit={handleJoin} className="space-y-4">
            <Field label="Invite code" htmlFor="invite-code">
              <input
                id="invite-code"
                autoFocus
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                maxLength={10}
                placeholder="e.g. K7PM2Q"
                autoCapitalize="characters"
                spellCheck={false}
                className={`${inputClass} tracking-[0.25em]`}
              />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeDialog}
                className="flex-1 rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-2xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-dark disabled:opacity-50"
              >
                {busy ? 'Joining…' : 'Join group'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialog === 'name' && (
        <Modal
          title="Display name"
          subtitle="This is what your groups will see."
          onClose={closeDialog}
        >
          <form onSubmit={handleRename} className="space-y-4">
            <Field label="Name" htmlFor="display-name-edit">
              <input
                id="display-name-edit"
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={32}
                className={inputClass}
              />
            </Field>
            {nameError && <p className="text-xs text-red-600">{nameError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeDialog}
                className="flex-1 rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={nameBusy}
                className="flex-1 rounded-2xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-dark disabled:opacity-50"
              >
                {nameBusy ? 'Saving…' : 'Save name'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

const inputClass =
  'w-full rounded-2xl border border-line bg-cream px-3.5 py-2.5 text-base outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20'

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

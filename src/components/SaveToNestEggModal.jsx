import { useMemo, useState } from 'react'
import { Paperclip } from 'lucide-react'
import Modal from './Modal'
import { FOLDERS, saveToNestEgg } from '../lib/store'
import { formatDate } from '../lib/format'

export default function SaveToNestEggModal({ message, group, displayName, onClose, onSaved }) {
  const defaultTitle = useMemo(() => {
    const source = message.body?.trim() || message.file_name || 'Saved item'
    return source.length > 70 ? `${source.slice(0, 67)}…` : source
  }, [message])

  const [folder, setFolder] = useState('Notes')
  const [title, setTitle] = useState(defaultTitle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await saveToNestEgg({
        message,
        group,
        folder,
        title: title.trim() || defaultTitle,
        displayName,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save that item.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Save to Nest Egg"
      subtitle={group?.name ? `From ${group.name}` : undefined}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-2xl bg-cream px-3.5 py-3">
          <p className="text-[11px] text-ink-soft">
            {message.sender_name} · {formatDate(message.created_at)}
          </p>
          {message.body && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm">{message.body}</p>
          )}
          {message.file_name && (
            <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-sage-dark">
              <Paperclip className="size-3.5 shrink-0" />
              <span className="truncate">{message.file_name}</span>
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            Folder
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FOLDERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFolder(option)}
                aria-pressed={folder === option}
                className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                  folder === option
                    ? 'border-sage bg-sage-soft text-sage-dark'
                    : 'border-line bg-white text-ink-soft hover:border-sage/50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="egg-title"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft"
          >
            Title (optional)
          </label>
          <input
            id="egg-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="Short title"
            className="w-full rounded-2xl border border-line bg-cream px-3.5 py-2.5 text-base outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-2xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save to Nest Egg'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

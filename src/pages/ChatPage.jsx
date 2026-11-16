import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bookmark,
  Download,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Send,
  X,
} from 'lucide-react'
import GroupInfo from '../components/GroupInfo'
import SaveToNestEggModal from '../components/SaveToNestEggModal'
import {
  MAX_FILE_BYTES,
  getGroup,
  listMessages,
  sendMessage,
  subscribeMessages,
} from '../lib/store'
import { useFileUrls } from '../lib/useFileUrls'
import { formatBytes, formatDayLabel, formatTime, isImage } from '../lib/format'

export default function ChatPage({ groups, displayName, userId, onGroup }) {
  const { groupId } = useParams()
  const [group, setGroup] = useState(() => groups.find((item) => item.id === groupId) || null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [sending, setSending] = useState(false)
  const [saveTarget, setSaveTarget] = useState(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [toast, setToast] = useState('')

  const fileInputRef = useRef(null)
  const endRef = useRef(null)
  const toastTimer = useRef(null)

  const fileUrls = useFileUrls(messages.map((message) => message.file_path))
  const isAdmin = Boolean(userId && group?.created_by === userId)
  const chatLocked = Boolean(group?.messages_locked) && !isAdmin

  const showToast = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  useEffect(() => {
    if (group) return
    let cancelled = false
    getGroup(groupId)
      .then((found) => {
        if (cancelled || !found) return
        setGroup(found)
        onGroup?.(found)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [groupId, group, onGroup])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setMessages([])

    listMessages(groupId)
      .then((rows) => {
        if (!cancelled) setMessages(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load messages.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsubscribe = subscribeMessages(groupId, (message) => {
      setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [groupId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, loading])

  const groupedByDay = useMemo(() => {
    const days = []
    for (const message of messages) {
      const label = formatDayLabel(message.created_at)
      const current = days[days.length - 1]
      if (current && current.label === label) current.items.push(message)
      else days.push({ label, items: [message] })
    }
    return days
  }, [messages])

  async function handleSend(event) {
    event.preventDefault()
    if (sending) return
    const clean = text.trim()
    if (!clean && !file) return

    setSending(true)
    setError('')
    try {
      const message = await sendMessage({
        groupId,
        senderName: displayName,
        body: clean,
        file,
      })
      setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]))
      setText('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err.message || 'Could not send that message.')
    } finally {
      setSending(false)
    }
  }

  function handleFilePick(event) {
    const picked = event.target.files?.[0] || null
    if (!picked) return
    if (picked.size > MAX_FILE_BYTES) {
      setError('Files must be 10 MB or smaller.')
      event.target.value = ''
      return
    }
    setError('')
    setFile(picked)
  }

  function clearFile() {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-cream/95 px-3 py-2.5 md:px-5">
        <Link
          to="/"
          aria-label="Back to groups"
          className="rounded-full p-2 text-ink-soft transition hover:bg-white md:hidden"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          title="Group info"
          className="min-w-0 flex-1 rounded-2xl px-1 py-1 text-left transition hover:bg-white/70"
        >
          <h1 className="truncate text-[15px] font-semibold">{group?.name || 'Group'}</h1>
          <p className="truncate text-[11px] text-ink-soft">
            {group?.college ? `${group.college} · ` : ''}
            Tap for group info
            {group?.messages_locked ? ' · admin-only chat' : ''}
          </p>
        </button>
      </header>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-6">
        <div className="mx-auto w-full max-w-3xl">
          {loading && <p className="py-6 text-center text-xs text-ink-soft">Loading messages…</p>}

          {!loading && messages.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-line bg-white/60 px-5 py-8 text-center">
              <p className="text-sm font-medium">No messages yet</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                Say hi, or share the invite code{' '}
                <span className="font-semibold tracking-wider text-sage-dark">
                  {group?.invite_code || '—'}
                </span>{' '}
                with your class.
              </p>
            </div>
          )}

          {groupedByDay.map((day) => (
            <div key={day.label}>
              <div className="my-4 flex justify-center">
                <span className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                  {day.label}
                </span>
              </div>
              <div className="space-y-2">
                {day.items.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    mine={
                      message.sender_id
                        ? message.sender_id === userId
                        : message.sender_name === displayName
                    }
                    url={fileUrls[message.file_path] || ''}
                    onSave={() => setSaveTarget(message)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div ref={endRef} className="h-1" />
        </div>
      </div>

      {chatLocked ? (
        <div className="shrink-0 border-t border-line bg-cream px-4 py-4 text-center">
          <Lock className="mx-auto size-4 text-sage-dark" />
          <p className="mt-1.5 text-xs text-ink-soft">
            Chat is locked — only group admins can send messages right now.
          </p>
        </div>
      ) : (
      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-line bg-cream px-3 pb-2.5 pt-2.5 md:px-5"
      >
        <div className="mx-auto w-full max-w-3xl">
          {error && (
            <p className="mb-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {file && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-xs">
              <Paperclip className="size-3.5 shrink-0 text-sage-dark" />
              <span className="min-w-0 flex-1 truncate">
                {file.name} · {formatBytes(file.size)}
              </span>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove attachment"
                className="rounded-full p-1 text-ink-soft transition hover:bg-cream-2"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,image/*"
              onChange={handleFilePick}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach a file"
              title="Attach a file (PDF, image, doc)"
              className="rounded-full border border-line bg-white p-2.5 text-ink-soft transition hover:text-sage-dark"
            >
              <Paperclip className="size-5" />
            </button>

            <textarea
              rows={1}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSend(event)
                }
              }}
              placeholder="Message your group…"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-3 text-base outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
            />

            <button
              type="submit"
              disabled={sending || (!text.trim() && !file)}
              aria-label="Send message"
              className="rounded-full bg-sage p-2.5 text-white transition hover:bg-sage-dark disabled:opacity-40"
            >
              {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
            </button>
          </div>
          <p className="mt-1.5 hidden text-center text-[10px] text-ink-soft sm:block">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </form>
      )}

      {saveTarget && (
        <SaveToNestEggModal
          message={saveTarget}
          group={group}
          displayName={displayName}
          onClose={() => setSaveTarget(null)}
          onSaved={() => showToast('Saved to your Nest Egg')}
        />
      )}

      {infoOpen && group && (
        <GroupInfo
          group={group}
          userId={userId}
          displayName={displayName}
          onClose={() => setInfoOpen(false)}
          onGroupUpdate={(patch) => {
            setGroup((prev) => (prev ? { ...prev, ...patch } : prev))
            if (group) onGroup?.({ ...group, ...patch })
          }}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message, mine, url, onSave }) {
  const imageAttachment = Boolean(message.file_path && isImage(message.file_type) && url)

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[87%] rounded-3xl px-3.5 py-2.5 sm:max-w-[75%] ${
          mine
            ? 'rounded-br-lg bg-sage text-white'
            : 'rounded-bl-lg border border-line bg-white text-ink'
        }`}
      >
        {!mine && (
          <p className="mb-1 text-[11px] font-semibold text-sage-dark">{message.sender_name}</p>
        )}

        {message.body && (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {message.body}
          </p>
        )}

        {imageAttachment ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block overflow-hidden rounded-2xl"
          >
            <img
              src={url}
              alt={message.file_name || 'Shared image'}
              loading="lazy"
              className="max-h-64 w-full object-cover"
            />
          </a>
        ) : message.file_path ? (
          <a
            href={url || undefined}
            target="_blank"
            rel="noreferrer"
            download={message.file_name}
            className={`mt-1.5 flex items-center gap-2.5 rounded-2xl px-3 py-2 transition ${
              mine ? 'bg-white/15 hover:bg-white/25' : 'bg-cream hover:bg-cream-2'
            }`}
          >
            <FileText className="size-5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
                {message.file_name || 'File'}
              </span>
              <span className={`block text-[10px] ${mine ? 'text-white/70' : 'text-ink-soft'}`}>
                {formatBytes(message.file_size)} · tap to open
              </span>
            </span>
            <Download className="size-4 shrink-0 opacity-70" />
          </a>
        ) : null}

        <div
          className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${
            mine ? 'text-white/75' : 'text-ink-soft'
          }`}
        >
          <span>{formatTime(message.created_at)}</span>
          <button
            type="button"
            onClick={onSave}
            title="Save to Nest Egg"
            aria-label="Save to Nest Egg"
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition ${
              mine ? 'hover:bg-white/20' : 'hover:bg-cream-2'
            }`}
          >
            <Bookmark className="size-3.5" />
            <span className="font-medium">Save to Nest Egg</span>
          </button>
        </div>
      </div>
    </div>
  )
}

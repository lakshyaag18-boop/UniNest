import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Eye, FileText, Loader2, Search, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import { FOLDERS, deleteNestEggItem, listNestEgg } from '../lib/store'
import { useFileUrls } from '../lib/useFileUrls'
import { formatDate } from '../lib/format'

export default function NestEggPage({ displayName }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [folderFilter, setFolderFilter] = useState('All')
  const [openItem, setOpenItem] = useState(null)

  const fileUrls = useFileUrls(items.map((item) => item.file_path))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listNestEgg(displayName))
    } catch (err) {
      setError(err.message || 'Could not load your saved items.')
    } finally {
      setLoading(false)
    }
  }, [displayName])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return items
    return items.filter((item) =>
      [item.title, item.body, item.group_name, item.file_name, item.sender_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    )
  }, [items, query])

  const visible = useMemo(
    () =>
      folderFilter === 'All'
        ? filtered
        : filtered.filter((item) => item.folder === folderFilter),
    [filtered, folderFilter],
  )

  const sections = useMemo(
    () =>
      FOLDERS.map((folder) => ({
        folder,
        items: visible.filter((item) => item.folder === folder),
      })).filter((section) => section.items.length > 0),
    [visible],
  )

  async function handleRemove(item) {
    if (!window.confirm(`Remove "${item.title}" from your Nest Egg?`)) return
    setError('')
    try {
      await deleteNestEggItem(item.id)
      setItems((prev) => prev.filter((entry) => entry.id !== item.id))
      setOpenItem(null)
    } catch (err) {
      setError(err.message || 'Could not remove that item.')
    }
  }

  function handleOpen(item) {
    if (item.body) {
      setOpenItem(item)
      return
    }
    const url = fileUrls[item.file_path]
    if (url) window.open(url, '_blank', 'noreferrer')
  }

  function handleDownload(item) {
    const url = fileUrls[item.file_path]
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = item.file_name || 'uninest-file'
    link.target = '_blank'
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const emptyMessage = query.trim()
    ? `No saved items match “${query.trim()}”.`
    : folderFilter === 'All'
      ? 'Nothing saved yet. Tap “Save to Nest Egg” on any message to keep it here.'
      : `Nothing saved in ${folderFilter} yet.`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-line bg-cream/95 px-3 py-3 md:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              aria-label="Back to groups"
              className="rounded-full p-2 text-ink-soft transition hover:bg-white md:hidden"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold leading-tight">Nest Egg</h1>
              <p className="text-[11px] text-ink-soft">
                Everything you saved from your groups, in one place.
              </p>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved notes, files, groups…"
              className="w-full rounded-2xl border border-line bg-white py-2.5 pl-10 pr-4 text-base outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
            />
          </div>

          <div className="scrollbar-slim mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {['All', ...FOLDERS].map((folder) => {
              const count =
                folder === 'All'
                  ? items.length
                  : items.filter((item) => item.folder === folder).length
              const active = folderFilter === folder
              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setFolderFilter(folder)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? 'border-sage bg-sage-soft text-sage-dark'
                      : 'border-line bg-white text-ink-soft hover:border-sage/50'
                  }`}
                >
                  {folder}
                  <span className="ml-1 opacity-60">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
              {error}
            </p>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-ink-soft">
              <Loader2 className="size-4 animate-spin" /> Loading your nest…
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line bg-white/60 px-5 py-10 text-center">
              <p className="text-sm font-medium">Your nest is empty</p>
              <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-soft">
                {emptyMessage}
              </p>
            </div>
          )}

          {sections.map((section) => (
            <section key={section.folder}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
                  {section.folder}
                </h2>
                <span className="rounded-full bg-sage-soft px-1.5 py-0.5 text-[10px] font-semibold text-sage-dark">
                  {section.items.length}
                </span>
              </div>

              <div className="space-y-2">
                {section.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-line bg-white p-3.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                        <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                          {item.group_name || 'Group'} ·{' '}
                          {formatDate(item.source_created_at || item.created_at)}
                          {item.sender_name ? ` · from ${item.sender_name}` : ''}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5">
                        {(item.body || item.file_path) && (
                          <button
                            type="button"
                            onClick={() => handleOpen(item)}
                            title="Open"
                            aria-label={`Open ${item.title}`}
                            className="rounded-full p-1.5 text-ink-soft transition hover:bg-cream-2 hover:text-sage-dark"
                          >
                            <Eye className="size-4" />
                          </button>
                        )}
                        {item.file_path && (
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            title="Download"
                            aria-label={`Download ${item.title}`}
                            className="rounded-full p-1.5 text-ink-soft transition hover:bg-cream-2 hover:text-sage-dark"
                          >
                            <Download className="size-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(item)}
                          title="Remove"
                          aria-label={`Remove ${item.title}`}
                          className="rounded-full p-1.5 text-ink-soft transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    {item.body && (
                      <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap break-words text-sm text-ink-soft">
                        {item.body}
                      </p>
                    )}

                    {item.file_name && (
                      <button
                        type="button"
                        onClick={() => handleOpen(item)}
                        className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-xl bg-cream px-2.5 py-1.5 text-[11px] font-medium text-sage-dark transition hover:bg-cream-2"
                      >
                        <FileText className="size-3.5 shrink-0" />
                        <span className="truncate">{item.file_name}</span>
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {openItem && (
        <Modal
          title={openItem.title}
          subtitle={`${openItem.group_name || 'Group'} · ${formatDate(
            openItem.source_created_at || openItem.created_at,
          )}`}
          onClose={() => setOpenItem(null)}
          wide
        >
          <div className="space-y-4">
            {openItem.sender_name && (
              <p className="text-xs text-ink-soft">Saved from a message by {openItem.sender_name}</p>
            )}
            {openItem.body && (
              <p className="whitespace-pre-wrap break-words rounded-2xl bg-cream px-4 py-3 text-sm leading-relaxed">
                {openItem.body}
              </p>
            )}
            {openItem.file_name && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-line px-3.5 py-3">
                <FileText className="size-5 shrink-0 text-sage-dark" />
                <span className="min-w-0 flex-1 truncate text-sm">{openItem.file_name}</span>
                <button
                  type="button"
                  onClick={() => handleDownload(openItem)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sage px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sage-dark"
                >
                  <Download className="size-3.5" /> Download
                </button>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-3">
              <button
                type="button"
                onClick={() => handleRemove(openItem)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline"
              >
                <Trash2 className="size-3.5" /> Remove from Nest Egg
              </button>
              <span className="text-[10px] uppercase tracking-wide text-ink-soft">
                {openItem.folder}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

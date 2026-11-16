import { demoMode } from '../lib/store'

export default function Footer() {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-line bg-cream px-3 py-2 text-center text-[11px] text-ink-soft">
      <span>Prototype for college groups.</span>
      {demoMode && (
        <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-medium text-sage-dark">
          Demo mode · add Supabase keys for live chat
        </span>
      )}
    </footer>
  )
}

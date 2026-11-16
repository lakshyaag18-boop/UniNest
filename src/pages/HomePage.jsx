import { Egg } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl border border-line bg-white">
        <Egg className="size-7 text-sage" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Pick a group to start chatting</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
        Create a group and share its invite code, or join one with a code from a classmate.
        Anything worth keeping goes in your Nest Egg.
      </p>
    </div>
  )
}

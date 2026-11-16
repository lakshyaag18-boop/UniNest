export function Logo({ className = 'size-10' }) {
  return (
    <div
      className={`${className} flex items-center justify-center rounded-[30%] bg-sage text-white shadow-sm`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="size-[58%]" fill="none">
        <ellipse cx="50" cy="56" rx="25" ry="31" fill="currentColor" />
        <path
          d="M28 40c8-14 20-21 22-21s14 7 22 21"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export function Brand({ subtitle = true }) {
  return (
    <div className="flex items-center gap-3">
      <Logo className="size-10" />
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight tracking-tight">UniNest</p>
        {subtitle && <p className="truncate text-[11px] text-ink-soft">Chat together. Keep what matters.</p>}
      </div>
    </div>
  )
}

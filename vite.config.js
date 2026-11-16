import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  // Extra hostnames the dev server may answer for (comma separated). Cloud
  // previews use a per-VM hostname, passed in at start-up rather than committed.
  const allowedHosts = (process.env.DEV_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
    },
  }
})

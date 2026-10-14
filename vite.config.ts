import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The deploy workflow sets these; local and CI test builds show "dev".
const run = process.env.GITHUB_RUN_NUMBER
const sha = (process.env.GITHUB_SHA ?? '').slice(0, 7)
const version = run ? `v${run}${sha ? ` · ${sha}` : ''}` : 'dev'

// Served from https://<user>.github.io/workout-tracker/ on GitHub Pages.
export default defineConfig({
  base: '/workout-tracker/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
})

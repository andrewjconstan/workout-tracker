import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/workout-tracker/ on GitHub Pages.
export default defineConfig({
  base: '/workout-tracker/',
  plugins: [react()],
})

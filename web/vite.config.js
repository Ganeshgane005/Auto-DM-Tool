import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development (`npm run dev` here), API calls go to the Express server on :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
})

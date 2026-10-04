import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/AdventCalendar/',
  plugins: [react()],
  build: {
    // The scene is a lazy chunk holding all of three.js (~930 kB), fetched only
    // in the last minute of the countdown. The *initial* payload is ~246 kB, so
    // the default 500 kB warning now only ever fires for that lazy chunk, which
    // cannot get smaller without dropping three.js. Raise the limit to just above
    // it so a genuine regression in the main chunk is still the thing that warns.
    chunkSizeWarningLimit: 1000,
  },
})

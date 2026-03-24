import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),

    // ── Fix: serve firebase-messaging-sw.js with correct MIME type ────────────
    // Vite's dev server returns its HTML shell for any file it doesn't own.
    // This middleware intercepts the SW request first and serves the real file.
    {
      name: 'service-worker-mime-fix',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/firebase-messaging-sw.js') {
            const file    = path.resolve(__dirname, 'public/firebase-messaging-sw.js')
            const content = fs.readFileSync(file, 'utf-8')
            res.setHeader('Content-Type', 'application/javascript')
            res.setHeader('Service-Worker-Allowed', '/')
            res.statusCode = 200
            res.end(content)
            return // do NOT call next() — we handled it
          }
          next()
        })
      },
    },
  ],
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const WHITEBOARDS_DIR = path.resolve(__dirname, 'public/whiteboards')

function saveWhiteboardPlugin() {
  return {
    name: 'save-whiteboard',
    configureServer(server) {
      server.middlewares.use('/api/whiteboards', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const { filename, dataUrl, strokes } = JSON.parse(body)
            const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
            const safeName = String(filename).replace(/[^a-zA-Z0-9_-]/g, '') || 'whiteboard'

            fs.mkdirSync(WHITEBOARDS_DIR, { recursive: true })
            fs.writeFileSync(path.join(WHITEBOARDS_DIR, `${safeName}.png`), base64, 'base64')
            fs.writeFileSync(
              path.join(WHITEBOARDS_DIR, `${safeName}.json`),
              JSON.stringify(strokes ?? [])
            )

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: err.message }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveWhiteboardPlugin()],
})

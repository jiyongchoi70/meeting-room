import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'favicon-ico-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/favicon.ico') {
            const svgPath = path.join(server.config.root, 'public', 'favicon.svg')
            if (fs.existsSync(svgPath)) {
              res.setHeader('Content-Type', 'image/svg+xml')
              fs.createReadStream(svgPath).pipe(res)
              return
            }
          }
          next()
        })
      },
    },
  ],
})

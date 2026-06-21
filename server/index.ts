import express from 'express'
import { ensureDataDir } from './storage'
import { dataRoutes } from './routes/dataRoutes'
import { importExportRoutes } from './routes/importExportRoutes'

const app = express()
const PORT = 3001

app.use(express.json({ limit: '10mb' }))

// Ensure data directory and files exist on startup
ensureDataDir()

// Routes
app.use('/api', dataRoutes)
app.use('/api', importExportRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`)
})

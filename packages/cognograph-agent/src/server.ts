import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { createSession, destroySession, resizeSession, destroyAll } from './pty'

const PORT = 19836
const CORS_ORIGINS = ['https://cognograph.app', 'https://canvas.cognograph.app', 'http://localhost:5173']

export function startServer() {
  const httpServer = createServer((req, res) => {
    // CORS headers
    const origin = req.headers.origin || ''
    if (CORS_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET')

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', agent: 'cognograph-agent', version: '0.1.0' }))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  const wss = new WebSocketServer({ server: httpServer, path: '/terminal' })

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url!, `http://localhost:${PORT}`)
    const sessionId = url.searchParams.get('session') || crypto.randomUUID()

    const session = createSession(sessionId)

    // PTY -> WebSocket
    session.process.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    session.process.onExit(({ exitCode }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', exitCode }))
        ws.close()
      }
    })

    // WebSocket -> PTY
    ws.on('message', (data: Buffer | string) => {
      const str = data.toString()
      try {
        const msg = JSON.parse(str)
        if (msg.type === 'resize') resizeSession(sessionId, msg.cols, msg.rows)
      } catch {
        // Raw terminal input
        session.process.write(str)
      }
    })

    ws.on('close', () => destroySession(sessionId))
  })

  httpServer.listen(PORT, () => {
    console.log(`[cognograph-agent] Local terminal agent running on localhost:${PORT}`)
    console.log(`[cognograph-agent] Canvas will auto-detect this agent on page load`)
  })

  process.on('SIGINT', () => { destroyAll(); process.exit(0) })
  process.on('SIGTERM', () => { destroyAll(); process.exit(0) })
}

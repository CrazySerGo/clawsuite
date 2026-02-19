import { createServer } from 'node:http'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import server from './dist/server/server.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLIENT_DIR = join(__dirname, 'dist', 'client')

const port = parseInt(process.env.PORT || '3000', 10)
const host = process.env.HOST || '0.0.0.0'

const MIME_TYPES = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
}

async function tryServeStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = decodeURIComponent(url.pathname)

  // Prevent directory traversal
  if (pathname.includes('..')) return false

  const filePath = join(CLIENT_DIR, pathname)

  // Make sure the resolved path is within CLIENT_DIR
  if (!filePath.startsWith(CLIENT_DIR)) return false

  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) return false

    const ext = extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const data = await readFile(filePath)

    const headers = {
      'Content-Type': contentType,
      'Content-Length': data.length,
    }

    // Cache hashed assets aggressively (they have content hashes in filenames)
    if (pathname.startsWith('/assets/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    }

    res.writeHead(200, headers)
    res.end(data)
    return true
  } catch {
    return false
  }
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`,
  )

  if (process.env.DEBUG_PROXY) {
    console.log(`[proxy] ${req.method} ${url.pathname}${url.search} (Host: ${req.headers.host})`)
  }

  // 1. Gateway UI Proxy
  if (url.pathname.startsWith('/gateway-ui')) {
    const gatewayUrl = process.env.CLAWDBOT_GATEWAY_URL || 'ws://127.0.0.1:18789'
    let target = 'http://127.0.0.1:18789'
    try {
      const gUrl = new URL(gatewayUrl)
      gUrl.protocol = gUrl.protocol === 'wss:' ? 'https:' : 'http:'
      gUrl.pathname = ''
      target = gUrl.toString().replace(/\/$/, '')
    } catch {}

    const proxyPath = url.pathname.replace(/^\/gateway-ui/, '') || '/'
    const targetUrl = new URL(proxyPath + url.search, target)

    const transport = target.startsWith('https') ? https : http
    const headers = { ...req.headers }
    delete headers['connection']
    delete headers['keep-alive']
    delete headers['proxy-connection']
    delete headers['transfer-encoding']
    delete headers['te']
    delete headers['upgrade']

    const proxyReq = transport.request(
      targetUrl,
      {
        method: req.method,
        headers: {
          ...headers,
          host: targetUrl.host,
          origin: targetUrl.origin,
          referer: targetUrl.origin + '/',
        },
      },
      (proxyRes) => {
        // Strip iframe-blocking headers so we can embed
        const headers = { ...proxyRes.headers }
        delete headers['x-frame-options']
        delete headers['content-security-policy']
        res.writeHead(proxyRes.statusCode, headers)
        proxyRes.pipe(res)
      }
    )
    proxyReq.on('error', (err) => {
      res.writeHead(502)
      res.end(`Gateway Proxy Error: ${err.message}`)
    })
    req.pipe(proxyReq)
    return
  }

  // 2. Browser Proxy Internal (9222)
  if (url.pathname.startsWith('/api/browser-proxy-internal')) {
    const target = 'http://127.0.0.1:9222'
    const proxyPath = url.pathname.replace(/^\/api\/browser-proxy-internal/, '') || '/'
    const targetUrl = new URL(proxyPath + url.search, target)

    const headers = { ...req.headers }
    delete headers['connection']
    delete headers['keep-alive']
    delete headers['proxy-connection']
    delete headers['transfer-encoding']
    delete headers['te']
    delete headers['upgrade']

    const proxyReq = http.request(
      targetUrl,
      {
        method: req.method,
        headers: {
          ...headers,
          host: targetUrl.host,
          origin: targetUrl.origin,
          referer: targetUrl.origin + '/',
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      },
    )
    proxyReq.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            ok: false,
            error: 'Browser proxy service not running',
          }),
        )
        return
      }
      res.writeHead(502)
      res.end(`Browser Proxy Error: ${err.message}`)
    })
    req.pipe(proxyReq)
    return
  }

  // 3. Browser Stream Internal (9223) - HTTP part
  if (url.pathname.startsWith('/api/browser-stream-internal')) {
    const target = 'http://127.0.0.1:9223'
    const proxyPath = url.pathname.replace(/^\/api\/browser-stream-internal/, '') || '/'
    const targetUrl = new URL(proxyPath + url.search, target)

    const headers = { ...req.headers }
    delete headers['connection']
    delete headers['keep-alive']
    delete headers['proxy-connection']
    delete headers['transfer-encoding']
    delete headers['te']
    delete headers['upgrade']

    const proxyReq = http.request(
      targetUrl,
      {
        method: req.method,
        headers: {
          ...headers,
          host: targetUrl.host,
          origin: targetUrl.origin,
          referer: targetUrl.origin + '/',
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      },
    )
    proxyReq.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            running: false,
            error: 'Browser stream service not running',
          }),
        )
        return
      }
      res.writeHead(502)
      res.end(`Browser Stream Error: ${err.message}`)
    })
    req.pipe(proxyReq)
    return
  }

  // Try static files first (client assets)
  if (req.method === 'GET' || req.method === 'HEAD') {
    const served = await tryServeStatic(req, res)
    if (served) return
  }

  // Fall through to SSR handler
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }

  let body = null
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }

  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body,
    duplex: 'half',
  })

  try {
    const response = await server.fetch(request)

    res.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries()),
    )

    if (response.body) {
      const reader = response.body.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
        res.end()
      }
      pump().catch((err) => {
        console.error('Stream error:', err)
        res.end()
      })
    } else {
      const text = await response.text()
      res.end(text)
    }
  } catch (err) {
    console.error('Request error:', err)
    res.writeHead(500)
    res.end('Internal Server Error')
  }
})

// 4. WebSocket Proxy
httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`,
  )

  if (url.pathname.startsWith('/api/browser-stream-internal')) {
    const targetPort = 9223
    const targetHost = '127.0.0.1'
    const proxyPath =
      req.url.replace(/^\/api\/browser-stream-internal/, '') || '/'

    const proxySocket = net.createConnection(targetPort, targetHost, () => {
      // Manual WebSocket upgrade proxy
      const headers = { ...req.headers, host: `${targetHost}:${targetPort}` }
      proxySocket.write(
        `${req.method} ${proxyPath} HTTP/${req.httpVersion}\r\n` +
          Object.entries(headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n') +
          '\r\n\r\n',
      )
      proxySocket.write(head)
      proxySocket.pipe(socket).pipe(proxySocket)
    })
    proxySocket.on('error', () => {
      socket.destroy()
    })
    return
  }

  // Gateway UI WebSocket proxy
  if (url.pathname.startsWith('/gateway-ui')) {
    const gatewayUrl =
      process.env.CLAWDBOT_GATEWAY_URL || 'ws://127.0.0.1:18789'
    let targetPort = 18789
    let targetHost = '127.0.0.1'
    try {
      const gUrl = new URL(gatewayUrl)
      targetPort = parseInt(gUrl.port, 10) || 18789
      targetHost = gUrl.hostname || '127.0.0.1'
    } catch {}

    const proxyPath = req.url.replace(/^\/gateway-ui/, '') || '/'

    const proxySocket = net.createConnection(targetPort, targetHost, () => {
      const headers = { ...req.headers, host: `${targetHost}:${targetPort}` }
      proxySocket.write(
        `${req.method} ${proxyPath} HTTP/${req.httpVersion}\r\n` +
          Object.entries(headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n') +
          '\r\n\r\n',
      )
      proxySocket.write(head)
      proxySocket.pipe(socket).pipe(proxySocket)
    })
    proxySocket.on('error', () => {
      socket.destroy()
    })
    return
  }

  // Fallback for Nitro/TanStack Start's own WebSockets if any
  // (Currently they don't seem to use any standard ones we need to proxy here)
})

httpServer.listen(port, host, () => {
  console.log(`ClawSuite running at http://${host}:${port}`)
})

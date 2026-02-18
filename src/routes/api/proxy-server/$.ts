import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/proxy-server/$')({
  server: {
    handlers: {
      ALL: async ({ request, params }) => {
        try {
          const targetPath = params._
          const url = new URL(request.url)
          const targetUrl = new URL(targetPath + url.search, 'http://localhost:9222')

          const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer()

          const res = await fetch(targetUrl.toString(), {
            method: request.method,
            headers: request.headers,
            body,
            redirect: 'manual',
          })

          return new Response(res.body, {
            status: res.status,
            headers: {
              ...Object.fromEntries(res.headers.entries()),
              'Access-Control-Allow-Origin': '*',
            },
          })
        } catch (err) {
          return new Response(JSON.stringify({ error: String(err) }), { status: 502 })
        }
      },
    },
  },
})

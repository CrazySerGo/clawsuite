import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/stream-proxy')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const res = await fetch('http://127.0.0.1:9223', {
            method: 'GET',
            headers: request.headers,
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
      POST: async ({ request }) => {
        try {
          const body = await request.arrayBuffer()
          const res = await fetch('http://127.0.0.1:9223', {
            method: 'POST',
            headers: request.headers,
            body,
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

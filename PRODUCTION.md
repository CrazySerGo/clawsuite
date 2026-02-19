# ClawSuite Production Guide

ClawSuite is built using TanStack Start and Nitro. It can be deployed as a standalone Node.js server.

## Building for Production

To build the application, run:

```bash
npm run build
```

This will generate the production build in the `.output` directory.

## Running in Production

To start the production server:

```bash
npm run start
```

By default, the server will listen on port 3000. You can change this using the `PORT` environment variable.

## Configuration

ClawSuite requires a connection to an OpenClaw Gateway. Configure this using environment variables:

- `CLAWDBOT_GATEWAY_URL`: WebSocket URL of your OpenClaw gateway (e.g., `ws://127.0.0.1:18789`).
- `CLAWDBOT_GATEWAY_TOKEN`: (Recommended) Authentication token for the gateway.
- `CLAWDBOT_GATEWAY_PASSWORD`: (Fallback) Authentication password for the gateway.

If both token and password are missing, ClawSuite will prompt you to configure them on first launch.

### Environment Variables

You can create a `.env` file in the root directory to store these values:

```bash
PORT=3000
CLAWDBOT_GATEWAY_URL=ws://127.0.0.1:18789
CLAWDBOT_GATEWAY_TOKEN=your_token_here
```

## Troubleshooting

### Terminal Shell
If the terminal fails to start, ensure that `/bin/bash` or `/bin/sh` is available on your system. You can also set the `SHELL` environment variable to your preferred shell path.

### 500 Internal Server Error
If you encounter 500 errors when accessing the API, check the server console logs. Common causes include:
- Incorrect `CLAWDBOT_GATEWAY_URL`.
- Missing or incorrect gateway credentials.
- Gateway process not running.

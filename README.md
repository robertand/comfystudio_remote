# ComfyStudio

AI-Powered Animatic Studio for Pre-Production. Edit storyboards, generate video clips, and produce animatics — powered by ComfyUI.

## Prerequisites

- **Node.js** 18+ and **npm**
- A running **ComfyUI** instance (default: `http://127.0.0.1:8188`)

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app connects to ComfyUI at `127.0.0.1:8188` by default.

### ComfyUI Over Proxy

If ComfyUI runs on a remote server behind Cloudflare Tunnel (or any HTTPS proxy), the app auto-detects and routes all requests through the Vite dev server to avoid mixed-content and CORS issues.

1. Open **Settings → ComfyUI Servers**
2. Add a remote server (e.g. `https://your-tunnel.trycloudflare.com`)
3. Configure auth if needed (Basic, Bearer, Cloudflare Access, or custom header)
4. Set it as active

The iframe loads ComfyUI through `/comfy/` on the same origin, and all API calls are proxied accordingly.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_COMFY_URL` | `http://127.0.0.1:8188` | Default ComfyUI target |
| `ELECTRON` | `false` | Set to `true` for Electron builds |

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file server.

## License

MIT

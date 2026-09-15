# Linux VNC Console

A browser front-end for a Linux desktop, built on [noVNC](https://novnc.com/info.html).
noVNC 1.7.0 is vendored in `web/vendor/novnc`, so the site works with no build
step and no CDN.

Two ways to run it:

- **`web/`** — a static site you serve yourself (or let `websockify` serve).
- **`apps-script/`** — the same console deployed on `script.google.com`, behind
  Google sign-in.

## How the pieces fit

A browser cannot open a raw TCP socket, so noVNC speaks RFB over a WebSocket.
`websockify` translates between the two:

```
browser ──ws(s)://──> websockify :6080 ──TCP──> VNC server :5901 ──> your desktop
```

`websockify` can also serve the static files, so one port covers both.

## Quick start on Linux

```bash
cd vnc
./server/setup-vnc-linux.sh install      # VNC server + websockify + a desktop
./server/setup-vnc-linux.sh start        # session on :1, console on :6080
```

It prints the URL to open. Add `--tls` for `wss://` (required if the page is
served over HTTPS — including from Apps Script):

```bash
./server/setup-vnc-linux.sh start --tls
```

Other options:

| Command | Effect |
| --- | --- |
| `start --attach` | Share the X display already on screen, via `x11vnc`, instead of a new session |
| `start --geometry 1920x1080` | Session size |
| `start --display 2 --web-port 6081` | Run a second session alongside the first |
| `start --no-web` | Bridge the socket only; serve `web/` yourself |
| `start --cert c.pem --key k.pem` | Use a real certificate instead of a generated self-signed one |
| `status` / `stop` | Check or tear down |

The first `start` asks for a VNC password and stores it in `~/.vnc/passwd`. The
raw VNC port is bound to localhost, so only `websockify` can reach it.

### Serving `web/` on its own

```bash
./server/serve-web.sh 8080
```

The page loads noVNC as ES modules, which browsers refuse over `file://` — it
has to come from an HTTP server. Open `http://localhost:8080/`, then point the
host/port fields at wherever `websockify` is listening.

## The console

- Connection settings with a live WebSocket-URL preview
- Password and username prompts, including credentials requested mid-handshake
- Server identity verification for RSA-AES servers, with a SHA-256 fingerprint
- Scale to fit, remote resize, clip-and-pan, view-only, shared session
- Quality and compression levels, VNC repeater support
- Ctrl+Alt+Del, a special-keys pad (Esc, Super, Menu, F1–F12, …)
- Two-way clipboard
- PNG snapshot of the remote screen
- Fullscreen
- Deep links: `?host=10.0.0.5&port=6080&encrypt=1&autoconnect=1`
- Settings remembered per browser — **passwords are never stored**

## Google Apps Script

See [`apps-script/README.md`](apps-script/README.md) for deployment.

The one thing to know up front: **Apps Script hosts the page but cannot carry
VNC traffic.** `UrlFetchApp` is request/response only and cannot proxy a
WebSocket, so the browser connects directly to `websockify`. That means the
host must be reachable from the user's browser, and the URL must be `wss://`,
because an HTTPS page may not open a plain WebSocket.

What Apps Script does add: Google sign-in in front of the console, per-user
saved settings, a reachability probe run from Google's network, an optional
host allow-list, and an optional access log in a Sheet.

## Security notes

- Without `--tls`, VNC traffic crosses the network unencrypted. Use `--tls`, or
  tunnel it: `ssh -L 6080:127.0.0.1:6080 user@host`.
- A self-signed certificate must be accepted in the browser once (open
  `https://host:6080/` and accept) before `wss://` will connect.
- VNC passwords are capped at 8 characters by the protocol. They authenticate
  the connection, nothing more — do not treat VNC auth as the only thing
  between the internet and your desktop.
- `--bind 127.0.0.1` keeps `websockify` off the network entirely, for use with
  an SSH tunnel.

## Layout

```
vnc/
├── web/                     static console
│   ├── index.html
│   ├── css/app.css
│   ├── js/app.js            all the noVNC wiring
│   └── vendor/novnc/        noVNC 1.7.0, MPL-2.0 (unmodified)
├── server/
│   ├── setup-vnc-linux.sh   install/start/stop the Linux side
│   └── serve-web.sh         static server for local development
└── apps-script/             script.google.com deployment
    ├── Code.gs
    ├── Index.html
    ├── Stylesheet.html
    ├── appsscript.json
    └── README.md
```

## Licence

noVNC is MPL-2.0 — see `web/vendor/novnc/LICENSE.txt` and
`web/vendor/novnc/docs/`. It is vendored unmodified from the `@novnc/novnc`
npm package, version 1.7.0.

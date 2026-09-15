# Google Apps Script deployment

Hosts the VNC console at a `script.google.com` URL, behind Google sign-in.

## What Apps Script does and does not do

Apps Script **serves the page**. It does **not** carry the VNC traffic.
`UrlFetchApp` is request/response only — it cannot proxy a WebSocket, and Apps
Script has no way to hold a socket open. The WebSocket goes from the user's
browser directly to your `websockify` host.

```
browser ──HTTPS──> script.google.com        (the page)
   │
   └────wss://────> websockify:6080 ──TCP──> Xvnc:5901   (the session)
```

Three consequences, all of which will bite you if ignored:

1. **`websockify` must be reachable from the browser.** A public DNS name, a
   VPN, or a tunnel (Cloudflare Tunnel, ngrok, `ssh -R`). Apps Script does not
   give a private host any new reachability.
2. **The URL must be `wss://`.** The page is HTTPS, so browsers block plain
   `ws://` as mixed content. Run `websockify --cert ... --key ...`, or put a
   reverse proxy in front of it.
3. **Self-signed certificates must be accepted first.** Open
   `https://your-host:6080/` in a tab, accept the warning, then return to the
   console. Otherwise the WebSocket fails with no useful browser error.

If you cannot meet 1–3, use `vnc/web` served by `websockify` itself
(`server/setup-vnc-linux.sh start --tls`) and skip Apps Script.

## Files

| File | Purpose |
| --- | --- |
| `Code.gs` | `doGet`, saved settings, reachability probe, optional access log |
| `Index.html` | The console UI; loads noVNC from a CDN |
| `Stylesheet.html` | CSS, inlined by `include('Stylesheet')` |
| `appsscript.json` | Manifest — V8 runtime, OAuth scopes, web app access |

## Deploy

1. Go to <https://script.google.com> → **New project**.
2. **Project Settings** → tick *Show "appsscript.json" manifest file in editor*.
3. Create the files and paste in the contents:
   - `Code.gs` (rename the default `Code.gs` or replace its contents)
   - `Index.html` — **File → New → HTML file**, named `Index`
   - `Stylesheet.html` — **File → New → HTML file**, named `Stylesheet`
   - `appsscript.json` — replace the generated manifest
4. Optional, **Project Settings → Script Properties**:

   | Property | Example | Effect |
   | --- | --- | --- |
   | `DEFAULT_HOST` | `vnc.example.com` | Prefilled host |
   | `DEFAULT_PORT` | `6080` | Prefilled port |
   | `DEFAULT_PATH` | `websockify` | Prefilled WebSocket path |
   | `ALLOWED_HOSTS` | `vnc.example.com,10.8.0.4` | Restricts what users may connect to |
   | `LOG_SHEET_ID` | spreadsheet ID | Writes connect/disconnect rows to that Sheet |

5. **Deploy → New deployment → Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Only myself** (widen deliberately — this is a remote
     desktop door)
6. Authorize the scopes when prompted, then open the `/exec` URL.

With `clasp` instead of the editor:

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --title "Linux VNC Console" --rootDir vnc/apps-script
clasp push
clasp deploy
```

`clasp` expects `.gs` and `.html` at the `rootDir`, which is how this folder is
laid out already.

## Using it

- **Test reachability** probes the host from Google's network with
  `UrlFetchApp`. A pass means the port is open and its TLS is valid publicly. A
  fail is not conclusive — a LAN or VPN host is unreachable from Google but may
  be perfectly reachable from the browser.
- **Save as my default** stores host/port/path and the toggles in
  `UserProperties`, per Google account. Passwords are never stored, sent to
  Apps Script, or logged.
- Deep links work: `…/exec?host=vnc.example.com&port=6080&autoconnect=1`.

## Scopes and why they are needed

| Scope | Used by |
| --- | --- |
| `script.external_request` | `checkGateway` (the reachability probe) |
| `userinfo.email` | Showing who is signed in, and the access log |
| `spreadsheets` | The access log; drop it if `LOG_SHEET_ID` is unused |

Remove any scope you do not want from `appsscript.json` — deleting
`spreadsheets` only disables `logAccess`.

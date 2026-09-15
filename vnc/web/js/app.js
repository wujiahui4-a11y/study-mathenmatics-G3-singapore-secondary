/*
 * Linux VNC Console — a small front-end for the noVNC RFB library.
 *
 * noVNC (vendor/novnc, MPL-2.0) speaks RFB over a WebSocket. A raw VNC server
 * does not speak WebSocket, so something has to bridge the two: websockify,
 * which server/setup-vnc-linux.sh installs and runs.
 */

import RFB from '../vendor/novnc/core/rfb.js';
import KeyTable from '../vendor/novnc/core/input/keysym.js';

const STORAGE_KEY = 'linux-vnc-console/settings';

/** Everything except the password, which is deliberately never persisted. */
const PERSISTED = [
    'host', 'port', 'path', 'username', 'encrypt', 'scaleViewport',
    'resizeSession', 'clipViewport', 'viewOnly', 'shared', 'qualityLevel',
    'compressionLevel', 'repeaterID',
];

const SPECIAL_KEYS = [
    { label: 'Esc', keysym: KeyTable.XK_Escape, code: 'Escape' },
    { label: 'Tab', keysym: KeyTable.XK_Tab, code: 'Tab' },
    { label: 'Super', keysym: KeyTable.XK_Super_L, code: 'MetaLeft' },
    { label: 'Menu', keysym: KeyTable.XK_Menu, code: 'ContextMenu' },
    { label: 'Print', keysym: KeyTable.XK_Print, code: 'PrintScreen' },
    { label: 'Insert', keysym: KeyTable.XK_Insert, code: 'Insert' },
    { label: 'Delete', keysym: KeyTable.XK_Delete, code: 'Delete' },
    { label: 'Home', keysym: KeyTable.XK_Home, code: 'Home' },
    { label: 'End', keysym: KeyTable.XK_End, code: 'End' },
    { label: 'Page Up', keysym: KeyTable.XK_Page_Up, code: 'PageUp' },
    { label: 'Page Down', keysym: KeyTable.XK_Page_Down, code: 'PageDown' },
    ...Array.from({ length: 12 }, (_, i) => ({
        label: `F${i + 1}`,
        keysym: KeyTable.XK_F1 + i,
        code: `F${i + 1}`,
    })),
];

const $ = (id) => document.getElementById(id);

const ui = {
    screen: $('screen'),
    placeholder: $('placeholder'),
    statusDot: $('statusDot'),
    statusText: $('statusText'),
    toasts: $('toasts'),
    settingsDialog: $('settingsDialog'),
    settingsForm: $('settingsForm'),
    settingsError: $('settingsError'),
    urlPreview: $('urlPreview'),
    credsDialog: $('credsDialog'),
    verifyDialog: $('verifyDialog'),
    clipboardDialog: $('clipboardDialog'),
    clipboardText: $('clipboardText'),
    keysDialog: $('keysDialog'),
    keypad: $('keypad'),
};

let rfb = null;
/** Set when the user asks to disconnect, so we can tell it from a drop. */
let userInitiatedDisconnect = false;
/** Remote desktop name — arrives via `desktopname`, before `connect` fires. */
let desktopName = '';
/**
 * Set by `securityfailure`, which is always followed by `disconnect`. The
 * authentication message is the useful one, so it must not be overwritten by
 * the generic "connection lost".
 */
let securityFailed = false;

/* ------------------------------------------------------------------ */
/* status + toasts                                                     */
/* ------------------------------------------------------------------ */

function setStatus(state, text) {
    ui.statusDot.dataset.state = state;
    ui.statusText.textContent = text;
    document.title = state === 'connected'
        ? `${text} — Linux VNC Console`
        : 'Linux VNC Console';
}

function toast(message, kind = 'info', ms = 5000) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.kind = kind;
    el.textContent = message;
    ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), ms);
}

function setConnectedUI(connected) {
    for (const id of ['btnCtrlAltDel', 'btnKeys', 'btnClipboard', 'btnScreenshot', 'btnDisconnect']) {
        $(id).disabled = !connected;
    }
    ui.placeholder.hidden = connected;
}

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */

function readSettings() {
    return {
        host: $('host').value.trim(),
        port: $('port').value.trim(),
        path: $('path').value.trim().replace(/^\/+/, ''),
        password: $('password').value,
        username: $('username').value.trim(),
        encrypt: $('encrypt').checked,
        scaleViewport: $('scaleViewport').checked,
        resizeSession: $('resizeSession').checked,
        clipViewport: $('clipViewport').checked,
        viewOnly: $('viewOnly').checked,
        shared: $('shared').checked,
        qualityLevel: Number($('qualityLevel').value),
        compressionLevel: Number($('compressionLevel').value),
        repeaterID: $('repeaterID').value.trim(),
    };
}

function applySettings(values) {
    for (const [key, value] of Object.entries(values)) {
        const el = $(key);
        if (!el) continue;
        if (el.type === 'checkbox') {
            el.checked = value === true || value === 'true' || value === '1';
        } else if (value !== undefined && value !== null) {
            el.value = value;
        }
    }
}

function loadStoredSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) applySettings(JSON.parse(raw));
    } catch (e) {
        // Private mode or blocked site data — defaults are fine.
    }
}

function storeSettings() {
    const all = readSettings();
    const subset = Object.fromEntries(PERSISTED.map((k) => [k, all[k]]));
    try {
        if ($('remember').checked) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(subset));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {
        // Not fatal — the connection still works, it just won't be remembered.
    }
}

/**
 * Prefill from the query string so a session can be linked to, e.g.
 * ?host=10.0.0.5&port=6080&encrypt=1&autoconnect=1
 */
function applyQueryParams() {
    const params = new URLSearchParams(location.search);
    if (![...params.keys()].length) return false;

    const values = {};
    for (const key of [...PERSISTED, 'password']) {
        if (params.has(key)) values[key] = params.get(key);
    }
    for (const key of ['encrypt', 'scaleViewport', 'resizeSession', 'clipViewport', 'viewOnly', 'shared']) {
        if (params.has(key)) values[key] = ['1', 'true', 'yes', 'on'].includes(params.get(key).toLowerCase());
    }
    applySettings(values);
    return ['1', 'true', 'yes', 'on'].includes((params.get('autoconnect') || '').toLowerCase());
}

function buildURL(s) {
    const scheme = s.encrypt ? 'wss' : 'ws';
    const host = s.host.includes(':') && !s.host.startsWith('[') ? `[${s.host}]` : s.host; // IPv6
    const path = s.path ? `/${s.path}` : '/';
    return `${scheme}://${host}:${s.port}${path}`;
}

function updateURLPreview() {
    const s = readSettings();
    ui.urlPreview.textContent = s.host ? `WebSocket URL: ${buildURL(s)}` : '';
}

/* ------------------------------------------------------------------ */
/* connect / disconnect                                                */
/* ------------------------------------------------------------------ */

function connect() {
    const s = readSettings();

    if (!s.host) {
        showSettingsError('Enter the host running websockify.');
        return;
    }
    // An https:// page may not open a plain ws:// socket — browsers block it as
    // mixed content, and the failure is otherwise silent and baffling.
    if (location.protocol === 'https:' && !s.encrypt) {
        showSettingsError(
            'This page is served over HTTPS, so the WebSocket must be encrypted. ' +
            'Tick "Encrypted WebSocket (wss://)" and run websockify with a certificate.');
        return;
    }

    disconnect({ silent: true });
    ui.settingsDialog.close();
    storeSettings();
    desktopName = '';
    securityFailed = false;

    const url = buildURL(s);
    setStatus('connecting', `Connecting to ${url}`);
    ui.placeholder.hidden = true;

    const credentials = {};
    if (s.password) credentials.password = s.password;
    if (s.username) credentials.username = s.username;

    try {
        rfb = new RFB(ui.screen, url, {
            shared: s.shared,
            credentials,
            repeaterID: s.repeaterID,
        });
    } catch (err) {
        setStatus('error', 'Could not start the connection');
        toast(`Could not start the connection: ${err.message}`, 'error', 9000);
        ui.placeholder.hidden = false;
        return;
    }

    rfb.scaleViewport = s.scaleViewport;
    rfb.resizeSession = s.resizeSession;
    rfb.clipViewport = s.clipViewport;
    rfb.viewOnly = s.viewOnly;
    rfb.qualityLevel = s.qualityLevel;
    rfb.compressionLevel = s.compressionLevel;
    rfb.background = '#000';

    rfb.addEventListener('connect', onConnect);
    rfb.addEventListener('disconnect', onDisconnect);
    rfb.addEventListener('credentialsrequired', onCredentialsRequired);
    rfb.addEventListener('securityfailure', onSecurityFailure);
    rfb.addEventListener('serververification', onServerVerification);
    rfb.addEventListener('desktopname', onDesktopName);
    rfb.addEventListener('clipboard', onRemoteClipboard);
    rfb.addEventListener('bell', () => toast('Remote bell', 'info', 1500));

    // Clear the password field; it lives in the RFB object now.
    $('password').value = '';
}

function disconnect({ silent = false } = {}) {
    if (!rfb) return;
    if (silent) {
        // Tearing down to start a new connection: stay quiet, and leave the
        // flag clear so a failure of the *next* connection still reports.
        rfb.removeEventListener('disconnect', onDisconnect);
        rfb.disconnect();
        rfb = null;
        return;
    }
    userInitiatedDisconnect = true;
    rfb.disconnect();
    rfb = null;
    setConnectedUI(false);
    setStatus('idle', 'Disconnected');
}

function onConnect() {
    setConnectedUI(true);
    setStatus('connected', desktopName || 'Connected');
    toast('Connected', 'ok', 2500);
    userInitiatedDisconnect = false;
    rfb.focus();
}

function onDisconnect(e) {
    const clean = e.detail.clean;
    setConnectedUI(false);   // also brings the placeholder back
    rfb = null;

    if (securityFailed) {
        securityFailed = false;          // already explained by onSecurityFailure
    } else if (userInitiatedDisconnect) {
        setStatus('idle', 'Disconnected');
    } else if (clean) {
        setStatus('idle', 'Disconnected by the server');
        toast('The server closed the connection.', 'info', 7000);
    } else {
        setStatus('error', 'Connection lost');
        toast(
            'Connection failed or was lost. Check that websockify is running on ' +
            'that host and port, and that a firewall is not in the way.',
            'error', 12000);
    }
    userInitiatedDisconnect = false;
}

function onDesktopName(e) {
    desktopName = e.detail.name;
    if (rfb && ui.statusDot.dataset.state === 'connected') {
        setStatus('connected', desktopName);
    }
}

function onSecurityFailure(e) {
    securityFailed = true;
    const reason = e.detail.reason ? `: ${e.detail.reason}` : '';
    setStatus('error', 'Authentication failed');
    toast(`Authentication failed (status ${e.detail.status})${reason}`, 'error', 12000);
}

function onCredentialsRequired(e) {
    const types = e.detail.types;
    $('credsUserField').hidden = !types.includes('username');
    $('credsPassField').hidden = !types.includes('password');
    $('credsTargetField').hidden = !types.includes('target');
    $('credsHint').textContent = `The server is asking for: ${types.join(', ')}.`;
    ui.credsDialog.showModal();
    (types.includes('username') ? $('credsUsername') : $('credsPassword')).focus();
}

async function onServerVerification(e) {
    if (e.detail.type !== 'RSA') {
        toast(`Unsupported server verification type: ${e.detail.type}`, 'error', 9000);
        disconnect();
        return;
    }
    $('fingerprint').textContent = await sha256Fingerprint(e.detail.publickey);
    ui.verifyDialog.showModal();
}

async function sha256Fingerprint(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(':');
}

function onRemoteClipboard(e) {
    ui.clipboardText.value = e.detail.text;
    toast('Remote clipboard updated — open Clipboard to read it.', 'info', 4000);
}

/* ------------------------------------------------------------------ */
/* toolbar actions                                                     */
/* ------------------------------------------------------------------ */

function buildKeypad() {
    for (const key of SPECIAL_KEYS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn';
        button.textContent = key.label;
        button.addEventListener('click', () => {
            if (!rfb) return;
            rfb.sendKey(key.keysym, key.code);
            toast(`Sent ${key.label}`, 'info', 1200);
        });
        ui.keypad.appendChild(button);
    }
}

async function saveScreenshot() {
    if (!rfb) return;
    try {
        const blob = await new Promise((resolve, reject) => {
            rfb.toBlob((b) => (b ? resolve(b) : reject(new Error('empty framebuffer'))), 'image/png');
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vnc-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        toast(`Could not capture the screen: ${err.message}`, 'error');
    }
}

function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen().catch((err) => {
            toast(`Fullscreen refused: ${err.message}`, 'error');
        });
    }
}

function showSettingsError(message) {
    ui.settingsError.textContent = message;
    ui.settingsError.hidden = false;
}

/* ------------------------------------------------------------------ */
/* wiring                                                              */
/* ------------------------------------------------------------------ */

function wire() {
    $('btnSettings').addEventListener('click', openSettings);
    $('btnOpenSettings').addEventListener('click', openSettings);
    $('settingsCancel').addEventListener('click', () => ui.settingsDialog.close());

    ui.settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        connect();
    });
    ui.settingsForm.addEventListener('input', () => {
        ui.settingsError.hidden = true;
        updateURLPreview();
    });

    $('btnDisconnect').addEventListener('click', () => disconnect());
    $('btnCtrlAltDel').addEventListener('click', () => rfb && rfb.sendCtrlAltDel());
    $('btnScreenshot').addEventListener('click', saveScreenshot);
    $('btnFullscreen').addEventListener('click', toggleFullscreen);
    $('btnKeys').addEventListener('click', () => ui.keysDialog.showModal());
    $('btnClipboard').addEventListener('click', () => ui.clipboardDialog.showModal());

    $('credsCancel').addEventListener('click', () => {
        ui.credsDialog.close();
        disconnect();
    });
    $('credsForm').addEventListener('submit', () => {
        if (!rfb) return;
        const creds = {};
        if (!$('credsUserField').hidden) creds.username = $('credsUsername').value;
        if (!$('credsPassField').hidden) creds.password = $('credsPassword').value;
        if (!$('credsTargetField').hidden) creds.target = $('credsTarget').value;
        rfb.sendCredentials(creds);
        $('credsPassword').value = '';
    });

    $('verifyCancel').addEventListener('click', () => {
        ui.verifyDialog.close();
        disconnect();
    });
    $('verifyForm').addEventListener('submit', () => rfb && rfb.approveServer());

    $('clipboardClose').addEventListener('click', () => ui.clipboardDialog.close());
    $('clipboardForm').addEventListener('submit', () => {
        if (!rfb) return;
        rfb.clipboardPasteFrom(ui.clipboardText.value);
        toast('Clipboard sent to the remote desktop.', 'ok', 2500);
    });

    // A modal dialog steals keyboard focus; hand it back to the session.
    for (const dialog of document.querySelectorAll('dialog')) {
        dialog.addEventListener('close', () => rfb && rfb.focus());
    }

    window.addEventListener('beforeunload', (e) => {
        if (!rfb) return;
        e.preventDefault();
        e.returnValue = '';
    });
}

function openSettings() {
    ui.settingsError.hidden = true;
    updateURLPreview();
    ui.settingsDialog.showModal();
    $('host').focus();
}

function init() {
    if (!window.WebSocket) {
        setStatus('error', 'This browser has no WebSocket support');
        return;
    }

    buildKeypad();
    wire();
    loadStoredSettings();
    const autoconnect = applyQueryParams();

    // Default to the host serving this page — the common case when websockify
    // itself serves the files (see server/setup-vnc-linux.sh).
    if (!$('host').value && location.hostname) {
        $('host').value = location.hostname;
        if (location.port) $('port').value = location.port;
        $('encrypt').checked = location.protocol === 'https:';
    }

    setStatus('idle', 'Not connected');
    setConnectedUI(false);

    if (autoconnect) connect();
}

init();

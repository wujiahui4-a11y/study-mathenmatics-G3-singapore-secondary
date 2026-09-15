/**
 * Linux VNC Console — Google Apps Script web app.
 *
 * Deploy this at script.google.com to get a Google-hosted, Google-authenticated
 * page that opens a VNC session in the browser.
 *
 * WHAT APPS SCRIPT CAN AND CANNOT DO HERE
 * ---------------------------------------
 * Apps Script serves the page. It does NOT carry the VNC traffic: UrlFetchApp
 * is request/response only and cannot proxy a WebSocket. The browser opens the
 * WebSocket straight to your websockify host, so:
 *
 *   1. websockify must be reachable from the user's browser (public DNS name,
 *      VPN, or a tunnel such as Cloudflare Tunnel / ngrok / an SSH -R forward).
 *   2. The URL must be wss://, not ws://. This page is served over HTTPS and
 *      browsers block plain-WebSocket connections from an HTTPS page. Run
 *      websockify with --cert/--key, or terminate TLS in front of it.
 *   3. A self-signed certificate must be accepted in the browser first: open
 *      https://your-host:6080/ in a tab, accept the warning, then come back.
 *
 * What Apps Script does give you: Google sign-in in front of the console,
 * per-user saved connection settings, a reachability probe from Google's
 * network, and an optional access log in a Sheet.
 *
 * SETUP
 * -----
 * Script Properties (Project Settings -> Script Properties) — all optional:
 *   DEFAULT_HOST      e.g. vnc.example.com      default host shown to users
 *   DEFAULT_PORT      e.g. 6080                 default websockify port
 *   DEFAULT_PATH      e.g. websockify           default WebSocket path
 *   ALLOWED_HOSTS     comma-separated allow-list of hosts users may connect to
 *   LOG_SHEET_ID      spreadsheet ID for the access log
 */

var DEFAULTS = {
  host: '',
  port: '6080',
  path: 'websockify',
  encrypt: true,
  scaleViewport: true,
  resizeSession: false,
  viewOnly: false,
  shared: true,
  qualityLevel: 6,
  compressionLevel: 2
};

/* ------------------------------------------------------------------ */
/* web app entry point                                                 */
/* ------------------------------------------------------------------ */

/**
 * Serves the console. Query parameters (?host=&port=&autoconnect=1) prefill
 * the form, which makes per-machine bookmarks possible.
 *
 * @param {!Object} e The Apps Script event object.
 * @return {!HtmlOutput} The rendered page.
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var config = getConfig();

  ['host', 'port', 'path'].forEach(function(key) {
    if (params[key]) config[key] = params[key];
  });
  if (params.encrypt !== undefined) config.encrypt = isTruthy_(params.encrypt);
  config.autoconnect = isTruthy_(params.autoconnect);

  var template = HtmlService.createTemplateFromFile('Index');
  template.config = config;
  template.user = getUserEmail_();

  return template.evaluate()
      .setTitle('Linux VNC Console')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Inlines another file from this project. Used by Index.html for the CSS.
 *
 * @param {string} filename Name of the file, without extension.
 * @return {string} The file's contents.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ------------------------------------------------------------------ */
/* configuration                                                       */
/* ------------------------------------------------------------------ */

/**
 * Returns this user's saved connection settings, falling back to the script
 * defaults. Passwords are never stored.
 *
 * @return {!Object} The effective configuration.
 */
function getConfig() {
  var script = PropertiesService.getScriptProperties();
  var config = {};

  Object.keys(DEFAULTS).forEach(function(key) {
    config[key] = DEFAULTS[key];
  });

  config.host = script.getProperty('DEFAULT_HOST') || config.host;
  config.port = script.getProperty('DEFAULT_PORT') || config.port;
  config.path = script.getProperty('DEFAULT_PATH') || config.path;

  var saved = PropertiesService.getUserProperties().getProperty('vncConfig');
  if (saved) {
    try {
      var parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(function(key) {
        if (key in DEFAULTS) config[key] = parsed[key];
      });
    } catch (err) {
      console.warn('Ignoring unreadable saved config: ' + err);
    }
  }

  config.allowedHosts = getAllowedHosts_();
  return config;
}

/**
 * Saves connection settings for the current user.
 *
 * @param {!Object} config Settings to store; unknown keys are dropped.
 * @return {!Object} The stored configuration.
 */
function saveConfig(config) {
  var clean = {};
  Object.keys(DEFAULTS).forEach(function(key) {
    if (config && config[key] !== undefined && config[key] !== null) {
      clean[key] = config[key];
    }
  });

  if (clean.host) assertHostAllowed_(String(clean.host));
  delete clean.password;

  PropertiesService.getUserProperties()
      .setProperty('vncConfig', JSON.stringify(clean));
  return clean;
}

/** @return {!Array<string>} Hosts users may connect to, empty if unrestricted. */
function getAllowedHosts_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALLOWED_HOSTS');
  if (!raw) return [];
  return raw.split(',').map(function(h) {
    return h.trim().toLowerCase();
  }).filter(String);
}

/**
 * Throws if an ALLOWED_HOSTS list exists and does not contain this host.
 *
 * @param {string} host The host to check.
 */
function assertHostAllowed_(host) {
  var allowed = getAllowedHosts_();
  if (!allowed.length) return;
  if (allowed.indexOf(host.toLowerCase()) === -1) {
    throw new Error(
        'Host "' + host + '" is not in this deployment\'s allow-list. ' +
        'Allowed: ' + allowed.join(', '));
  }
}

/* ------------------------------------------------------------------ */
/* gateway probe                                                       */
/* ------------------------------------------------------------------ */

/**
 * Checks whether the websockify host answers HTTP, from Google's network.
 *
 * websockify serves HTTP on the same port it accepts WebSocket upgrades on, so
 * a reply means the port is open and TLS (if any) is valid. A failure here does
 * not always mean the browser cannot connect — a host on your LAN or behind a
 * VPN is unreachable from Google but fine from the user's machine.
 *
 * @param {!Object} config Connection settings with host/port/encrypt.
 * @return {!Object} Result with ok, status, message and elapsedMs.
 */
function checkGateway(config) {
  var host = String((config && config.host) || '').trim();
  if (!host) return {ok: false, message: 'No host given.'};

  assertHostAllowed_(host);

  var port = String((config && config.port) || DEFAULTS.port).trim();
  var scheme = (config && config.encrypt === false) ? 'http' : 'https';
  var url = scheme + '://' + host + ':' + port + '/';
  var started = Date.now();

  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: false,
      validateHttpsCertificates: true,
      timeout: 10
    });
    var code = response.getResponseCode();
    return {
      ok: code < 500,
      status: code,
      elapsedMs: Date.now() - started,
      message: 'Reachable from Google — HTTP ' + code + '.'
    };
  } catch (err) {
    return {
      ok: false,
      elapsedMs: Date.now() - started,
      message: describeFetchError_(String(err), scheme)
    };
  }
}

/**
 * Turns a UrlFetchApp exception into something actionable.
 *
 * @param {string} message The raw error text.
 * @param {string} scheme Either 'http' or 'https'.
 * @return {string} A human-readable explanation.
 */
function describeFetchError_(message, scheme) {
  var lower = message.toLowerCase();
  if (lower.indexOf('certificate') !== -1 || lower.indexOf('ssl') !== -1) {
    return 'TLS rejected. websockify is probably using a self-signed ' +
           'certificate. Open the https:// URL in a browser tab and accept it, ' +
           'or install a certificate from a public CA.';
  }
  if (lower.indexOf('timeout') !== -1 || lower.indexOf('timed out') !== -1) {
    return 'No answer within 10s. The host may be firewalled off from the ' +
           'public internet — that is fine if the browser reaches it another ' +
           'way (VPN, LAN, SSH tunnel).';
  }
  if (lower.indexOf('dns') !== -1 || lower.indexOf('unknown host') !== -1) {
    return 'DNS lookup failed. A private hostname will not resolve from ' +
           'Google; use a public name or an IP the browser can reach.';
  }
  if (scheme === 'https' && lower.indexOf('protocol') !== -1) {
    return 'The port answered but not with TLS. Restart websockify with ' +
           '--cert/--key, or untick the encryption option (only works if this ' +
           'page is not served over HTTPS).';
  }
  return 'Could not reach it: ' + message;
}

/* ------------------------------------------------------------------ */
/* optional access log                                                 */
/* ------------------------------------------------------------------ */

/**
 * Appends a row to the access-log Sheet, if LOG_SHEET_ID is configured.
 * Called from the page when a session opens or closes.
 *
 * @param {string} event Either 'connect' or 'disconnect'.
 * @param {!Object} config The connection settings in use.
 * @return {boolean} True if a row was written.
 */
function logAccess(event, config) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('LOG_SHEET_ID');
  if (!sheetId) return false;

  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'User', 'Event', 'Host', 'Port', 'Encrypted']);
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      new Date(),
      getUserEmail_(),
      event,
      (config && config.host) || '',
      (config && config.port) || '',
      !(config && config.encrypt === false)
    ]);
    return true;
  } catch (err) {
    console.error('Access log write failed: ' + err);
    return false;
  }
}

/** @return {string} The signed-in user's email, or '' if not available. */
function getUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (err) {
    return '';
  }
}

/**
 * Coerces a query-parameter string into a boolean.
 *
 * @param {*} value The raw value.
 * @return {boolean} Whether it reads as true.
 */
function isTruthy_(value) {
  return ['1', 'true', 'yes', 'on'].indexOf(String(value).toLowerCase()) !== -1;
}

/* ------------------------------------------------------------------ */
/* editor helpers — run these by hand from the Apps Script editor       */
/* ------------------------------------------------------------------ */

/** Prints the effective configuration to the execution log. */
function debugShowConfig() {
  console.log(JSON.stringify(getConfig(), null, 2));
}

/** Probes the configured default host and prints the result. */
function debugProbeDefaultHost() {
  console.log(JSON.stringify(checkGateway(getConfig()), null, 2));
}

/* Replace the web app's old doGet with this loader, then deploy a new version.
   Supports both the existing p1-p4 build and the new p5 game module. */
const JJS_REPO = 'wujiahui4-a11y/study-mathenmatics-G3-singapore-secondary';
const JJS_REF = 'cursor/jujutsu-kaisen-multiplayer-0a77';
const BASE = 'https://raw.githubusercontent.com/' + JJS_REPO + '/' + JJS_REF + '/jujutsu-parts/';

function jjsFetch_(url) {
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (response.getResponseCode() !== 200) throw new Error('GitHub returned HTTP ' + response.getResponseCode());
  return response.getContentText();
}

function doGet(e) {
  const params = e && e.parameter || {};
  try {
    // Every request in a page load uses one immutable commit. This prevents
    // an update midway through loading from mixing incompatible game files.
    let revision = params.v;
    if (revision && !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid game revision.');
    if (params.p && !/^[1-5]$/.test(params.p)) throw new Error('Unknown game file.');
    if (!revision) {
      const cache = CacheService.getScriptCache(), key = 'jjs-head-' + JJS_REF;
      revision = cache.get(key);
      if (!revision) {
        const commit = JSON.parse(jjsFetch_('https://api.github.com/repos/' + JJS_REPO + '/commits/' + encodeURIComponent(JJS_REF)));
        revision = commit.sha;
        if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Could not resolve the game version.');
        cache.put(key, revision, 60);
      }
    }
    const base = BASE.replace('/' + JJS_REF + '/jujutsu-parts/', '/' + revision + '/jujutsu-parts/');
    if (params.p) {
      const code = jjsFetch_(base + 'p' + params.p + '.js');
      return ContentService.createTextOutput(code).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    const endpoint = ScriptApp.getService().getUrl();
    if (!endpoint) throw new Error('Deploy this project as a web app first.');
    // Replace full placeholders, including those inside the small pop-out copy.
    const html = jjsFetch_(base + 'index.html').replace(/__PART_BASE__\?p=(\d+)/g,
      function (_, part) { return endpoint + '?p=' + part + '&v=' + revision; });
    return HtmlService.createHtmlOutput(html).setTitle('Jujutsu Battleground');
  } catch (error) {
    const message = String(error.message || error).replace(/[&<>"']/g,
      function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; });
    return HtmlService.createHtmlOutput('<h2>JJS could not load</h2><p>' + message + '</p><p>Refresh to try again.</p>');
  }
}


// Called by the HTML-service page through Google's native server-call bridge.
function getGamePart(part, revision) {
  if (!/^[1-5]$/.test(String(part))) throw new Error('Unknown game file.');
  if (revision && !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid game revision.');
  const base = revision
    ? BASE.replace('/' + JJS_REF + '/jujutsu-parts/', '/' + revision + '/jujutsu-parts/')
    : BASE;
  return jjsFetch_(base + 'p' + part + '.js');
}

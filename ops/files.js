// Dateien — Code-Baum aus GitHub + Link zum geteilten Dokumenten-Ordner
//
// Bewusst nur Lesen. Der Code selbst wird über Git bearbeitet, nicht hier.
// Gitignore'lu belgeler (legal/, Verträge, Rechnungen) burada GÖRÜNMEZ —
// onlar paylaşılan Google Drive klasöründedir, sağ üstteki bağlantı oraya gider.
import { $, esc, fail } from './app.js?v=20260809d';
import { GITHUB_REPO, GITHUB_BRANCH, SHARED_FOLDER_URL } from './config.js?v=20260809d';

let tree = null;        // { name → node }, node: { dir:bool, path, children }
let openDirs = new Set();
let current = null;

const TEXT_MAX = 400_000;   // 400 KB üstü dosyayı tarayıcıda açma

async function loadTree() {
  const el = $('#fileTree');
  el.innerHTML = '<p class="empty">Lade …</p>';
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`);
    if (!r.ok) throw new Error(r.status === 403
      ? 'GitHub-Ratelimit erreicht (60/Std. ohne Token) — später erneut versuchen'
      : `GitHub ${r.status}`);
    const json = await r.json();
    tree = build(json.tree || []);
    if (json.truncated) $('#fileCrumbs').textContent = 'Hinweis: Baum von GitHub gekürzt';
    render();
  } catch (e) {
    fail('Dateibaum', e);
    el.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
  }
}

function build(entries) {
  const root = { dir: true, path: '', children: {} };
  for (const e of entries) {
    const parts = e.path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const isLeaf = i === parts.length - 1;
      node.children[part] ||= {
        dir: isLeaf ? e.type === 'tree' : true,
        path: parts.slice(0, i + 1).join('/'),
        size: isLeaf ? e.size : 0,
        children: {}
      };
      node = node.children[part];
    });
  }
  return root;
}

function render() {
  const rows = [];
  (function walk(node, depth) {
    const names = Object.keys(node.children).sort((a, b) => {
      const A = node.children[a], B = node.children[b];
      if (A.dir !== B.dir) return A.dir ? -1 : 1;
      return a.localeCompare(b, 'de');
    });
    for (const name of names) {
      const n = node.children[name];
      const open = openDirs.has(n.path);
      rows.push(`
        <button class="fnode ${current === n.path ? 'is-on' : ''}"
                data-path="${esc(n.path)}" data-dir="${n.dir}"
                style="padding-left:${8 + depth * 14}px">
          <span class="ico">${n.dir ? (open ? '▾' : '▸') : '·'}</span>
          <span class="nm">${esc(name)}</span>
        </button>`);
      if (n.dir && open) walk(n, depth + 1);
    }
  })(tree, 0);

  $('#fileTree').innerHTML = rows.join('');
  $('#fileTree').onclick = (e) => {
    const b = e.target.closest('.fnode'); if (!b) return;
    const path = b.dataset.path;
    if (b.dataset.dir === 'true') {
      openDirs.has(path) ? openDirs.delete(path) : openDirs.add(path);
      render();
    } else {
      openFile(path);
    }
  };
}

async function openFile(path) {
  current = path;
  render();
  $('#fileCrumbs').textContent = path;
  const view = $('#fileView');
  view.innerHTML = '<p class="empty">Lade …</p>';

  if (/\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|woff2?|ttf|mp4|xlsx?|docx?)$/i.test(path)) {
    const url = `https://github.com/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${path}`;
    view.innerHTML = `<p class="empty">Binärdatei — <a href="${esc(url)}" target="_blank" rel="noopener">auf GitHub öffnen ↗</a></p>`;
    return;
  }

  try {
    const r = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`);
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const text = await r.text();
    if (text.length > TEXT_MAX) {
      view.innerHTML = `<p class="empty">Datei zu groß (${Math.round(text.length / 1024)} KB) — nur die ersten 400 KB:</p><pre>${esc(text.slice(0, TEXT_MAX))}</pre>`;
    } else {
      view.innerHTML = `<pre>${esc(text)}</pre>`;
    }
  } catch (e) {
    fail('Datei öffnen', e);
    view.innerHTML = `<p class="empty">${esc(e.message)}</p>`;
  }
}

export function mountFiles() {
  if (SHARED_FOLDER_URL) {
    const a = $('#driveLink');
    a.href = SHARED_FOLDER_URL;
    a.hidden = false;
  }
  loadTree();
}

const fs = require('fs');
const path = require('path');

const replacements = [
  { from: 'â†', to: '←' },
  { from: 'â†’', to: '→' },
  { from: 'â„¹ï¸', to: 'ℹ️' },
  { from: 'â€“', to: '–' },
  { from: 'â€"', to: '—' },
  { from: 'â€”', to: '—' },
  { from: 'â€ž', to: '„' },
  { from: 'â€œ', to: '"' },
  { from: 'â€˜', to: '\'' },
  { from: 'â€™', to: '\'' },
  { from: 'â€¦', to: '…' },
  { from: 'â€¢', to: '•' },
  { from: 'â‚¬', to: '€' },
  { from: 'Ã¼', to: 'ü' },
  { from: 'Ã¶', to: 'ö' },
  { from: 'Ã¤', to: 'ä' },
  { from: 'ÃŸ', to: 'ß' },
  { from: 'Ã„', to: 'Ä' },
  { from: 'Ã–', to: 'Ö' },
  { from: 'Ãœ', to: 'Ü' },
  { from: 'Â«', to: '"' },
  { from: 'Â»', to: '"' },
  { from: 'Â', to: '' },
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const r of replacements) {
    if (content.includes(r.from)) {
      content = content.split(r.from).join(r.to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('FIXED:', filePath);
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walk(fullPath);
    } else if (entry.isFile() && /\.(html|js|css|md|txt|json|sql)$/.test(entry.name)) {
      fixFile(fullPath);
    }
  }
}

walk('c:/Users/Test/Desktop/claude/website');
console.log('Done.');

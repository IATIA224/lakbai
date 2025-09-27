const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public', '_redirects');
const dest = path.join(__dirname, '..', 'build', '_redirects');

try {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log('Copied public/_redirects to build/_redirects');
  } else {
    console.warn('public/_redirects not found — nothing copied');
  }
} catch (err) {
  console.error('Failed to copy _redirects:', err);
  process.exit(1);
}

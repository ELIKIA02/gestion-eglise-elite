import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '..', 'node_modules', 'whatsapp-rust-bridge', 'package.json');

if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (pkg.exports?.['.'] && !pkg.exports['.'].require) {
    pkg.exports['.'].require = pkg.exports['.'].import;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('[postinstall] Patched whatsapp-rust-bridge exports for CJS');
  }
}

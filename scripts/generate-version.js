import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

fs.writeFileSync(
  path.join(rootDir, 'docs', 'version.json'),
  JSON.stringify({ version: pkg.version })
);

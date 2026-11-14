// Static checks run in CI: required files exist, every JS file parses,
// and every relative import points at a file that exists.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';

const REQUIRED = ['public/index.html', 'public/style.css', 'public/js/main.js', 'netlify.toml'];
const JS_ROOT = 'public/js';

let failed = false;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

for (const f of REQUIRED) if (!existsSync(f)) fail(`Missing required file ${f}`);

const files = readdirSync(JS_ROOT, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.js'))
  .map((f) => join(JS_ROOT, f));

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]/g;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    fail(`Syntax error in ${file}\n${e.stderr}`);
    continue;
  }
  const src = readFileSync(file, 'utf8');
  for (const [, spec] of src.matchAll(IMPORT_RE)) {
    const target = resolve(dirname(file), spec);
    if (!existsSync(target)) fail(`${file} imports missing module ${spec}`);
  }
  console.log(`✓ ${file}`);
}

if (failed) process.exit(1);
console.log(`\nAll checks passed (${files.length} files).`);

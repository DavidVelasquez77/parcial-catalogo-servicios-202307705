import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const forbidden = [/sk-[A-Za-z0-9]{20,}/, /gh[pousr]_[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /AIza[0-9A-Za-z_-]{20,}/];
const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage']);
let failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (!entry.name.endsWith('.xlsx') && !entry.name.endsWith('.png')) {
      const content = fs.readFileSync(full, 'utf8');
      if (forbidden.some((pattern) => pattern.test(content))) failures.push(path.relative(root, full));
    }
  }
}

function isTracked(relativePath) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relativePath], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (isTracked('.env')) failures.push('.env no debe versionarse ni publicarse');
walk(root);
if (failures.length) { console.error(JSON.stringify({ ok: false, failures })); process.exitCode = 1; }
else console.log(JSON.stringify({ ok: true, scanned: 'source, configuration and documentation' }));

import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  ['typecheck', [npm, 'run', 'typecheck']],
  ['build', [npm, 'run', 'build']],
  ['secret-audit', [npm, 'run', 'audit:secrets']],
  ['compose-config', ['docker', 'compose', 'config']],
];
if (process.env.HARNESS_RUN_SMOKE === '1') {
  steps.push(['acceptance', ['docker', 'compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/acceptance.js']]);
  steps.push(['smoke', ['docker', 'compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/smoke.js']]);
  steps.push(['persistence', [npm, 'run', 'persistence:check']]);
}

const results = [];
for (const [name, command] of steps) {
  console.log(`\n[HARNESS] ${name}`);
  const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
  results.push({ name, code: result.status ?? 1 });
  if ((result.status ?? 1) !== 0) {
    console.error(JSON.stringify({ ok: false, failedStep: name, results }));
    process.exitCode = result.status ?? 1;
    process.exit();
  }
}
console.log(JSON.stringify({ ok: true, results }));

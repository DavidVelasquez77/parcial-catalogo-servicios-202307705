import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'docker.exe' : 'docker';
const args = ['compose', 'restart', 'db'];
const restart = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
if ((restart.status ?? 1) !== 0) process.exit(restart.status ?? 1);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
for (let attempt = 1; attempt <= 30; attempt += 1) {
  const ready = spawnSync(command, ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'catalogo', '-d', 'catalogo'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if ((ready.status ?? 1) === 0) break;
  if (attempt === 30) process.exit(1);
  await sleep(1000);
}

const restartApi = spawnSync(command, ['compose', 'restart', 'api'], { stdio: 'inherit', shell: process.platform === 'win32' });
if ((restartApi.status ?? 1) !== 0) process.exit(restartApi.status ?? 1);

for (let attempt = 1; attempt <= 30; attempt += 1) {
  const verify = spawnSync(command, ['compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/verify-import.js'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if ((verify.status ?? 1) === 0) process.exit(0);
  await sleep(1000);
}
console.error('El API no estuvo disponible después de reiniciar los contenedores.');
process.exit(1);


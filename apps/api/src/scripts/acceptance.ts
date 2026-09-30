import 'dotenv/config';
import { Pool } from 'pg';

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000/api';

type Result = { response: Response; body: any; cookie: string };

async function request(path: string, init: RequestInit = {}, cookie = ''): Promise<Result> {
  const response = await fetch(base + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  const setCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return { response, body, cookie: setCookie.map((item) => item.split(';')[0]).join('; ') };
}

async function expectStatus(result: Result, status: number, label: string) {
  if (result.response.status !== status) throw new Error(label + ': esperaba ' + status + ' y recibió ' + result.response.status + '. ' + JSON.stringify(result.body));
}

async function login(identifier: string, password: string) {
  const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
  await expectStatus(result, 201, 'login ' + identifier);
  if (!result.cookie) throw new Error('login ' + identifier + ': no recibió cookie.');
  return result.cookie;
}

async function createOrg(kind: string, body: Record<string, unknown>, cookie: string) {
  const result = await request('/organization/' + kind, { method: 'POST', body: JSON.stringify(body) }, cookie);
  await expectStatus(result, 201, 'crear ' + kind);
  return result.body as { id: number };
}

async function deactivateOrg(kind: string, id: number, cookie: string) {
  const result = await request('/organization/' + kind + '/' + id, { method: 'DELETE' }, cookie);
  await expectStatus(result, 200, 'desactivar ' + kind);
}

async function cleanupTemporaryData(stamp: number) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username LIKE $1)', [`acc.%${stamp}`]);
    await client.query('DELETE FROM users WHERE username LIKE $1', [`acc.%${stamp}`]);
    await client.query('DELETE FROM positions WHERE code IN ($1, $2)', [`ACC-P1-${stamp}`, `ACC-P2-${stamp}`]);
    await client.query('DELETE FROM sections WHERE code IN ($1, $2)', [`ACC-S1-${stamp}`, `ACC-S2-${stamp}`]);
    await client.query('DELETE FROM departments WHERE code = $1', [`ACC-D-${stamp}`]);
    await client.query('DELETE FROM areas WHERE code = $1', [`ACC-A-${stamp}`]);
    await client.query('DELETE FROM companies WHERE code = $1', [`ACC-${stamp}`]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const checks: string[] = [];
  const invalid = await request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'admin.demo', password: 'incorrecta' }) });
  await expectStatus(invalid, 401, 'P01 credencial inválida');
  const noSession = await request('/auth/me');
  await expectStatus(noSession, 401, 'P02 sin sesión');
  const adminCookie = await login(process.env.DEMO_ADMIN_USERNAME ?? 'admin.demo', process.env.DEMO_ADMIN_PASSWORD ?? 'Admin123!');
  checks.push('P01', 'P02');

  const firstImport = await request('/imports/run', { method: 'POST' }, adminCookie);
  await expectStatus(firstImport, 201, 'P06 importación');
  const firstServices = await request('/services?pageSize=100', {}, adminCookie);
  await expectStatus(firstServices, 200, 'P06 catálogo');
  if (firstServices.body.total !== 46) throw new Error('P06: esperaba 46 servicios y recibió ' + firstServices.body.total + '.');
  const secondImport = await request('/imports/run', { method: 'POST' }, adminCookie);
  await expectStatus(secondImport, 201, 'P07 reimportación');
  const secondServices = await request('/services?pageSize=100', {}, adminCookie);
  await expectStatus(secondServices, 200, 'P07 catálogo');
  const codes = secondServices.body.data.map((item: { code: string }) => item.code);
  if (secondServices.body.total !== 46 || new Set(codes).size !== 46) throw new Error('P07: la reimportación alteró el conteo o creó duplicados.');
  checks.push('P06', 'P07');

  const review = await request('/services?search=SE.12&status=REVIEW&pageSize=100', {}, adminCookie);
  await expectStatus(review, 200, 'P08 SE.12');
  if (review.body.total !== 3 || review.body.data.some((item: { classLabel: unknown; criticalityLabel: unknown; typeLabel: unknown }) => item.classLabel !== null || item.criticalityLabel !== null || item.typeLabel !== null)) {
    throw new Error('P08: SE.12 no conserva los campos incompletos como NULL.');
  }
  checks.push('P08');
  const filtered = await request('/services?search=SE.12&status=REVIEW&pageSize=100', {}, adminCookie);
  await expectStatus(filtered, 200, 'P10 filtro');
  if (filtered.body.total !== 3) throw new Error('P10: filtro SE.12 no devuelve tres servicios.');
  checks.push('P10');

  const stamp = Date.now();
  const company = await createOrg('companies', { code: 'ACC-' + stamp, name: 'Acceptance temporal' }, adminCookie);
  const area = await createOrg('areas', { code: 'ACC-A-' + stamp, name: 'Área temporal', companyId: company.id }, adminCookie);
  const department = await createOrg('departments', { code: 'ACC-D-' + stamp, name: 'Departamento temporal', areaId: area.id }, adminCookie);
  const sectionA = await createOrg('sections', { code: 'ACC-S1-' + stamp, name: 'Sección A temporal', departmentId: department.id }, adminCookie);
  const sectionB = await createOrg('sections', { code: 'ACC-S2-' + stamp, name: 'Sección B temporal', departmentId: department.id }, adminCookie);
  const positionA = await createOrg('positions', { code: 'ACC-P1-' + stamp, name: 'Puesto A temporal', sectionId: sectionA.id }, adminCookie);
  const positionB = await createOrg('positions', { code: 'ACC-P2-' + stamp, name: 'Puesto B temporal', sectionId: sectionB.id }, adminCookie);
  const userAResult = await request('/users', { method: 'POST', body: JSON.stringify({ name: 'Acceptance A', username: 'acc.a.' + stamp, email: 'acc.a.' + stamp + '@local.test', password: 'Acceptance123!', role: 'CONSULTA', positionId: positionA.id }) }, adminCookie);
  await expectStatus(userAResult, 201, 'P04 usuario');
  const userBResult = await request('/users', { method: 'POST', body: JSON.stringify({ name: 'Acceptance B', username: 'acc.b.' + stamp, email: 'acc.b.' + stamp + '@local.test', password: 'Acceptance123!', role: 'CONSULTA', positionId: positionB.id }) }, adminCookie);
  await expectStatus(userBResult, 201, 'P11 usuario');
  const userA = userAResult.body as { id: number };
  const userB = userBResult.body as { id: number };
  const levels = await request('/services/level1', {}, adminCookie);
  await expectStatus(levels, 200, 'P04 niveles');
  const existingService = firstServices.body.data.find((item: { code: string }) => item.code === 'SE.01.01');
  if (!existingService) throw new Error('P04: no se encontró un servicio demo para probar la asignación.');
  const originalAssignment = { responsibleSectionId: existingService.responsibleSectionId ?? null, responsibleUserId: existingService.responsibleUserId ?? null };
  const service = await request('/services/' + existingService.id, { method: 'PATCH', body: JSON.stringify({ responsibleSectionId: sectionA.id, responsibleUserId: userA.id }) }, adminCookie);
  await expectStatus(service, 200, 'P04 servicio');
  const detail = await request('/services/' + existingService.id, {}, adminCookie);
  await expectStatus(detail, 200, 'P04 detalle');
  if (detail.body.responsible_section_id !== sectionA.id || detail.body.responsible_user_id !== userA.id) throw new Error('P04: no se conservaron las relaciones del responsable.');
  checks.push('P04');

  const duplicate = await request('/services', { method: 'POST', body: JSON.stringify({ code: existingService.code, name: 'Duplicado', level1Id: levels.body[0].id }) }, adminCookie);
  await expectStatus(duplicate, 409, 'P05 duplicado');
  const invalidParent = await request('/organization/areas', { method: 'POST', body: JSON.stringify({ code: 'ACC-BAD-' + stamp, name: 'Padre inexistente', companyId: 999999999 }) }, adminCookie);
  await expectStatus(invalidParent, 400, 'P05 padre inexistente');
  checks.push('P05');

  const invalidRange = await request('/services', { method: 'POST', body: JSON.stringify({ code: 'ACC.MIN.' + stamp, name: 'Rango inválido', level1Id: levels.body[0].id, minimum: 10, maximum: 5 }) }, adminCookie);
  await expectStatus(invalidRange, 400, 'P09 mínimo máximo');
  checks.push('P09');

  const wrongResponsible = await request('/services', { method: 'POST', body: JSON.stringify({ code: 'ACC.BADRESP.' + stamp, name: 'Responsable inválido', level1Id: levels.body[0].id, responsibleSectionId: sectionA.id, responsibleUserId: userB.id }) }, adminCookie);
  await expectStatus(wrongResponsible, 400, 'P11 responsable');
  checks.push('P11');

  const inactiveUser = await request('/users', { method: 'POST', body: JSON.stringify({ name: 'Acceptance inactive', username: 'acc.inactive.' + stamp, email: 'acc.inactive.' + stamp + '@local.test', password: 'Acceptance123!', role: 'CONSULTA', positionId: positionA.id }) }, adminCookie);
  await expectStatus(inactiveUser, 201, 'P02 usuario inactivo');
  const inactiveId = inactiveUser.body.id as number;
  const inactivePatch = await request('/users/' + inactiveId, { method: 'PATCH', body: JSON.stringify({ active: false }) }, adminCookie);
  await expectStatus(inactivePatch, 200, 'P02 desactivar usuario');
  const inactiveLogin = await request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'acc.inactive.' + stamp, password: 'Acceptance123!' }) });
  await expectStatus(inactiveLogin, 401, 'P02 usuario inactivo');

  const queryCookie = await login(process.env.DEMO_QUERY_USERNAME ?? 'consulta.demo', process.env.DEMO_QUERY_PASSWORD ?? 'Consulta123!');
  const forbidden = await request('/services', { method: 'POST', body: JSON.stringify({ code: 'ACC.FORBIDDEN.' + stamp, name: 'No debe guardarse', level1Id: levels.body[0].id }) }, queryCookie);
  await expectStatus(forbidden, 403, 'P03 escritura consulta');
  checks.push('P03');

  await request('/services/' + existingService.id, { method: 'PATCH', body: JSON.stringify(originalAssignment) }, adminCookie).catch(() => undefined);
  await request('/users/' + userA.id, { method: 'PATCH', body: JSON.stringify({ active: false }) }, adminCookie).catch(() => undefined);
  await request('/users/' + userB.id, { method: 'PATCH', body: JSON.stringify({ active: false }) }, adminCookie).catch(() => undefined);
  await deactivateOrg('positions', positionA.id, adminCookie).catch(() => undefined);
  await deactivateOrg('positions', positionB.id, adminCookie).catch(() => undefined);
  await deactivateOrg('sections', sectionA.id, adminCookie).catch(() => undefined);
  await deactivateOrg('sections', sectionB.id, adminCookie).catch(() => undefined);
  await deactivateOrg('departments', department.id, adminCookie).catch(() => undefined);
  await deactivateOrg('areas', area.id, adminCookie).catch(() => undefined);
  await deactivateOrg('companies', company.id, adminCookie).catch(() => undefined);
  await cleanupTemporaryData(stamp);

  const logout = await request('/auth/logout', { method: 'POST' }, adminCookie);
  await expectStatus(logout, 201, 'P02 logout');
  const afterLogout = await request('/auth/me', {}, adminCookie);
  await expectStatus(afterLogout, 401, 'P02 sesión cerrada');

  console.log(JSON.stringify({ ok: true, checks, temporaryDataPrefix: 'ACC-' + stamp }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });


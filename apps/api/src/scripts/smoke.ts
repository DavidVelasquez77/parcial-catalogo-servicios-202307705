import 'dotenv/config';

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000/api';

async function request(path: string, init: RequestInit = {}, cookie = '') {
  const response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  const setCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return { response, body, cookie: setCookie.map((item) => item.split(';')[0]).join('; ') };
}

async function main() {
  const invalid = await request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: process.env.DEMO_ADMIN_USERNAME ?? 'admin.demo', password: 'incorrecta' }) });
  if (invalid.response.status !== 401) throw new Error(`P01 inválido: esperaba 401 y recibió ${invalid.response.status}`);
  const adminLogin = await request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: process.env.DEMO_ADMIN_USERNAME ?? 'admin.demo', password: process.env.DEMO_ADMIN_PASSWORD ?? 'Admin123!' }) });
  if (adminLogin.response.status !== 201 || !adminLogin.cookie) throw new Error(`P01 válido: login admin falló (${adminLogin.response.status})`);
  const services = await request('/services?search=SE.12&status=REVIEW', {}, adminLogin.cookie);
  if (services.response.status !== 200 || services.body.total !== 3) throw new Error('P10: el filtro SE.12 no devolvió los tres servicios esperados.');
  const queryLogin = await request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: process.env.DEMO_QUERY_USERNAME ?? 'consulta.demo', password: process.env.DEMO_QUERY_PASSWORD ?? 'Consulta123!' }) });
  if (queryLogin.response.status !== 201 || !queryLogin.cookie) throw new Error('P03: login de consulta falló.');
  const forbidden = await request('/services', { method: 'POST', body: JSON.stringify({ code: 'TEST.99', name: 'No debe guardarse', level1Id: 1 }) }, queryLogin.cookie);
  if (forbidden.response.status !== 403) throw new Error(`P03: esperaba 403 y recibió ${forbidden.response.status}`);
  const logout = await request('/auth/logout', { method: 'POST' }, adminLogin.cookie);
  if (logout.response.status !== 201) throw new Error('P02: logout falló.');
  const afterLogout = await request('/auth/me', {}, adminLogin.cookie);
  if (afterLogout.response.status !== 401) throw new Error('P02: la sesión siguió válida después de logout.');
  console.log(JSON.stringify({ ok: true, checks: ['P01', 'P02', 'P03', 'P10'] }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

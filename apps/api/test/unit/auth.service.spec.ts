import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { DatabaseService } from '../../src/database/database.service';

describe('AuthService · unitarias', () => {
  const query = jest.fn();
  const db = { query } as unknown as DatabaseService;
  let service: AuthService;

  beforeEach(() => {
    query.mockReset();
    service = new AuthService(db);
  });

  it('devuelve el usuario autenticado sin exponer el hash', async () => {
    const passwordHash = await bcrypt.hash('Secret123!', 4);
    query.mockResolvedValue({ rows: [{ id: 1, name: 'Admin', username: 'admin', email: 'admin@local.test', role: 'ADMIN', active: true, positionId: 1, sectionId: 1, passwordHash }] });

    const user = await service.login('admin', 'Secret123!');

    expect(user).toMatchObject({ id: 1, username: 'admin', role: 'ADMIN' });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rechaza una contraseña incorrecta', async () => {
    const passwordHash = await bcrypt.hash('Secret123!', 4);
    query.mockResolvedValue({ rows: [{ id: 1, name: 'Admin', username: 'admin', email: null, role: 'ADMIN', active: true, positionId: 1, sectionId: 1, passwordHash }] });

    await expect(service.login('admin', 'incorrecta')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza una cuenta inactiva aunque la contraseña sea válida', async () => {
    const passwordHash = await bcrypt.hash('Secret123!', 4);
    query.mockResolvedValue({ rows: [{ id: 1, name: 'Admin', username: 'admin', email: null, role: 'ADMIN', active: false, positionId: 1, sectionId: 1, passwordHash }] });

    await expect(service.login('admin', 'Secret123!')).rejects.toThrow('Usuario o contraseña incorrectos.');
  });
});

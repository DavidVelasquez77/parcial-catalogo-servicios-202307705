import { BadRequestException } from '@nestjs/common';
import { ServicesService } from '../../src/services/services.service';
import { DatabaseService } from '../../src/database/database.service';

describe('ServicesService · unitarias', () => {
  const query = jest.fn();
  const db = { query } as unknown as DatabaseService;
  let service: ServicesService;

  beforeEach(() => {
    query.mockReset();
    service = new ServicesService(db);
  });

  it('rechaza un mínimo mayor que el máximo', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 10 }] });

    await expect(service.create({ code: 'UNIT.RANGE', name: 'Rango', level1Id: 10, minimum: 10, maximum: 5 })).rejects.toThrow('El mínimo no puede ser mayor que el máximo.');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rechaza un responsable sin sección', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 10 }] });

    await expect(service.create({ code: 'UNIT.RESP', name: 'Responsable', level1Id: 10, responsibleUserId: 5 })).rejects.toThrow('Un usuario responsable requiere una sección.');
  });

  it('conserva umbrales ausentes como null al crear', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 10 }] }).mockResolvedValueOnce({ rows: [{ id: 20, code: 'UNIT.NULL', minimum: null, maximum: null }] });

    const created = await service.create({ code: 'UNIT.NULL', name: 'Sin umbrales', level1Id: 10 });

    expect(created).toMatchObject({ id: 20, code: 'UNIT.NULL' });
    expect(query.mock.calls[2][1]).toEqual(expect.arrayContaining([null, null]));
  });

  it('calcula total y páginas al listar servicios', async () => {
    query.mockResolvedValue({ rows: [{ id: 1, code: 'UNIT.01', total: 46 }] });

    const result = await service.list({ page: '2', pageSize: '10' });

    expect(result).toMatchObject({ total: 46, page: 2, pageSize: 10, pages: 5 });
    expect(result.data).toHaveLength(1);
  });
});

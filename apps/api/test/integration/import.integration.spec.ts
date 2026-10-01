import { DatabaseService } from '../../src/database/database.service';
import { ImportService } from '../../src/imports/import.service';

describe('ImportService · integración con PostgreSQL y Excel real', () => {
  let db: DatabaseService;
  let service: ImportService;
  const file = process.env.IMPORT_FILE ?? '/app/data/CatalogoServicios.xlsx';

  beforeAll(() => {
    db = new DatabaseService();
    service = new ImportService(db);
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  it('valida la hoja, encabezados y 46 servicios del archivo original', async () => {
    const report = await service.validateFile(file);

    expect(report.sheet).toBe('Servicios Externos');
    expect(report.headerRow).toBe(4);
    expect(report.serviceRows).toBe(46);
    expect(report.continuationRows).toBe(51);
    expect(report.warnings).toEqual([]);
  });

  it('reimporta el mismo Excel sin crear ni actualizar registros', async () => {
    await service.run(file);
    const second = await service.run(file);

    expect(second).toMatchObject({ created: 0, updated: 0, skipped: 46, level1: 12, level2: 46 });
  });
});

import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ExcelJS from 'exceljs';
import { DatabaseService } from '../database/database.service';

type CellValue = string | number | boolean | null;
type CatalogMaps = { classes: Map<string, number>; criticalities: Map<string, number>; types: Map<string, number> };
type ValidationWarning = { code: string; message: string; rows?: string };
type ValidationReport = {
  file: string;
  sheet: string;
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  serviceRows: number;
  continuationRows: number;
  warnings: ValidationWarning[];
};

const EXPECTED_HEADERS = ['COD.N1', 'SERVICIO - NIVEL 1', 'COD.N2', 'SERVICIO - NIVEL 2', 'ACTIVO', 'CLASE DE SERVICIO', 'CRITICIDAD', 'TIPO DE SERVICIO', 'DESCRIPCIÓN', 'MÉTRICA', 'MINIMO', 'MAXIMO'];

const text = (value: CellValue): string | null => value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim();
const numeric = (value: CellValue): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};
const normalizedHeader = (value: CellValue): string => String(value ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

@Injectable()
export class ImportService {
  constructor(private readonly db: DatabaseService) {}

  private value(sheet: ExcelJS.Worksheet, row: number, column: number): CellValue {
    const cell = sheet.getCell(row, column);
    const raw = (cell.isMerged && cell.master.address !== cell.address ? cell.master.value : cell.value) as unknown;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') {
      if ('richText' in raw && Array.isArray(raw.richText)) return raw.richText.map((part: { text?: string }) => part.text ?? '').join('');
      if ('text' in raw && typeof raw.text === 'string') return raw.text;
      if ('result' in raw && (typeof raw.result === 'string' || typeof raw.result === 'number')) return raw.result;
    }
    return raw as CellValue;
  }

  private isMergedSecondary(sheet: ExcelJS.Worksheet, row: number, column: number): boolean {
    const cell = sheet.getCell(row, column);
    return cell.isMerged && cell.master.address !== cell.address;
  }

  private async catalogs(): Promise<CatalogMaps> {
    const [classes, criticalities, types] = await Promise.all([
      this.db.query<{ id: number; label: string }>('SELECT id, label FROM service_classes'),
      this.db.query<{ id: number; label: string }>('SELECT id, label FROM criticalities'),
      this.db.query<{ id: number; label: string }>('SELECT id, label FROM service_types'),
    ]);
    return {
      classes: new Map(classes.rows.map((item) => [item.label, item.id])),
      criticalities: new Map(criticalities.rows.map((item) => [item.label, item.id])),
      types: new Map(types.rows.map((item) => [item.label, item.id])),
    };
  }

  private rowHasContent(sheet: ExcelJS.Worksheet, row: number): boolean {
    return Array.from({ length: 12 }, (_, index) => this.value(sheet, row, index + 1)).some((item) => text(item) !== null);
  }

  private findDataEnd(sheet: ExcelJS.Worksheet): number {
    let seenData = false;
    let blankStreak = 0;
    let lastDataRow = 4;
    for (let row = 5; row <= sheet.actualRowCount; row += 1) {
      if (this.rowHasContent(sheet, row)) {
        seenData = true;
        blankStreak = 0;
        lastDataRow = row;
      } else if (seenData) {
        blankStreak += 1;
        if (blankStreak >= 3) return lastDataRow;
      }
    }
    return lastDataRow;
  }

  private validationError(report: Omit<ValidationReport, 'warnings'>, errors: string[]): never {
    throw new BadRequestException({ message: 'El archivo de importación no cumple la estructura esperada.', errors, report });
  }

  async validateFile(filePath = process.env.IMPORT_FILE ?? path.resolve(process.cwd(), 'data', 'CatalogoServicios.xlsx')): Promise<ValidationReport> {
    if (!fs.existsSync(filePath)) throw new BadRequestException(`No existe el archivo de importación: ${filePath}`);
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch (error) {
      throw new BadRequestException(`No se pudo leer el Excel. Verifica que sea un archivo .xlsx válido: ${error instanceof Error ? error.message : String(error)}`);
    }
    const sheet = workbook.getWorksheet('Servicios Externos');
    if (!sheet) throw new BadRequestException('El Excel no contiene la hoja obligatoria "Servicios Externos".');
    const errors: string[] = [];
    const warnings: ValidationWarning[] = [];
    const headerRow = 4;
    const headers = EXPECTED_HEADERS.map((expected, index) => normalizedHeader(this.value(sheet, headerRow, index + 1)));
    EXPECTED_HEADERS.forEach((expected, index) => {
      if (headers[index] !== normalizedHeader(expected)) errors.push(`La columna ${String.fromCharCode(65 + index)}4 debe ser "${expected}" y contiene "${headers[index] || '(vacío)'}".`);
    });
    const dataStartRow = 5;
    const dataEndRow = this.findDataEnd(sheet);
    if (dataEndRow < dataStartRow) errors.push('No se encontraron filas de datos después de la fila de encabezados.');
    let currentLevel1: string | null = null;
    let serviceRows = 0;
    let continuationRows = 0;
    const codes = new Map<string, number>();
    for (let row = dataStartRow; row <= dataEndRow; row += 1) {
      const level1Code = text(this.value(sheet, row, 1));
      const level1Name = text(this.value(sheet, row, 2));
      const level2Code = this.isMergedSecondary(sheet, row, 3) ? null : text(this.value(sheet, row, 3));
      const level2Name = text(this.value(sheet, row, 4));
      if (level1Code) {
        currentLevel1 = level1Code;
        if (!level1Name) errors.push(`La fila ${row} tiene COD.N1 "${level1Code}" pero no tiene nombre de nivel 1.`);
      }
      if (!level2Code) {
        if (this.rowHasContent(sheet, row)) continuationRows += 1;
        continue;
      }
      serviceRows += 1;
      if (!currentLevel1) errors.push(`La fila ${row} tiene COD.N2 "${level2Code}" sin un COD.N1 padre.`);
      if (!level2Name) errors.push(`La fila ${row} tiene COD.N2 "${level2Code}" pero no tiene nombre de nivel 2.`);
      const previous = codes.get(level2Code);
      if (previous) warnings.push({ code: 'DUPLICATE_LEVEL2', message: `El código ${level2Code} aparece más de una vez; se conservará la primera ocurrencia.`, rows: `${previous},${row}` });
      else codes.set(level2Code, row);
      const active = this.value(sheet, row, 5);
      const minimumRaw = this.value(sheet, row, 11);
      const maximumRaw = this.value(sheet, row, 12);
      if (active !== null && typeof active !== 'string' && typeof active !== 'number') errors.push(`La fila ${row} tiene ACTIVO con un tipo no admitido.`);
      const minimum = numeric(minimumRaw);
      const maximum = numeric(maximumRaw);
      const hasMinimum = minimumRaw !== null && !(typeof minimumRaw === 'string' && minimumRaw.trim() === '');
      const hasMaximum = maximumRaw !== null && !(typeof maximumRaw === 'string' && maximumRaw.trim() === '');
      if (hasMinimum && minimum === null) errors.push(`La fila ${row} tiene un Minimo no numérico.`);
      if (hasMaximum && maximum === null) errors.push(`La fila ${row} tiene un Maximo no numérico.`);
      if (minimum !== null && maximum !== null && Number.isFinite(minimum) && Number.isFinite(maximum) && minimum > maximum) errors.push(`La fila ${row} tiene Minimo mayor que Maximo.`);
    }
    if (serviceRows === 0) errors.push('No se encontró ningún COD.N2 en el bloque de datos.');
    if (errors.length) this.validationError({ file: filePath, sheet: sheet.name, headerRow, dataStartRow, dataEndRow, serviceRows, continuationRows }, errors);
    return { file: filePath, sheet: sheet.name, headerRow, dataStartRow, dataEndRow, serviceRows, continuationRows, warnings };
  }

  async run(filePath = process.env.IMPORT_FILE ?? path.resolve(process.cwd(), 'data', 'CatalogoServicios.xlsx')) {
    const validation = await this.validateFile(filePath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(validation.sheet);
    if (!sheet) throw new BadRequestException(`No se encontró la hoja validada ${validation.sheet}.`);
    const importRun = await this.db.query<{ id: number }>(`INSERT INTO import_runs(file_name, status) VALUES($1, 'RUNNING') RETURNING id`, [path.basename(filePath)]);
    const runId = importRun.rows[0].id;
    const summary = { runId, created: 0, updated: 0, skipped: 0, observed: 0, level1: 0, level2: 0 };
    try {
      const maps = await this.catalogs();
      await this.db.transaction(async (client) => {
        const level1 = new Map<string, number>();
        const existingL1 = await client.query<{ id: number; code: string; name: string }>('SELECT id, code, name FROM service_level_1');
        existingL1.rows.forEach((item) => level1.set(item.code, item.id));
        const seenL2 = new Set<string>();
        let currentLevel1Code: string | null = null;
        let continuationRows = 0;

        for (let row = validation.dataStartRow; row <= validation.dataEndRow; row += 1) {
          const level1Code = text(this.value(sheet, row, 1));
          const level1Name = text(this.value(sheet, row, 2));
          const level2Code = this.isMergedSecondary(sheet, row, 3) ? null : text(this.value(sheet, row, 3));
          const level2Name = text(this.value(sheet, row, 4));
          if (level1Code) {
            currentLevel1Code = level1Code;
            if (!level1.has(level1Code)) {
              const inserted = await client.query<{ id: number }>('INSERT INTO service_level_1(code, name) VALUES($1,$2) RETURNING id', [level1Code, level1Name ?? 'Sin nombre']);
              level1.set(level1Code, inserted.rows[0].id);
              summary.created += 1;
            } else {
              const existing = await client.query<{ name: string }>('SELECT name FROM service_level_1 WHERE code=$1', [level1Code]);
              if (existing.rows[0] && existing.rows[0].name !== level1Name && level1Code === 'SE.12') {
                await this.observation(client, runId, 'WARNING', level1Code, `Conflicto de nombre: se conserva "${existing.rows[0].name}" y se observa "${level1Name}".`, 'Servicios Externos', String(row));
                summary.observed += 1;
              }
            }
          }
          if (!level2Code) {
            continuationRows += 1;
            continue;
          }
          if (seenL2.has(level2Code)) {
            summary.skipped += 1;
            continue;
          }
          seenL2.add(level2Code);
          const parentCode = currentLevel1Code;
          const parentId = parentCode ? level1.get(parentCode) : undefined;
          if (!parentId) {
            await this.observation(client, runId, 'ERROR', level2Code, 'No se encontró el servicio de nivel 1 padre.', 'Servicios Externos', String(row));
            summary.observed += 1;
            summary.skipped += 1;
            continue;
          }
          const activeCode = text(this.value(sheet, row, 5));
          const classLabel = text(this.value(sheet, row, 6));
          const criticalityLabel = text(this.value(sheet, row, 7));
          const typeLabel = text(this.value(sheet, row, 8));
          const description = text(this.value(sheet, row, 9));
          const metric = text(this.value(sheet, row, 10));
          const minimum = numeric(this.value(sheet, row, 11));
          const maximum = numeric(this.value(sheet, row, 12));
          if (minimum !== null && maximum !== null && minimum > maximum) {
            await this.observation(client, runId, 'ERROR', level2Code, 'El mínimo es mayor que el máximo.', 'Servicios Externos', String(row));
            summary.observed += 1;
            summary.skipped += 1;
            continue;
          }
          const classId = classLabel ? maps.classes.get(classLabel) ?? null : null;
          const criticalityId = criticalityLabel ? maps.criticalities.get(criticalityLabel) ?? null : null;
          const typeId = typeLabel ? maps.types.get(typeLabel) ?? null : null;
          if ((classLabel && !classId) || (criticalityLabel && !criticalityId) || (typeLabel && !typeId)) {
            await this.observation(client, runId, 'WARNING', level2Code, 'Una opción del catálogo no coincide; se conserva como desconocida.', 'Servicios Externos', String(row));
            summary.observed += 1;
          }
          const status = activeCode === 'S' ? 'ACTIVE' : activeCode === 'N' ? 'INACTIVE' : 'REVIEW';
          const missing = !activeCode || !classLabel || !criticalityLabel || !typeLabel || !metric;
          const mergedCellsResolved = [1, 2, 3, 4, 10].some((column) => { const cell = sheet.getCell(row, column); return cell.isMerged && cell.master.address !== cell.address; });
          const sourceTransformations = JSON.stringify({ mergedCellsResolved, canonicalLevel1: parentCode === 'SE.12' ? 'first-occurrence' : null, missingAttributesKeptNull: missing });
          const existing = await client.query<{ id: number; name: string; level_1_id: number; active_code: string | null; status: string; class_id: number | null; criticality_id: number | null; type_id: number | null; description: string | null; metric: string | null; minimum: number | null; maximum: number | null; source_sheet: string | null; source_rows: string | null; source_transformations: string | null }>('SELECT id, name, level_1_id, active_code, status, class_id, criticality_id, type_id, description, metric, minimum, maximum, source_sheet, source_rows, source_transformations FROM service_level_2 WHERE code=$1', [level2Code]);
          if (existing.rows[0]) {
            const current = existing.rows[0];
            const nextName = level2Name ?? level2Code;
            const sameNumber = (left: number | string | null, right: number | null) => (left === null && right === null) || (left !== null && right !== null && Number(left) === Number(right));
            const unchanged = current.name === nextName
              && Number(current.level_1_id) === Number(parentId)
              && current.active_code === activeCode
              && current.status === status
              && current.class_id === classId
              && current.criticality_id === criticalityId
              && current.type_id === typeId
              && current.description === description
              && current.metric === metric
              && sameNumber(current.minimum, minimum)
              && sameNumber(current.maximum, maximum)
              && current.source_sheet === 'Servicios Externos'
              && current.source_rows === String(row)
              && current.source_transformations === sourceTransformations;
            if (unchanged) {
              summary.skipped += 1;
            } else {
              await client.query(`UPDATE service_level_2 SET name=$1, level_1_id=$2, active_code=$3, status=$4, class_id=$5, criticality_id=$6, type_id=$7, description=$8, metric=$9, minimum=$10, maximum=$11, source_sheet=$12, source_rows=$13, source_transformations=$14, updated_at=NOW() WHERE id=$15`, [nextName, parentId, activeCode, status, classId, criticalityId, typeId, description, metric, minimum, maximum, 'Servicios Externos', String(row), sourceTransformations, current.id]);
              summary.updated += 1;
            }
          } else {
            await client.query(`INSERT INTO service_level_2(code,name,level_1_id,active_code,status,class_id,criticality_id,type_id,description,metric,minimum,maximum,source_sheet,source_rows,source_transformations) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [level2Code, level2Name ?? level2Code, parentId, activeCode, status, classId, criticalityId, typeId, description, metric, minimum, maximum, 'Servicios Externos', String(row), sourceTransformations]);
            summary.created += 1;
          }
          if (missing) {
            await this.observation(client, runId, 'WARNING', level2Code, 'El servicio tiene atributos incompletos y queda en revisión.', 'Servicios Externos', String(row));
            summary.observed += 1;
          }
        }
        if (continuationRows) {
          await this.observation(client, runId, 'INFO', null, `${continuationRows} filas de continuación sin código de servicio no generaron registros.`, 'Servicios Externos', '5-101');
          summary.observed += 1;
        }
        await this.assignDemo(client, 'SE.01.01', 'SEC-SOP', 'admin.demo');
        await this.assignDemo(client, 'SE.03.01', 'SEC-SOP', 'consulta.demo');
        await this.assignDemo(client, 'SE.12.1', 'SEC-SOP', 'admin.demo');
      });
      const levelCounts = await this.db.query<{ l1: number; l2: number }>(`SELECT (SELECT COUNT(*) FROM service_level_1)::INTEGER AS l1, (SELECT COUNT(*) FROM service_level_2)::INTEGER AS l2`);
      summary.level1 = levelCounts.rows[0].l1;
      summary.level2 = levelCounts.rows[0].l2;
      await this.db.query(`UPDATE import_runs SET status='SUCCESS', created_count=$1, updated_count=$2, skipped_count=$3, observed_count=$4, finished_at=NOW() WHERE id=$5`, [summary.created, summary.updated, summary.skipped, summary.observed, runId]);
      return { ...summary, validation: { dataEndRow: validation.dataEndRow, serviceRows: validation.serviceRows, continuationRows: validation.continuationRows, warnings: validation.warnings } };
    } catch (error) {
      await this.db.query(`UPDATE import_runs SET status='FAILED', error_message=$1, finished_at=NOW() WHERE id=$2`, [error instanceof Error ? error.message : String(error), runId]);
      throw error;
    }
  }

  private async observation(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, runId: number, severity: string, code: string | null, message: string, sheet: string, rows: string) {
    await client.query(`INSERT INTO import_observations(import_run_id,severity,code,message,source_sheet,source_rows) VALUES($1,$2,$3,$4,$5,$6)`, [runId, severity, code, message, sheet, rows]);
  }

  private async assignDemo(client: { query: <T = unknown>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> }, serviceCode: string, sectionCode: string, userCode: string) {
    const service = await client.query<{ id: number }>('SELECT id FROM service_level_2 WHERE code=$1', [serviceCode]);
    const section = await client.query<{ id: number }>('SELECT id FROM sections WHERE code=$1', [sectionCode]);
    const user = await client.query<{ id: number }>('SELECT id FROM users WHERE username=$1', [userCode]);
    if (service.rows[0] && section.rows[0] && user.rows[0]) await client.query(`UPDATE service_level_2 SET responsible_section_id=$1, responsible_user_id=$2 WHERE id=$3`, [section.rows[0].id, user.rows[0].id, service.rows[0].id]);
  }

  async listRuns() {
    const runs = await this.db.query(`SELECT id, file_name AS "fileName", status, created_count AS "createdCount", updated_count AS "updatedCount", skipped_count AS "skippedCount", observed_count AS "observedCount", started_at AS "startedAt", finished_at AS "finishedAt", error_message AS "errorMessage" FROM import_runs ORDER BY id DESC`);
    return runs.rows;
  }

  async observations(runId: number) {
    const result = await this.db.query(`SELECT id, severity, code, message, source_sheet AS "sourceSheet", source_rows AS "sourceRows", created_at AS "createdAt" FROM import_observations WHERE import_run_id=$1 ORDER BY id`, [runId]);
    return result.rows;
  }
}

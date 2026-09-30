import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ExcelJS from 'exceljs';
import { DatabaseService } from '../database/database.service';

type CellValue = string | number | boolean | null;
type CatalogMaps = { classes: Map<string, number>; criticalities: Map<string, number>; types: Map<string, number> };

const text = (value: CellValue): string | null => value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim();
const numeric = (value: CellValue): number | null => value === null || value === undefined || value === '' ? null : Number(value);

@Injectable()
export class ImportService {
  constructor(private readonly db: DatabaseService) {}

  private value(sheet: ExcelJS.Worksheet, row: number, column: number): CellValue {
    const raw = sheet.getCell(row, column).value as unknown;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') {
      if ('richText' in raw && Array.isArray(raw.richText)) return raw.richText.map((part: { text?: string }) => part.text ?? '').join('');
      if ('text' in raw && typeof raw.text === 'string') return raw.text;
      if ('result' in raw && (typeof raw.result === 'string' || typeof raw.result === 'number')) return raw.result;
    }
    return raw as CellValue;
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

  async run(filePath = process.env.IMPORT_FILE ?? path.resolve(process.cwd(), 'CatalogoServicios.xlsx')) {
    if (!fs.existsSync(filePath)) throw new BadRequestException(`No existe el archivo de importación: ${filePath}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet('Servicios Externos');
    if (!sheet) throw new BadRequestException('El Excel no contiene la hoja Servicios Externos.');
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

        for (let row = 5; row <= 101; row += 1) {
          const level1Code = text(this.value(sheet, row, 1));
          const level1Name = text(this.value(sheet, row, 2));
          const level2Code = text(this.value(sheet, row, 3));
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
          const existing = await client.query<{ id: number }>('SELECT id FROM service_level_2 WHERE code=$1', [level2Code]);
          if (existing.rows[0]) {
            await client.query(`UPDATE service_level_2 SET name=$1, level_1_id=$2, active_code=$3, status=$4, class_id=$5, criticality_id=$6, type_id=$7, description=$8, metric=$9, minimum=$10, maximum=$11, source_sheet=$12, source_rows=$13, source_transformations=$14, updated_at=NOW() WHERE id=$15`, [level2Name ?? level2Code, parentId, activeCode, status, classId, criticalityId, typeId, description, metric, minimum, maximum, 'Servicios Externos', String(row), sourceTransformations, existing.rows[0].id]);
            summary.updated += 1;
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
      return summary;
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

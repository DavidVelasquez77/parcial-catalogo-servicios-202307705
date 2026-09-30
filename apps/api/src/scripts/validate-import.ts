import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ImportService } from '../imports/import.service';

async function main() {
  const context = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const report = await context.get(ImportService).validateFile(process.argv[2] ?? process.env.IMPORT_FILE);
    console.log(JSON.stringify({ ok: true, ...report }, null, 2));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ImportService } from '../imports/import.service';

async function main() {
  const context = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const result = await context.get(ImportService).run(process.argv[2] ?? process.env.IMPORT_FILE);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

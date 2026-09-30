# Evidencia de ciclo Harness + Loop

## Ciclo real ejecutado

1. Plan: levantar PostgreSQL, API y frontend mediante Compose.
2. Act: ejecutar `docker compose up -d`.
3. Observe: el API falló inicialmente porque el runner buscaba migraciones en `/app/apps/database/migrations`.
4. Evaluate: los logs mostraron `ENOENT` y el contenedor API no inició.
5. Correct: se corrigió la ruta a `/app/database/migrations`.
6. Re-evaluate: la migración `001_init.sql` se aplicó y Nest inició correctamente.
7. Success: seed, importación y verificación devolvieron 12 niveles 1, 46 niveles 2 y 0 duplicados.

## Controles

```text
docker compose build
docker compose up -d
docker compose exec api node apps/api/dist/scripts/seed-demo.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
docker compose restart db api
docker compose up -d web
docker compose exec api node apps/api/dist/scripts/verify-import.js
```

La ejecución no eliminó el volumen de PostgreSQL.

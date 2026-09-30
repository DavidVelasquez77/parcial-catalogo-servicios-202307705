# Evidencia del ciclo Harness + Loop

## 1. Qué se considera harness en este proyecto

El harness no es únicamente Docker. Es el conjunto coordinado de:

- instrucciones operativas en AGENTS.md;
- código de la aplicación;
- archivo Excel controlado;
- Dockerfiles y compose.yaml;
- migración SQL;
- scripts de seed, importación, verificación, aceptación y smoke;
- comprobación de persistencia después de reiniciar PostgreSQL;
- auditoría de secretos;
- comandos de logs y recuperación;
- códigos de salida;
- documentación de los resultados.

Con estas piezas otra persona puede levantar el entorno, cargar datos, ejecutar controles, observar fallos y repetir la validación.

## 2. Comando principal

~~~powershell
$env:HARNESS_RUN_SMOKE='1'
npm run harness
~~~

En Linux o macOS:

~~~bash
HARNESS_RUN_SMOKE=1 npm run harness
~~~

## 3. Controles que ejecuta harness.mjs

| Orden | Control | Qué verifica | Falla si |
|---:|---|---|---|
| 1 | typecheck | API y frontend compilan en TypeScript | existen errores de tipos |
| 2 | build | NestJS y Vite generan artefactos | falla el build |
| 3 | secret-audit | no hay secretos obvios en fuentes o documentación | encuentra patrones prohibidos |
| 4 | compose-config | Compose es sintácticamente válido | Docker no puede resolver la configuración |
| 5 | acceptance | P01–P11: autenticación, roles, organización, duplicados, importación, SE.12, umbrales y responsables | un contrato funcional no coincide |
| 6 | smoke opcional | recorrido corto P01, P02, P03 y P10 | un estado HTTP no coincide |
| 7 | persistence | reinicio controlado de db y verificación 12/46/0/3 | se pierden datos o cambia el conteo |

Cada control hereda el código de salida del proceso. Un control fallido detiene el harness y reporta el paso responsable. La aceptación usa datos temporales con prefijo `ACC-` y los limpia mediante bajas lógicas o eliminación acotada de filas creadas por la propia prueba.

## 4. Datos de evaluación

Las cuentas y la organización mínima se crean con:

~~~bash
docker compose exec api node apps/api/dist/scripts/seed-demo.js
~~~

La salida esperada incluye:

~~~json
{"ok":true,"companyId":1,"areaId":1,"departmentId":1,"sectionId":1,"demoUsers":["admin.demo","consulta.demo"]}
~~~

El seed es repetible: actualiza los registros demo sin crear otra cuenta demo en cada ejecución.

## 5. Ciclo ejecutado y fallo real corregido

### Plan

Levantar PostgreSQL, API y frontend mediante Compose. Luego ejecutar typecheck, build, auditoría, aceptación P01–P11, smoke y persistencia.

### Act

Se ejecutó:

~~~text
docker compose build
docker compose up -d
~~~

### Observe

El API no inició porque el script de migración buscaba los archivos en una ruta inexistente dentro del contenedor. El log mostró un error de archivo no encontrado para:

~~~text
/app/apps/database/migrations
~~~

### Evaluate

Se comparó el error con apps/api/Dockerfile. El Dockerfile copia la carpeta database en:

~~~text
/app/database
~~~

Por tanto, la ruta usada por el script no coincidía con la ruta real del contenedor.

### Correct

Se corrigió el script de migración para resolver:

~~~text
/app/database/migrations
~~~

Luego se reconstruyó la imagen API.

### Re-evaluate

Se repitieron:

~~~text
docker compose up -d
docker compose exec api node apps/api/dist/scripts/seed-demo.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
docker compose exec api node apps/api/dist/scripts/smoke.js
npm test
npm run persistence:check
~~~

Resultado:

~~~json
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3}
{"ok":true,"checks":["P01","P02","P06","P07","P08","P10","P04","P05","P09","P11","P03"]}
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3}
~~~

### Success

El API inició, la migración se aplicó, la importación conservó 12 niveles 1 y 46 niveles 2, no hubo duplicados y los controles de autenticación finalizaron correctamente.

## 6. Segunda observación corregida

Durante la implementación del importador se observó que la librería inicialmente utilizada tenía una vulnerabilidad de severidad alta y además no era la mejor opción para inspeccionar celdas combinadas en este entorno.

La decisión fue:

1. retirar la dependencia inicial;
2. usar exceljs;
3. leer workbook, worksheet y valores de la celda master;
4. reconstruir la imagen Docker;
5. repetir importación, verify-import y smoke.

La ejecución final con exceljs produjo:

~~~json
{"runId":3,"created":0,"updated":46,"skipped":49,"observed":5,"level1":12,"level2":46}
~~~

## 7. Persistencia

Para verificar que el harness no depende de una base efímera:

~~~bash
docker compose restart db api
docker compose up -d web
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

El resultado conservó:

~~~json
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3}
~~~

No se ejecutó docker compose down -v durante esta comprobación.

## 8. Límites de seguridad del harness

- No publica archivos .env.
- No lee ni modifica el Excel original.
- No ejecuta comandos recibidos desde las celdas del Excel.
- No elimina volúmenes automáticamente.
- No exige una clave de proveedor de IA.
- Usa únicamente datos demo controlados.
- Detiene el proceso cuando una validación falla.

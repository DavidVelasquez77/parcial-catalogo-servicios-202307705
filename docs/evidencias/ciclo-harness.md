# Evidencia del harness y ciclo de corrección

## 1. Qué se considera harness en este proyecto

El harness no es únicamente Docker. Es el conjunto coordinado de:

- instrucciones operativas en AGENTS.md;
- código de la aplicación;
- archivo Excel controlado;
- Dockerfiles y compose.yaml;
- migración SQL;
- scripts de seed, validación, importación, verificación, aceptación y smoke;
- comprobación de persistencia después de reiniciar PostgreSQL;
- auditoría de secretos;
- comandos de logs y recuperación;
- códigos de salida;
- documentación de los resultados.

Con estas piezas otra persona puede levantar el entorno, cargar datos, ejecutar controles, observar fallos y repetir la validación.

## 2. Comando principal

~~~powershell
& .\scripts\harness-docker.ps1
~~~

En Linux o macOS:

~~~bash
sh scripts/harness-docker.sh
~~~

Estos comandos son el flujo oficial Docker-only: no requieren Node.js en el host. `npm run harness` se conserva como atajo opcional para desarrollo local.

## 3. Controles que ejecuta el harness Docker-only

| Orden | Control | Qué verifica | Falla si |
|---:|---|---|---|
| 1 | build | Docker compila API y frontend mediante sus Dockerfiles | falla el build |
| 2 | secret-audit | no hay secretos obvios en fuentes o documentación | encuentra patrones prohibidos |
| 3 | compose-config | Compose es sintácticamente válido | Docker no puede resolver la configuración |
| 4 | import-validation | Excel legible, hoja, encabezados A4:L4, rango, códigos, tipos y umbrales | el archivo no cumple el contrato estructural |
| 5 | seed/import/verify | prepara datos demo, sincroniza y comprueba 12/46/0/3 | falla la carga o cambia el conteo |
| 6 | acceptance | P01–P11: autenticación, roles, organización, duplicados, importación, SE.12, umbrales y responsables | un contrato funcional no coincide |
| 7 | smoke | recorrido corto P01, P02, P03 y P10 | un estado HTTP no coincide |
| 8 | persistence | reinicio controlado de db y api dentro del flujo Docker y verificación 12/46/0/3 | se pierden datos o cambia el conteo |

Cada control hereda el código de salida del proceso. Un control fallido detiene el harness y reporta el paso responsable. La aceptación usa datos temporales con prefijo `ACC-`, prueba primero las bajas lógicas mediante la API y, si termina correctamente, elimina únicamente las filas que creó mediante una transacción de limpieza acotada. Una ejecución fallida conserva los datos para poder diagnosticarla.

El harness distingue tres clases de resultado:

- **éxito:** el proceso devuelve código 0 y una salida `ok: true`;
- **advertencia:** el proceso termina correctamente pero reporta observaciones de calidad, como nombres alternativos de SE.12;
- **fallo bloqueante:** el proceso devuelve código distinto de cero y no permite continuar con una etapa que podría contaminar la evidencia.

La validación del Excel es deliberadamente anterior a la creación de `import_runs`. De esta manera un archivo mal formado no deja una falsa ejecución iniciada ni toca servicios existentes.

## 4. Contrato de cada control

| Control | Entrada | Salida observable | Persistencia permitida |
|---|---|---|---|
| validate-import | data/CatalogoServicios.xlsx | reporte de estructura y advertencias | ninguna |
| import-catalog | Excel validado + DB | created, updated, skipped, observed | sincronización transaccional |
| verify-import | DB | conteos 12/46/0/3 | solo lectura |
| acceptance | API + datos temporales ACC- | checks P01–P11 | datos temporales, limpiados al terminar |
| persistence-check | Compose + volumen | verify después del reinicio | reinicio, no borrado |

## 5. Datos de evaluación

Las cuentas y la organización mínima se crean con:

~~~bash
docker compose exec api node apps/api/dist/scripts/seed-demo.js
~~~

La salida esperada incluye:

~~~json
{"ok":true,"companyId":1,"areaId":1,"departmentId":1,"sectionId":1,"demoUsers":["admin.demo","consulta.demo"]}
~~~

El seed es repetible: actualiza los registros demo sin crear otra cuenta demo en cada ejecución.

## 6. Ciclo ejecutado y fallo real corregido

### Plan

Levantar PostgreSQL, API y frontend mediante Compose. Luego construir las imágenes, validar el Excel, ejecutar seed, importación, aceptación P01–P11, smoke y persistencia, sin depender de Node en el host.

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

~~~powershell
& .\scripts\harness-docker.ps1
~~~

La misma rutina puede ejecutarse en Linux o macOS con `sh scripts/harness-docker.sh`. Todo el flujo se ejecuta en contenedores; no se requiere Node.js en el host.

Resultado:

~~~json
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3}
{"ok":true,"checks":["P01","P02","P06","P07","P08","P10","P04","P05","P09","P11","P03"]}
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3}
~~~

### Success

El API inició, la migración se aplicó, la validación aceptó el Excel original, la importación conservó 12 niveles 1 y 46 niveles 2, no hubo duplicados y los controles de autenticación finalizaron correctamente.

## 7. Segunda observación corregida

Durante la implementación del importador se observó que la librería inicialmente utilizada tenía una vulnerabilidad de severidad alta y además no era la mejor opción para inspeccionar celdas combinadas en este entorno.

La decisión fue:

1. retirar la dependencia inicial;
2. usar exceljs;
3. leer workbook, worksheet y valores de la celda master;
4. reconstruir la imagen Docker;
5. repetir importación, verify-import y smoke.

La ejecución histórica con exceljs produjo:

~~~json
{"runId":3,"created":0,"updated":46,"skipped":49,"observed":5,"level1":12,"level2":46}
~~~

Después se incorporó la comparación incremental. La reejecución con el mismo archivo produjo:

~~~json
{"runId":24,"created":0,"updated":0,"skipped":46,"observed":5,"level1":12,"level2":46}
~~~

Esta salida demuestra la regla solicitada: sin cambios no se sobrescribe nada; con cambios solo se actualiza el servicio afectado; con códigos nuevos se agregan registros.

Con el Excel original, la misma comprobación produce `level1: 12`, `level2: 46` y `skipped: 46` cuando los 46 servicios ya existen.

## 8. Reemplazo y validación de un Excel nuevo

El archivo de entrada no está codificado como una verdad inmutable. Está configurado por IMPORT_FILE y, en Compose, se reemplaza desde data/CatalogoServicios.xlsx. El procedimiento es:

1. guardar una copia del archivo anterior;
2. copiar el nuevo archivo al mismo nombre;
3. ejecutar `docker compose up --build -d api`;
4. ejecutar `docker compose exec api node apps/api/dist/scripts/validate-import.js`;
5. revisar errores, rango, códigos y advertencias;
6. ejecutar la importación solo con validación exitosa;
7. verificar conteos e historial.

La sincronización no hace una limpieza destructiva. Un código nuevo se agrega, un código modificado se actualiza, un código igual se ignora y un código ausente permanece en la base. Esta última regla protege contra un Excel incompleto o parcialmente reemplazado.

## 9. Persistencia

Para verificar que el harness no depende de una base efímera:

~~~bash
docker compose restart db
docker compose exec db pg_isready -U catalogo -d catalogo
docker compose restart api
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

El resultado conservó:

~~~json
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3,"expected":{"level1":12,"level2":46,"review":3}}
~~~

No se ejecutó docker compose down -v durante esta comprobación.

## 10. Límites de seguridad del harness

- No publica archivos .env.
- No lee ni modifica el Excel original.
- No ejecuta comandos recibidos desde las celdas del Excel.
- No elimina volúmenes automáticamente.
- No exige una clave de proveedor de IA.
- Usa únicamente datos demo controlados.
- Detiene el proceso cuando una validación falla.

# Guía de evaluación y pruebas

## Defensa rápida de Service Desk (segunda tarea)

Desde un clon limpio de `main`, copiar `.env.example` a `.env` (PowerShell: `Copy-Item .env.example .env`; Linux/macOS: `cp .env.example .env`), ejecutar `docker compose up --build -d` y luego los cinco comandos de preparación del [README](../README.md): seed de cuentas, importación del catálogo, importación de CMDB, generación de 5,000 dispositivos y seed de tickets. Entrar en `http://localhost:8080/` como `admin.demo` con la contraseña local de demostración configurada en `.env`.

En cinco minutos, mostrar: (1) **Tickets**, filtros, un detalle con bitácora, CI y campos específicos de proceso; (2) **Colas**, siete procesos, nivel y permisos por rol o usuario; (3) **CMDB**, dos CI con procedencia `CMDB.xlsx` y 5,000 dispositivos, clasificación y recorrido de impacto; (4) **Indicadores**, antigüedad, primera atención, resolución y cumplimiento en minutos calendario; (5) **Conocimientos**, autoservicio nivel 0 con las FAQ iniciales. Para demostrar el punto 8, filtrar la categoría **Hardware**, elegir **Solo dispositivos**, mostrar las 25 filas por página y el total; buscar `CMDB-XLSX-5` y abrir la ficha para señalar los valores originales, su responsable y procedencia. En otro CI, abrir un ticket desde **Tickets relacionados** y seguir sus permisos e historial. Para mostrar la distribución, ejecutar el generador con `EVAL2026` y leer `byLevelAndCategory`: Hardware = 5,000, Software = 0 y 1,250 en cada subcategoría de Hardware. Para impacto, señalar que el recorrido atraviesa `DEPENDS_ON` y `HOSTED_ON` en varios saltos y enumera servicios *potencialmente* afectados; no demuestra una interrupción efectiva. Para eventos, explicar que E0 solo se registra y se cierra; E1 se evalúa sin respuesta operativa; E2/E3 generan incidente y notificación, y reciben respuesta antes del cierre. Mostrar `GET /api/desk/notifications` como verificación de la notificación, sin correo real. Enseñar `docs/PROCESOS.md` para explicar el mapeo de tipos, E0–E3, I0–I6, niveles y fórmulas; `docs/MODELO.md` para diferenciar jerarquía de categorías y relaciones técnicas.

Si se solicita harness, ejecutar `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1` en Windows o `sh scripts/service-desk-test.sh` en Linux/macOS. La salida muestra P01–P18 y P18 tras reiniciar PostgreSQL. Para la evidencia de IA, abrir `docs/IA.md` y `docs/prompts/service-desk.md`; explicar un prompt revisado y una actualización de `AGENTS.md`. El proyecto de pruebas usa otro nombre Compose y no modifica la instalación normal. El recorrido antiguo del catálogo continúa debajo.

### Cómo demostrar el punto 6: los siete procesos

En **Colas**, señalar que hay al menos una cola activa para cada proceso. En
**Tickets**, filtrar por proceso y abrir un ticket de muestra; el detalle
muestra los datos específicos guardados y la bitácora. Explicar que los pasos
y campos obligatorios completos se encuentran en [PROCESOS.md](PROCESOS.md),
y que la interfaz ayuda a capturar datos pero la API repite las validaciones.

Para una demostración breve, describir un control distintivo por flujo:

1. **Nuevo servicio:** analizar necesidad y viabilidad; tras aprobar, vincular
   uno activo o crear la propuesta en revisión, sin duplicar código.
2. **Cambio:** mostrar CI afectados, riesgo, prueba y reversión; indicar que no
   se puede ejecutar sin aprobación registrada y planificar.
3. **Incidente:** mostrar categoría I0–I6, afectación y solución; la categoría
   se valida con la duración y la resolución deja el tiempo real cuando aplica.
4. **Evento:** mostrar E0 directo de registro a cierre; E1 con evaluación sin
   respuesta; E2/E3 con evaluación, incidente enlazado, notificación y respuesta
   antes del cierre. La notificación puede comprobarse en `GET /api/desk/notifications`.
5. **Problema:** mostrar el incidente relacionado y la cadena de causa raíz,
   solución temporal/error conocido y solución definitiva; el cambio correctivo
   queda vinculado con `IMPLEMENTS`.
6. **Acceso:** distinguir conceder de revocar, beneficiario y permiso; mencionar
   la aprobación separada y el bloqueo de autoaprobación.
7. **Servicio de tecnología:** mostrar la solicitud sobre servicio existente,
   asignación de agente, cumplimiento y confirmación del solicitante.

Para probar las puertas y rechazos con evidencia repetible, ejecutar la suite
P01–P18; P09 recorre los siete flujos y P10–P13 verifican aprobaciones,
eventos, clasificación y vínculos. El comando no usa la base normal de la
aplicación. Los resultados de la repetición están en [PRUEBAS.md](PRUEBAS.md#siete-procesos-y-evidencia-de-sus-puertas-27-de-octubre-de-2026-guatemala).

## Objetivo

Esta guía permite evaluar la solución desde cero y relacionar cada escenario del enunciado con un comando, una acción de interfaz y un resultado esperado.

## Preparación

~~~bash
docker compose up --build -d
docker compose exec api node apps/api/dist/scripts/seed-demo.js
docker compose exec api node apps/api/dist/scripts/validate-import.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

Abrir http://localhost:8080.

## Cuentas

- Administrador: admin.demo / Admin123!
- Consulta: consulta.demo / Consulta123!

## Recorrido funcional

### 1. Resumen

Ingresar como administrador y abrir Resumen.

Verificar:

- Servicios de nivel 2: 46 en el Excel original.
- Servicios activos: 42.
- En revisión: 3.
- Nivel 1: 12 en el Excel original.
- Historial de importaciones visible.

### 1.1 Importación desde la interfaz

En el menú **Importaciones**, el administrador puede:

1. Pulsar **Validar Excel** y comprobar la hoja, encabezados, filas y cantidad de servicios detectados.
2. Pulsar **Importar y sincronizar** para ejecutar la carga repetible.
3. Revisar el resumen con los contadores **Creados**, **Actualizados**, **Omitidos** y **Observados**.
4. Abrir **Ver observaciones** para consultar las incidencias con su código, mensaje, hoja y filas de origen.

La ejecución desde la interfaz usa el mismo servicio transaccional que `import-catalog.js`; no existe una lógica paralela que pueda producir resultados distintos.

### 2. Servicios

Abrir Servicios.

Verificar:

- la tabla muestra código, nombre, nivel 1, criticidad, tipo y estado;
- la búsqueda por SE.12 encuentra los tres servicios especiales;
- el filtro En revisión muestra los tres;
- al seleccionar una fila se abre la ficha;
- la ficha muestra clasificación, medición, responsabilidad y descripción;
- ADMIN ve Nuevo servicio y las acciones de edición;
- CONSULTA solo puede leer.

### 3. Organización

Revisar las pestañas:

1. Empresas.
2. Áreas.
3. Departamentos.
4. Secciones.
5. Puestos.

ADMIN puede crear, editar y desactivar. CONSULTA puede consultar sin botones de escritura.
Para comprobar la política de dependencias, intenta desactivar una empresa que
todavía tenga áreas: tanto la baja lógica por `DELETE` como una edición con estado
inactivo deben ser rechazadas con un mensaje comprensible. La baja solo debe
permitirse después de desactivar ordenadamente sus descendientes.

### 4. Usuarios

ADMIN puede crear y editar usuarios, cambiar rol, correo y puesto, y activar o
desactivar cuentas. Cada usuario debe tener puesto y la aplicación valida que
toda la jerarquía organizacional del puesto esté activa. Para verificar la edición,
mueve un usuario a otro puesto y cambia su correo; al recargar la lista ambos
valores deben permanecer guardados. Varios usuarios pueden compartir un puesto.

### 5. Catálogos

ADMIN puede agregar una etiqueta y cambiar su estado en:

- Clases.
- Criticidades.
- Tipos.

## Matriz histórica P01–P12 del parcial práctico 2

Esta matriz corresponde al catálogo del parcial 2 y se conserva como evidencia de la primera entrega. Para evaluar la ampliación Service Desk, utilizar P01–P18 descritos al inicio de esta guía y en `docs/PRUEBAS.md`.

| ID | Escenario | Procedimiento | Resultado esperado | Evidencia |
|---|---|---|---|---|
| P01 | Login válido e inválido | Intentar contraseña incorrecta y luego credencial demo | 401 en el primer caso y acceso en el segundo | acceptance.js |
| P02 | Sin sesión y logout | Abrir ruta sin cookie; cerrar sesión; consultar /auth/me | 401 sin sesión y después de logout | acceptance.js |
| P03 | Consulta modifica | Ingresar como consulta e intentar crear servicio | 403 en servidor | acceptance.js + smoke.js |
| P04 | Crear jerarquía y usuario | ADMIN crea empresa, área, departamento, sección, puesto y usuario temporal | Relaciones visibles y recuperables; limpieza lógica | acceptance.js |
| P05 | Código o referencia inválida | Crear registro duplicado o usar padre inexistente | HTTP 409/400 y no se crea información inválida | acceptance.js |
| P06 | Importar Excel | Ejecutar validate-import.js, import-catalog.js y verify-import.js | Archivo aceptado; 12, 46, 0 y observaciones | acceptance.js + validate-import.js + verify-import.js |
| P07 | Repetir importación | Ejecutar importador dos veces y revisar el resumen | No aparecen duplicados; los cambios suben updated y los datos idénticos quedan skipped | acceptance.js + import_runs |
| P08 | SE.12 y ausencias | Filtrar SE.12 y abrir fichas | 3 registros REVIEW y valores desconocidos | acceptance.js + interfaz |
| P09 | Mínimo mayor que máximo | Crear o editar con minimum 10 y maximum 5 | API rechaza la operación con HTTP 400 | acceptance.js |
| P10 | Búsqueda y filtros | Buscar SE.12 y seleccionar REVIEW | Resultado de tres servicios | acceptance.js + smoke.js |
| P11 | Responsable incorrecto | Seleccionar usuario que no pertenece a la sección | API rechaza la asignación | acceptance.js |
| P12 | Persistencia | Reiniciar PostgreSQL y volver a levantar API | Datos se conservan: 12/46/0/3 | harness-docker.ps1/.sh |

## Pruebas automatizadas disponibles

### Tipo de pruebas

- `verify-import.js` es una comprobación de integración con PostgreSQL y el modelo importado.
- `acceptance.js` es una prueba de integración/extremo a extremo de la API: usa HTTP, sesión, guards, reglas de negocio y base de datos real dentro de Docker.
- `smoke.js` es un recorrido corto de integración para login, logout, permisos y filtros.
- `harness-docker.ps1/.sh` incluye la prueba operativa que reinicia los servicios y verifica el volumen persistente. `persistence-check.mjs` queda como atajo local opcional.
- La pirámide base del catálogo contiene 7 unitarias, 2 integraciones y 1 E2E (70/20/10). La ampliación añade 7 unitarias y 2 recorridos de navegador; la suite completa actual ejecuta 14 unitarias, 2 integraciones y 3 E2E. La aceptación Service Desk P01–P18 es un control separado.

### Harness

~~~powershell
& .\scripts\harness-docker.ps1
~~~

El harness-docker.ps1/.sh conserva el flujo histórico del catálogo parcial 2 y corre en el Compose predeterminado. Para evaluar Service Desk sin tocar la base normal, use scripts/service-desk-test.ps1/.sh (P01–P18) y scripts/test-pyramid.ps1/.sh (unit, integration, e2e o all); sus detalles y límites están en docs/ia/03-harness-engineering.md. En Linux o macOS usar `sh scripts/harness-docker.sh`.

## Pirámide de pruebas 70/20/10

El núcleo histórico del catálogo tiene 7 unitarias, 2 integraciones y 1 E2E (70/20/10). Service Desk añade 7 unitarias y 2 E2E; los comandos ejecutan las suites completas actuales y all presenta por separado la base, las ampliaciones y el total 14/2/3.

~~~powershell
# Windows PowerShell
& .\scripts\test-pyramid.ps1 unit
& .\scripts\test-pyramid.ps1 integration
& .\scripts\test-pyramid.ps1 e2e
& .\scripts\test-pyramid.ps1 all
~~~

~~~bash
# Linux, macOS o Git Bash
sh scripts/test-pyramid.sh unit
sh scripts/test-pyramid.sh integration
sh scripts/test-pyramid.sh e2e
sh scripts/test-pyramid.sh all
~~~

Las unitarias aíslan servicios con mocks; integración usa PostgreSQL y `data/CatalogoServicios.xlsx`; E2E abre el frontend servido por Nginx y prueba el recorrido visible de login, catálogo, filtro y logout. Cada runner detiene el flujo si una prueba falla.

### Prueba de aceptación completa dentro de Docker

~~~powershell
docker compose exec -T api node apps/api/dist/scripts/acceptance.js
~~~

Ejecuta dentro del contenedor API `acceptance.js`. Crea datos temporales con prefijo `ACC-`, verifica reglas positivas y negativas, restaura las asignaciones tocadas y limpia exclusivamente las filas creadas por la prueba cuando termina correctamente. La salida esperada contiene `"ok":true` y los checks P01 a P11. `npm test` es únicamente un atajo opcional para equipos que ya tengan Node.js y npm.

### Smoke

~~~bash
docker compose exec api node apps/api/dist/scripts/smoke.js
~~~

Salida esperada:

~~~json
{"ok":true,"checks":["P01","P02","P03","P10"]}
~~~

### Persistencia después de reinicio

~~~powershell
docker compose restart db
docker compose exec db pg_isready -U catalogo -d catalogo
docker compose restart api
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

El procedimiento reinicia PostgreSQL, comprueba su disponibilidad, reinicia la API y repite la verificación dentro del contenedor. No ejecuta `down -v` y por eso no destruye el volumen `postgres_data`.

### Importación

~~~bash
docker compose exec api node apps/api/dist/scripts/validate-import.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

Salida esperada:

~~~json
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3,"expected":{"level1":12,"level2":46,"review":3}}
~~~

## Validaciones negativas recomendadas

### Mínimo mayor que máximo

Desde Swagger o una herramienta HTTP autenticada, enviar un servicio con:

~~~json
{
  "code": "TEST.MINMAX",
  "name": "Prueba de umbral",
  "level1Id": 1,
  "minimum": 10,
  "maximum": 5
}
~~~

Debe recibirse un error de validación y no debe quedar el registro.

### Padre inexistente

Intentar crear un área con companyId inexistente. Debe rechazarse porque el servicio consulta el padre antes de insertar.

### Responsable de otra sección

Intentar asignar un usuario de una sección distinta a responsibleSectionId. validateAssignment verifica la pertenencia y rechaza la operación.

## Persistencia

Para comprobar persistencia sin destruir datos:

~~~bash
docker compose restart db api
docker compose up -d web
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

No ejecutar docker compose down -v durante esta prueba.

## Evidencia visual

La revisión visual debe comprobar:

- foco visible en campos;
- etiquetas en español;
- badges para estados;
- badge En revisión;
- tablas desplazables en pantallas angostas;
- ausencia de controles administrativos para CONSULTA;
- ficha lateral del servicio;
- mensajes de error comprensibles.

## Interpretación de fallos

| Síntoma | Revisión |
|---|---|
| web no abre | docker compose ps, logs web y docker compose up -d web |
| API no responde | logs api y estado de db |
| verify devuelve 0 | revisar que seed e import se ejecutaron |
| login falla | revisar .env, seed-demo.js y logs api |
| no hay datos después de reinicio | confirmar que no se usó down -v |
| importación falla | revisar nombre de archivo, hoja y logs api |

## Criterio de aprobación operativa

La solución está lista para evaluación cuando:

- los tres servicios de Compose están activos;
- verify-import devuelve 12, 46, 0 y 3 con el Excel original;
- smoke termina con ok true;
- ambos roles pueden iniciar sesión;
- ADMIN puede mantener datos;
- CONSULTA puede consultar y recibe 403 al escribir;
- reiniciar contenedores no elimina los datos.

# Resolución técnica del parcial

## 1. Identificación y objetivo

- Asignatura: Software Avanzado.
- Carné: 202307705.
- Repositorio: [parcial-catalogo-servicios-202307705](https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705).
- Commit de entrega: el commit apuntado por la etiqueta `parcial-v2.0`.
- Etiqueta de entrega: parcial-v2.0.
- Fecha de última verificación documentada: 30 de septiembre de 2026.

El objetivo del proyecto es transformar el archivo CatalogoServicios.xlsx en una aplicación web de gestión de servicios de TI. La solución no se limita a mostrar el Excel: normaliza su información, conserva su trazabilidad, incorpora una estructura organizacional, permite asignar responsables y ofrece autenticación local con autorización en el servidor.

## 2. Problema que se resuelve

El archivo de origen es útil como catálogo inicial, pero presenta limitaciones para una operación diaria:

1. La información está en una hoja de cálculo y no tiene restricciones relacionales.
2. Las filas físicas no representan necesariamente servicios independientes porque existen celdas combinadas y filas de continuación.
3. Existen campos incompletos y un conflicto de interpretación asociado a SE.12.
4. No existe un control de usuarios, roles, unidades organizacionales ni responsables.
5. Una hoja de cálculo no ofrece por sí sola un historial de importaciones ni una política de bajas.
6. No hay validación centralizada para relaciones, estados y umbrales.

La aplicación atiende estas necesidades con un frontend web, una API, PostgreSQL y un importador repetible.

## 3. Alcance

### Incluido

- Login y logout local.
- Sesiones persistidas en PostgreSQL.
- Roles ADMIN y CONSULTA.
- Mantenimiento de empresas, áreas, departamentos, secciones y puestos.
- Mantenimiento de usuarios.
- Mantenimiento de servicios y catálogos.
- Mantenimiento administrativo de servicios de nivel 1.
- Búsqueda, filtros, paginación equivalente y ficha de servicio.
- Asignación de sección y usuario responsable.
- Importación de CatalogoServicios.xlsx.
- Resolución de celdas combinadas.
- Tratamiento explícito de SE.12 y de datos faltantes.
- Historial de importaciones y observaciones.
- Docker Compose, migraciones y scripts reproducibles.
- Pirámide automatizada 70/20/10 con Jest, ts-jest y Playwright.
- Documentación de context engineering, prompt engineering y harness engineering.
- Registro ampliado de las tres fases en `docs/ia/`, con prompts finales en XML.

### Fuera de alcance

- Gestión de tickets o incidentes.
- Facturación.
- Consumo o contratación de servicios.
- Inicio de sesión con Google, GitHub u otro proveedor.
- Un modelo de IA dentro de la aplicación en tiempo de ejecución.
- Edición del archivo Excel original desde la aplicación.

## 4. Supuestos y decisiones humanas

1. La primera aparición de un código de nivel 1 es la referencia canónica para su nombre cuando el Excel presenta valores incompatibles.
2. Para SE.12 se conserva Suministrar Analitica como nombre canónico porque es el primer valor asociado al código. Las diferencias se conservan en observaciones.
3. Un campo vacío significa dato desconocido, no cero, falso ni una etiqueta inventada.
4. Los servicios incompletos se pueden importar y quedan en estado REVIEW para permitir su corrección posterior.
5. La estructura organizacional es información nueva del parcial. No se afirma que provenga del Excel.
6. Las cuentas demo y las asignaciones de demostración se crean mediante seed-demo.js.
7. Las bajas son lógicas para no destruir trazabilidad ni datos de evaluación.
8. Se usa SQL explícito con pg en lugar de Prisma porque el alcance es pequeño y se requiere control directo sobre migraciones y consultas.

## 5. Arquitectura

~~~mermaid
flowchart LR
    B[ navegador ] -->|HTTP + cookie de sesión| W[Nginx / frontend]
    W -->|/api| A[NestJS API]
    A -->|SQL parametrizado| D[(PostgreSQL 16)]
    A -->|solo lectura| X[data/CatalogoServicios.xlsx]
    A --> V[seed, import, verify, smoke]
    V --> D
~~~

### Componentes

#### Frontend

Ubicación: apps/web.

- React y TypeScript.
- Vite para el build.
- CSS propio con tokens en styles.css.
- Layout con barra superior, menú lateral, tarjetas, tablas, badges, drawer y modales.
- El rol Consulta recibe la misma información de lectura, pero no recibe acciones de mantenimiento en la interfaz.

#### Backend

Ubicación: apps/api/src.

- NestJS organizado por módulos.
- AuthGuard para exigir sesión.
- RolesGuard para exigir ADMIN cuando la operación modifica datos.
- Servicios de dominio para autenticación, organización, usuarios, catálogos, servicios e importaciones.
- Validaciones en el servidor; la interfaz no es la única barrera.

#### Base de datos

Ubicación: database/migrations/001_init.sql.

- PostgreSQL 16.
- Migración versionada y registrada en schema_migrations.
- Restricciones de claves foráneas, unicidad, estado y umbrales.
- Volumen Docker llamado postgres_data.

#### Infraestructura

- compose.yaml crea db, api y web.
- La API espera a que PostgreSQL esté healthy.
- El contenedor API migra antes de iniciar NestJS.
- Nginx entrega el build de React y reenvía /api al backend.
- data/CatalogoServicios.xlsx se monta en el API en modo de solo lectura.

## 6. Modelo de datos

~~~mermaid
erDiagram
    COMPANIES ||--o{ AREAS : contiene
    AREAS ||--o{ DEPARTMENTS : contiene
    DEPARTMENTS ||--o{ SECTIONS : contiene
    SECTIONS ||--o{ POSITIONS : contiene
    POSITIONS ||--o{ USERS : asigna
    SERVICE_LEVEL_1 ||--o{ SERVICE_LEVEL_2 : agrupa
    SERVICE_CLASSES ||--o{ SERVICE_LEVEL_2 : clasifica
    CRITICALITIES ||--o{ SERVICE_LEVEL_2 : mide
    SERVICE_TYPES ||--o{ SERVICE_LEVEL_2 : tipifica
    SECTIONS ||--o{ SERVICE_LEVEL_2 : responsabiliza
    USERS ||--o{ SERVICE_LEVEL_2 : asigna
    IMPORT_RUNS ||--o{ IMPORT_OBSERVATIONS : registra
~~~

### Diccionario de entidades

| Tabla | Propósito | Claves y restricciones |
|---|---|---|
| companies | Empresas raíz | id PK, code UNIQUE |
| areas | Áreas de una empresa | company_id FK, UNIQUE(company_id, code) |
| departments | Departamentos de un área | area_id FK, UNIQUE(area_id, code) |
| sections | Secciones de un departamento | department_id FK, UNIQUE(department_id, code) |
| positions | Puestos de una sección | section_id FK, UNIQUE(section_id, code) |
| users | Cuentas y responsables | username UNIQUE, email UNIQUE, position_id FK, role controlado |
| service_level_1 | Familias de servicios | code UNIQUE |
| service_level_2 | Servicios administrables | code UNIQUE, level_1_id FK |
| service_classes | Clases controladas | label UNIQUE |
| criticalities | Criticidades controladas | label UNIQUE |
| service_types | Tipos controlados | label UNIQUE |
| import_runs | Resumen de cada importación | status, contadores y timestamps |
| import_observations | Incidencias de una ejecución | severity, código, mensaje y origen |
| audit_logs | Punto de extensión para auditoría | usuario, acción, entidad y detalles JSON |
| session | Sesiones HTTP | sid PK, sesión y expiración |

### Campos importantes de service_level_2

| Campo | Significado | Regla |
|---|---|---|
| code | Código del nivel 2 | Único |
| name | Nombre del servicio | Obligatorio |
| level_1_id | Nivel 1 padre | Obligatorio y existente |
| active_code | Valor original de ACTIVO | Puede ser S, N u otro valor |
| status | Estado operativo | ACTIVE, INACTIVE o REVIEW |
| class_id | Clase | Opcional, FK |
| criticality_id | Criticidad | Opcional, FK |
| type_id | Tipo | Opcional, FK |
| description | Descripción | Opcional |
| metric | Métrica | Opcional |
| minimum | Umbral mínimo | Opcional, numérico |
| maximum | Umbral máximo | Opcional, numérico |
| responsible_section_id | Sección responsable | Opcional, FK |
| responsible_user_id | Usuario responsable | Opcional, FK y debe pertenecer a la sección |
| source_sheet | Hoja de origen | Trazabilidad |
| source_rows | Fila o rango de origen | Trazabilidad |
| source_transformations | Transformaciones realizadas | Trazabilidad |

La base de datos impone minimum IS NULL OR maximum IS NULL OR minimum <= maximum.

## 7. Mapeo del Excel al modelo

La hoja utilizada es Servicios Externos.

| Excel | Modelo | Tratamiento |
|---|---|---|
| A COD.N1 | service_level_1.code | Se crea o reutiliza por código |
| B SERVICIO - Nivel 1 | service_level_1.name | Primera aparición canónica |
| C COD.N2 | service_level_2.code | Solo una fila con código crea servicio |
| D SERVICIO - Nivel 2 | service_level_2.name | Obligatorio cuando existe COD.N2 |
| E ACTIVO | active_code y status | S → ACTIVE, N → INACTIVE, desconocido → REVIEW |
| F CLASE DE SERVICIO | service_classes + class_id | Se conserva como opción controlada |
| G CRITICIDAD | criticalities + criticality_id | Se conserva como opción controlada |
| H TIPO DE SERVICIO | service_types + type_id | Se conserva como opción controlada |
| I Descripción | description | Vacío → NULL |
| J Métrica | metric | Vacío → NULL |
| K Minimo | minimum | Vacío → NULL |
| L Maximo | maximum | Vacío → NULL |

Las listas de opciones ubicadas fuera del bloque principal se consideran catálogo de referencia, no servicios adicionales.

## 8. Algoritmo de importación

El importador realiza las siguientes etapas:

1. Abre el archivo indicado por IMPORT_FILE.
2. Valida que el archivo sea un XLSX legible.
3. Busca la hoja Servicios Externos.
4. Valida los encabezados A4:L4, códigos, nombres, tipos numéricos y umbrales antes de modificar la base.
5. Detecta el bloque de datos y recorre únicamente sus filas.
6. Para cada celda, obtiene el valor de la celda principal si pertenece a un rango combinado.
7. Normaliza espacios sin alterar el contenido semántico.
8. Si no existe COD.N2, registra la fila como omitida u observada y no crea un servicio.
9. Si aparece un COD.N1 nuevo, crea el nivel 1.
10. Si el nivel 1 ya existe con otro nombre, conserva el primero y registra la diferencia.
11. Convierte campos vacíos a NULL.
12. Calcula el estado a partir de ACTIVO y de la presencia de datos.
13. Compara cada nivel 2 por código: inserta nuevos, actualiza modificados y omite iguales.
14. Guarda hoja, fila y transformaciones.
15. Registra contadores en import_runs.
16. Registra incidencias en import_observations.
17. Confirma la transacción solo si la ejecución termina correctamente.

### Celdas combinadas

Una celda secundaria de un rango combinado no se interpreta como un registro nuevo. El valor se recupera desde la celda master del rango. Esto evita repetir el nombre del nivel 1 en cada fila y evita fabricar servicios donde solo existe una fila de continuación.

### Caso SE.12

El código SE.12 presenta información conflictiva o incompleta en el archivo. La política aplicada es:

- conservar un solo registro de nivel 1 para SE.12;
- usar Suministrar Analitica como nombre canónico por primera ocurrencia;
- conservar el origen de las filas involucradas;
- guardar la diferencia como observación;
- importar SE.12.1, SE.12.2 y SE.12.3 como servicios distintos;
- conservar sus atributos faltantes como NULL;
- marcar esos tres servicios como REVIEW.

### Idempotencia

La segunda importación identifica servicios por código. Compara los campos importables antes de escribir: un servicio modificado se actualiza, uno idéntico se omite y uno nuevo se inserta. Por esto una segunda carga no aumenta el número de servicios y evita actualizaciones innecesarias.

## 9. Autenticación y autorización

### Login

- POST /api/auth/login recibe identifier y password.
- identifier puede ser username o email.
- La contraseña se compara contra bcrypt.
- Una cuenta inactiva no puede iniciar sesión.
- La respuesta crea una sesión HTTP-only almacenada en PostgreSQL.

### Protección de rutas

Todas las rutas funcionales pasan por AuthGuard. Las rutas administrativas además pasan por RolesGuard y declaran el rol ADMIN.

La interfaz oculta botones administrativos para mejorar la experiencia, pero la seguridad real está en la API. Un usuario CONSULTA que intente hacer POST, PATCH o DELETE recibe HTTP 403 aunque construya la solicitud manualmente.

### Logout

POST /api/auth/logout destruye la sesión. La misma cookie no puede reutilizarse para consultar /api/auth/me después del logout.

### Información protegida

La API nunca devuelve password_hash en los listados de usuarios. Las contraseñas demo se generan localmente y no se publican como secretos de producción.

## 10. Reglas de negocio

### Organización

- Toda entidad subordinada requiere un padre.
- No se puede asociar un registro nuevo o moverlo a una jerarquía con algún antecesor inexistente o inactivo.
- Los códigos son únicos dentro de su padre.
- La desactivación es lógica y se bloquea mientras existan dependientes activos, tanto desde `DELETE` como desde `PATCH` con `active: false`.
- La edición de usuarios conserva correo y puesto, valida la unicidad del correo y permite varios usuarios en un mismo puesto.
- Las bajas de organización son lógicas.
- Un usuario requiere un puesto válido.
- Un puesto pertenece a una sola sección.

### Servicios

- Todo nivel 2 requiere código, nombre y nivel 1 válido.
- Un usuario responsable requiere sección responsable.
- El usuario responsable debe pertenecer a la sección seleccionada y estar activo.
- minimum y maximum son opcionales.
- Si ambos existen, minimum no puede superar maximum.
- Desactivar un servicio cambia su estado a INACTIVE.
- La importación puede dejar un servicio en REVIEW cuando el origen no permite afirmar que está activo o completo.

## 11. API principal

La lista completa y los esquemas se pueden consultar en Swagger. Las operaciones principales son:

| Método | Ruta | Rol | Uso |
|---|---|---|---|
| POST | /api/auth/login | Público | Iniciar sesión |
| POST | /api/auth/logout | Autenticado | Cerrar sesión |
| GET | /api/auth/me | Autenticado | Consultar sesión actual |
| GET | /api/services | Autenticado | Buscar y filtrar servicios |
| GET | /api/services/:id | Autenticado | Consultar ficha |
| POST | /api/services | ADMIN | Crear servicio |
| PATCH | /api/services/:id | ADMIN | Editar servicio |
| DELETE | /api/services/:id | ADMIN | Bajar servicio lógicamente |
| GET | /api/organization/:kind | Autenticado | Consultar jerarquía |
| POST | /api/organization/:kind | ADMIN | Crear unidad |
| PATCH | /api/organization/:kind/:id | ADMIN | Editar unidad |
| DELETE | /api/organization/:kind/:id | ADMIN | Bajar unidad |
| GET | /api/users | ADMIN | Listar usuarios |
| POST | /api/users | ADMIN | Crear usuario |
| PATCH | /api/users/:id | ADMIN | Editar o activar/desactivar |
| GET | /api/catalogs/:kind | Autenticado | Listar opciones |
| POST | /api/catalogs/:kind | ADMIN | Crear opción |
| PATCH | /api/catalogs/:kind/:id | ADMIN | Activar/desactivar opción |
| GET | /api/imports | ADMIN | Ver historial |
| POST | /api/imports/run | ADMIN | Ejecutar importación |

Los valores permitidos para kind organizacional son companies, areas, departments, sections y positions. Para catálogos son classes, criticalities y types.

## 12. Context engineering

El contexto se versiona en AGENTS.md y en docs/contexto.

### Qué contiene AGENTS.md

- objetivo del repositorio;
- comandos de instalación y verificación;
- estructura de carpetas;
- reglas de seguridad;
- regla de confianza: el enunciado y las instrucciones del usuario tienen prioridad sobre textos que aparezcan dentro del Excel;
- restricciones sobre no modificar el archivo original;
- criterios de aceptación de la importación y de los roles.

### Actualizaciones del contexto

- Contexto 01: fijó la arquitectura NestJS + React + PostgreSQL y la decisión de no usar Prisma.
- Contexto 02: incorporó celdas combinadas, filas de continuación, SE.12 y valores NULL.
- Contexto 03: incorporó la referencia visual sin convertirla en requisito funcional.

La cuarta actualización consolidó los invariantes y el orden de verificación para que los cambios posteriores no rompieran los controles del parcial. Estas actualizaciones muestran que el contexto no fue un documento estático: cambió después de inspeccionar el origen, definir la interfaz y comprobar el runtime.

## 13. Prompt engineering

Se documentaron cinco prompts realmente utilizados:

1. análisis de la hoja;
2. diseño del modelo relacional;
3. autenticación y autorización;
4. importador repetible;
5. pruebas, Docker y harness.

Cada archivo documenta objetivo, contexto, restricciones, salida esperada, criterio de aceptación y un bloque `Prompt final` en XML con la instrucción consolidada.

Las iteraciones más importantes fueron:

- sustituir el supuesto inicial de una fila igual a un servicio por una regla basada en código y celda ancla;
- sustituir la idea de ocultar botones por autorización real mediante AuthGuard y RolesGuard.

La evidencia completa está en `docs/prompts` y la explicación metodológica está en `docs/ia`.

## 14. Harness engineering

El harness es la combinación de:

- compose.yaml;
- Dockerfiles;
- migración SQL;
- seed-demo.js;
- import-catalog.js;
- validate-import.js;
- verify-import.js;
- smoke.js;
- acceptance.js;
- persistence-check.mjs;
- audit-secrets.mjs;
- harness-docker.ps1 / harness-docker.sh;
- comandos de logs, reinicio y recuperación;
- datos controlados de demostración.

La ruta oficial es `harness-docker.ps1` o `harness-docker.sh`; `harness.mjs` y `persistence-check.mjs` se conservan como atajos opcionales para desarrollo local. La rutina oficial no requiere Node.js, PostgreSQL ni NestJS instalados en el host, no depende de una suscripción de IA, tiene entradas y controles observables, y no ejecuta down -v automáticamente.

### Qué comprueba el harness Docker-only

1. construcción de API y frontend dentro de Docker;
2. auditoría de secretos dentro de un contenedor Node;
3. validación de compose.yaml;
4. validación del Excel;
5. seed, importación, reimportación idéntica y verificación 12/46/0/3;
6. aceptación funcional P01–P11;
7. smoke;
8. comprobación de persistencia después del reinicio.

## 15. Ciclo de corrección del harness

El enunciado no exige una disciplina independiente llamada Loop Engineering. El ciclo siguiente se documenta como el método usado dentro de Harness Engineering para detectar y corregir fallos:

~~~text
PLAN → ACT → OBSERVE → EVALUATE → CORRECT → RE-EVALUATE
~~~

El ciclo evita considerar una implementación terminada solo porque compila. Cada vuelta incluye:

- definir el resultado observable;
- ejecutar un cambio acotado;
- revisar salida, logs o conteos;
- comparar con el criterio de aceptación;
- corregir la causa;
- repetir la prueba.

## 16. Evidencia de ejecución real

### Comandos ejecutados

~~~powershell
& .\scripts\harness-docker.ps1
~~~

~~~bash
sh scripts/harness-docker.sh
~~~

### Resultados

| Control | Resultado |
|---|---|
| Build Docker | Exitoso para NestJS y Vite; la compilación ocurre dentro de las imágenes |
| Docker | API, web y db en ejecución |
| Migración | Aplicada automáticamente |
| Seed | Cuentas y organización demo creadas |
| Importación | 12 nivel 1, 46 nivel 2, 0 duplicados |
| Reimportación sin cambios | 0 actualizados, 46 omitidos por igualdad, sin duplicados |
| Validación del Excel | Hoja, encabezados A4:L4, 46 servicios y 51 filas de continuación aceptados |
| Revisión | 3 servicios en REVIEW |
| Login inválido | HTTP 401 |
| Login válido | HTTP 201 |
| Lectura autenticada | HTTP 200 |
| Escritura como Consulta | HTTP 403 |
| Logout | Sesión invalidada; /auth/me devuelve 401 |
| Persistencia | Conteos conservados después de reiniciar |
| Aceptación P01–P11 | Todos los contratos funcionales en `ok: true` |

### Incidencia corregida durante el desarrollo

En una primera ejecución, el API buscaba las migraciones en una ruta incorrecta dentro del contenedor y produjo un error de archivo no encontrado. El análisis del log mostró que la ruta esperaba /app/apps/database/migrations, mientras que el Dockerfile copia las migraciones en /app/database/migrations.

La corrección fue ajustar el script de migración a la ruta real del contenedor. Después se reconstruyó la imagen y se repitieron migración, seed, importación, verificación y smoke. El resultado final fue satisfactorio.

## 17. Matriz requisito → implementación → prueba

| Requisito | Implementación | Verificación | Evidencia |
|---|---|---|---|
| Autenticación local | auth.service.ts y auth.controller.ts | Login válido e inválido | smoke.js |
| Hash con sal | bcryptjs | Login correcto sin exponer hash | users.service.ts |
| Roles | AuthGuard y RolesGuard | Consulta recibe 403 al escribir | smoke.js |
| Sesión persistida | connect-pg-simple y tabla session | Logout y reinicio | auth.module.ts, migration |
| Organización | tablas y OrganizationService | Listados y formularios CRUD | organization/ |
| Usuarios | UsersService | Seed y mantenimiento ADMIN | users/ |
| Catálogos | CatalogService | Listado y mantenimiento | catalog/ |
| Servicios | ServicesService | búsqueda, ficha, filtros, paginación y CRUD | services/ |
| Servicios nivel 1 | ServicesService y Level1Page | creación, edición y baja lógica ADMIN | services/, Level1Page.tsx |
| Umbrales | CHECK SQL y validación API | mínimo mayor que máximo rechazado | migration, services.service.ts |
| Importación | ImportService con exceljs | conteos 12/46/0 en el Excel original | import-catalog.js, verify-import.js |
| SE.12 | regla canónica y observaciones | tres servicios REVIEW | docs/IMPORTACION.md |
| Persistencia | volumen postgres_data | reinicio sin pérdida | compose.yaml |
| Docker | Dockerfiles y Compose | build y ps | compose.yaml |
| Context engineering | AGENTS, contexto versionado y guía de fase | revisión de actualizaciones | docs/contexto, docs/ia/01-context-engineering.md |
| Prompt engineering | cinco prompts finales XML e iteraciones | revisión documental | docs/prompts, docs/ia/02-prompt-engineering.md |
| Harness engineering | scripts y controles | harness Docker-only, aceptación y persistencia en verde | scripts/harness-docker.ps1/.sh, acceptance.ts |
| Ciclo de corrección del harness | evidencia de corrección | fallo y re-ejecución | docs/evidencias |

## 18. Limitaciones conocidas

- El frontend presenta acciones de administración solo a ADMIN, pero la protección importante se mantiene en el servidor.
- Los datos organizacionales son mínimos y demo; el Excel no los proporciona.
- La aplicación usa credenciales demo locales para facilitar evaluación. En producción se deben cambiar.
- npm audit reporta advertencias moderadas indirectas relacionadas con js-yaml y uuid. No se aplicó una corrección forzada que degradaría ExcelJS.
- No se incluye despliegue en nube; la entrega se evalúa mediante Docker local.
- No se modificó el Excel para corregir errores: las decisiones se implementan en la importación y se documentan.

## 19. Cómo reproducir la entrega

Desde un clon limpio:

~~~bash
docker compose up --build -d
docker compose exec api node apps/api/dist/scripts/seed-demo.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
docker compose exec api node apps/api/dist/scripts/smoke.js
~~~

Después abrir http://localhost:8080 y seguir la [Guía de evaluación](GUIA_EVALUACION.md).

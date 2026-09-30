# Catálogo de Servicios TI

Aplicación web para convertir el catálogo institucional de servicios externos de TI en un sistema consultable y administrable. El proyecto incorpora autenticación local, roles, estructura organizacional, responsables, catálogos controlados, importación repetible del Excel original y trazabilidad de los datos.

Este repositorio corresponde al parcial práctico de Software Avanzado, carné 202307705.

## 1. Información de entrega

| Dato | Valor |
|---|---|
| Repositorio | [DavidVelasquez77/parcial-catalogo-servicios-202307705](https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705) |
| Rama | main |
| Commit de entrega | aa1bae7 |
| Etiqueta | parcial-v2.0 |
| Integrante | 202307705 |
| Colaborador solicitado | maldanap-usac |
| Archivo de entrada | data/CatalogoServicios.xlsx |

La etiqueta parcial-v2.0 apunta al commit entregado. El archivo Excel incluido es el original y no se modifica durante la importación.

## 2. Qué resuelve la aplicación

La aplicación permite:

- iniciar y cerrar sesión con usuario o correo y contraseña;
- administrar la jerarquía Empresa → Área → Departamento → Sección → Puesto → Usuario;
- administrar servicios de nivel 2 relacionados con un servicio de nivel 1;
- administrar servicios de nivel 1, incluyendo edición y baja lógica;
- mantener clases, criticidades y tipos de servicio;
- consultar servicios mediante búsqueda por código o nombre;
- filtrar por nivel 1, estado, clase, criticidad y tipo, con paginación;
- asignar una sección responsable y, opcionalmente, un usuario de esa misma sección;
- importar el Excel de forma repetible sin crear duplicados;
- conservar campos incompletos como desconocidos y marcarlos como En revisión;
- registrar ejecuciones de importación, observaciones y datos de origen;
- operar con dos roles: ADMIN y CONSULTA.

No se implementan tickets, facturación ni consumo de servicios porque están fuera del alcance del enunciado.

## 3. Tecnologías y justificación

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | React 19, Vite, TypeScript | Interfaz por componentes, rápida y tipada |
| Backend | NestJS 11, TypeScript | Módulos, guards, controladores y estructura clara |
| Persistencia | PostgreSQL 16 | Relaciones, restricciones, transacciones y volumen persistente |
| Acceso a datos | pg y SQL parametrizado | Control directo de SQL y migraciones; no se usa Prisma |
| Sesiones | express-session + connect-pg-simple | Sesiones HTTP-only almacenadas en PostgreSQL |
| Contraseñas | bcryptjs | Hash especializado con sal, nunca texto plano |
| Excel | exceljs | Lectura de hoja, celdas combinadas y valores originales |
| Servidor web | Nginx | Sirve el frontend y redirige /api hacia el backend |
| Contenedores | Docker Compose | Entorno reproducible con API, frontend y PostgreSQL |

El diseño visual usa CSS propio y tokens de color inspirados en la referencia indicada en el proyecto. No se copian logos, textos ni recursos de Freshservice.

## 4. Requisitos previos

### Ruta recomendada: Docker

Para ejecutar la aplicación no es necesario instalar Node.js, PostgreSQL ni NestJS en el equipo anfitrión. Solo se necesita:

- Docker Desktop abierto;
- Docker Compose v2, incluido en las versiones actuales de Docker Desktop;
- Git, si se clona el repositorio.

### Ruta opcional: comandos locales

Para ejecutar npm run typecheck, npm run build o npm run harness desde Windows se necesita Node.js 22 o compatible y npm. La base de datos y la aplicación pueden seguir ejecutándose en Docker.

## 5. Rutas y encendido de la aplicación

### Ruta local del proyecto

En el equipo de desarrollo utilizado para esta entrega, la raíz del proyecto es:

~~~text
C:\Users\Vela\Desktop\SA\MAGISTRAL\LECCIONES\2 parcial\parcial-catalogo-servicios-202307705
~~~

En otro equipo se debe usar la carpeta donde se clonó el repositorio. Todos los comandos siguientes deben ejecutarse desde esa raíz, donde están `compose.yaml` y `data/CatalogoServicios.xlsx`.

### Encender desde Windows PowerShell

~~~powershell
Set-Location -LiteralPath 'C:\Users\Vela\Desktop\SA\MAGISTRAL\LECCIONES\2 parcial\parcial-catalogo-servicios-202307705'
Copy-Item .env.example .env -ErrorAction SilentlyContinue
docker compose up --build -d
docker compose ps
docker compose exec api node apps/api/dist/scripts/seed-demo.js
docker compose exec api node apps/api/dist/scripts/validate-import.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

Si `.env` ya existe, el primer comando `Copy-Item` puede omitirse. La migración SQL se ejecuta automáticamente cuando inicia la API. Después de una primera construcción, para volver a encender los servicios normalmente basta con:

~~~powershell
docker compose up -d
~~~

### URLs y rutas disponibles

| Uso | URL o ruta |
|---|---|
| Aplicación web | [http://localhost:8080/](http://localhost:8080/) |
| Login | `http://localhost:8080/` |
| Swagger | [http://localhost:8080/api/docs](http://localhost:8080/api/docs) |
| API desde el navegador | `http://localhost:8080/api/...` |
| Archivo original | `data/CatalogoServicios.xlsx` |

La interfaz es una SPA: sus pantallas se navegan desde `/` usando el menú lateral. Las rutas principales de la API son:

| Recurso | Rutas |
|---|---|
| Sesión | `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` |
| Servicios | `/api/services`, `/api/services/:id`, `/api/services/dashboard` |
| Nivel 1 | `/api/services/level1`, `/api/services/level1/:id` |
| Organización | `/api/organization/companies`, `/areas`, `/departments`, `/sections`, `/positions` |
| Usuarios | `/api/users` |
| Catálogos | `/api/catalogs/classes`, `/criticalities`, `/types` |
| Importaciones | `/api/imports`, `/api/imports/validate`, `/api/imports/run`, `/api/imports/:id/observations` |

El puerto `3000` de la API es interno de Docker y no se publica directamente al host; desde fuera se debe utilizar el prefijo `http://localhost:8080/api` mediante Nginx.

### Apagar y reiniciar

~~~powershell
# Apagar sin borrar la base de datos
docker compose down

# Volver a iniciar conservando el volumen postgres_data
docker compose up -d

# Reiniciar db y API para comprobar persistencia
npm run persistence:check
~~~

No ejecutar `docker compose down -v` durante la evaluación: elimina los datos persistidos.

## 6. Inicio desde un clon limpio

Los siguientes comandos son el procedimiento de evaluación recomendado. Ejecutarlos desde la raíz del repositorio.

### Windows PowerShell

~~~powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
docker compose exec api node apps/api/dist/scripts/seed-demo.js
docker compose exec api node apps/api/dist/scripts/validate-import.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

### Linux, macOS o Git Bash

~~~bash
cp .env.example .env
docker compose up --build -d
docker compose ps
docker compose exec api node apps/api/dist/scripts/seed-demo.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

La salida esperada de la verificación es equivalente a:

~~~json
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3}
~~~

El API ejecuta la migración automáticamente al iniciar. La ejecución explícita de seed-demo.js crea o actualiza las cuentas, la organización mínima y los datos de demostración. La validación se ejecuta antes de importar. La importación puede repetirse: los servicios modificados se actualizan, los idénticos se ignoran y los nuevos se agregan, sin duplicar códigos.

## 7. URLs y cuentas de evaluación

Con los contenedores activos:

- Aplicación web: [http://localhost:8080](http://localhost:8080)
- Documentación Swagger: [http://localhost:8080/api/docs](http://localhost:8080/api/docs)
- API desde el host: `http://localhost:8080/api`; el servicio NestJS escucha en `3000` únicamente dentro de Compose.

| Rol | Usuario | Contraseña | Permisos |
|---|---|---|---|
| Administrador | admin.demo | Admin123! | Lectura, alta, edición y baja lógica |
| Consulta | consulta.demo | Consulta123! | Lectura; las escrituras son rechazadas en el servidor |

Las credenciales anteriores son datos locales de demostración. Se definen mediante variables de entorno y no representan secretos reales.

## 8. Recorrido recomendado para evaluar la interfaz

1. Ingresar como admin.demo.
2. Abrir Resumen y confirmar los indicadores 46, 42, 3 y 12.
3. Abrir Servicios, buscar SE.12 y comprobar los tres registros en revisión.
4. Abrir una fila para revisar código, nivel 1, clase, criticidad, tipo, métrica, umbrales, sección, responsable y descripción.
5. Abrir Organización y revisar las cinco entidades de la jerarquía.
6. Abrir Usuarios y comprobar el puesto y rol de cada cuenta demo.
7. Abrir Catálogos y revisar clases, criticidades y tipos.
8. Abrir Importaciones, ejecutar nuevamente la carga y comprobar el historial.
9. Cerrar sesión e ingresar como consulta.demo.
10. Confirmar que Consulta puede leer servicios, pero no ve las pantallas de mantenimiento ni puede escribir mediante la API.

## 9. Controles de datos importados

El resultado esperado del archivo original es:

| Control | Resultado |
|---|---:|
| Códigos distintos de nivel 1 | 12 |
| Códigos explícitos de nivel 2 | 46 |
| Duplicados de nivel 2 | 0 |
| Servicios con datos incompletos | 3 |
| Código especial | SE.12.1, SE.12.2, SE.12.3 |

Reglas importantes:

- Se procesa la hoja Servicios Externos.
- Los encabezados están en A4:L4 y los datos se revisan entre las filas 5 y 101.
- Las celdas combinadas se resuelven usando el valor de su celda principal.
- Una fila sin código de nivel 2 no crea un servicio.
- SE.12 conserva como nombre canónico Suministrar Analitica, tomado de la primera ocurrencia; las diferencias se registran como observaciones.
- Los valores faltantes de las filas de SE.12 quedan en NULL; no se convierten en cero ni se inventan etiquetas.
- Los servicios incompletos quedan en estado REVIEW y se muestran como En revisión.
- Cada servicio guarda hoja, fila de origen y transformaciones relevantes.

La explicación completa se encuentra en [docs/RESOLUCION.md](docs/RESOLUCION.md) y en [docs/IMPORTACION.md](docs/IMPORTACION.md).

## 10. Comandos de validación

### Verificación local de código

~~~bash
npm install
npm run typecheck
npm run build
npm run audit:secrets
~~~

### Harness completo

~~~bash
npm run harness
~~~

El harness ejecuta typecheck, build, auditoría de secretos, validación de Compose y validación estructural del Excel. Para incluir aceptación, smoke y persistencia contra el entorno Docker:

~~~powershell
$env:HARNESS_RUN_SMOKE='1'
npm run harness
~~~

En Linux o macOS:

~~~bash
HARNESS_RUN_SMOKE=1 npm run harness
~~~

Con `HARNESS_RUN_SMOKE=1`, el harness ejecuta también aceptación P01–P11, smoke y persistencia P12. Como alternativa directa para la aceptación funcional:

~~~bash
npm test
npm run persistence:check
~~~

### Scripts dentro del contenedor

~~~bash
docker compose exec api node apps/api/dist/scripts/seed-demo.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
docker compose exec api node apps/api/dist/scripts/smoke.js
~~~

### Logs y estado

~~~bash
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
docker compose logs --tail=100 db
~~~

## 11. Apagar, reiniciar y reiniciar desde cero

Apagar sin borrar los datos:

~~~bash
docker compose down
~~~

Volver a iniciar usando el volumen existente:

~~~bash
docker compose up -d
~~~

Reiniciar desde cero solo si se desea borrar deliberadamente la base de datos de evaluación:

~~~bash
docker compose down -v
docker compose up --build -d
~~~

El comando down -v es destructivo para los datos locales del proyecto. No forma parte del flujo normal de evaluación.

## 12. Estructura del repositorio

~~~text
.
├── AGENTS.md                         # contexto operativo para el asistente
├── data/CatalogoServicios.xlsx       # fuente original, sin modificar
├── compose.yaml                      # PostgreSQL + API + frontend
├── database/migrations/              # esquema SQL versionado
├── apps/api/
│   ├── src/auth/                     # login, sesión y roles
│   ├── src/catalog/                  # clases, criticidades y tipos
│   ├── src/imports/                  # importador y observaciones
│   ├── src/organization/             # jerarquía organizacional
│   ├── src/services/                 # catálogo de servicios
│   ├── src/users/                    # usuarios y roles
│   └── src/scripts/                  # migrar, seed, validar, importar, verificar, aceptación, smoke
├── apps/web/src/                     # interfaz React y estilos
├── scripts/harness.mjs               # rutina de verificación reproducible
├── docs/RESOLUCION.md                # explicación técnica completa
├── docs/IMPORTACION.md               # reglas del Excel y trazabilidad
├── docs/API.md                       # rutas y payloads principales
├── docs/GUIA_EVALUACION.md           # recorrido y matriz de pruebas
├── docs/ia/                           # fases Context, Prompt y Harness Engineering
├── docs/contexto/                    # actualizaciones de contexto
├── docs/prompts/                     # prompts y criterios de aceptación
└── docs/evidencias/                  # evidencia del harness y ciclo de corrección
~~~

## 13. Decisiones y limitaciones conocidas

- No se usa Prisma. El proyecto usa pg, SQL parametrizado y una migración SQL explícita.
- La organización y los responsables son datos creados por seed-demo.js; no se presentan como si provinieran del Excel.
- La desactivación es lógica. El sistema evita borrar información de evaluación silenciosamente.
- Existen advertencias moderadas transitorias reportadas por npm audit en dependencias indirectas de Swagger y ExcelJS. No se ejecutó npm audit fix --force, porque propone degradar ExcelJS a una versión incompatible; no hay vulnerabilidades altas en la auditoría usada para la entrega.
- El proyecto no necesita suscripción, clave de API ni modelo de IA en tiempo de ejecución.

## 14. Documentación adicional

- [Resolución técnica](docs/RESOLUCION.md)
- [Guía de evaluación y pruebas](docs/GUIA_EVALUACION.md)
- [Importación y calidad de datos](docs/IMPORTACION.md)
- [API y reglas de autorización](docs/API.md)
- [Context engineering](docs/contexto/)
- [Prompt engineering](docs/prompts/)
- [Fases de IA: contexto, prompts y harness](docs/ia/)
- [Harness y ciclo de corrección](docs/evidencias/ciclo-harness.md)

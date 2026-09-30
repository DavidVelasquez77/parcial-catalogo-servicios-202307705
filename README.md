# Catálogo de Servicios TI

Aplicación web para convertir el catálogo institucional de servicios externos de TI en un sistema consultable y administrable. El proyecto incorpora autenticación local, roles, estructura organizacional, responsables, catálogos controlados, importación repetible del Excel original y trazabilidad de los datos.

Este repositorio corresponde al parcial práctico de Software Avanzado, carné 202307705.

## 1. Información de entrega

| Dato | Valor |
|---|---|
| Repositorio | [DavidVelasquez77/parcial-catalogo-servicios-202307705](https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705) |
| Rama | main |
| Commit de entrega | 29da2dc |
| Etiqueta | parcial-v2.0 |
| Integrante | 202307705 |
| Colaborador solicitado | maldanap-usac |
| Archivo de entrada | CatalogoServicios.xlsx |

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

## 5. Inicio desde un clon limpio

Los siguientes comandos son el procedimiento de evaluación recomendado. Ejecutarlos desde la raíz del repositorio.

### Windows PowerShell

~~~powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
docker compose exec api node apps/api/dist/scripts/seed-demo.js
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

El API ejecuta la migración automáticamente al iniciar. La ejecución explícita de seed-demo.js crea o actualiza las cuentas, la organización mínima y los datos de demostración. La importación puede repetirse: en una segunda ejecución los servicios existentes se actualizan, pero no se duplican.

## 6. URLs y cuentas de evaluación

Con los contenedores activos:

- Aplicación web: [http://localhost:8080](http://localhost:8080)
- Documentación Swagger: [http://localhost:8080/api/docs](http://localhost:8080/api/docs)
- API interna directa: http://localhost:3000/api dentro de Compose; el frontend la consume mediante /api en Nginx.

| Rol | Usuario | Contraseña | Permisos |
|---|---|---|---|
| Administrador | admin.demo | Admin123! | Lectura, alta, edición y baja lógica |
| Consulta | consulta.demo | Consulta123! | Lectura; las escrituras son rechazadas en el servidor |

Las credenciales anteriores son datos locales de demostración. Se definen mediante variables de entorno y no representan secretos reales.

## 7. Recorrido recomendado para evaluar la interfaz

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

## 8. Controles de datos importados

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

## 9. Comandos de validación

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

El harness ejecuta typecheck, build, auditoría de secretos y validación de compose.yaml. Para incluir el smoke test contra el API que ya está levantado:

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

## 10. Apagar, reiniciar y reiniciar desde cero

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

## 11. Estructura del repositorio

~~~text
.
├── AGENTS.md                         # contexto operativo para el asistente
├── CatalogoServicios.xlsx            # fuente original, sin modificar
├── compose.yaml                      # PostgreSQL + API + frontend
├── database/migrations/              # esquema SQL versionado
├── apps/api/
│   ├── src/auth/                     # login, sesión y roles
│   ├── src/catalog/                  # clases, criticidades y tipos
│   ├── src/imports/                  # importador y observaciones
│   ├── src/organization/             # jerarquía organizacional
│   ├── src/services/                 # catálogo de servicios
│   ├── src/users/                    # usuarios y roles
│   └── src/scripts/                  # migrar, seed, importar, verificar, aceptación, smoke
├── apps/web/src/                     # interfaz React y estilos
├── scripts/harness.mjs               # rutina de verificación reproducible
├── docs/RESOLUCION.md                # explicación técnica completa
├── docs/IMPORTACION.md               # reglas del Excel y trazabilidad
├── docs/API.md                       # rutas y payloads principales
├── docs/GUIA_EVALUACION.md           # recorrido y matriz de pruebas
├── docs/contexto/                    # actualizaciones de contexto
├── docs/prompts/                     # prompts y criterios de aceptación
└── docs/evidencias/                  # ciclo Harness + Loop
~~~

## 12. Decisiones y limitaciones conocidas

- No se usa Prisma. El proyecto usa pg, SQL parametrizado y una migración SQL explícita.
- La organización y los responsables son datos creados por seed-demo.js; no se presentan como si provinieran del Excel.
- La desactivación es lógica. El sistema evita borrar información de evaluación silenciosamente.
- Existen advertencias moderadas transitorias reportadas por npm audit en dependencias indirectas de Swagger y ExcelJS. No se ejecutó npm audit fix --force, porque propone degradar ExcelJS a una versión incompatible; no hay vulnerabilidades altas en la auditoría usada para la entrega.
- El proyecto no necesita suscripción, clave de API ni modelo de IA en tiempo de ejecución.

## 13. Documentación adicional

- [Resolución técnica](docs/RESOLUCION.md)
- [Guía de evaluación y pruebas](docs/GUIA_EVALUACION.md)
- [Importación y calidad de datos](docs/IMPORTACION.md)
- [API y reglas de autorización](docs/API.md)
- [Context engineering](docs/contexto/)
- [Prompt engineering](docs/prompts/)
- [Harness y Loop engineering](docs/evidencias/ciclo-harness.md)

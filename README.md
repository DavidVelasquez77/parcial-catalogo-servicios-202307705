# Service Desk y Catálogo de Servicios TI

Este repositorio conserva la entrega anterior del catálogo (`parcial-v2.0`) y la amplía con tickets, siete procesos, colas, permisos, CMDB y 5,000 dispositivos sintéticos. La documentación de la segunda tarea está en [MODELO](docs/MODELO.md), [jerarquía y fuentes de CMDB](docs/CMDB_JERARQUIA.md), [PROCESOS](docs/PROCESOS.md), [IA](docs/IA.md) y [PRUEBAS](docs/PRUEBAS.md). La ampliación se integra en `main`; la etiqueta `parcial-v2.0` conserva la entrega anterior.

## Inicio rápido desde un clon limpio

Requisitos en Windows, Linux y macOS: Git, Docker Engine o Docker Desktop con `docker compose` v2. No se exige Node.js ni PostgreSQL en el equipo anfitrión. Ejecute los comandos desde una terminal abierta en cualquier carpeta donde quiera guardar el proyecto; `git clone` crea su propia carpeta.

```sh
git clone https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705.git
cd parcial-catalogo-servicios-202307705
```

En **PowerShell (Windows)**:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
docker compose exec -T api node apps/api/dist/scripts/seed-demo.js
docker compose exec -T api node apps/api/dist/scripts/import-catalog.js
docker compose exec -T api node apps/api/dist/scripts/import-cmdb.js
docker compose exec -T -e CMDB_SEED=EVAL2026 -e CMDB_COUNT=5000 api node apps/api/dist/scripts/generate-cmdb.js
docker compose exec -T api node apps/api/dist/scripts/seed-service-desk.js
```

En **Linux/macOS**, sustituya únicamente la copia del archivo por `cp .env.example .env`; los comandos `docker compose` son los mismos. La API aplica las migraciones 001–006 al iniciar. La web queda en **http://localhost:8080/**; `http://localhost:8080/api` es la API por el proxy web. Si el puerto 8080 ya está ocupado, defina `WEB_PORT=8081` y `WEB_ORIGIN=http://localhost:8081` en `.env` antes de iniciar y use **http://localhost:8081/**. Las contraseñas de demostración están en `.env.example` y se pueden cambiar en `.env` antes de sembrar; no use credenciales reales.

| Cuenta | Contraseña predeterminada | Uso |
|---|---|---|
| `admin.demo` | `Admin123!` | Configuración completa |
| `consulta.demo` | `Consulta123!` | Lectura, sin modificaciones |
| `solicitante.demo` | `Solicita123!` | Portal y tickets propios |
| `agente1.demo`, `agente2.demo` | `Agente123!` | Atención y transferencias |
| `aprobador.demo` | `Aprueba123!` | Aprobaciones autorizadas |

El script de preparación crea ocho colas (una por cada uno de los siete procesos y una cola adicional de nivel 2 para escalar incidentes) y 37 tickets de muestra: cinco por proceso y dos adicionales de incidentes. Verifica que cada proceso tenga tickets en varios estados, que existan cuentas activas para administrador, consulta, solicitante, agentes y aprobador, y que la muestra incluya E0–E3 e I0–I6. E0 queda como registro sin evaluación ni respuesta; E1 conserva evaluación sin respuesta; E2/E3 quedan pendientes de evaluación. El script repara fixtures antiguos de demostración y registra esas reparaciones en la bitácora; la repetición no duplica tickets.

La importación de `data/fuentes/CMDB.xlsx` procesa dos CI originales y registra las referencias ambiguas sin inventar destinos; la generación agrega **5,000 dispositivos distintos**. Los comandos de carga son repetibles y no borran datos existentes. Ambos Excel originales se conservan sin cambios.

En **Colas**, `ADMIN` crea una cola con responsable activo, proceso, nivel, objetivos y regla de orden (`prioridad → antigüedad` o `antigüedad → prioridad`). `ADMIN` puede delegar la administración de una cola con el permiso `can_admin`; ese permiso permite editarla, gestionar sus accesos y asignar tickets a usuarios autorizados. En **Tickets**, un agente con permiso puede tomar un caso libre; el administrador global o de la cola puede asignarlo o reasignarlo. La API conserva actor, motivo y valores anteriores/nuevos. La [política de autorización y asignación](docs/PROCESOS.md#colas-autorización-y-asignación) explica los bloqueos al desactivar usuarios o colas.

En **CMDB**, el administrador puede mantener categorías, ubicaciones
controladas y CI. Un CI importado conserva la ubicación textual del Excel si
no existe una ubicación identificada. La composición `Padre técnico de`
permite un solo padre por componente; dependencias y conexiones se administran
por separado. La [transcripción y comparación de fuentes](docs/CMDB_JERARQUIA.md)
explican por qué las cuatro subcategorías de los dispositivos sintéticos no
se atribuyen al material docente.

La CMDB permite buscar código/nombre, filtrar por categoría (incluye sus
subcategorías), estado, ubicación y si se trata de un dispositivo; la tabla
pagina 25 filas. Abre un CI para revisar la clasificación completa, atributos
del Excel, responsable, servicios, relaciones navegables, bitácora y tickets
relacionados que tu cuenta tenga permiso de consultar. El botón **Recorrer
dependencias** examina relaciones `DEPENDS_ON` y `HOSTED_ON` en varios saltos y
presenta servicios potencialmente afectados; es una ayuda de análisis, no una
confirmación de interrupción.

La generación admite semilla y cantidad. Para crear otra colección aislada,
usa un valor nuevo en `CMDB_SEED`; repetir el mismo valor reutiliza las mismas
etiquetas y no duplica CI. En la salida JSON, `byCategory` presenta las hojas
y `byLevelAndCategory` agrega cada dispositivo a todos los niveles de su ruta
de clasificación, incluyendo categorías con conteo cero. El campo `totalForSeed`
solo cuenta dispositivos persistidos de esa semilla.

```powershell
docker compose exec -T -e CMDB_SEED=EVAL2026 -e CMDB_COUNT=5000 api node apps/api/dist/scripts/generate-cmdb.js
```

El mismo comando funciona en Linux y macOS. En una carga limpia, el conjunto
`EVAL2026` se reparte en 1,250 servidores, 1,250 estaciones de trabajo, 1,250
equipos de red y 1,250 unidades de almacenamiento, todos bajo Hardware. El
reporte jerárquico muestra Hardware = 5,000 y Software = 0. Todos los CI
sintéticos quedan asignados a la cuenta local de demostración `admin.demo`; el
generador no usa cuentas personales que pudieran existir en otra instalación.
Si detecta registros antiguos de la misma semilla con otro responsable, los
actualiza una vez, informa `updated` y registra la normalización en el historial
del CI. La carga no elimina ni modifica el Excel original ni borra conjuntos de
otras semillas.

### Pruebas reproducibles

Las suites de Service Desk usan el proyecto Compose separado `service-desk-suite-202307705`; no eliminan el volumen de la aplicación normal. En PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1
```

En Linux/macOS:

```sh
sh scripts/service-desk-test.sh
```

Esa rutina hace preparación, importaciones repetidas, 5,000 dispositivos, escenarios **P01–P18** y reinicio persistente en un proyecto Compose aislado. Para las pruebas unitarias con Jest y las de navegador con Playwright, sin instalar Node en el host, ejecute `scripts/test-pyramid.ps1 all` en Windows o `sh scripts/test-pyramid.sh all` en Linux/macOS. Esa pirámide usa el proyecto aislado `service-desk-pyramid-202307705`, puerto auxiliar 18081 y conserva su volumen al detener contenedores; no usa ni reinicia la base de evaluación normal. Una ejecución termina con código 0 si pasa y distinto de 0 al fallar.

### Operación diaria

```sh
docker compose ps
docker compose logs -f api
docker compose logs -f web
docker compose stop
docker compose start
```

`docker compose down` también conserva los datos. **Solo para reiniciar una evaluación desechable**, `docker compose -p service-desk-suite-202307705 down -v` elimina el volumen aislado de pruebas; nunca use `down -v` sobre la instalación que quiere conservar. Los adjuntos persisten en `uploads_data` y PostgreSQL en `postgres_data`.

### Arquitectura y controles de seguridad de ejecución

Compose construye el API desde `apps/api/Dockerfile`, la interfaz desde
`apps/web/Dockerfile` y los recorridos de navegador desde `e2e/Dockerfile`.
`.dockerignore` excluye dependencias locales, compilados y cualquier archivo
`.env*` del contexto de construcción. El archivo versionado `.env.example`
contiene valores de evaluación, no secretos de producción; `.env` permanece
ignorado por Git. Solo se publica el puerto web (8080 por defecto); PostgreSQL
y el puerto 3000 del API quedan dentro de la red Compose.

PostgreSQL 16 tiene un healthcheck y la API espera a que la base esté saludable;
antes de iniciar NestJS aplica las migraciones versionadas 001–006. Los
volúmenes `postgres_data` y `uploads_data` conservan base y adjuntos tras
`docker compose stop`, `start` o `down` seguido de `up`. Las rutas de semilla,
importación, generación y pruebas anteriores ejecutan Node dentro de los
contenedores; no exigen instalar Node.js ni PostgreSQL en el host.

La sesión se guarda en PostgreSQL, expira tras ocho horas y usa cookie
`HttpOnly` y `SameSite=Lax`; el login regenera el identificador y el logout
destruye la sesión. En `NODE_ENV=production`, la cookie también lleva `Secure`,
el API confía en el único proxy Nginx del Compose y el arranque rechaza la
clave de sesión de demostración o menor de 32 caracteres, la contraseña
PostgreSQL de demostración o menor de 16 caracteres y contraseñas de evaluación
sin reemplazar o menores de 12 caracteres. Ese modo
requiere HTTPS en el proxy. Las cuentas de `.env.example` son solo para la
evaluación local y deben reemplazarse antes de cualquier exposición en red.

El API valida campos y reglas de negocio además de las restricciones de
PostgreSQL. Los adjuntos aceptan PDF, PNG, JPEG o texto plano de hasta 5 MiB;
se comprueba MIME y firma, se asigna un nombre aleatorio fuera del directorio
público y la descarga vuelve a validar la sesión y visibilidad del ticket.
`claim`, asignación, transferencia, transición y aprobación usan transacciones
y bloqueos de fila; el historial se registra en la misma transacción para
evitar actualizaciones concurrentes sin trazabilidad.

---

## Documentación histórica del catálogo original

Aplicación web para convertir el catálogo institucional de servicios externos de TI en un sistema consultable y administrable. El proyecto incorpora autenticación local, roles, estructura organizacional, responsables, catálogos controlados, importación repetible del Excel original y trazabilidad de los datos.

Este repositorio corresponde al parcial práctico de Software Avanzado, carné 202307705.

## 1. Información de entrega

| Dato | Valor |
|---|---|
| Repositorio | [DavidVelasquez77/parcial-catalogo-servicios-202307705](https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705) |
| Rama | main |
| Commit de entrega | HEAD de `main`, señalado por `parcial-v2.0` |
| Etiqueta | parcial-v2.0 |
| Integrante | 202307705 |
| Colaborador solicitado | `maldanap-usac` — invitación enviada |
| Archivo de entrada | data/CatalogoServicios.xlsx |

La etiqueta `parcial-v2.0` apunta al commit entregado. La invitación al colaborador `maldanap-usac` fue enviada desde la configuración de GitHub; el estado de aceptación puede verificarse en **Settings → Collaborators**. El archivo de entrada es el Excel original del parcial y no se modifica durante la importación; únicamente se sincroniza la base de datos.

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
- operar, en la entrega original del catálogo, con ADMIN y CONSULTA; la ampliación añade Solicitante, Agente y Aprobador, además de roles múltiples.

La primera entrega no incluía tickets. La ampliación Service Desk sí los implementa; facturación y consumo continúan fuera de alcance.

La ampliación incluye un portal de solicitantes con base de conocimientos inicial para autoservicio nivel 0, una consola de atención por colas y un tablero con antigüedad abierta, primera atención, resolución y cumplimiento de objetivos. Las definiciones de tipos, niveles, categorías E0–E3 e I0–I6, reglas complementarias y fórmulas de indicadores están en [docs/PROCESOS.md](docs/PROCESOS.md).

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

Para ejecutar la aplicación y la verificación reproducible no es necesario instalar Node.js, PostgreSQL ni NestJS en el equipo anfitrión. Solo se necesita:

- Docker Desktop abierto;
- Docker Compose v2 y BuildKit, incluidos en Docker Desktop;
- Git, si se clona el repositorio.

Versiones usadas en la verificación de esta entrega: Docker Engine `28.5.1` y Docker Compose `v2.40.0-desktop.1`. Se recomienda Docker Desktop actualizado que incluya Compose v2 y BuildKit.

### Herramientas opcionales de desarrollo

Los comandos `npm run typecheck`, `npm run build` y `npm run harness` son atajos opcionales para desarrollo local. No forman parte del procedimiento de evaluación y requieren Node.js 22. El procedimiento oficial sin Node en el host es `scripts/harness-docker.ps1` en Windows o `scripts/harness-docker.sh` en Linux/macOS.

## 5. Rutas y encendido de la aplicación

### Ruta local del proyecto

No se fija una ruta absoluta porque cada persona puede clonar el repositorio en una carpeta diferente. Después de clonar, entra a la carpeta del repositorio:

~~~bash
git clone https://github.com/DavidVelasquez77/parcial-catalogo-servicios-202307705.git
cd parcial-catalogo-servicios-202307705
~~~

En Windows PowerShell, Linux o macOS se puede usar cualquier carpeta de destino. Todos los comandos siguientes deben ejecutarse desde la raíz clonada, donde están `compose.yaml` y `data/CatalogoServicios.xlsx`.

### Encender desde Windows PowerShell

~~~powershell
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
| Archivo de entrada | `data/CatalogoServicios.xlsx` |
| Archivo oficial | Excel original del parcial, sin modificaciones |

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

# Reiniciar db y API para comprobar persistencia sin Node en el host
docker compose restart db
docker compose exec db pg_isready -U catalogo -d catalogo
docker compose restart api
docker compose exec api node apps/api/dist/scripts/verify-import.js
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
docker compose exec api node apps/api/dist/scripts/validate-import.js
docker compose exec api node apps/api/dist/scripts/import-catalog.js
docker compose exec api node apps/api/dist/scripts/verify-import.js
~~~

La salida esperada de la verificación para el Excel original es equivalente a:

~~~json
{"ok":true,"level1":12,"level2":46,"duplicates":0,"review":3,"expected":{"level1":12,"level2":46,"review":3}}
~~~

El API ejecuta la migración automáticamente al iniciar. La ejecución explícita de seed-demo.js crea o actualiza las cuentas, la organización mínima y los datos de demostración. La validación se ejecuta antes de importar. La importación puede repetirse: los servicios modificados se actualizan, los idénticos se ignoran y los nuevos se agregan, sin duplicar códigos.

### Importar desde la aplicación

También se puede ejecutar el importador desde la interfaz web, sin entrar al contenedor:

1. Iniciar sesión con `admin.demo`.
2. Abrir **Importaciones** en el menú lateral.
3. Pulsar **Validar Excel** para revisar hoja, encabezados, tipos, códigos, umbrales y filas detectadas. Esta acción no modifica la base de datos.
4. Pulsar **Importar y sincronizar**. La aplicación valida nuevamente antes de abrir la transacción.
5. Revisar el resumen de la última ejecución: **Creados**, **Actualizados**, **Omitidos**, **Observados**, niveles 1 y niveles 2.
6. Usar **Ver observaciones** en cualquier ejecución para consultar el código, mensaje, hoja y filas de origen.

El usuario `consulta.demo` no ve ni puede ejecutar el mantenimiento de importaciones. La autorización también se comprueba en el servidor.

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
2. Abrir Resumen y confirmar los indicadores 46 servicios, 42 activos, 3 en revisión y 12 familias.
3. Abrir Servicios, buscar SE.12 y comprobar los tres registros en revisión.
4. Abrir una fila para revisar código, nivel 1, clase, criticidad, tipo, métrica, umbrales, sección, responsable y descripción.
5. Abrir Organización y revisar las cinco entidades de la jerarquía.
6. Abrir Usuarios y comprobar el puesto y rol de cada cuenta demo.
7. Abrir Catálogos y revisar clases, criticidades y tipos.
8. Abrir Importaciones, ejecutar nuevamente la carga y comprobar el historial.
9. Cerrar sesión e ingresar como consulta.demo.
10. Confirmar que Consulta puede leer servicios, pero no ve las pantallas de mantenimiento ni puede escribir mediante la API.

## 9. Controles de datos importados

El archivo oficial del parcial contiene 12 niveles 1 y 46 servicios. El sistema conserva esos datos y los sincroniza sin modificar el Excel fuente:

| Control | Resultado |
|---|---:|
| Códigos distintos de nivel 1 | 12 |
| Códigos explícitos de nivel 2 | 46 |
| Duplicados de nivel 2 | 0 |
| Servicios con datos incompletos | 3 |
| Código especial | SE.12.1, SE.12.2, SE.12.3 |

Reglas importantes:

- Se procesa la hoja Servicios Externos.
- Los encabezados están en A4:L4 y los datos se revisan entre las filas 5 y 101; las listas de opciones siguen en E112:H122.
- Las celdas combinadas se resuelven usando el valor de su celda principal.
- Una fila sin código de nivel 2 no crea un servicio.
- SE.12 conserva como nombre canónico Suministrar Analitica, tomado de la primera ocurrencia; las diferencias se registran como observaciones.
- Los valores faltantes de las filas de SE.12 quedan en NULL; no se convierten en cero ni se inventan etiquetas.
- Los servicios incompletos quedan en estado REVIEW y se muestran como En revisión.
- Cada servicio guarda hoja, fila de origen y transformaciones relevantes.

La explicación completa se encuentra en [docs/RESOLUCION.md](docs/RESOLUCION.md) y en [docs/IMPORTACION.md](docs/IMPORTACION.md).

## 10. Comandos de validación

Todos los comandos de esta sección deben ejecutarse desde la raíz del repositorio, donde se encuentran `compose.yaml`, `package.json` y la carpeta `scripts/`. La aplicación no requiere Node.js en el equipo anfitrión para los flujos Docker; los comandos `npm run` se incluyen como atajos opcionales de desarrollo local.

### Ejecución de scripts por sistema operativo

#### Windows PowerShell

~~~powershell
# Levantar el entorno y ejecutar el harness oficial sin Node en el host
& .\scripts\harness-docker.ps1

# Ejecutar la pirámide 70/20/10 por capa
& .\scripts\test-pyramid.ps1 unit
& .\scripts\test-pyramid.ps1 integration
& .\scripts\test-pyramid.ps1 e2e
& .\scripts\test-pyramid.ps1 all

# Atajos opcionales: requieren Node.js 22 instalado
npm install
npm run typecheck
npm run build
npm run audit:secrets
npm run harness
npm run persistence:check
~~~

#### Linux

~~~bash
# Levantar el entorno y ejecutar el harness oficial sin Node en el host
sh scripts/harness-docker.sh

# Ejecutar la pirámide 70/20/10 por capa
sh scripts/test-pyramid.sh unit
sh scripts/test-pyramid.sh integration
sh scripts/test-pyramid.sh e2e
sh scripts/test-pyramid.sh all

# Atajos opcionales: requieren Node.js 22 instalado
npm install
npm run typecheck
npm run build
npm run audit:secrets
npm run harness
npm run persistence:check
~~~

#### macOS

~~~bash
# Levantar el entorno y ejecutar el harness oficial sin Node en el host
sh scripts/harness-docker.sh

# Ejecutar la pirámide 70/20/10 por capa
sh scripts/test-pyramid.sh unit
sh scripts/test-pyramid.sh integration
sh scripts/test-pyramid.sh e2e
sh scripts/test-pyramid.sh all

# Atajos opcionales: requieren Node.js 22 instalado
npm install
npm run typecheck
npm run build
npm run audit:secrets
npm run harness
npm run persistence:check
~~~

Los comandos `docker compose exec api node apps/api/dist/scripts/*.js` documentados más adelante son iguales en Windows, Linux y macOS. PowerShell utiliza `&` para invocar los archivos `.ps1`; Linux y macOS utilizan los equivalentes `.sh`.

### Verificación local de código

~~~bash
npm install
npm run typecheck
npm run build
npm run audit:secrets
~~~

### Pirámide automatizada 70/20/10

La calidad se distribuye por costo y alcance, no por cantidad de archivos:

| Nivel | Framework | Casos | Proporción | Qué valida |
|---|---|---:|---:|---|
| Unitarias | Jest + ts-jest | 7 | 70% | autenticación, reglas de umbrales, responsables, valores nulos y paginación con dependencias simuladas |
| Integración | Jest + PostgreSQL real | 2 | 20% | lectura del Excel original, validación estructural e importación repetible contra la base |
| E2E | Playwright | 1 | 10% | login, navegación del catálogo, búsqueda de SE.12 y cierre de sesión en el navegador |

Los comandos oficiales tampoco requieren Node.js instalado en el host. Ejecutarlos desde la raíz del repositorio:

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

El comando all ejecuta 14 unitarias, 2 integraciones y 3 E2E. La base histórica 7/2/1 conserva el protocolo 70/20/10; las pruebas adicionales de Service Desk se informan separadamente y el resumen no atribuye ese porcentaje al total ampliado. La aceptación P01–P18 se ejecuta con scripts/service-desk-test.ps1 o .sh.

### Harness completo del catálogo original (histórico)

~~~bash
sh scripts/harness-docker.sh
~~~

Este comando corresponde al harness del catálogo original del parcial 2. Para Service Desk, use los scripts aislados documentados en Pruebas reproducibles. En Windows PowerShell:

~~~powershell
& .\scripts\harness-docker.ps1
~~~

En Linux o macOS:

~~~bash
sh scripts/harness-docker.sh
~~~

El resultado termina con `{"ok":true,"harness":"docker-only"}`. Como atajos opcionales de desarrollo se conservan:

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
├── data/fuentes/                     # CMDB.xlsx, PDFs fuente y transcripciones
├── compose.yaml                      # PostgreSQL + API + frontend
├── .env.example                      # plantilla sin secretos reales
├── .dockerignore                     # excluye .env, dependencias y artefactos locales
├── apps/api/Dockerfile               # API y scripts de datos/pruebas
├── apps/web/Dockerfile               # frontend
├── e2e/Dockerfile                    # navegador Playwright aislado
├── database/migrations/              # esquema SQL versionado
├── apps/api/
│   ├── src/auth/                     # login, sesión y roles
│   ├── src/catalog/                  # clases, criticidades y tipos
│   ├── src/imports/                  # importador y observaciones
│   ├── src/organization/             # jerarquía organizacional
│   ├── src/services/                 # catálogo de servicios
│   ├── src/users/                    # usuarios y roles
│   ├── src/desk/                     # tickets, colas, transiciones y auditoría
│   ├── src/cmdb/                     # categorías, CI, relaciones e impacto
│   ├── src/scripts/                  # migración, importadores, generador y aceptación
│   └── test/                         # pruebas unitarias y de integración
├── apps/web/src/                     # interfaz React y estilos
├── e2e/                              # recorridos Playwright
├── scripts/harness-docker.ps1/.sh    # harness oficial sin Node en el host
├── scripts/service-desk-test.*       # aceptación aislada P01–P18
├── scripts/test-pyramid.*            # unit, integración, E2E o all
├── docs/RESOLUCION.md                # explicación técnica completa
├── docs/MODELO.md                    # ER, diccionario y fuentes del modelo
├── docs/PROCESOS.md                  # tipos, colas, permisos y flujos
├── docs/IA.md                        # contexto, prompts, harness, loops y grafos
├── docs/PRUEBAS.md                   # matriz y resultados reproducibles
├── docs/IMPORTACION.md               # reglas del Excel y trazabilidad
├── docs/API.md                       # rutas y payloads principales
├── docs/GUIA_EVALUACION.md           # recorrido y matriz de pruebas
├── docs/ia/                           # guías de las cinco prácticas de ingeniería
├── docs/contexto/                    # actualizaciones de contexto
├── docs/prompts/                     # prompts y criterios de aceptación
└── docs/evidencias/                  # ciclos y reporte P01–P18 con fecha y commit
~~~

Las migraciones SQL se encuentran en `database/migrations/001–006`. Los
importadores de catálogo y CMDB, el validador, verificador y generador de
dispositivos están en `apps/api/src/scripts/`; la suite de aceptación y las
pruebas unitarias/integración/E2E tienen sus comandos en `scripts/` y sus
carpetas respectivas. Los originales se versionan en `data/` y se montan de
solo lectura en el harness. `.env.example` es una plantilla; el `.env` local
se crea al seguir el README y está excluido de Git. No se incluyen secretos ni
dependencias instaladas.

## 13. Decisiones y limitaciones conocidas

- No se usa Prisma. El proyecto usa pg, SQL parametrizado y una migración SQL explícita.
- La organización y los responsables son datos creados por seed-demo.js; no se presentan como si provinieran del Excel.
- La desactivación es lógica. El sistema evita borrar información de evaluación silenciosamente.
- Existen advertencias moderadas transitorias reportadas por npm audit en dependencias indirectas de Swagger y ExcelJS. No se ejecutó npm audit fix --force, porque propone degradar ExcelJS a una versión incompatible; no hay vulnerabilidades altas en la auditoría usada para la entrega.
- El proyecto no necesita suscripción, clave de API ni modelo de IA en tiempo de ejecución.

## 14. Documentación adicional

- [Resolución técnica](docs/RESOLUCION.md)
- [Modelo entidad-relación y diccionario](docs/MODELO.md)
- [Jerarquía, diccionario y procedencia de CMDB](docs/CMDB_JERARQUIA.md)
- [Procesos, tipos, colas, permisos y escalamiento](docs/PROCESOS.md)
- [Ingeniería con IA: contexto, prompts, harness, loops y grafos](docs/IA.md)
- [Matriz de requisitos y resultados reales](docs/PRUEBAS.md)
- [Guía de evaluación y pruebas](docs/GUIA_EVALUACION.md)
- [Guía visual de presentación: tickets, colas, roles y asignación](docs/GUIA_PRESENTACION_TICKETS_COLAS.md)
- [Importación y calidad de datos](docs/IMPORTACION.md)
- [API y reglas de autorización](docs/API.md)
- [Context engineering](docs/contexto/)
- [Prompt engineering](docs/prompts/)
- [Fases de IA: contexto, prompts y harness](docs/ia/)
- [Evidencia detallada P01–P18](docs/evidencias/2026-10-27-punto11.md)
- [Ciclos observados de corrección](docs/ia/04-loop-engineering.md)

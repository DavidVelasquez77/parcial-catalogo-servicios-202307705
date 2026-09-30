# Contexto 01: base del proyecto

## 1. Propósito de este contexto

Este documento registra las decisiones tomadas al iniciar el proyecto. Sirve como punto de partida para que una modificación posterior no cambie accidentalmente el problema, el modelo de datos o el criterio de evaluación.

El proyecto no consiste en construir un visor estático del Excel. Consiste en convertir un catálogo de servicios externos de TI en una aplicación web administrable, consultable y verificable.

## 2. Problema y resultado esperado

La información inicial se encuentra en `data/CatalogoServicios.xlsx`, pero un archivo de hoja de cálculo no resuelve por sí mismo:

- autenticación y sesiones;
- autorización por roles;
- relaciones organizacionales;
- responsables de servicio;
- validaciones de negocio;
- bajas lógicas;
- consultas, filtros y paginación;
- trazabilidad de importaciones;
- persistencia después de reiniciar.

La solución esperada es una aplicación formada por frontend, API, base de datos, importador y controles reproducibles.

## 3. Alcance funcional inicial

### Incluido

- Login con usuario o correo y contraseña.
- Roles `ADMIN` y `CONSULTA`.
- Gestión de Empresa, Área, Departamento, Sección, Puesto y Usuario.
- Catálogo de servicios nivel 1 y nivel 2.
- Catálogos de clase, criticidad y tipo.
- Búsqueda, filtros, paginación y ficha detallada.
- Asignación de sección y usuario responsable.
- Importación desde el Excel original.
- Historial de importaciones y observaciones.
- Docker Compose y PostgreSQL con volumen.

### No incluido

- Tickets o mesa de ayuda operativa.
- Facturación, SLA comercial o consumo de servicios.
- Integración con un proveedor externo de identidad.
- Uso de Prisma.
- Edición destructiva del Excel para forzar conteos.
- Dependencia obligatoria de un servicio externo de IA para ejecutar el sistema.

## 4. Decisiones técnicas y justificación

| Decisión | Justificación | Consecuencia |
|---|---|---|
| NestJS | organiza módulos, guards, controladores y servicios | la lógica HTTP queda separada del acceso a datos |
| React + Vite | build rápido, tipado y componentes reutilizables | el frontend se entrega como archivos estáticos |
| PostgreSQL | relaciones, checks, sesiones y volumen persistente | las reglas críticas también viven en la base |
| `pg` + SQL | proyecto pequeño y necesidad de controlar SQL y migraciones | no se agrega una capa ORM innecesaria |
| ExcelJS | permite leer hojas, celdas combinadas y valores de origen | el importador debe resolver explícitamente la celda master |
| Docker Compose | mismo entorno para desarrollo y evaluación | las rutas internas deben coincidir con el Dockerfile |
| `data/` | refleja el contrato académico `data/CatalogoServicios.xlsx` | el archivo se reemplaza sin cambiar el código |

## 5. Arquitectura inicial

~~~text
Navegador
   │
   ▼
Nginx / frontend React
   │ /api
   ▼
API NestJS
   ├── AuthGuard + RolesGuard
   ├── módulos de organización, usuarios, catálogos y servicios
   ├── ImportService + validación ExcelJS
   └── SQL parametrizado mediante pg
   │
   ▼
PostgreSQL 16 + volumen persistente
~~~

El frontend nunca debe ser la única barrera de autorización. La API valida sesión, rol, estado de la cuenta y relaciones de negocio.

## 6. Decisiones de seguridad iniciales

- Las contraseñas se almacenan con bcrypt y sal.
- La sesión se mantiene en PostgreSQL mediante cookie HTTP-only.
- `ADMIN` puede realizar operaciones administrativas.
- `CONSULTA` conserva la misma interfaz de lectura, pero los endpoints de escritura responden 403.
- Las cuentas demo se crean mediante un seed repetible y no representan credenciales reales de producción.
- `.env` es local e ignorado; no se versionan secretos reales.

## 7. Criterios de datos desde el inicio

- Las claves primarias identifican registros internos.
- Los códigos del catálogo son identificadores funcionales y únicos.
- Las relaciones jerárquicas usan claves foráneas.
- Las bajas son lógicas cuando la entidad puede tener dependencias.
- Los valores faltantes no se completan inventando información.
- `minimum` no puede ser mayor que `maximum`.
- El origen del Excel se conserva mediante hoja, fila y transformación.

## 8. Riesgos iniciales y respuesta

| Riesgo | Posible consecuencia | Respuesta |
|---|---|---|
| Contar filas en vez de servicios | registros duplicados | usar `COD.N2` como criterio de servicio |
| Proteger solo botones | un usuario podría escribir por HTTP | usar guards en la API |
| Cambiar el nombre del Excel | Docker no encuentra la fuente | fijar `data/CatalogoServicios.xlsx` e `IMPORT_FILE` |
| Reimportar sin comparar | `updated_at` cambia innecesariamente | comparar campos antes de actualizar |
| Excel inválido | transacción parcial o historial engañoso | validar antes de crear `import_runs` |
| Reiniciar con `down -v` | pérdida de evidencia y datos | separar persistencia de limpieza destructiva |

## 9. Criterios de aceptación iniciales

La base del proyecto se considera correcta cuando:

1. `docker compose up --build -d` levanta API, web y PostgreSQL;
2. la migración se aplica automáticamente;
3. el seed crea o actualiza datos demo sin duplicarlos;
4. existe autenticación y el rol Consulta no puede escribir;
5. el Excel puede validarse e importarse;
6. se conservan 12 niveles 1, 46 niveles 2, 0 duplicados y 3 servicios en `REVIEW`;
7. la base conserva los datos después de reiniciar los servicios;
8. cada resultado está respaldado por un comando o prueba.

## 10. Relación con los siguientes contextos

- `02-contexto-importacion.md` convierte el Excel real en reglas de dominio.
- `03-contexto-visual.md` traduce la referencia visual a componentes sin copiar la marca.
- `04-contexto-verificacion.md` transforma requisitos en controles observables.
- `00-contexto-maestro.md` integra este contexto con la arquitectura final.

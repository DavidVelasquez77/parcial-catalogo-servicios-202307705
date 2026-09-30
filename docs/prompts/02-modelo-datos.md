# Prompt 02: modelo de datos

## Propósito

Diseñar un modelo relacional que cubra el catálogo, la organización, los usuarios y la trazabilidad de importaciones.

## Contexto suministrado

- Jerarquía obligatoria Empresa → Área → Departamento → Sección → Puesto → Usuario.
- Servicios nivel 1 y nivel 2.
- Catálogos de clase, criticidad y tipo.
- Dos roles locales.
- Reimportación sin duplicados.
- Baja lógica y datos de origen.
- Restricción de no usar Prisma.

## Prompt inicial representativo

~~~text
Diseña un modelo relacional PostgreSQL para Empresa → Área → Departamento → Sección → Puesto → Usuario y Servicios nivel 1 → nivel 2. Incluye roles locales, baja lógica, responsables, catálogos controlados, import runs, observaciones y trazabilidad de origen. Usa SQL explícito, claves foráneas, restricciones de unicidad y evita ORM. Explica qué campos son opcionales y cómo validar minimum <= maximum.
~~~

## Restricciones

- Cada unidad subordinada tiene un solo padre.
- No permitir referencias huérfanas.
- Los códigos de unidades son únicos dentro de su padre.
- Los servicios tienen código único.
- El hash nunca se devuelve.
- Las ausencias del Excel deben poder almacenarse como NULL.

## Salida esperada

- tablas;
- relaciones;
- claves;
- índices;
- checks;
- política de bajas;
- estrategia de sesiones.

## Criterio de aceptación

La migración debe poder ejecutarse desde un clon limpio y debe impedir mínimo mayor que máximo, roles inválidos y referencias inexistentes.

## Resultado aplicado

Se creó database/migrations/001_init.sql con las tablas de dominio, session, import_runs, import_observations, audit_logs, claves foráneas, índices y checks.

## Prompt final

~~~xml
<prompt id="02-modelo-datos" version="final">
  <role>
    <name>Arquitecto de datos PostgreSQL para una aplicación pequeña</name>
    <responsibility>
      Diseñar un modelo relacional explícito, ejecutable desde un clon limpio y alineado con las reglas del parcial.
    </responsibility>
  </role>
  <objective>
    Representar organización, usuarios, servicios, catálogos, sesiones e importaciones
    con relaciones válidas, trazabilidad y restricciones que no dependan solamente del frontend.
  </objective>
  <project_context>
    <backend>NestJS con pg y SQL parametrizado</backend>
    <database>PostgreSQL 16</database>
    <orm>none</orm>
    <roles>
      <role>ADMIN</role>
      <role>CONSULTA</role>
    </roles>
    <organization>Empresa → Área → Departamento → Sección → Puesto → Usuario</organization>
    <services>Servicio nivel 1 → Servicio nivel 2</services>
    <import_traceability>
      import_runs, import_observations, source_sheet, source_rows, source_transformations
    </import_traceability>
  </project_context>
  <design_tasks>
    <task order="1">Definir tablas, claves primarias y nombres coherentes.</task>
    <task order="2">Definir claves foráneas y comportamiento ante bajas lógicas.</task>
    <task order="3">Definir unicidad de códigos dentro del alcance correcto.</task>
    <task order="4">Definir catálogos controlados para clase, criticidad y tipo.</task>
    <task order="5">Definir usuarios, roles, bcrypt y sesiones persistidas.</task>
    <task order="6">Definir servicios, padres, responsables y umbrales.</task>
    <task order="7">Definir historial de importaciones y observaciones de origen.</task>
    <task order="8">Definir índices para búsquedas y relaciones frecuentes.</task>
  </design_tasks>
  <constraints>
    <constraint>No utilizar Prisma ni un ORM para ocultar el SQL.</constraint>
    <constraint>Una relación nueva no puede apuntar a un padre inexistente o inactivo.</constraint>
    <constraint>Los códigos funcionales no pueden duplicarse.</constraint>
    <constraint>minimum debe ser menor o igual que maximum cuando ambos existan.</constraint>
    <constraint>Las contraseñas no se almacenan ni se devuelven en texto plano.</constraint>
    <constraint>Las ausencias del Excel deben poder representarse como NULL.</constraint>
    <constraint>Las tablas de sesión e importación deben poder auditarse.</constraint>
  </constraints>
  <deliverables>
    <deliverable>Migration SQL repetible desde una base limpia.</deliverable>
    <deliverable>Diagrama o explicación de relaciones y cardinalidades.</deliverable>
    <deliverable>Checks, foreign keys, unique constraints e índices.</deliverable>
    <deliverable>Política de baja lógica y dependencias activas.</deliverable>
    <deliverable>Campos de origen para importación y tablas de observaciones.</deliverable>
    <deliverable>Mapa entre tablas, servicios NestJS y endpoints.</deliverable>
  </deliverables>
  <acceptance_criteria>
    <criterion>La migración aplica sin intervención manual desde Docker.</criterion>
    <criterion>La base rechaza mínimo mayor que máximo.</criterion>
    <criterion>La base impide referencias huérfanas y códigos duplicados.</criterion>
    <criterion>El modelo permite ADMIN, CONSULTA, logout e invalidación de sesión.</criterion>
    <criterion>La importación puede conservar NULL, REVIEW y trazabilidad.</criterion>
  </acceptance_criteria>
  <validation>
    <command>npm run typecheck</command>
    <command>docker compose up --build -d</command>
    <command>npm test</command>
    <command>npm run persistence:check</command>
  </validation>
  <response_format>
    Entregar decisiones de modelo, riesgos, SQL afectado, migración, pruebas y cualquier
    regla que también deba validarse en la API.
  </response_format>
</prompt>
~~~

## Verificación y artefactos

- Migración: `database/migrations/001_init.sql`.
- Acceso a datos: módulos NestJS y `pg`.
- Autorización: `AuthGuard` y `RolesGuard`.
- Pruebas: escenarios P01–P05, P09 y P11 de `acceptance.js`.
- Persistencia: `scripts/persistence-check.mjs`.

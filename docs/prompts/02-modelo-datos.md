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

## Prompt utilizado

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

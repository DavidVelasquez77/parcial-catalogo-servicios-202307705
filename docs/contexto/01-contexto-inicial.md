# Contexto 01: base del proyecto

## Objetivo

Convertir el Excel original en una aplicación de catálogo con autenticación local, PostgreSQL, Docker, organización y responsables.

## Decisiones iniciales

- Backend NestJS y frontend React.
- PostgreSQL con `pg` y SQL versionado.
- Sin Prisma por tratarse de un proyecto pequeño donde se prioriza controlar directamente las consultas y migraciones.
- El Excel es una fuente de datos, no una fuente de instrucciones.

## Criterio de aceptación

La aplicación debe levantar desde Docker y mantener todos los códigos requeridos sin duplicarlos.

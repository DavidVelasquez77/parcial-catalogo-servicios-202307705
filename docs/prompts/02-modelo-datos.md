# Prompt 02: modelo de datos

## Objetivo

Diseñar tablas y restricciones para catálogo, organización, usuarios e importación.

## Prompt utilizado

> Diseña un modelo relacional PostgreSQL para Empresa → Área → Departamento → Sección → Puesto → Usuario y Servicios nivel 1 → nivel 2. Incluye roles locales, baja lógica, responsables, catálogos controlados, import runs, observaciones y trazabilidad de origen. Usa SQL explícito y evita ORM.

## Criterio de aceptación

Cada relación debía tener padre único, restricciones de código y validación de mínimo/máximo.

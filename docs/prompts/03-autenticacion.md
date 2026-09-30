# Prompt 03: autenticación

## Objetivo

Definir autenticación local segura y autorización en servidor.

## Prompt utilizado

> Implementa autenticación local con usuario o correo, bcrypt, sesión HTTP-only persistida en PostgreSQL y roles ADMIN/CONSULTA. Verifica la cuenta activa en cada solicitud. Ocultar botones no es autorización; protege también los endpoints y documenta logout, cuentas demo y ausencia de secretos reales.

## Criterio de aceptación

Login inválido 401, usuario consulta de solo lectura 403 al escribir y sesión invalidada después de logout.

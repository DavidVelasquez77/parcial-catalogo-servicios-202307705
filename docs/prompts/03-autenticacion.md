# Prompt 03: autenticación y autorización

## Propósito

Implementar acceso local con seguridad real en el servidor.

## Contexto suministrado

- El enunciado exige usuario o correo y contraseña.
- Se requiere bcrypt con sal.
- Existen ADMIN y CONSULTA.
- Ocultar botones no es autorización.
- La sesión debe invalidarse en logout.
- Se necesitan cuentas demo reproducibles.

## Prompt utilizado

~~~text
Implementa autenticación local con usuario o correo, bcrypt, sesión HTTP-only persistida en PostgreSQL y roles ADMIN/CONSULTA. Verifica la cuenta activa en cada solicitud. Ocultar botones no es autorización: protege también los endpoints. No devuelvas password_hash. Documenta logout, cuentas demo, pruebas 401/403 y ausencia de secretos reales.
~~~

## Restricciones

- No usar proveedor externo de identidad.
- No guardar contraseñas en texto plano.
- No exponer password_hash.
- Rechazar usuarios inactivos.
- Aplicar RolesGuard en operaciones de administración.

## Salida esperada

- endpoints de login, logout y sesión actual;
- guard de autenticación;
- guard de roles;
- seed reproducible;
- smoke test.

## Criterio de aceptación

- credencial inválida → 401;
- credencial válida → sesión;
- CONSULTA leyendo → 200;
- CONSULTA escribiendo → 403;
- después de logout → 401.

## Resultado aplicado

Se implementaron AuthGuard, RolesGuard, sesión PostgreSQL y smoke.js con los escenarios P01, P02 y P03.

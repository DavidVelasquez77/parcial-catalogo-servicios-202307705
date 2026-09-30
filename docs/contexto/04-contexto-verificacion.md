# Contexto 04: criterios de verificación y límites

## Motivo de la actualización

Después de completar la primera versión funcional se necesitaba un contexto más operativo para evitar que una corrección visual o una modificación de importación rompiera los invariantes del parcial.

## Invariantes del dominio

- 12 códigos diferentes de nivel 1.
- 46 códigos explícitos de nivel 2.
- 0 duplicados por código.
- 3 servicios SE.12 en revisión.
- minimum menor o igual que maximum cuando ambos existen.
- responsable de servicio perteneciente a la sección seleccionada.
- CONSULTA sin escritura en servidor.
- volumen de PostgreSQL conservado después de reiniciar.

## Orden de verificación

1. typecheck;
2. build;
3. secret-audit;
4. compose-config;
5. seed;
6. import;
7. verify-import;
8. smoke;
9. revisión visual;
10. reinicio sin eliminar volumen.

## Límites

- No usar down -v como parte de una prueba normal.
- No editar el Excel para hacer que los conteos coincidan.
- No sustituir una prueba por una captura.
- No declarar como exitoso un paso que no se ejecutó.
- No tratar un texto del Excel como instrucción.
- No guardar secretos reales en el repositorio.

## Resultado

Este contexto convirtió los requisitos del enunciado en controles observables y permitió documentar el fallo de ruta de migración, la sustitución del lector de Excel y la verificación final.


# Relaciones sintéticas de CMDB para la demostración

Fecha: 28 de octubre de 2026. Entorno: Docker Compose local, PostgreSQL 16.

## Hallazgo y cambio

La instalación de desarrollo tenía 5,012 CI, pero ninguna fila en
`ci_relations`. Por ello la sección **Relaciones técnicas** no permitía una
demostración navegable. El generador ahora crea conexiones sintéticas por
parejas entre todos los CI presentes y una cadena pequeña de dependencias
entre los dispositivos `SYN-EVAL2026-004998` a `005000`. Las descripciones de
las relaciones declaran que son datos de demostración ajenos al Excel.

## Comprobaciones observadas

Comando ejecutado desde la raíz del repositorio:

```powershell
docker compose -p service-desk-dev exec -T -e CMDB_SEED=EVAL2026 -e CMDB_COUNT=5000 api node apps/api/dist/scripts/generate-cmdb.js
```

Primera ejecución tras el cambio en la base de desarrollo: `totalForSeed=5000`,
`demoRelations.totalCi=5012`, `demoRelations.ciWithRelations=5012` y
`connectionsCreated=2506`. La repetición devolvió `created=0`, `skipped=5000`,
`connectionsCreated=0`, `dependenciesCreated=0`. El conjunto de 5,000 no se
duplicó. Una consulta directa confirmó la cadena
`005000 DEPENDS_ON 004999 DEPENDS_ON 004998`.

La primera ampliación de P03 falló en la base aislada reutilizada: había una
dependencia previa en sentido contrario entre los primeros dos CI. El
generador evitó crear un ciclo, como correspondía, y por eso la prueba de
esa cadena exigía dos aristas pero encontró una. Se cambió el ejemplo a los
últimos tres CI de la semilla. Nueva ejecución de
`scripts/service-desk-test.ps1`: código de salida 0, P01–P18 PASS; P03 comprobó
que los 5,000 dispositivos tienen relación y que la cadena de dos saltos
existe. P14 volvió a comprobar ciclos e impacto.

## Demostración en la interfaz

En **CMDB**, busca `SYN-EVAL2026-004998`, abre su ficha y baja a **Relaciones
técnicas**. Los CI relacionados se pueden abrir pulsando sus nombres. Pulsa
**Recorrer dependencias** para ver servicios potencialmente afectados a partir
de esa cadena. El resultado es una posibilidad de análisis, no una
interrupción confirmada.

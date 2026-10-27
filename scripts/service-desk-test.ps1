$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$project = 'service-desk-suite-202307705'

function Invoke-Compose {
  param([string]$Label, [string[]]$ComposeArgs)
  Write-Host "[SERVICE DESK] $Label"
  & docker compose -p $project @ComposeArgs
  if ($LASTEXITCODE -ne 0) { throw "$Label falló con código $LASTEXITCODE" }
}

Invoke-Compose 'construir base y API aisladas' @('up','--build','-d','db','api')
Invoke-Compose 'crear cuentas y organización' @('exec','-T','api','node','apps/api/dist/scripts/seed-demo.js')
Invoke-Compose 'validar Excel original' @('exec','-T','api','node','apps/api/dist/scripts/validate-import.js')
Invoke-Compose 'importar catálogo' @('exec','-T','api','node','apps/api/dist/scripts/import-catalog.js')
Invoke-Compose 'repetir importación sin duplicar' @('exec','-T','api','node','apps/api/dist/scripts/import-catalog.js')
Invoke-Compose 'verificar 12/46 e incidencias' @('exec','-T','api','node','apps/api/dist/scripts/verify-import.js')
Invoke-Compose 'importar los CI originales de CMDB.xlsx' @('exec','-T','api','node','apps/api/dist/scripts/import-cmdb.js')
Invoke-Compose 'repetir CMDB.xlsx sin duplicar' @('exec','-T','api','node','apps/api/dist/scripts/import-cmdb.js')
Invoke-Compose 'generar 5000 dispositivos' @('exec','-T','-e','CMDB_SEED=EVAL2026','-e','CMDB_COUNT=5000','api','node','apps/api/dist/scripts/generate-cmdb.js')
Invoke-Compose 'repetir generación sin duplicar' @('exec','-T','-e','CMDB_SEED=EVAL2026','-e','CMDB_COUNT=5000','api','node','apps/api/dist/scripts/generate-cmdb.js')
Invoke-Compose 'preparar siete procesos, ocho colas y tickets' @('exec','-T','api','node','apps/api/dist/scripts/seed-service-desk.js')
Invoke-Compose 'escenarios P01-P17' @('exec','-T','-e','DESK_TEST_ISOLATED=1','api','node','apps/api/dist/scripts/desk-acceptance.js')

$before = (& docker compose -p $project exec -T api node apps/api/dist/scripts/desk-persistence.js | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'No se pudo tomar el estado previo al reinicio.' }
Invoke-Compose 'reiniciar PostgreSQL conservando el volumen' @('restart','db')
Invoke-Compose 'esperar salud de PostgreSQL' @('up','--wait','-d','db')
Invoke-Compose 'reiniciar API conservando el volumen' @('restart','api')
$after = ''
for ($attempt = 1; $attempt -le 15; $attempt++) {
  $after = (& docker compose -p $project exec -T api node apps/api/dist/scripts/desk-persistence.js 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -eq 0 -and $after) { break }
  Start-Sleep -Seconds 1
}
if (-not $after -or $before -ne $after) { throw "P18: datos cambiaron tras reinicio. Antes: $before Después: $after" }
Write-Host "P18 PASS $after"
Write-Host '{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}'

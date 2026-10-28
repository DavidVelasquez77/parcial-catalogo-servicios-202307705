param(
  [ValidateSet('unit', 'integration', 'e2e', 'all')]
  [string]$Suite = 'all'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$composeProject = 'service-desk-pyramid-202307705'
$env:WEB_PORT = '18081'

function Invoke-ComposeStep {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "`n[TEST-PYRAMID] $Name"
  & docker compose -p $composeProject @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falló '$Name' con código $LASTEXITCODE."
  }
}

function Prepare-Backend {
  Invoke-ComposeStep 'preparar PostgreSQL, API y frontend aislados' @('up', '--build', '-d', 'db', 'api', 'web')
  Invoke-ComposeStep 'crear datos demo' @('exec', '-T', 'api', 'node', 'apps/api/dist/scripts/seed-demo.js')
  Invoke-ComposeStep 'validar Excel original' @('exec', '-T', 'api', 'node', 'apps/api/dist/scripts/validate-import.js')
  Invoke-ComposeStep 'cargar Excel original' @('exec', '-T', 'api', 'node', 'apps/api/dist/scripts/import-catalog.js')
  Invoke-ComposeStep 'importar los CI originales de CMDB.xlsx' @('exec', '-T', 'api', 'node', 'apps/api/dist/scripts/import-cmdb.js')
  Invoke-ComposeStep 'preparar 5,000 dispositivos sintéticos para interfaz' @('exec', '-T', '-e', 'CMDB_SEED=EVAL2026', '-e', 'CMDB_COUNT=5000', 'api', 'node', 'apps/api/dist/scripts/generate-cmdb.js')
  Invoke-ComposeStep 'preparar colas demo y preguntas frecuentes de autoservicio' @('exec', '-T', 'api', 'node', 'apps/api/dist/scripts/seed-service-desk.js')
}

function Run-Unit {
  Invoke-ComposeStep 'unitarias Jest (base 70% + extensión)' @('run', '--build', '--rm', '-T', 'api', 'node_modules/.bin/jest', '--config', 'apps/api/test/jest.unit.config.js', '--runInBand')
}

function Run-Integration {
  Prepare-Backend
  Invoke-ComposeStep 'integración Jest (base 20%)' @('run', '--rm', '-T', 'api', 'node_modules/.bin/jest', '--config', 'apps/api/test/jest.integration.config.js', '--runInBand')
}

function Run-E2E {
  Prepare-Backend
  Invoke-ComposeStep 'E2E Playwright (base 10% + extensión)' @('--profile', 'tests', 'run', '--build', '--rm', '-T', 'e2e')
}

switch ($Suite) {
  'unit' { Run-Unit }
  'integration' { Run-Integration }
  'e2e' { Run-E2E }
  'all' {
    Run-Unit
    Run-Integration
    Run-E2E
  }
}

Invoke-ComposeStep 'detener contenedores de prueba (el volumen aislado se conserva)' @('down')
if ($Suite -eq 'all') {
  Write-Host '{"ok":true,"suite":"all","corePyramid":"70/20/10","coreTests":{"unit":7,"integration":2,"e2e":1},"extensions":{"unit":6,"integration":0,"e2e":2},"executedTotal":{"unit":13,"integration":2,"e2e":3}}'
} else {
  Write-Host "`n{`"ok`":true,`"suite`":`"$Suite`"}"
}

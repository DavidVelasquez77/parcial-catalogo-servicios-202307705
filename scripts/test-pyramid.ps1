param(
  [ValidateSet('unit', 'integration', 'e2e', 'all')]
  [string]$Suite = 'all'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Invoke-DockerStep {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "`n[TEST-PYRAMID] $Name"
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falló '$Name' con código $LASTEXITCODE."
  }
}

function Prepare-Backend {
  Invoke-DockerStep 'preparar PostgreSQL, API y frontend' @('compose', 'up', '--build', '-d', 'db', 'api', 'web')
  Invoke-DockerStep 'crear datos demo' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/seed-demo.js')
  Invoke-DockerStep 'validar Excel original' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/validate-import.js')
  Invoke-DockerStep 'cargar Excel original' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/import-catalog.js')
}

function Run-Unit {
  Invoke-DockerStep 'unitarias Jest (7 pruebas, 70%)' @('compose', 'run', '--build', '--rm', '-T', 'api', 'node_modules/.bin/jest', '--config', 'apps/api/test/jest.unit.config.js', '--runInBand')
}

function Run-Integration {
  Prepare-Backend
  Invoke-DockerStep 'integración Jest (2 pruebas, 20%)' @('compose', 'run', '--rm', '-T', 'api', 'node_modules/.bin/jest', '--config', 'apps/api/test/jest.integration.config.js', '--runInBand')
}

function Run-E2E {
  Prepare-Backend
  Invoke-DockerStep 'E2E Playwright (1 prueba, 10%)' @('compose', '--profile', 'tests', 'run', '--build', '--rm', '-T', 'e2e')
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

Write-Host "`n{`"ok`":true,`"suite`":`"$Suite`",`"pyramid`":`"70/20/10`"}"

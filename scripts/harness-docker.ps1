$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Invoke-DockerStep {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "`n[HARNESS-DOCKER] $Name"
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falló '$Name' con código $LASTEXITCODE."
  }
}

function Invoke-DockerRetry {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [int]$Attempts = 30
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    Write-Host "`n[HARNESS-DOCKER] $Name (intento $attempt/$Attempts)"
    & docker @Arguments
    if ($LASTEXITCODE -eq 0) {
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "No se completó '$Name' después de $Attempts intentos."
}

Invoke-DockerStep 'validar Compose' @('compose', 'config')
Invoke-DockerStep 'construir y levantar contenedores' @('compose', 'up', '--build', '-d')
Invoke-DockerRetry 'validar el Excel dentro de la API' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/validate-import.js')
Invoke-DockerStep 'crear cuentas y organización demo' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/seed-demo.js')
Invoke-DockerStep 'importar el Excel dentro de la API' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/import-catalog.js')
Invoke-DockerStep 'verificar conteos y duplicados' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/verify-import.js')
Invoke-DockerStep 'ejecutar aceptación P01-P11' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/acceptance.js')
Invoke-DockerStep 'ejecutar smoke tests' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/smoke.js')

$mount = "type=bind,source=$repoRoot,target=/workspace,readonly"
Invoke-DockerStep 'auditar secretos dentro de un contenedor Node' @('run', '--rm', '--mount', $mount, '--workdir', '/workspace', 'node:22-alpine', 'node', 'scripts/audit-secrets.mjs')
Invoke-DockerStep 'reiniciar PostgreSQL' @('compose', 'restart', 'db')
Invoke-DockerRetry 'esperar PostgreSQL' @('compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'catalogo', '-d', 'catalogo')
Invoke-DockerStep 'reiniciar API' @('compose', 'restart', 'api')
Invoke-DockerRetry 'verificar persistencia después del reinicio' @('compose', 'exec', '-T', 'api', 'node', 'apps/api/dist/scripts/verify-import.js')

Write-Host '{"ok":true,"harness":"docker-only"}'

#requires -Version 5.1
<#
  serve.ps1 - servidor estatico minimo para rodar o Fibula localmente.

  O jogo carrega data/game/content.json por fetch, e o navegador bloqueia isso
  quando a pagina e aberta direto do disco (file://). Entao, para testar local,
  sirva a pasta por HTTP:

    powershell -ExecutionPolicy Bypass -File tools/serve.ps1

  e abra http://localhost:8080/. Ctrl+C encerra.
#>
[CmdletBinding()]
param(
  [int]$Port = 8080,
  [string]$Root
)

$ErrorActionPreference = 'Stop'

if (-not $Root) {
  $here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
  $Root = Split-Path -Parent $here
}
$Root = [System.IO.Path]::GetFullPath($Root)
if (-not (Test-Path (Join-Path $Root 'index.html'))) {
  throw "Nao achei index.html em '$Root'. Passe -Root apontando para a raiz do projeto."
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.svg'  = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.ico'  = 'image/x-icon'; '.webmanifest' = 'application/manifest+json'
  '.md'   = 'text/markdown; charset=utf-8'; '.woff2' = 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch {
  throw "Nao consegui abrir a porta $Port ($($_.Exception.Message)). Tente -Port 8081."
}

Write-Host "Fibula em http://localhost:$Port/  (raiz: $Root)"
Write-Host "Ctrl+C encerra."

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '') { $rel = 'index.html' }

      $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
      # barra o acesso fora da raiz (../)
      if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        $res.StatusCode = 403
      } elseif (Test-Path -LiteralPath $full -PathType Container) {
        $full = Join-Path $full 'index.html'
      }

      if ($res.StatusCode -ne 403 -and (Test-Path -LiteralPath $full -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-store')
        $bytes = [System.IO.File]::ReadAllBytes($full)
        try {
          $res.ContentLength64 = $bytes.Length
          $res.OutputStream.Write($bytes, 0, $bytes.Length)
          $code = 200
        } catch {
          # o navegador desistiu no meio do envio (recarga, navegacao):
          # nao e falha do servidor, entao nao loga como 500
          $code = '---'
        }
      } elseif ($res.StatusCode -eq 403) {
        $code = 403
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - $rel")
        $res.ContentType = 'text/plain; charset=utf-8'
        $res.OutputStream.Write($msg, 0, $msg.Length)
        $code = 404
      }
      Write-Host ("  {0,-3} {1}" -f $code, $rel)
    } catch {
      Write-Host "  500 $($_.Exception.Message)"
      try { $res.StatusCode = 500 } catch {}
    } finally {
      try { $res.OutputStream.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}

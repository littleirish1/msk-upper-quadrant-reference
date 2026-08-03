param(
  [int]$PortalPort = 4379
)
$ErrorActionPreference = 'Stop'
$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if ($null -eq $tailscale) { throw 'Tailscale CLI is absent. Install and authenticate it manually before running this script.' }
if ($PortalPort -lt 1 -or $PortalPort -gt 65535) { throw 'PortalPort must be between 1 and 65535.' }

$status = (& $tailscale.Source status --json | ConvertFrom-Json)
if ($status.BackendState -ne 'Running') { throw 'Tailscale is not authenticated and running.' }
$funnel = (& $tailscale.Source funnel status 2>&1 | Out-String)
if ($LASTEXITCODE -eq 0 -and $funnel -notmatch 'No (serve|funnel) config') { throw 'A Funnel configuration may exist. Remove it manually and re-run status; this script will not alter or enable Funnel.' }

$target = 'http://127.0.0.1:' + $PortalPort
try { Invoke-WebRequest -UseBasicParsing -Uri $target -Method Head -TimeoutSec 5 | Out-Null } catch { throw "The loopback portal is not reachable at $target." }
& $tailscale.Source serve --bg --https=443 $target
if ($LASTEXITCODE -ne 0) { throw 'Tailscale Serve configuration failed.' }
& $tailscale.Source serve status

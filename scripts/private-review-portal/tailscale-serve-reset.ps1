$ErrorActionPreference = 'Stop'
$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if ($null -eq $tailscale) { throw 'Tailscale CLI is absent.' }
$funnel = (& $tailscale.Source funnel status 2>&1 | Out-String)
if ($LASTEXITCODE -eq 0 -and $funnel -notmatch 'No (serve|funnel) config') { throw 'A Funnel configuration may exist. This script refuses to change state until Funnel is removed manually.' }
& $tailscale.Source serve reset
if ($LASTEXITCODE -ne 0) { throw 'Unable to reset the Serve configuration.' }
& $tailscale.Source serve status

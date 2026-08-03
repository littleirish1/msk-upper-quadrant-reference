$ErrorActionPreference = 'Stop'
$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if ($null -eq $tailscale) { throw 'Tailscale CLI is absent.' }
& $tailscale.Source serve --https=443 off
if ($LASTEXITCODE -ne 0) { throw 'Unable to stop the HTTPS Serve listener. Inspect `tailscale serve status` manually.' }
& $tailscale.Source serve status

$ErrorActionPreference = 'Stop'
$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if ($null -eq $tailscale) {
  Write-Output 'Tailscale CLI: absent. Remote private access is incomplete; local loopback use remains available.'
  exit 2
}

Write-Output ('Tailscale CLI: ' + $tailscale.Source)
& $tailscale.Source version
& $tailscale.Source status
Write-Output 'Serve status:'
& $tailscale.Source serve status
Write-Output 'Funnel status (must show no Funnel configuration):'
& $tailscale.Source funnel status

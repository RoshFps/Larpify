<#
.SYNOPSIS
  Stops Larpify from opening when you sign in. Pass -RemoveProfile to also
  delete its separate browser profile (and the Spotify login saved in it).
#>
param([switch]$RemoveProfile)

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'Larpify.lnk'
if (Test-Path $shortcutPath) {
  Remove-Item $shortcutPath
  Write-Host "Removed $shortcutPath"
} else {
  Write-Host 'Larpify was not set to open at sign-in.'
}

if ($RemoveProfile) {
  $profileDir = Join-Path $env:LOCALAPPDATA 'Larpify\BrowserProfile'
  if (Test-Path $profileDir) {
    Remove-Item -Recurse -Force $profileDir
    Write-Host "Removed $profileDir"
  }
}

<#
.SYNOPSIS
  Opens Larpify automatically when you sign in to this Windows PC.

.DESCRIPTION
  Adds a "Larpify" shortcut to your Startup folder. It opens your Larpify
  address in its own Chrome or Edge window with a separate browser profile,
  so your login there is remembered and audio may start without a click.
  Undo it with uninstall-windows.ps1.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -Url https://larpify-ruby.vercel.app/
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$Url
)

$ErrorActionPreference = 'Stop'

$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $browser) { throw 'Could not find Chrome or Edge. Install one of them and run this again.' }

# A profile of its own: the launch flags only apply to a fresh browser process,
# and it keeps Larpify's login separate from your everyday browsing.
$profileDir = Join-Path $env:LOCALAPPDATA 'Larpify\BrowserProfile'
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

$arguments = @(
  "--user-data-dir=`"$profileDir`"",
  "--app=$Url",
  '--autoplay-policy=no-user-gesture-required',
  '--no-first-run',
  '--no-default-browser-check'
) -join ' '

$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'Larpify.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $browser
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = Split-Path $browser
$shortcut.Description = 'Larpify'
$shortcut.Save()

Write-Host "Added $shortcutPath"
Write-Host 'Opening Larpify now. Log in once in this window; next time it opens on its own when you sign in.'
Start-Process -FilePath $browser -ArgumentList $arguments

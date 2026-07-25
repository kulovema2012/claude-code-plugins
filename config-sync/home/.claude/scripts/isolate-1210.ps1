<#
.SYNOPSIS
  Isolate which MCP server / project plugin triggers z.ai error 1210
  ("Invalid API parameter") for Claude Code in the Saifah-fund project.

.Strategy
  Claude Code attaches the full tool set to EVERY request, so a trivial
  print-mode prompt reproduces a tool-schema 1210. We bisect:
    Phase 0  - baseline (everything on)              -> must reproduce 1210
    Phase 1  - .mcp.json disabled                     -> if 1210 GONE, MCP is the cause
    Phase 1a - re-enable MCP servers ONE at a time    -> pin the exact server
    Phase 2  - project plugins disabled               -> if 1210 GONE, a plugin is the cause
  .mcp.json and settings.local.json are backed up to *.orig and restored in
  finally (also on Ctrl+C). Nothing is committed; logs live under your profile.

.Usage
  # 1) Set z.ai override in THIS shell FIRST (PowerShell syntax, not export!):
  $env:ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
  $env:ANTHROPIC_AUTH_TOKEN="<your token>"
  $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $env:ANTHROPIC_DEFAULT_SONNET_MODEL = $env:ANTHROPIC_DEFAULT_OPUS_MODEL = "glm-5.2[1m]"
  # 2) Run:
  & "$env:USERPROFILE\.claude\scripts\isolate-1210.ps1"
#>
[CmdletBinding()]
param(
  [string]$ProjectDir = "C:\Users\new_k\development-labs\employee-projects\saifah-fund",
  [string]$Prompt     = "Reply with exactly: ok",
  [string]$LogDir     = "$env:USERPROFILE\.claude\scripts\isolate-1210-logs",
  [switch]$SkipEnvCheck
)

$ErrorActionPreference = 'Continue'

# ---------------- formatting helpers ----------------
function Sec($t){ Write-Host "`n==== $t ====" -ForegroundColor Cyan }
function OK($t){  Write-Host "[PASS ] $t" -ForegroundColor Green }
function Bad($t){ Write-Host "[1210 ] $t" -ForegroundColor Red }
function Info($t){Write-Host "[info ] $t" -ForegroundColor DarkGray }

# ---------------- file helpers (no-BOM JSON writes) ----------------
function Write-JsonFile($path,$obj){
  $json = $obj | ConvertTo-Json -Depth 20
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $json, $enc)
}

# ---------------- one probe = one non-interactive claude turn ----------------
function Invoke-Probe {
  param([string]$Tag)
  $LogFile = Join-Path $LogDir "$Tag.log"
  if(Test-Path $LogFile){ Remove-Item $LogFile -Force }
  # IMPORTANT: do NOT use Start-Process here. In PS 5.1 it copies the process
  # environment into a CASE-SENSITIVE StringDictionary and throws
  # "Item has already been added ... 'Path' / 'PATH'" when the profile leaves
  # both a Path and PATH key (the Vercel switcher does this). Launching cmd.exe
  # via the call operator lets the child inherit the env block directly at the
  # OS level (case-insensitive) -> no throw. The batch wrapper makes the
  # redirection + quoting deterministic.
  $bat  = Join-Path $LogDir "_probe.cmd"
  $safe = $Prompt -replace '"',''
  $body = '@echo off' + "`r`n" +
          ('cd /d "{0}"' -f $ProjectDir) + "`r`n" +
          ('claude --debug -p "{0}" > "{1}" 2>&1' -f $safe, $LogFile)
  [System.IO.File]::WriteAllText($bat, $body, (New-Object System.Text.UTF8Encoding($false)))
  & cmd.exe /c $bat
  return $LogFile
}

function Has-1210 {
  param([string]$LogFile)
  if(-not (Test-Path $LogFile)){ return $false }
  $m = Select-String -Path $LogFile -Pattern '("code"\s*:\s*"?\s*1210|Invalid API parameter|API Error: 400)' -AllMatches -EA SilentlyContinue
  return [bool]$m
}

# ---------------- preflight ----------------
if(-not (Test-Path $ProjectDir)){ Write-Host "ProjectDir not found: $ProjectDir" -ForegroundColor Red; exit 2 }
if(-not (Get-Command claude -EA SilentlyContinue)){ Write-Host "claude not on PATH." -ForegroundColor Red; exit 2 }

if(-not $SkipEnvCheck){
  $missing = @()
  foreach($v in 'ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_DEFAULT_HAIKU_MODEL','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL'){
    if([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($v,'Process'))){ $missing += $v }
  }
  if($missing.Count){
    Write-Host "`nThese env vars are NOT set in this shell: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "Without the full z.ai override the probe hits real Anthropic and cannot reproduce 1210." -ForegroundColor Yellow
    Write-Host "Set them (PowerShell syntax) then re-run. Use -SkipEnvCheck to force." -ForegroundColor Yellow
    exit 3
  }
}

$null = New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$mcpPath       = Join-Path $ProjectDir ".mcp.json"
$localPath     = Join-Path $ProjectDir ".claude\settings.local.json"
$mcpOrig       = "$mcpPath.orig"
$localOrig     = "$localPath.orig"
$mcpDisabled   = "$mcpPath.disabled"
$results       = [System.Collections.Generic.List[pscustomobject]]::new()
$offender      = $null

function Backup-Files {
  if(Test-Path $mcpPath){   Copy-Item $mcpPath   $mcpOrig   -Force }
  if(Test-Path $localPath){ Copy-Item $localPath $localOrig -Force }
}
function Restore-Files {
  if(Test-Path $mcpOrig){ Copy-Item $mcpOrig $mcpPath -Force; Remove-Item $mcpOrig -Force -EA SilentlyContinue }
  elseif(Test-Path $mcpDisabled){ Move-Item $mcpDisabled $mcpPath -Force -EA SilentlyContinue }
  Remove-Item $mcpDisabled -Force -EA SilentlyContinue
  if(Test-Path $localOrig){ Copy-Item $localOrig $localPath -Force; Remove-Item $localOrig -Force -EA SilentlyContinue }
}

Backup-Files
try {
  # parse original MCP server names once (for Phase 1a)
  $mcpServers = @()
  if(Test-Path $mcpOrig){
    try {
      $j = Get-Content $mcpOrig -Raw | ConvertFrom-Json
      if($j.mcpServers){ $mcpServers = @($j.mcpServers.PSObject.Properties.Name) }
    } catch { Write-Warning "Could not parse .mcp.json: $_" }
  }

  # ---------- Phase 0 ----------
  Sec "Phase 0 - baseline (all MCP + all plugins)"
  $log0 = Invoke-Probe "phase0-baseline"
  $b0 = Has-1210 $log0
  $results.Add([pscustomobject]@{ Phase='0 baseline'; Result=$(if($b0){'1210'}else{'clean'}); Log=$log0 })
  if(-not $b0){
    OK "No 1210 at baseline with prompt: $Prompt"
    Write-Host "  -> Env may not point at z.ai, OR the trigger is content-dependent" -ForegroundColor Yellow
    Write-Host "     (e.g. 1210 only when pasting an image). Inspect: $log0" -ForegroundColor Yellow
    Write-Host "  (files restored; see finally)" -ForegroundColor DarkGray
    return
  }
  Bad "Reproduced 1210 at baseline - bisecting..."

  # ---------- Phase 1 ----------
  if((Test-Path $mcpOrig) -and $mcpServers.Count -gt 0){
    Sec "Phase 1 - .mcp.json DISABLED (all MCP servers off)"
    if(Test-Path $mcpPath){ Move-Item $mcpPath $mcpDisabled -Force }
    $log1 = Invoke-Probe "phase1-no-mcp"
    $b1 = Has-1210 $log1
    $results.Add([pscustomobject]@{ Phase='1 no-MCP'; Result=$(if($b1){'1210'}else{'clean'}); Log=$log1 })
    Copy-Item $mcpOrig $mcpPath -Force   # restore full mcp before sub-phases / phase 2
    if($b1){
      Bad "1210 persists with MCP off -> MCP is NOT the (sole) cause."
    } else {
      OK "1210 GONE with MCP off -> an MCP server tool schema is the trigger."
      $origJson = Get-Content $mcpOrig -Raw | ConvertFrom-Json
      foreach($srv in $mcpServers){
        Sec "Phase 1a - MCP server only: $srv"
        $single = [ordered]@{ mcpServers = [ordered]@{ $srv = $origJson.mcpServers.$srv } }
        Write-JsonFile $mcpPath $single
        $loga = Invoke-Probe "phase1a-$srv"
        $ba = Has-1210 $loga
        $results.Add([pscustomobject]@{ Phase="1a $srv"; Result=$(if($ba){'1210'}else{'clean'}); Log=$loga })
        if($ba){ Bad "$srv REPRODUCES 1210"; if(-not $offender){ $offender = "MCP server: $srv" } }
        else  { OK  "$srv alone is clean" }
      }
      Copy-Item $mcpOrig $mcpPath -Force
    }
  } else { Info "No .mcp.json / no servers; skipped MCP phases." }

  # ---------- Phase 2 ----------
  if(-not $offender -and (Test-Path $localOrig)){
    Sec "Phase 2 - project plugins DISABLED (MCP restored)"
    $projPluginKeys = @(
      'unit-testing@claude-code-workflows','frontend-design@claude-plugins-official',
      'feature-dev@claude-plugins-official','typescript-lsp@claude-plugins-official',
      'pr-review-toolkit@claude-plugins-official','stripe@claude-plugins-official',
      'agent-teams@claude-code-workflows'
    )
    $obj = Get-Content $localOrig -Raw | ConvertFrom-Json
    if(-not ($obj.PSObject.Properties.Name -contains 'enabledPlugins')){
      $obj | Add-Member -NotePropertyName enabledPlugins -NotePropertyValue ([pscustomobject]@{})
    }
    foreach($k in $projPluginKeys){
      if($obj.enabledPlugins.PSObject.Properties.Name -contains $k){ $obj.enabledPlugins.$k = $false }
      else { $obj.enabledPlugins | Add-Member -NotePropertyName $k -NotePropertyValue $false }
    }
    Write-JsonFile $localPath $obj
    if(Test-Path $mcpOrig){ Copy-Item $mcpOrig $mcpPath -Force }
    $log2 = Invoke-Probe "phase2-no-plugins"
    $b2 = Has-1210 $log2
    $results.Add([pscustomobject]@{ Phase='2 no-plugins'; Result=$(if($b2){'1210'}else{'clean'}); Log=$log2 })
    if($b2){ Bad "1210 persists with MCP+plugins off -> core Anthropic feature z.ai rejects (cache_control / thinking / image). Inspect $log0" }
    else  { OK  "1210 GONE with plugins off -> a project plugin tool is the trigger. Re-enable one at a time to pin it." }
  }
}
finally {
  Sec "Restoring project files"
  Restore-Files
  OK ".mcp.json and settings.local.json restored"
}

# ---------------- report ----------------
Sec "RESULT"
$results | Format-Table -AutoSize
if($offender){
  Write-Host "`n>>> OFFENDER: $offender" -ForegroundColor Magenta
  Write-Host "Inspect that tool's inputSchema; z.ai commonly rejects: `$schema, format, nested anyOf/`$ref, unusual additionalProperties." -ForegroundColor White
} else {
  Write-Host "`nNo single MCP server isolated. If Phase 2 was clean -> bisect plugins; if it still 1210s -> core payload (see phase0 log)." -ForegroundColor White
}
Write-Host "`nLogs dir: $LogDir" -ForegroundColor DarkGray
Write-Host "To see the raw request body z.ai rejected, re-run Phase 0 manually in a throwaway shell:" -ForegroundColor DarkGray
Write-Host "  `$env:ANTHROPIC_LOG='debug'; claude --debug -p 'Reply with: ok' 2>&1 | Select-String -Pattern 'tools','1210' -Context 1,1" -ForegroundColor DarkGray
Write-Host "  NOTE: ANTHROPIC_LOG=debug writes your auth token to stdout - keep that output private & delete after." -ForegroundColor Yellow

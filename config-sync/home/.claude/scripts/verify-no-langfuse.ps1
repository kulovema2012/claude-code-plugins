<#
.SYNOPSIS
  Empirically verify z.ai works with a given MCP server removed (default: langfuse).
  Backs up .mcp.json, removes the server, runs one real claude probe against z.ai,
  reports, then restores .mcp.json from backup (finally).
#>
[CmdletBinding()]
param(
  [string]$ProjectDir   = "C:\Users\new_k\development-labs\employee-projects\saifah-fund",
  [string]$RemoveServer = "langfuse",
  [string]$Prompt       = "Reply with exactly: ok",
  [string]$LogDir       = "$env:USERPROFILE\.claude\scripts\isolate-1210-logs"
)
$ErrorActionPreference = 'Continue'; $ProgressPreference = 'SilentlyContinue'
$null = New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$mcp = Join-Path $ProjectDir ".mcp.json"
$bak = "$mcp.verify-bak"
if(-not (Test-Path $mcp)){ "no .mcp.json at $mcp"; exit 2 }
Copy-Item $mcp $bak -Force
try {
  $o = Get-Content $mcp -Raw | ConvertFrom-Json
  $before = ($o.mcpServers.PSObject.Properties.Name) -join ', '
  if($o.mcpServers.PSObject.Properties.Name -contains $RemoveServer){
    $null = $o.mcpServers.PSObject.Properties.Remove($RemoveServer)
  }
  $after = ($o.mcpServers.PSObject.Properties.Name) -join ', '
  [System.IO.File]::WriteAllText($mcp, ($o | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
  "servers before: $before"
  "removed      : $RemoveServer"
  "servers after : $after"
  $log = Join-Path $LogDir "verify-no-$RemoveServer.log"
  $bat = Join-Path $LogDir "_verify.cmd"
  $body = '@echo off' + "`r`n" + ('cd /d "{0}"' -f $ProjectDir) + "`r`n" + ('claude --debug -p "{0}" > "{1}" 2>&1' -f $Prompt, $log)
  [System.IO.File]::WriteAllText($bat, $body, (New-Object System.Text.UTF8Encoding($false)))
  "probe -> z.ai ..."
  & cmd.exe /c $bat
  $hit1210 = $false; $anyErr = $null
  if(Test-Path $log){
    $hit1210 = [bool](Select-String -Path $log -Pattern '1210','Invalid API parameter' -EA SilentlyContinue)
    $e = Select-String -Path $log -Pattern 'API Error' -EA SilentlyContinue | Select-Object -First 1
    if($e){ $anyErr = $e.Line.Trim() }
  }
  if($hit1210){ "RESULT: 1210 STILL PRESENT (removing $RemoveServer did NOT fix it)" }
  elseif($anyErr){ "RESULT: different error -> $anyErr" }
  else { "RESULT: CLEAN - no 1210, no API error. z.ai accepted the request with $RemoveServer removed." }
  "log: $log"
}
finally {
  Copy-Item $bak $mcp -Force
  [System.IO.File]::Delete($bak)
  "restored .mcp.json from backup; backup deleted"
}

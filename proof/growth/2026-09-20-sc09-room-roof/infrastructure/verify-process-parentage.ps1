param([string]$Runner,[string]$Qualifier,[string]$Output)
$ErrorActionPreference='Stop'
if([Net.Dns]::GetHostName().ToLowerInvariant() -cne 'dans1'){throw 'DANS1 required'}
foreach($pair in @(@($Runner,'Get-TreeIds'),@($Qualifier,'Capture-OwnedTrees'))){
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($pair[0],[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'Parse error'}
 $name=$pair[1];$fn=$ast.Find({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -eq $name},$false)
 . ([scriptblock]::Create($fn.Extent.Text))
}
function P($id,$parent,$seconds){[pscustomobject]@{ProcessId=$id;ParentProcessId=$parent;CreationDate=([datetime]'2026-09-20T00:00:00Z').AddSeconds($seconds);ExecutablePath="C:/fixture/$id.exe";CommandLine="fixture-$id"}}
$script:fixture=@((P 100 1 100),(P 200 100 101),(P 300 200 102),(P 400 100 10),(P 500 200 20),(P 600 400 105))
function Get-CimInstance {param($ClassName) $script:fixture}
$checks=[Collections.Generic.List[object]]::new()
function Check($name,$actual,$expected){$a=(@($actual|Sort-Object)-join ',');$e=(@($expected|Sort-Object)-join ',');if($a -cne $e){throw "$name expected $e got $a"};$checks.Add(@{name=$name;result='PASS';ids=$a})}
Check 'CDP excludes children predating reused parent and their descendants' @(Get-TreeIds 100 $fixture) @(100,200,300)
Check 'CDP refuses missing root identity' @(Get-TreeIds 999 $fixture) @()
$step=[pscustomobject]@{started=([datetime]'2026-09-20T00:01:40Z');owned=@{}}
$root=$fixture[0];$step.owned[([string]$root.ProcessId+'|'+[string]$root.CreationDate)]=$root
Capture-OwnedTrees @($step)
Check 'Qualifier excludes stale PID parentage' @($step.owned.Values.ProcessId) @(100,200,300)
$script:fixture=@((P 100 1 200),(P 700 100 201))
Capture-OwnedTrees @($step)
Check 'Qualifier refuses replacement root PID' @($step.owned.Values.ProcessId) @(100,200,300)
$missing=P 900 100 202;$missing.CreationDate=$null
Check 'CDP refuses missing child creation time' @(Get-TreeIds 100 @($fixture[0],$missing)) @(100)
$record=@{host='DANS1';result='PASS';checks=@($checks);runnerSha256=(Get-FileHash $Runner).Hash;qualifierSha256=(Get-FileHash $Qualifier).Hash;limits='Pure synthetic process inventories; no process termination performed'}
$record|ConvertTo-Json -Depth 6|Set-Content $Output -Encoding utf8
$record|ConvertTo-Json -Depth 6
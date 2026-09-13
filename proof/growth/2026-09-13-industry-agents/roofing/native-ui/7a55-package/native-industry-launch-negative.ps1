param(
 [Parameter(Mandatory=$true)][string]$Exe,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExeSha256,
 [Parameter(Mandatory=$true)][string]$Engine,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$EngineSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Attempt,
 [string]$PreviousLaunch,
 [Parameter(Mandatory=$true)][ValidateSet("missing","tampered")][string]$NegativeCase
)
$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1' -or [Diagnostics.Process]::GetCurrentProcess().SessionId -ne 1){throw 'Run only in DANS1 interactive session 1.'}
$buildRoot='C:\Users\danie\XRayBuilds'
$Exe=[IO.Path]::GetFullPath($Exe);$Engine=[IO.Path]::GetFullPath($Engine)
foreach($pair in ,@($Exe,$ExeSha256)){
 if(-not $pair[0].StartsWith($buildRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Executable outside isolated build root.'}
 $item=Get-Item -LiteralPath $pair[0]
 if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Expected ordinary executable file.'}
 if((Get-FileHash -LiteralPath $pair[0]).Hash -ne $pair[1]){throw 'Executable hash mismatch.'}
}
if(Get-NetTCPConnection -LocalPort 9351 -State Listen -ErrorAction SilentlyContinue){throw 'CDP9351 already used; no process will be stopped.'}
$proof=Join-Path $buildRoot "native-industry-$Attempt"
if(Test-Path -LiteralPath $proof){throw 'Attempt exists; preserve prior evidence.'}
New-Item -ItemType Directory -Path $proof|Out-Null
$qaProfile=Join-Path $proof 'webview-profile';New-Item -ItemType Directory -Path $qaProfile|Out-Null
$profileOrigin=$null
if($PreviousLaunch){
 $previousPath=[IO.Path]::GetFullPath($PreviousLaunch)
 $previousRoot=Split-Path -Parent $previousPath
 if((Split-Path -Parent $previousRoot) -ne $buildRoot -or (Split-Path -Leaf $previousRoot) -notmatch '^native-industry-[a-z0-9-]+$' -or (Split-Path -Leaf $previousPath) -ne 'launch.json'){throw 'Previous launch must be an owned native-industry attempt record.'}
 foreach($entry in @($previousRoot,$previousPath)){if((Get-Item -LiteralPath $entry).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Previous launch path is a reparse point.'}}
 $previous=Get-Content -LiteralPath $previousPath -Raw|ConvertFrom-Json
 if($previous.host -ne 'DANS1' -or $previous.sessionId -ne 1 -or $previous.proof -ne $previousRoot -or $previous.port -ne 9351){throw 'Previous launch identity is invalid.'}
 if(Get-Process -Id $previous.pid -ErrorAction SilentlyContinue){throw 'Previous native PID is still present; never copy an active profile.'}
 $sourceProfile=[IO.Path]::GetFullPath($previous.profile)
 if($sourceProfile -ne (Join-Path $previousRoot 'webview-profile')){throw 'Previous profile does not belong to its attempt.'}
 $profileItem=Get-Item -LiteralPath $sourceProfile
 if(-not $profileItem.PSIsContainer -or ($profileItem.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Expected ordinary previous profile directory.'}
 # Do not follow links while making the complete closed-profile inventory.
 $queue=[Collections.Generic.Queue[string]]::new();$queue.Enqueue($sourceProfile)
 $inventory=[Collections.Generic.List[object]]::new()
 while($queue.Count){foreach($item in Get-ChildItem -LiteralPath $queue.Dequeue() -Force){
   if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Profile contains a reparse point; copy refused.'}
   if($item.PSIsContainer){$queue.Enqueue($item.FullName)}else{$inventory.Add(@{path=$item.FullName.Substring($sourceProfile.Length+1);bytes=$item.Length;sha256=(Get-FileHash -LiteralPath $item.FullName).Hash})}
 }}
 $inventory|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $proof 'source-profile-inventory.json')
 $sourceInventoryHash=(Get-FileHash -LiteralPath (Join-Path $proof 'source-profile-inventory.json')).Hash
 & robocopy $sourceProfile $qaProfile /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /NP /NFL /NDL ("/LOG:"+(Join-Path $proof 'profile-copy.log'))|Out-Null
 $copyExit=$LASTEXITCODE;if($copyExit -ge 8){throw 'Closed profile copy failed; original preserved.'}
 foreach($entry in $inventory){$dest=[IO.Path]::GetFullPath((Join-Path $qaProfile $entry.path));if(-not $dest.StartsWith($qaProfile+'\',[StringComparison]::OrdinalIgnoreCase) -or (Get-FileHash -LiteralPath $dest).Hash -ne $entry.sha256){throw 'Copied profile identity mismatch.'}}
 $profileOrigin=@{previousLaunch=$previousPath;previousLaunchSha256=(Get-FileHash -LiteralPath $previousPath).Hash;sourceProfile=$sourceProfile;inventorySha256=$sourceInventoryHash;files=$inventory.Count;copyExit=$copyExit;originalPreserved=$true}
 $profileOrigin|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $proof 'profile-origin.json')
}
if($NegativeCase -eq 'missing' -and (Test-Path -LiteralPath $Engine)){throw 'Missing case unexpectedly has engine'}
if($NegativeCase -eq 'tampered' -and ((Get-FileHash -LiteralPath $Engine).Hash -eq $EngineSha256)){throw 'Tampered case engine matches qualified hash'}
if((Split-Path -Parent $Exe) -notmatch 'native-package-negative-(missing|tampered)-[a-z0-9-]+$'){throw 'Negative case must use owned disposable copy'}
$psi=New-Object Diagnostics.ProcessStartInfo
$unrelatedCwd=Join-Path $proof 'unrelated-cwd';New-Item -ItemType Directory -Path $unrelatedCwd|Out-Null
$expectedResource=[IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $Exe) 'engine\bin\xray-engine.exe'));if($Engine -ne $expectedResource){throw 'Expected engine inside extracted package resources.'}
$psi.FileName=$Exe;$psi.WorkingDirectory=$unrelatedCwd;$psi.UseShellExecute=$false
$psi.EnvironmentVariables['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']='--remote-debugging-port=9351 --remote-debugging-address=127.0.0.1'
$psi.EnvironmentVariables['WEBVIEW2_USER_DATA_FOLDER']=$qaProfile
$psi.EnvironmentVariables.Remove('XRAY_ENGINE_PATH')
$psi.EnvironmentVariables.Remove('PYTHONPATH')
$psi.EnvironmentVariables.Remove('PYTHONHOME')
$psi.EnvironmentVariables['PATH']=[Environment]::GetFolderPath('System')+';'+$env:SystemRoot
$environmentProof=@{engineOverridePresent=$psi.EnvironmentVariables.ContainsKey('XRAY_ENGINE_PATH');pythonPathPresent=$psi.EnvironmentVariables.ContainsKey('PYTHONPATH');path=$psi.EnvironmentVariables['PATH'];cwd=$unrelatedCwd;globalEnvironmentChanged=$false;engineResolution='bundled resource_dir only'}
# Visible launch explicitly requested; environment changes apply only to this process tree.
$process=[Diagnostics.Process]::Start($psi)
$record=@{host=$env:COMPUTERNAME;sessionId=$process.SessionId;pid=$process.Id;createdAt=$process.StartTime.ToUniversalTime().ToString('o');exe=$Exe;exeSha256=$ExeSha256;engine=$Engine;engineSha256=$EngineSha256;profile=$qaProfile;proof=$proof;port=9351;launchedAt=[DateTime]::UtcNow.ToString('o')}
$record.commandLine=(Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)").CommandLine
$record.profileOrigin=$profileOrigin
$record.environmentProof=$environmentProof
$record.negativeCase=$NegativeCase
$record|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $proof 'launch.json')
$record|ConvertTo-Json


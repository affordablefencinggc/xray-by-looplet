$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$runtime = Join-Path $root 'runtime'
foreach ($entry in @(
    'system.runtime.compilerservices.unsafe/lib/net462/System.Runtime.CompilerServices.Unsafe.dll',
    'system.buffers/lib/net462/System.Buffers.dll',
    'system.numerics.vectors/lib/net462/System.Numerics.Vectors.dll',
    'system.memory/lib/net462/System.Memory.dll',
    'acadsharp/lib/net48/ACadSharp.dll'
)) {
    [void][System.Reflection.Assembly]::LoadFrom((Join-Path $runtime $entry))
}
$source = Join-Path $root 'prepared.dxf'
$dwgPath = Join-Path $root 'roundtrip.dwg'
$dxfPath = Join-Path $root 'roundtrip.dxf'
$notifications = [System.Collections.Generic.List[string]]::new()
$handler = [ACadSharp.IO.NotificationEventHandler] {
    param($sender, $event)
    $notifications.Add([string]$event.Message)
}
$report = [ordered]@{
    translator = 'ACadSharp 3.7.1 (.NET Framework 4.8)'
    source = 'proof/audit/IW-DWG/prepared.dxf'
    pass = $false
    stage = 'read-source-dxf'
}
try {
    $doc = [ACadSharp.IO.DxfReader]::Read($source, $handler)
    $doc.CreateDefaults()
    $report.sourceEntities = $doc.Entities.Count
    $report.sourceUnits = [string]$doc.Header.InsUnits
    $report.sourceLayers = @($doc.Layers | ForEach-Object Name)
    $report.stage = 'write-dwg'
    [ACadSharp.IO.DwgWriter]::Write($dwgPath, $doc, [ACadSharp.IO.DwgWriterConfiguration]::new(), $handler)
    $report.dwgSignature = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($dwgPath), 0, 6)
    $report.stage = 'read-dwg'
    $roundtrip = [ACadSharp.IO.DwgReader]::Read($dwgPath, $handler)
    $report.roundtripEntities = $roundtrip.Entities.Count
    $report.roundtripUnits = [string]$roundtrip.Header.InsUnits
    $report.roundtripLayers = @($roundtrip.Layers | ForEach-Object Name)
    $report.stage = 'write-dxf'
    [ACadSharp.IO.DxfWriter]::Write($dxfPath, $roundtrip, $false, [ACadSharp.IO.DxfWriterConfiguration]::new(), $handler)
    $report.modelMetadataRetained = [System.IO.File]::ReadAllText($dxfPath).Contains('XRAY_MODEL:')
    if ($doc.Entities.Count -ne $roundtrip.Entities.Count) { throw 'Entity count changed.' }
    if ($doc.Header.InsUnits -ne $roundtrip.Header.InsUnits) { throw 'Units changed.' }
    $report.pass = $true
    $report.stage = 'done'
} catch {
    $report.error = $_.Exception.ToString()
} finally {
    $report.notifications = @($notifications.ToArray())
    $json = $report | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText((Join-Path $root 'roundtrip.json'), $json + "`n")
    $report | Select-Object translator,pass,stage,sourceEntities,roundtripEntities,sourceUnits,roundtripUnits,sourceLayers,roundtripLayers,dwgSignature,modelMetadataRetained,error | ConvertTo-Json -Depth 5
}
if (-not $report.pass) { exit 1 }

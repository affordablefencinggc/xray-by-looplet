$ErrorActionPreference = 'Stop'
$sourceRoot = Join-Path $PSScriptRoot 'sources'
New-Item -ItemType Directory -Force -Path $sourceRoot | Out-Null
$items = @(
    @{ id='BK-S01'; file='official-structures.html'; url='https://www.burjkhalifa.ae/the-tower/structures/'; kind='html'; marker='buttress' },
    @{ id='BK-S02'; file='som-project.html'; url='https://www.som.com/projects/burj-khalifa/'; kind='html'; marker='Emaar' },
    @{ id='BK-S03'; file='guardian-silver20.html'; url='https://www.guardianglass.com/ap/en/our-glass/sunguard-solar/silver-20'; kind='html'; marker='Burj' },
    @{ id='BK-S04'; file='besix-project.html'; url='https://www.besix.com/en/projects/burj-khalifa'; kind='html'; marker='Samsung' },
    @{ id='BK-S06'; file='icc-typical-floor-plan.jpg'; url='https://www.iccsafe.org/wp-content/uploads/bsj/Figure-2-Burj-Khalifa-300x234.jpg'; kind='jpg'; marker='' }
)
$manifestPath = Join-Path $sourceRoot 'manifest.json'
if (Test-Path -LiteralPath $manifestPath) { throw 'Existing manifest: preserve this acquisition; do not overwrite.' }
$records = foreach ($item in $items) {
    $target = Join-Path $sourceRoot $item.file
    $record = [ordered]@{ documentId=$item.id; source='web'; url=$item.url; originalFileName=$item.file; importedAt=$null; downloadStatus='failed'; contentIdentityCheck=$false; evidenceState='unverified'; calibrationId=$null; quoteReady=$false; error=$null }
    try {
        if (Test-Path -LiteralPath $target) { throw 'Existing file: refusing overwrite.' }
        $response = Invoke-WebRequest -UseBasicParsing -Uri $item.url -TimeoutSec 25
        $record.importedAt = [DateTime]::UtcNow.ToString('o')
        $record.mimeType = [string]$response.Headers['Content-Type']
        $stream = $response.RawContentStream
        $stream.Position = 0
        $buffer = New-Object System.IO.MemoryStream
        $stream.CopyTo($buffer)
        $bytes = $buffer.ToArray()
        if ($item.kind -eq 'jpg') {
            if ($bytes.Length -lt 3 -or $bytes[0] -ne 255 -or $bytes[1] -ne 216 -or $bytes[2] -ne 255) { throw 'Not a JPEG binary.' }
        } else {
            $body = [Text.Encoding]::UTF8.GetString($bytes)
            if ($body -notmatch $item.marker -or $body -notmatch '<html') { throw 'Expected HTML identity markers missing.' }
        }
        [IO.File]::WriteAllBytes($target, $bytes)
        $record.byteLength = $bytes.Length
        $record.sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        $record.contentIdentityCheck = $true
        $record.downloadStatus = 'acquired'
    } catch { $record.error = $_.Exception.Message }
    [PSCustomObject]$record
}
$records | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
$records | Select-Object documentId,downloadStatus,byteLength,contentIdentityCheck,error | Format-Table -AutoSize

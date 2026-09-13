$ErrorActionPreference='Stop'
$root='C:\Users\danie\XRayBuilds\native-industry-tools-7zip2603'
if(Test-Path $root){throw 'Tool attempt exists'}
New-Item -ItemType Directory $root|Out-Null
$items=@()
foreach($name in @('7zr.exe','7z2603-x64.exe')){
$url='https://github.com/ip7z/7zip/releases/download/26.03/'+$name
Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile (Join-Path $root $name)
$items+=@{url=$url;name=$name;sha256=(Get-FileHash (Join-Path $root $name)).Hash;signature=(Get-AuthenticodeSignature (Join-Path $root $name)).Status.ToString()}
}
@{officialSource='https://www.7-zip.org/download.html';at=[datetime]::UtcNow.ToString('o');downloads=$items;installPerformed=$false}|ConvertTo-Json -Depth 5|Set-Content "$root\downloads.json"
& "$root\7zr.exe" l "$root\7z2603-x64.exe" > "$root\installer-list.log" 2>&1
if($LASTEXITCODE -ne 0){throw '7zr installer listing failed'}
& "$root\7zr.exe" x "$root\7z2603-x64.exe" "-o$root\portable" -y > "$root\extract.log" 2>&1
if($LASTEXITCODE -ne 0){throw 'Extraction failed'}
Get-ChildItem "$root\portable" -File|Select-Object Name,Length|ConvertTo-Json

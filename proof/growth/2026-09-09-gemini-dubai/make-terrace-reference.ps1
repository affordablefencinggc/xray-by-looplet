Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1800,1200
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::FromArgb(248,247,242))
$ink = [System.Drawing.Brushes]::Black
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(30,40,50)),2
$blue = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(0,100,180)),3
$title = New-Object System.Drawing.Font 'Arial',32
$font = New-Object System.Drawing.Font 'Arial',19
$small = New-Object System.Drawing.Font 'Arial',15
$g.DrawString('TERRACE COURT / WIREFRAME CHALLENGE',$title,$ink,55,35)
$g.DrawString('Illustrative concept. Dimensions in metres. Open court faces +Y.',$font,$ink,55,100)
$outlines = @(
 @(@(0,0),@(28,0),@(28,22),@(20,22),@(20,8),@(8,8),@(8,22),@(0,22)),
 @(@(2,0),@(26,0),@(26,20),@(20,20),@(20,8),@(8,8),@(8,20),@(2,20)),
 @(@(4,0),@(24,0),@(24,18),@(20,18),@(20,8),@(8,8),@(8,18),@(4,18))
)
function Iso($x,$y,$z) { [System.Drawing.PointF]::new([single](500+($x-$y)*16),[single](650+($x+$y)*7-$z*30)) }
for ($l=0;$l -lt 3;$l++) {
 $poly=$outlines[$l]; $z=$l*3.6
 for($i=0;$i -lt $poly.Count;$i++) {
  $a=$poly[$i]; $b=$poly[($i+1)%$poly.Count]
  $g.DrawLine($pen,(Iso $a[0] $a[1] $z),(Iso $b[0] $b[1] $z))
  $g.DrawLine($pen,(Iso $a[0] $a[1] ($z+3.6)),(Iso $b[0] $b[1] ($z+3.6)))
  $g.DrawLine($pen,(Iso $a[0] $a[1] $z),(Iso $a[0] $a[1] ($z+3.6)))
 }
 $ox=1190; $oy=210+$l*290; $scale=10
 $g.DrawString(('LEVEL '+$l+' / z = '+$z+' m'),$font,$ink,$ox,$oy-45)
 for($i=0;$i -lt $poly.Count;$i++) {
  $a=$poly[$i];$b=$poly[($i+1)%$poly.Count]
  $g.DrawLine($pen,[single]($ox+$a[0]*$scale),[single]($oy+$a[1]*$scale),[single]($ox+$b[0]*$scale),[single]($oy+$b[1]*$scale))
 }
 if($l -eq 1) {$g.DrawRectangle($blue,($ox+80),($oy+160),120,20)}
}
$bridge=@(@(8,16),@(20,16),@(20,18),@(8,18))
for($i=0;$i -lt 4;$i++) {$a=$bridge[$i];$b=$bridge[($i+1)%4];$g.DrawLine($blue,(Iso $a[0] $a[1] 3.6),(Iso $b[0] $b[1] 3.6))}
$g.DrawString('28 m wide x 22 m deep / 10.8 m high',$font,$ink,55,1020)
$g.DrawString('3 storeys at 3.6 m. Each upper floor steps back 2 m.',$small,$ink,55,1070)
$g.DrawString('Blue: 12 x 2 m bridge at level 1. Keep the courtyard empty.',$small,$ink,55,1110)
$target=Join-Path (Get-Location) 'screenshots/gemini-dubai-capacity/terrace-court-reference.png'
$bmp.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$bmp.Dispose();$pen.Dispose();$blue.Dispose()
Write-Output $target


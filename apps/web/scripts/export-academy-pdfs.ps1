$ErrorActionPreference = 'Stop'

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')
$academyRoot = Join-Path $workspaceRoot 'MateriAcademy'
$configPath = Join-Path $PSScriptRoot 'academy-master-course.config.json'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Config tidak ditemukan di $configPath"
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json

try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
} catch {
  throw 'Microsoft PowerPoint tidak tersedia. Install PowerPoint desktop untuk mengekspor PDF lesson secara otomatis.'
}

$powerPoint.Visible = -1
$ppFixedFormatTypePDF = 2
$ppPrintHandoutVerticalFirst = 1
$ppPrintOutputSlides = 1
$ppPrintAll = 1
$msoFalse = 0
$msoTrue = -1

function New-PrintRange($presentation, $startSlide, $endSlide) {
  $ranges = $presentation.PrintOptions.Ranges
  while ($ranges.Count -gt 0) {
    $ranges.Item(1).Delete() | Out-Null
  }
  $null = $ranges.Add($startSlide, $endSlide)
}

try {
  foreach ($module in $config.modules) {
    $pptPath = Join-Path $academyRoot $module.sourcePptx
    if (-not (Test-Path -LiteralPath $pptPath)) {
      throw "File PPTX tidak ditemukan: $pptPath"
    }

    $moduleOutputDir = Join-Path $academyRoot (Join-Path $config.assetBasePath $module.slug)
    New-Item -ItemType Directory -Force -Path $moduleOutputDir | Out-Null

    Write-Host "Mengekspor PDF lesson untuk $($module.title)..."
    $presentation = $powerPoint.Presentations.Open($pptPath, $msoFalse, $msoFalse, $msoFalse)

    try {
      foreach ($lesson in $module.lessons) {
        $fileName = '{0:D2}-{1}.pdf' -f [int]$lesson.order, [string]$lesson.slug
        $outputPath = Join-Path $moduleOutputDir $fileName
        $startSlide = [int]$lesson.slideRange.start
        $endSlide = [int]$lesson.slideRange.end

        New-PrintRange -presentation $presentation -startSlide $startSlide -endSlide $endSlide

        $presentation.ExportAsFixedFormat(
          $outputPath,
          $ppFixedFormatTypePDF,
          2,
          $msoTrue,
          $ppPrintHandoutVerticalFirst,
          $ppPrintOutputSlides,
          $msoFalse,
          $presentation.PrintOptions.Ranges,
          1,
          $startSlide,
          '',
          $false,
          $false,
          $false,
          $false,
          $false
        )

        Write-Host ("  OK  Lesson {0}: slide {1}-{2}" -f $lesson.order, $startSlide, $endSlide)
      }
    } finally {
      $presentation.Close()
    }
  }

  Write-Host 'Ekspor PDF lesson selesai.'
} finally {
  if ($powerPoint) {
    $powerPoint.Quit()
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}

$ErrorActionPreference = 'Stop'

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')
$academyRoot = Join-Path $workspaceRoot 'MateriAcademy'
$configPath = Join-Path $PSScriptRoot 'academy-master-course.config.json'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Config tidak ditemukan di $configPath"
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$selectedSlug = ($args | Where-Object { $_ -like '--module=*' } | Select-Object -First 1)
$selectedSlug = if ($selectedSlug) { $selectedSlug.Split('=')[1] } else { '' }

try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
} catch {
  throw 'Microsoft PowerPoint tidak tersedia. Install PowerPoint desktop untuk mengekspor PDF lesson secara otomatis.'
}

$powerPoint.Visible = -1
$ppFixedFormatTypePDF = 2
$ppSaveAsPDF = 32
$ppPrintHandoutVerticalFirst = 1
$ppPrintOutputSlides = 1
$ppPrintAll = 1
$msoFalse = 0
$msoTrue = -1

function Resolve-Modules($allModules, $moduleSlug) {
  if (-not $moduleSlug) {
    return @($allModules)
  }

  return @($allModules | Where-Object { $_.slug -eq $moduleSlug })
}

function Export-LessonPdf($powerPoint, $pptPath, $outputPath, $startSlide, $endSlide) {
  $tempPptPath = Join-Path ([System.IO.Path]::GetTempPath()) ("academy-lesson-{0}.pptx" -f [guid]::NewGuid().ToString('N'))
  Copy-Item -LiteralPath $pptPath -Destination $tempPptPath -Force

  $lessonPresentation = $null
  try {
    $lessonPresentation = $powerPoint.Presentations.Open($tempPptPath, $msoFalse, $msoFalse, $msoFalse)

    for ($slideIndex = $lessonPresentation.Slides.Count; $slideIndex -ge 1; $slideIndex--) {
      if ($slideIndex -lt $startSlide -or $slideIndex -gt $endSlide) {
        $lessonPresentation.Slides.Item($slideIndex).Delete()
      }
    }

    $lessonPresentation.SaveAs($outputPath, $ppSaveAsPDF)
  } finally {
    if ($lessonPresentation) {
      $lessonPresentation.Close()
    }
    Remove-Item -LiteralPath $tempPptPath -Force -ErrorAction SilentlyContinue
  }
}

try {
  $modules = Resolve-Modules -allModules $config.modules -moduleSlug $selectedSlug
  if ($modules.Count -eq 0) {
    throw "Module $selectedSlug tidak ditemukan di config."
  }

  foreach ($module in $modules) {
    $pptPath = Join-Path $academyRoot $module.sourcePptx
    if (-not (Test-Path -LiteralPath $pptPath)) {
      throw "File PPTX tidak ditemukan: $pptPath"
    }

    $moduleOutputDir = Join-Path $academyRoot (Join-Path $config.assetBasePath $module.slug)
    New-Item -ItemType Directory -Force -Path $moduleOutputDir | Out-Null

    Write-Host "Mengekspor PDF lesson untuk $($module.title)..."
    foreach ($lesson in $module.lessons) {
      if ($lesson.contentType -eq 'text' -or -not $lesson.slug -or -not $lesson.slideRange) {
        continue
      }

      $fileName = '{0:D2}-{1}.pdf' -f [int]$lesson.order, [string]$lesson.slug
      $outputPath = Join-Path $moduleOutputDir $fileName
      $startSlide = [int]$lesson.slideRange.start
      $endSlide = [int]$lesson.slideRange.end

      Export-LessonPdf -powerPoint $powerPoint -pptPath $pptPath -outputPath $outputPath -startSlide $startSlide -endSlide $endSlide

      Write-Host ("  OK  Lesson {0}: slide {1}-{2}" -f $lesson.order, $startSlide, $endSlide)
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

param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$sourceDir = Join-Path $Root 'src/js/auralis-core'
$outFile = Join-Path $Root 'auralis-core.js'

if (-not (Test-Path -LiteralPath $sourceDir)) {
    throw "Missing source directory: $sourceDir"
}

$fileList = [System.Collections.Generic.List[System.IO.FileInfo]](@(Get-ChildItem -LiteralPath $sourceDir -Filter '*.js'))
$fileList.Sort([System.Comparison[System.IO.FileInfo]]{
    param($a, $b) [System.String]::Compare($a.Name, $b.Name, [System.StringComparison]::Ordinal)
})
$parts = $fileList

if (-not $parts) {
    throw "No JS source shards found in $sourceDir"
}

$bundle = New-Object System.Collections.Generic.List[string]
$bundle.Add('/*')
$bundle.Add(' * GENERATED FILE. Do not edit directly.')
$bundle.Add(' * Source shards live in src/js/auralis-core/.')
$bundle.Add(' * Rebuild with: powershell -ExecutionPolicy Bypass -File scripts/build-core.ps1')
$bundle.Add(' */')
$bundle.Add('')

foreach ($part in $parts) {
    $bundle.Add("/* >>> $($part.Name) */")
    $bundle.Add((Get-Content -Raw -LiteralPath $part.FullName -Encoding UTF8).TrimEnd())
    $bundle.Add("/* <<< $($part.Name) */")
    $bundle.Add('')
}

if ($bundle[$bundle.Count - 1] -eq '') {
    $bundle.RemoveAt($bundle.Count - 1)
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outFile, ($bundle -join "`r`n"), $utf8NoBom)
Write-Host "Built $outFile from $($parts.Count) shards."

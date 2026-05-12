$files = @(
  'webdesign-bonn.html',
  'webdesign-hennef.html',
  'webdesign-koeln.html',
  'webdesign-siegburg.html',
  'webdesign-troisdorf.html'
)

$basePath = 'c:\Users\Test\Desktop\claude\website'

foreach ($f in $files) {
  $path = Join-Path $basePath $f
  $content = Get-Content $path -Raw
  $original = $content

  # Add @id after @type: ProfessionalService
  $content = $content -replace '"@type": "ProfessionalService",\r?\n(\s*)"name":', "`"@type`": `"ProfessionalService`",`r`n`$1`"@id`": `"https://infinitymade.de/#organization`",`r`n`$1`"name`":"

  # Add sameAs before closing }
  $content = $content -replace '"geo": \{ "@type": "GeoCoordinates", "latitude": ([\d.]+), "longitude": ([\d.]+) \ }\r?\n  \}', "`"geo`": { `"@type`": `"GeoCoordinates`", `"latitude`": `$1, `"longitude`": `$2 },`r`n    `"sameAs`": [`"https://www.wikidata.org/wiki/Q139764488`"]`r`n  }"

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline -Encoding UTF8
    Write-Host "Updated: $f"
  } else {
    Write-Host "No changes: $f"
  }
}

# WhatsApp bot pages — update provider object
$waFiles = @(
  'whatsapp-bot-fitness.html',
  'whatsapp-bot-friseur.html',
  'whatsapp-bot-physiotherapie.html',
  'whatsapp-bot-restaurant.html'
)

foreach ($f in $waFiles) {
  $path = Join-Path $basePath $f
  $content = Get-Content $path -Raw
  $original = $content

  # Add @id and sameAs to provider object
  $content = $content -replace '"provider": \{ "@type": "ProfessionalService", "name": "InfinityMade"', '"provider": { "@type": "ProfessionalService", "@id": "https://infinitymade.de/#organization", "name": "InfinityMade", "sameAs": ["https://www.wikidata.org/wiki/Q139764488"]'

  if ($content -ne $original) {
    Set-Content -Path $path -Value $content -NoNewline -Encoding UTF8
    Write-Host "Updated: $f"
  } else {
    Write-Host "No changes: $f"
  }
}

Write-Host "Done."

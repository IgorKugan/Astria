param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::Open($Destination, 'Create')
try {
  $parent=[IO.Path]::GetDirectoryName($Source.TrimEnd('\'))
  foreach ($file in Get-ChildItem -LiteralPath $Source -File -Recurse) {
    $relative=$file.FullName.Substring($parent.Length+1).Replace('\','/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose() }

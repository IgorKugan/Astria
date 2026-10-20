param([Parameter(Mandatory=$true)][string]$JobPath, [switch]$Independent)
$ErrorActionPreference = 'Stop'
$job = Get-Content -LiteralPath $JobPath -Raw -Encoding UTF8 | ConvertFrom-Json
$root = [IO.Path]::GetFullPath($job.root).TrimEnd('\')
$folder = [IO.Path]::GetFullPath($job.folder).TrimEnd('\')
if ($folder -ne [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($JobPath)) -or !$folder.StartsWith($root + '\Save\Updates\update-', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid update folder' }
if ([IO.Path]::GetFullPath($job.stage) -ne ($folder + '\program') -or !([IO.Path]::GetFullPath($job.backup)).StartsWith($root + '\Save\Backups\Program-', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid staging or backup path' }
$rootFiles = @('Astria.exe','chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','dxcompiler.dll','dxil.dll','ffmpeg.dll','icudtl.dat','libEGL.dll','libGLESv2.dll','LICENSE','LICENSE.electron.txt','LICENSES.chromium.html','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','vk_swiftshader.dll','vk_swiftshader_icd.json','vulkan-1.dll','portable.flag','LEIA-ME.txt')
function Assert-ProgramPath([string]$Name) {
  if (!($rootFiles -ccontains $Name) -and $Name -cnotmatch '^locales/[a-zA-Z0-9-]+\.pak$' -and $Name -cne 'resources/app.asar') { throw "Invalid program path: $Name" }
}
function Assert-NoLinks([string]$Target) {
  $cursor = [IO.Path]::GetFullPath($Target)
  while ($cursor -and $cursor.Length -ge $root.Length) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked paths are not allowed during updates' }
    if ($cursor -eq $root) { break }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
}
Assert-NoLinks $folder
Assert-NoLinks $job.backup
if (!$Independent) {
  # Node's Windows child job ends when Astria quits. A native PowerShell launch
  # starts the worker outside that child job; keep this bootstrap alive until
  # the worker exits, or Astria closes after observing the worker's ready file.
  $worker = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'),'-JobPath',('"' + $JobPath + '"'),'-Independent') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $folder 'worker.log') -RedirectStandardError (Join-Path $folder 'worker-error.log') -PassThru
  $worker.WaitForExit()
  exit $worker.ExitCode
}
foreach ($name in $job.oldFiles) { Assert-ProgramPath $name; Assert-NoLinks (Join-Path $root $name) }
foreach ($file in $job.files) {
  Assert-ProgramPath $file.path
  $target = Join-Path $job.stage $file.path
  Assert-NoLinks $target
  Assert-NoLinks (Join-Path $root $file.path)
  $stream = [IO.File]::OpenRead($target)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { $digest = [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
  finally { $stream.Dispose(); $algorithm.Dispose() }
  if ((Get-Item -LiteralPath $target).Length -ne $file.size -or $digest -ne $file.sha256) { throw 'Staged file verification failed' }
}
# The app exits normally and flushes its profiles before any program file moves.
[IO.File]::WriteAllText(($JobPath + '.ready'), 'Ready to wait for the app to close')
$parent = Get-Process -Id $job.pid -ErrorAction SilentlyContinue
if ($parent) { $parent | Wait-Process -Timeout 60 -ErrorAction Stop }
New-Item -ItemType Directory -Path $job.backup | Out-Null
$movedOld = [Collections.Generic.List[string]]::new()
$movedNew = [Collections.Generic.List[string]]::new()
$started = $null
try {
  foreach ($name in $job.oldFiles) {
    $source = Join-Path $root $name
    if (!(Test-Path -LiteralPath $source -PathType Leaf)) { continue }
    $target = Join-Path $job.backup $name
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
    Move-Item -LiteralPath $source -Destination $target
    $movedOld.Add($name)
  }
  foreach ($file in $job.files) {
    $target = Join-Path $root $file.path
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
    Move-Item -LiteralPath (Join-Path $job.stage $file.path) -Destination $target
    $movedNew.Add($file.path)
  }
  $started = Start-Process -FilePath (Join-Path $root 'Astria.exe') -ArgumentList ('--astria-update-health="' + $JobPath + '"') -WorkingDirectory $root -WindowStyle Normal -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(45)
  while (!(Test-Path -LiteralPath ($JobPath + '.healthy'))) {
    if ($started.HasExited -or [DateTime]::UtcNow -gt $deadline) { throw 'The updated interface did not start successfully' }
    Start-Sleep -Milliseconds 300
    $started.Refresh()
  }
  [IO.File]::WriteAllText((Join-Path $folder 'result.txt'), 'Update successful. Previous program: ' + $job.backup)
} catch {
  $failure = $_.Exception.Message
  if ($started -and !$started.HasExited) { $started.Kill(); $started.WaitForExit() }
  foreach ($name in $movedNew) { Remove-Item -LiteralPath (Join-Path $root $name) -Force }
  foreach ($name in $movedOld) { Move-Item -LiteralPath (Join-Path $job.backup $name) -Destination (Join-Path $root $name) -Force }
  [IO.File]::WriteAllText((Join-Path $folder 'result.txt'), 'Rolled back: ' + $failure)
  Start-Process -FilePath (Join-Path $root 'Astria.exe') -WorkingDirectory $root -WindowStyle Normal
  exit 1
}

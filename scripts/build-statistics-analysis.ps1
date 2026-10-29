$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskDotnet=if($env:ALBION_SAT_DOTNET){$env:ALBION_SAT_DOTNET}else{'dotnet'}
$taskProject=Join-Path $taskRoot 'third_party/statistics-analysis/src/StatisticsAnalysisTool/StatisticsAnalysisTool.csproj'
$taskOutput=Join-Path $taskRoot 'work/sat-publish'
$env:DOTNET_CLI_TELEMETRY_OPTOUT='1'
$env:DOTNET_NOLOGO='1'
& $taskDotnet publish $taskProject -c Release -r win-x64 --self-contained true -p:LocalInstallerBuild=true -p:DebugType=None -o $taskOutput
if($LASTEXITCODE -ne 0){throw 'Statistics Analysis build failed'}
Copy-Item -LiteralPath (Join-Path $taskRoot 'third_party/statistics-analysis/LICENSE') -Destination (Join-Path $taskOutput 'LICENSE-SAT.txt')
Copy-Item -LiteralPath (Join-Path $taskRoot 'third_party/statistics-analysis/ORIGIN.md') -Destination (Join-Path $taskOutput 'SOURCE-SAT.md')
$taskAssets=Get-Content -Raw -Encoding UTF8 (Join-Path (Split-Path $taskProject) 'obj/project.assets.json') | ConvertFrom-Json
$taskCache=$taskAssets.project.restore.packagesPath
foreach($taskLibrary in $taskAssets.libraries.PSObject.Properties){
    if($taskLibrary.Value.type -ne 'package'){continue}
    $taskPackage=Join-Path $taskCache $taskLibrary.Value.path
    $taskNotices=Join-Path $taskOutput ('licenses/nuget/'+$taskLibrary.Name.Replace('/','-'))
    New-Item -ItemType Directory -Force $taskNotices | Out-Null
    Get-ChildItem -LiteralPath $taskPackage -File -Filter '*.nuspec' | Copy-Item -Destination $taskNotices
    foreach($taskNotice in (Get-ChildItem -LiteralPath $taskPackage -Recurse -File | Where-Object {$_.Name -match '^(LICENSE|COPYING|NOTICE|ThirdPartyNotices)(\..*)?$'})){
        $taskRelative=$taskNotice.FullName.Substring($taskPackage.Length).TrimStart([char[]]'\/')
        $taskDestination=Join-Path $taskNotices $taskRelative
        New-Item -ItemType Directory -Force (Split-Path $taskDestination) | Out-Null
        Copy-Item -LiteralPath $taskNotice.FullName -Destination $taskDestination
    }
}

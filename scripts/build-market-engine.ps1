$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskSource=Join-Path $taskRoot 'work/aodp-engine-source'
if(-not(Test-Path -LiteralPath $taskSource)){
 git clone --depth 1 --branch 0.1.61 https://github.com/ao-data/albiondata-client.git $taskSource
 if($LASTEXITCODE -ne 0){throw 'Cannot obtain AODP sources'}
}
$taskRevision=git -C $taskSource rev-parse --short=7 HEAD
if($taskRevision -ne 'c6edd94'){throw 'Unexpected AODP source revision'}
Copy-Item -LiteralPath (Join-Path $taskRoot 'desktop/vendor/aodp/engine-main.go') -Destination (Join-Path $taskSource 'engine-main.go')
@'
//go:build windows
package notification
import "github.com/ao-data/albiondata-client/log"
func Push(message string) { log.Info(message) }
'@ | Set-Content -LiteralPath (Join-Path $taskSource 'notification/notification_win.go') -Encoding utf8
$env:CGO_ENABLED='0'
Push-Location $taskSource
try{
 go build -trimpath -ldflags '-s -w' -o (Join-Path $taskRoot 'desktop/vendor/aodp/albiondata-client.exe') engine-main.go
 if($LASTEXITCODE -ne 0){throw 'Cannot build embedded market engine'}
}finally{Pop-Location}

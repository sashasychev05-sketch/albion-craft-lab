param([Parameter(Mandatory=$true)][string]$ImagePath)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
try {
 Add-Type -AssemblyName System.Runtime.WindowsRuntime
 $null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
 $null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
 $null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
 $null=[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]
 $taskAsTask=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetGenericArguments().Count -eq 1}|Select-Object -First 1
 function Await($Operation,[Type]$ResultType) {$task=$taskAsTask.MakeGenericMethod($ResultType).Invoke($null,@($Operation));$task.GetAwaiter().GetResult()}
 $taskEngine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
 if(-not $taskEngine){$taskEngine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()}
 if(-not $taskEngine){throw 'OCR_UNAVAILABLE'}
 $taskFile=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
 $taskStream=Await ($taskFile.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
 try {
  $taskDecoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($taskStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $taskBitmap=Await ($taskDecoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  try {$taskResult=Await ($taskEngine.RecognizeAsync($taskBitmap)) ([Windows.Media.Ocr.OcrResult]);@{text=$taskResult.Text;language=$taskEngine.RecognizerLanguage.LanguageTag}|ConvertTo-Json -Compress}
  finally {$taskBitmap.Dispose()}
 } finally {$taskStream.Dispose()}
} catch { [Console]::Error.WriteLine('LOCAL_OCR_FAILED: '+$_.Exception.Message);exit 1 }

param([ValidateSet('status','focus','hide')][string]$Action='status',[Parameter(Mandatory=$true)][string]$Executable,[int]$ProcessId=0)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$taskFile=[IO.Path]::GetFullPath($Executable)
$taskMatches=@(Get-Process -Name 'AlbionAvalonChecker' -ErrorAction SilentlyContinue|Where-Object {try{[string]::Equals($_.MainModule.FileName,$taskFile,[StringComparison]::OrdinalIgnoreCase)}catch{$false}})
if($Action -eq 'status'){@{processes=@($taskMatches|ForEach-Object {@{pid=$_.Id}})}|ConvertTo-Json -Compress -Depth 4;exit}
$taskProcess=$taskMatches|Where-Object Id -eq $ProcessId|Select-Object -First 1
if(-not $taskProcess){throw 'Checker process no longer matches the selected program.'}
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class AvalonWindow {
 public delegate bool Visitor(IntPtr window, IntPtr parameter);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Visitor visitor, IntPtr parameter);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
 public static IntPtr Find(uint process) {
  IntPtr result=IntPtr.Zero;
  EnumWindows(delegate(IntPtr window, IntPtr parameter){uint owner; GetWindowThreadProcessId(window,out owner);if(owner!=process)return true;var name=new StringBuilder(512);GetWindowText(window,name,512);if(name.ToString().IndexOf("AlbionAvalonChecker",StringComparison.OrdinalIgnoreCase)>=0||name.ToString().IndexOf("Avalon Checker",StringComparison.OrdinalIgnoreCase)>=0){result=window;return false;}return true;},IntPtr.Zero);
  return result;
 }
}
'@
$taskHandle=[AvalonWindow]::Find([uint32]$ProcessId)
if($taskHandle -eq [IntPtr]::Zero){throw 'Checker window is not ready yet.'}
if($Action -eq 'hide'){$null=[AvalonWindow]::ShowWindowAsync($taskHandle,0)}else{$null=[AvalonWindow]::ShowWindowAsync($taskHandle,9);$null=[AvalonWindow]::SetForegroundWindow($taskHandle)}
@{focused=($Action -eq 'focus');hidden=($Action -eq 'hide')}|ConvertTo-Json -Compress

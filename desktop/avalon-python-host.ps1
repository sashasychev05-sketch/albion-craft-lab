param([Parameter(Mandatory=$true)][string]$Runtime,[Parameter(Mandatory=$true)][string]$Worker,[Parameter(Mandatory=$true)][string]$Archive,[Parameter(Mandatory=$true)][string]$Profile)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$env:ACL_AVALON_RUNTIME=[IO.Path]::GetFullPath($Runtime)
$env:ACL_AVALON_WORKER=[IO.Path]::GetFullPath($Worker)
$env:ACL_AVALON_ARCHIVE=[IO.Path]::GetFullPath($Archive)
$env:ACL_AVALON_PROFILE=[IO.Path]::GetFullPath($Profile)
$env:PYTHONNOUSERSITE='1';$env:PYTHONUTF8='1';$env:PYTHONUNBUFFERED='1'
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class AvalonPythonHost {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr LoadLibraryW(string path);
 [DllImport("kernel32.dll",CharSet=CharSet.Ansi,SetLastError=true)] static extern IntPtr GetProcAddress(IntPtr module,string name);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool SetDllDirectoryW(string path);
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate void SetPath([MarshalAs(UnmanagedType.LPWStr)]string path);
 [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate void Init();
 [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate int Run(IntPtr code);
 static T Function<T>(IntPtr module,string name) {return (T)(object)Marshal.GetDelegateForFunctionPointer(GetProcAddress(module,name),typeof(T));}
 static string Literal(string value) {var text=new StringBuilder();foreach(byte b in Encoding.UTF8.GetBytes(value))text.Append(b.ToString("x2"));return "bytes.fromhex('"+text.ToString()+"').decode('utf-8')";}
 public static int Start(string runtime,string worker,string archive,string profile) {
  SetProcessDpiAwarenessContext(new IntPtr(-4));SetDllDirectoryW(runtime);
  IntPtr library=LoadLibraryW(System.IO.Path.Combine(runtime,"python312.dll"));if(library==IntPtr.Zero)throw new InvalidOperationException("Python runtime is unavailable.");
  foreach(string flag in new string[]{"Py_NoSiteFlag","Py_IsolatedFlag","Py_IgnoreEnvironmentFlag","Py_DontWriteBytecodeFlag"}){IntPtr address=GetProcAddress(library,flag);if(address!=IntPtr.Zero)Marshal.WriteInt32(address,1);}
  Function<SetPath>(library,"Py_SetPath")(System.IO.Path.Combine(runtime,"base_library.zip")+";"+runtime);
  Function<Init>(library,"Py_Initialize")();
  byte[] bytes=Encoding.UTF8.GetBytes("import os; os.environ.update({'ACL_AVALON_RUNTIME':"+Literal(runtime)+",'ACL_AVALON_ARCHIVE':"+Literal(archive)+",'ACL_AVALON_PROFILE':"+Literal(profile)+"}); p="+Literal(worker)+"; exec(compile(open(p,encoding='utf-8').read(),p,'exec'))\0");
  IntPtr script=Marshal.AllocHGlobal(bytes.Length);try{Marshal.Copy(bytes,0,script,bytes.Length);return Function<Run>(library,"PyRun_SimpleString")(script);}finally{Marshal.FreeHGlobal(script);}
 }
}
'@
exit [AvalonPythonHost]::Start($env:ACL_AVALON_RUNTIME,$env:ACL_AVALON_WORKER,$env:ACL_AVALON_ARCHIVE,$env:ACL_AVALON_PROFILE)

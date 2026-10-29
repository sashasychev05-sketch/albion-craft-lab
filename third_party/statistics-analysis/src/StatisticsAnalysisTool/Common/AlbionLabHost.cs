// Albion Lab integration changes, distributed under GPL-3.0.
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;

namespace StatisticsAnalysisTool.Common;

internal static class AlbionLabHost
{
    private static nint _parent;
    private static DispatcherTimer _timer;
    public static bool IsEmbedded => _parent != 0;
    public static void ReportProgress(double progress, string task)
    {
        if (IsEmbedded) Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { type = "progress", progress, task }));
    }

    public static void Configure()
    {
        var value = Environment.GetEnvironmentVariable("ALBION_LAB_SAT_PARENT");
        var profile = Environment.GetEnvironmentVariable("ALBION_LAB_SAT_PROFILE");
        if (string.IsNullOrWhiteSpace(value) && string.IsNullOrWhiteSpace(profile)) return;
        if (!long.TryParse(value, out var handle) || handle == 0 || !IsWindow((nint)handle) || string.IsNullOrWhiteSpace(profile) || !Path.IsPathFullyQualified(profile))
            throw new InvalidOperationException("Invalid Albion Lab host configuration.");
        _parent = (nint)handle;
        AppDataPaths.ConfigureAlbionLabProfile(Path.GetFullPath(profile));
        _ = Task.Run(async () => {
            while (await Console.In.ReadLineAsync() is { } line)
                if (line == "close") { _ = System.Windows.Application.Current.Dispatcher.BeginInvoke(() => System.Windows.Application.Current.Shutdown()); break; }
        });
    }

    public static void Attach(Window window)
    {
        if (!IsEmbedded) return;
        window.WindowStyle = WindowStyle.None;
        window.AllowsTransparency = false;
        window.ResizeMode = ResizeMode.NoResize;
        window.ShowInTaskbar = Environment.GetEnvironmentVariable("ALBION_LAB_SAT_QA") == "1";
        new WindowInteropHelper(window).Owner = _parent;
        window.Loaded += (_, _) => {
            var handle = new WindowInteropHelper(window).Handle;
            if (GetWindow(handle, 4) != _parent) throw new InvalidOperationException("Could not attach SAT to Albion Lab.");
            void Fit()
            {
                if (!IsWindow(_parent)) { System.Windows.Application.Current.Shutdown(); return; }
                if (GetClientRect(_parent, out var rect)) {
                    var top = (int)(48 * GetDpiForWindow(_parent) / 96);
                    var width = Math.Max(1, rect.Right); var height = Math.Max(1, rect.Bottom - top);
                    var point = new Point { X = 0, Y = top }; ClientToScreen(_parent, ref point);
                    GetWindowRect(handle, out var existing);
                    if (existing.Left != point.X || existing.Top != point.Y || existing.Right-existing.Left != width || existing.Bottom-existing.Top != height)
                        SetWindowPos(handle, 0, point.X, point.Y, width, height, 0x0010 | 0x0004);
                }
            }
            _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(150) };
            _timer.Tick += (_, _) => Fit();
            _timer.Start();
            window.Dispatcher.BeginInvoke(() => {
                Fit(); GetWindowRect(handle, out var bounds);
                Serilog.Log.Information("Albion host: owner verified={OwnerVerified}, visible={Visible}, bounds={Left},{Top},{Right},{Bottom}",
                    GetWindow(handle, 4) == _parent, IsWindowVisible(handle), bounds.Left,bounds.Top,bounds.Right,bounds.Bottom);
                Console.WriteLine("{\"type\":\"ready\"}");
            });
        };
        window.Closed += (_, _) => _timer?.Stop();
    }

    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct Point { public int X, Y; }
    [DllImport("user32.dll")] private static extern bool ClientToScreen(nint window, ref Point point);
    [DllImport("user32.dll")] private static extern nint GetWindow(nint window, uint command);
    [DllImport("user32.dll")] private static extern bool IsWindow(nint window);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(nint window);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(nint window, out Rect rect);
    [DllImport("user32.dll")] private static extern bool GetClientRect(nint window, out Rect rect);
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(nint window);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(nint window, nint after, int x, int y, int width, int height, uint flags);
}

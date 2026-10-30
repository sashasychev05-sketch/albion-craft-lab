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
    private static Window _mainWindow;
    private static bool _showRequested;
    private static bool _mainReady;
    public static bool CaptureRequested { get; private set; } = true;
    private static TextWriter _output;
    private static readonly object OutputGate = new();
    public static bool IsShuttingDown { get; private set; }
    public static bool BackgroundMode => Environment.GetEnvironmentVariable("ALBION_LAB_SAT_BACKGROUND") == "1";
    public static bool IsEmbedded => _parent != 0;
    public static void RequestCapture(bool enabled) { if (IsEmbedded) CaptureRequested = enabled; }
    public static void ReportCapture(bool active)
    {
        if (IsEmbedded) EventLine(System.Text.Json.JsonSerializer.Serialize(new { type = "capture-state", active, requested = CaptureRequested }));
    }
    public static void CaptureError(string message)
    {
        if (IsEmbedded) EventLine(System.Text.Json.JsonSerializer.Serialize(new { type = "capture-error", message }));
    }
    public static void EventLine(string value)
    {
        try { lock (OutputGate) _output?.WriteLine(value); } catch (IOException) { }
    }
    public static void ReportProgress(double progress, string task)
    {
        if (IsEmbedded) EventLine(System.Text.Json.JsonSerializer.Serialize(new { type = "progress", progress, task }));
    }

    public static void Configure()
    {
        var value = Environment.GetEnvironmentVariable("ALBION_LAB_SAT_PARENT");
        var profile = Environment.GetEnvironmentVariable("ALBION_LAB_SAT_PROFILE");
        if (string.IsNullOrWhiteSpace(value) && string.IsNullOrWhiteSpace(profile)) return;
        if (!long.TryParse(value, out var handle) || handle == 0 || !IsWindow((nint)handle) || string.IsNullOrWhiteSpace(profile) || !Path.IsPathFullyQualified(profile))
            throw new InvalidOperationException("Invalid Albion Lab host configuration.");
        _parent = (nint)handle;
        CaptureRequested = Environment.GetEnvironmentVariable("ALBION_LAB_SAT_CAPTURE") != "0";
        _output = Console.Out;
        var input = Console.In;
        AppDataPaths.ConfigureAlbionLabProfile(Path.GetFullPath(profile));
        AlbionLabSessionBridge.Start();
        _ = Task.Run(async () => {
            while (await input.ReadLineAsync() is { } line) {
                var command = line;
                _ = System.Windows.Application.Current.Dispatcher.BeginInvoke(async () => {
                  try {
                    if (command == "close") { IsShuttingDown = true; System.Windows.Application.Current.Shutdown(); }
                    if (command == "show-ui") { _showRequested = true; _mainWindow?.Show(); _mainWindow?.Activate(); }
                    if (command == "hide-ui") { _showRequested = false; _mainWindow?.Hide(); }
                    if (command.StartsWith("tab:") && _mainWindow is Views.MainWindow main) main.ShowAlbionLabModule(command[4..]);
                    if (command is "capture-on" or "capture-off") {
                        RequestCapture(command == "capture-on");
                        if (_mainReady) {
                            var tracking = ServiceLocator.Resolve<Network.Manager.TrackingController>();
                            if (CaptureRequested) await tracking.StartTrackingAsync();
                            else tracking.StopTracking();
                        }
                    }
                    if (command == "new-session" && _mainWindow?.DataContext is ViewModels.MainWindowViewModel model
                        && model.IsTrackingActive && model.MainStatusBindings.IsInGame) {
                        var tracking = ServiceLocator.Resolve<Network.Manager.TrackingController>();
                        tracking.StatisticController.EndSession(DateTime.UtcNow);
                        tracking.StatisticController.StartSession(tracking.EntityController.LocalUserData.Username);
                    }
                  } catch (Exception error) { EventLine(System.Text.Json.JsonSerializer.Serialize(new { type = "session-error", message = error.Message })); }
                });
                if (command == "close") break;
            }
        });
    }

    public static void HideInterface()
    {
        _showRequested = false;
        _mainWindow?.Hide();
        EventLine("{\"type\":\"ui-hidden\"}");
    }

    public static void Attach(Window window, bool mainWindow = true)
    {
        if (!IsEmbedded) return;
        if (mainWindow) _mainWindow = window;
        window.WindowStyle = WindowStyle.None;
        window.AllowsTransparency = false;
        window.ResizeMode = ResizeMode.NoResize;
        window.ShowInTaskbar = Environment.GetEnvironmentVariable("ALBION_LAB_SAT_QA") == "1";
        if (mainWindow && BackgroundMode && !_showRequested) window.ShowActivated = false;
        new WindowInteropHelper(window).Owner = _parent;
        window.Loaded += (_, _) => {
            var handle = new WindowInteropHelper(window).Handle;
            if (GetWindow(handle, 4) != _parent) throw new InvalidOperationException("Could not attach SAT to Albion Lab.");
            void Fit()
            {
                if (!IsWindow(_parent)) { System.Windows.Application.Current.Shutdown(); return; }
                if (!window.IsVisible) return;
                if (GetClientRect(_parent, out var rect)) {
                    var top = (int)(48 * GetDpiForWindow(_parent) / 96);
                    var width = Math.Max(1, rect.Right); var height = Math.Max(1, rect.Bottom - top);
                    var point = new Point { X = 0, Y = top }; ClientToScreen(_parent, ref point);
                    GetWindowRect(handle, out var existing);
                    if (existing.Left != point.X || existing.Top != point.Y || existing.Right-existing.Left != width || existing.Bottom-existing.Top != height)
                        SetWindowPos(handle, 0, point.X, point.Y, width, height, 0x0010 | 0x0004);
                }
            }
            var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(150) };
            _timer = timer;
            timer.Tick += (_, _) => Fit();
            timer.Start();
            window.IsVisibleChanged += (_, _) => timer.Interval = TimeSpan.FromMilliseconds(window.IsVisible ? 150 : 1000);
            window.Closed += (_, _) => timer.Stop();
            window.Dispatcher.BeginInvoke(async () => {
                Fit(); GetWindowRect(handle, out var bounds);
                Serilog.Log.Information("Albion host: owner verified={OwnerVerified}, visible={Visible}, bounds={Left},{Top},{Right},{Bottom}",
                    GetWindow(handle, 4) == _parent, IsWindowVisible(handle), bounds.Left,bounds.Top,bounds.Right,bounds.Bottom);
                if (mainWindow) {
                    _mainReady = true;
                    if (CaptureRequested && window.DataContext is ViewModels.MainWindowViewModel model && !model.IsTrackingActive)
                        await ServiceLocator.Resolve<Network.Manager.TrackingController>().StartTrackingAutomaticallyAsync();
                    if (BackgroundMode && !_showRequested) window.Hide();
                    EventLine("{\"type\":\"ready\"}");
                }
            });
        };
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

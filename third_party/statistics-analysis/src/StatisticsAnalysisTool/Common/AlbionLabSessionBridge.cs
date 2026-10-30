// Albion Lab session integration, GPL-3.0.
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Windows.Threading;
using StatisticsAnalysisTool.Cluster;
using StatisticsAnalysisTool.Models;
using StatisticsAnalysisTool.Network.Manager;

namespace StatisticsAnalysisTool.Common;

internal static class AlbionLabSessionBridge
{
    private static readonly JsonSerializerOptions Options = new() {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
        Converters = { new JsonStringEnumConverter() }
    };
    private static readonly ConcurrentQueue<string> Pending = new();
    private static readonly object Gate = new();
    private static readonly string Run = Guid.NewGuid().ToString("N");
    private static Timer _writer;
    private static DispatcherTimer _contextTimer;
    private static string _journal;
    private static long _sequence, _queued, _dropped;
    private static Guid _session;
    private static string _lastError;
    private static string _lastContext;
    private static DateTime _lastHeartbeat;
    public static Guid SessionId { get { lock (Gate) return _session; } }

    public static void Start()
    {
        if (!AlbionLabHost.IsEmbedded || _writer != null) return;
        var directory = Path.Combine(AppDataPaths.RuntimeBaseDirectory, "AlbionLab");
        Directory.CreateDirectory(directory);
        _journal = Path.Combine(directory, $"events-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Run}.jsonl");
        _writer = new Timer(_ => Flush(), null, 500, 500);
    }

    public static void Publish(string kind, object data, Guid? sessionId = null, string id = null, DateTime? time = null)
    {
        if (!AlbionLabHost.IsEmbedded || _journal == null) return;
        if (Interlocked.Increment(ref _queued) > 50000) {
            Interlocked.Decrement(ref _queued); Interlocked.Increment(ref _dropped); return;
        }
        try {
            Pending.Enqueue(JsonSerializer.Serialize(new {
                id = id ?? $"{Run}:{Interlocked.Increment(ref _sequence)}", kind,
                sessionId = sessionId ?? SessionId, time = time ?? DateTime.UtcNow, updatedAtUtc = DateTime.UtcNow, data
            }, Options));
        } catch (Exception error) {
            Interlocked.Decrement(ref _queued);
            ReportError("Не удалось передать часть данных сессии: " + error.Message);
        }
    }

    public static void Session(StatisticSession session)
    {
        if (!AlbionLabHost.IsEmbedded || session == null) return;
        lock (Gate) {
            if (!session.EndedAtUtc.HasValue) _session = session.Id;
            else if (_session == session.Id) _session = Guid.Empty;
        }
        Publish("session", session, session.Id, "session:" + session.Id.ToString("N"));
    }

    public static void Statistic(StatisticEntry entry, bool historical = false)
    {
        if (!AlbionLabHost.IsEmbedded || entry == null) return;
        if (entry.AlbionLabId == Guid.Empty) entry.AlbionLabId = Guid.NewGuid();
        var item = entry.ItemIndex > 0 ? ItemController.GetItemByIndex(entry.ItemIndex) : null;
        Publish("stat", new { entry, historical, item = item == null ? null : new { id = item.UniqueName, name = item.LocalizedName } },
            entry.SessionId, "stat:" + entry.AlbionLabId.ToString("N"), entry.OccurredAtUtc);
    }

    public static void Import(DashboardStatistics statistics)
    {
        if (!AlbionLabHost.IsEmbedded) return;
        foreach (var session in statistics.Sessions) Session(session);
        foreach (var group in statistics.Entries.GroupBy(x => x.SessionId)) {
            var index = 0;
            foreach (var entry in group.OrderBy(x => x.OccurredAtUtc)) {
                if (entry.AlbionLabId == Guid.Empty) {
                    var key = $"{entry.SessionId:N}:{index}:{entry.OccurredAtUtc:O}:{entry.ValueType}";
                    entry.AlbionLabId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(key)).AsSpan(0, 16));
                }
                Statistic(entry, true); index++;
                while (Interlocked.Read(ref _queued) > 10000) {
                    var before = Interlocked.Read(ref _queued); Flush(true);
                    if (Interlocked.Read(ref _queued) >= before) return;
                }
            }
        }
    }

    public static void Context(TrackingController controller, bool tracking, bool inGame)
    {
        if (!AlbionLabHost.IsEmbedded) return;
        var user = controller.EntityController.LocalUserData;
        var cluster = ClusterController.CurrentCluster;
        var data = new {
            tracking, inGame, sessionId = SessionId, character = user.Username,
            server = AppDataPaths.ActiveUserDataServerLocation.ToString(),
            location = ClusterController.GetCurrentClusterDisplayName(), locationId = cluster.Index,
            mapType = cluster.MapType.ToString(), clusterType = cluster.ClusterMode.ToString(),
            guild = user.GuildName, alliance = user.AllianceName,
            silver = user.Silver?.ToString(), gold = user.Gold?.ToString(),
            learningPoints = user.LearningPoints?.ToString(), reputation = user.Reputation,
            respecPoints = user.ReSpecPoints?.ToString(), playTimeSeconds = user.PlayTimeInSeconds,
            party = controller.EntityController.GetAllEntities(true).OrderBy(x => x.Key).Select(x => new {
                id = x.Key, name = x.Value.Name, damage = x.Value.Damage, healing = x.Value.Heal,
                takenDamage = x.Value.TakenDamage
            }).ToArray()
        };
        var serialized = JsonSerializer.Serialize(data, Options);
        if (serialized == _lastContext) return;
        _lastContext = serialized;
        Publish("context", data);
    }

    public static void Watch(TrackingController controller, ViewModels.MainWindowViewModel model)
    {
        if (!AlbionLabHost.IsEmbedded) return;
        _contextTimer?.Stop();
        _contextTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _contextTimer.Tick += (_, _) => Context(controller, model.IsTrackingActive, model.MainStatusBindings.IsInGame);
        _contextTimer.Start();
        Context(controller, model.IsTrackingActive, model.MainStatusBindings.IsInGame);
    }

    public static void Combat(TrackingController controller, string metric, long sourceId, long targetId,
        long value, int spell, string content, Guid? combatId = null)
    {
        if (!AlbionLabHost.IsEmbedded || SessionId == Guid.Empty || value <= 0) return;
        var local = controller.EntityController.LocalUserData.UserObjectId;
        var source = controller.EntityController.GetEntity(sourceId)?.Value;
        var target = controller.EntityController.GetEntity(targetId)?.Value;
        Publish("combat", new {
            metric, value, sourceId = sourceId.ToString(), targetId = targetId.ToString(), spell, content, combatId,
            source = source?.Name, target = target?.Name,
            sourceLocal = local == sourceId, targetLocal = local == targetId,
            location = ClusterController.GetCurrentClusterDisplayName(),
            locationId = ClusterController.CurrentCluster.Index
        });
    }

    public static void Flush(bool wait = false)
    {
        if (_journal == null) return;
        if (wait) Monitor.Enter(Gate);
        else if (!Monitor.TryEnter(Gate)) return;
        try {
            var batch = Pending.Take(2000).ToArray();
            if (batch.Length > 0) {
                using var file = new FileStream(_journal, FileMode.OpenOrCreate, FileAccess.Write, FileShare.Read);
                var originalLength = file.Length;
                file.Position = originalLength;
                try {
                    var bytes = Encoding.UTF8.GetBytes(string.Join('\n', batch) + "\n");
                    file.Write(bytes); file.Flush(true);
                } catch { file.SetLength(originalLength); throw; }
                for (var index = 0; index < batch.Length; index++) if (Pending.TryDequeue(out _)) Interlocked.Decrement(ref _queued);
                AlbionLabHost.EventLine("{\"type\":\"session-data\"}");
                _lastError = null;
            }
            var dropped = Interlocked.Exchange(ref _dropped, 0);
            if (dropped > 0) ReportError($"Передача не успела сохранить {dropped} событий; статистика может быть неполной.");
            if (DateTime.UtcNow - _lastHeartbeat > TimeSpan.FromSeconds(5)) {
                _lastHeartbeat = DateTime.UtcNow;
                AlbionLabHost.EventLine("{\"type\":\"heartbeat\"}");
            }
        } catch (Exception error) { ReportError("Не удалось записать данные сессии: " + error.Message); }
        finally { Monitor.Exit(Gate); }
    }

    private static void ReportError(string message)
    {
        if (_lastError == message) return;
        _lastError = message;
        AlbionLabHost.EventLine(JsonSerializer.Serialize(new { type = "session-error", message }));
    }

    public static void Close()
    {
        _contextTimer?.Stop();
        _writer?.DisposeAsync().AsTask().GetAwaiter().GetResult(); _writer = null;
        while (!Pending.IsEmpty) {
            var before = Pending.Count; Flush(true);
            if (Pending.Count >= before) break;
        }
    }
}


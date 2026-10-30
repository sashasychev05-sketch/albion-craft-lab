# Statistics Analysis Tool inside Albion Lab

Upstream: https://github.com/Triky313/AlbionOnline-StatisticsAnalysis
Revision: 8ad2067d96c9372f4a9f07f5896a9e1ccb9f9b29
License: GNU GPL version 3. See LICENSE.

The upstream source projects and functional modules are preserved in src/.
Albion Lab integration modifications:

- Common/AlbionLabHost.cs owns and positions the native WPF interface inside an Albion Lab host frame.
- Common/AppDataPaths.cs permits a separate runtime profile supplied by the host.
- App.xaml.cs isolates runtime data and skips standalone migration, auto-start,
  background updater and automatic external application launch in hosted mode.
- Common/SystemTrayService.cs keeps the hosted component inside the host window.
- Views/MainWindow.xaml.cs disables standalone frame movement and frame buttons in hosted mode.
- ViewModels/SettingsWindowViewModel.cs prevents standalone auto-start registration.
- Updater/AutoUpdateController.cs delegates updates to Albion Lab.

Build requirements: Windows x64, .NET SDK 10, Node.js 24 and npm.
The build publishes a self-contained Windows x64 component, including .NET Desktop Runtime.
Npcap is required only for live packet capture.

Build: scripts/build-statistics-analysis.ps1 in the Albion Lab repository.
The modified corresponding source and build scripts are distributed in that repository.
Original authorship and license notices remain in the upstream source.

Albion Lab 1.10 session data integration:

- Common/AlbionLabSessionBridge.cs exports accepted statistics, combat contributions, locations and player/party context to a durable local domain-event journal. Raw network packets and authentication data are not exported.
- Models/StatisticEntry.cs, Models/DashboardStatistics.cs and Common/StatisticSessionStorage.cs preserve stable entry IDs across saves, snapshots and imports.
- Network/Manager/StatisticController.cs emits session lifecycle, imports history and reports revised loot entries.
- DamageMeter/CombatEventTracker.cs and Network/Manager/CombatController.cs emit accepted damage, healing, received damage and overheal.
- Cluster/ClusterController.cs emits location changes.
- Network/Manager/TrackingController.cs and Views/MainWindow.xaml.cs respect the host capture switch and keep background capture running when tools are hidden.
- Common/AlbionLabHost.cs accepts capture, navigation and new-session commands and reports setup, capture state and errors.
- App.xaml.cs drains the journal at shutdown and preserves the original first-start guide; Views/FirstStartGuideWindow.xaml.cs adapts its hosted frame.
- Views/MainWindow.xaml names the native module tabs for host navigation.
- The Electron host imports journals and saved module data into its local SQLite worker, presents a session dashboard and an always-on-top overlay. Original SAT models, item icons and advanced tools remain available.

# Embedded Albion Lab market engine

Based on MIT-licensed ao-data/albiondata-client tag 0.1.61, commit c6edd94.
Source: https://github.com/ao-data/albiondata-client/tree/0.1.61

The supplied binary uses engine-main.go instead of the upstream GUI entry point.
It has no tray, WebView, external dashboard or self-updater. Its upload target
must be HTTP on 127.0.0.1. WebSockets and private upload targets are disabled.
Status is emitted as bounded JSON lines on stdout and displayed by Albion Lab.
Windows toast notifications are redirected to the engine log.

Rebuild on Windows using Go and scripts/build-market-engine.ps1. The packet
capture driver Npcap remains a separate system prerequisite, not redistributed.
The upstream license is retained in LICENSE.

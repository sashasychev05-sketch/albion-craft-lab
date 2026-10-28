// Albion Lab headless entry point for ao-data/albiondata-client 0.1.61.
// Built as a named file, excluding the upstream desktop/tray/updater main.
package main

import (
 "encoding/json"
 "fmt"
 "net/url"
 "os"
 "time"
 "github.com/ao-data/albiondata-client/client"
 "github.com/ao-data/albiondata-client/internal/dashboard"
)

func main() {
 client.ConfigGlobal.SetupFlags()
 target, err := url.Parse(client.ConfigGlobal.PublicIngestBaseUrls)
 if err != nil || target.Scheme != "http" || target.Hostname() != "127.0.0.1" || target.Port() == "" || target.User != nil {
  fmt.Fprintln(os.Stderr, "LOCAL_TARGET_REQUIRED")
  os.Exit(2)
 }
 client.ConfigGlobal.PrivateIngestBaseUrls = ""
 client.ConfigGlobal.EnableWebsockets = false
 client.ConfigGlobal.Offline = false
 go func() {
  encoder := json.NewEncoder(os.Stdout)
  for {
   state := dashboard.GetStatus()
   encoder.Encode(map[string]interface{}{"capture":state.CaptureRunning,"error":state.CaptureError,"server":state.ServerID,"encryption":state.EncryptionStatus})
   time.Sleep(time.Second)
  }
 }()
 if err := client.NewClient("0.1.61-albion-lab").Run(); err != nil {
  fmt.Fprintln(os.Stderr, "CAPTURE_FAILED")
  os.Exit(1)
 }
}

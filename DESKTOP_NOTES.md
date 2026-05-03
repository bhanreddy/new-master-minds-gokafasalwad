# Desktop Build — Known Limitations

## Slate School Kosgi — Tauri Desktop App

This document lists known limitations of the desktop build compared to the mobile (Android/iOS) and web versions.

---

### 1. FCM Push Notifications — Disabled

Firebase Cloud Messaging (FCM) does **not** work inside the Tauri webview. The `tauri://` protocol prevents the FCM service worker from registering. Push notifications will **fail silently** — no errors thrown, but no notifications delivered.

**Workaround:** None currently. Desktop users should rely on in-app polling for updates. A native notification system via Tauri plugins may be implemented in a future release.

---

### 2. File Downloads — Browser Default Location

File downloads (e.g., report PDFs, fee receipts) use the **browser's default download behavior** inside the webview. There is no native "Save As" dialog.

Downloaded files go to the system's default Downloads folder.

**Workaround:** None currently. A Tauri file dialog plugin (`@tauri-apps/plugin-dialog`) can be added in a future release to provide native Save As functionality.

---

### 3. No Auto-Update Mechanism

The desktop app does **not** auto-update. Users must manually download and install new versions.

**Planned:** Tauri's built-in updater (`@tauri-apps/plugin-updater`) will be configured in a follow-up task once a release distribution channel (GitHub Releases or custom server) is established.

---

### 4. Windows Build — Not Yet Available

The current build targets **macOS only** (`.app` and `.dmg`). Windows `.exe` and `.msi` builds will be produced via GitHub Actions CI in a follow-up task.

**Next step:** Set up a GitHub Actions workflow with `windows-latest` runner to cross-compile for Windows.

---

### 5. Platform-Specific Considerations

| Feature | Mobile | Desktop (Tauri) |
|---------|--------|-----------------|
| Push Notifications (FCM) | ✅ Works | ❌ Disabled |
| File Downloads | Native Share/Save | Default Downloads folder |
| Auto-Update | OTA via Expo Updates | ❌ Not implemented |
| Biometric Auth | ✅ Fingerprint/Face | ❌ Not available |
| Camera/Gallery | ✅ Native | ❌ Not available |
| GPS Location | ✅ Native | ⚠️ Browser geolocation only |

---

## Next Steps

1. **Windows build via GitHub Actions** — `.exe` + `.msi` installer
2. **Tauri updater plugin** — Auto-update from GitHub Releases
3. **Native file dialog** — Save As for downloads
4. **Tray icon** — System tray with quick actions
5. **Deep linking** — `schoolims://` protocol handler for desktop

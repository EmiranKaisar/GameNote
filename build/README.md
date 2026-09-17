# Platform builds

This directory holds local Game Note build output. Generated applications and installers are ignored by Git; these README files are retained only to document the expected folders and commands.

| Folder | Contents | Build command | Required host |
| --- | --- | --- | --- |
| `macos/` | `.app` package and macOS release artifacts | `npm run build:mac` | macOS |
| `macos-dmg/` | macOS disk image for distribution | `npm run build:mac:dmg` | macOS |
| `windows/` | `.msi` and/or `.exe` installers | `npm run build:windows` | Windows |
| `android/` | `.apk` and/or `.aab` packages | `npm run build:android` | macOS, Windows, or Linux |
| `ios/` | iOS packages produced by the configured Xcode build | `npm run build:ios` | macOS |

Run commands from the `app/` directory after `npm ci`. Mobile projects also require the one-time initialization described in [`../BUILDING.md`](../BUILDING.md).

The build scripts replace the selected platform's collected output with the newest successful build. Upload finished desktop packages to a versioned GitHub Release rather than committing them. Android and iOS releases should go through their appropriate store or signed distribution workflow. Signing and notarization requirements still apply.


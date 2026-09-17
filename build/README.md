# Platform builds

This directory separates distributable Game Note packages from local compiler output.

| Folder | Contents | Build command | Required host |
| --- | --- | --- | --- |
| `macos/` | `.app` package and macOS release artifacts | `npm run build:mac` | macOS |
| `windows/` | `.msi` and/or `.exe` installers | `npm run build:windows` | Windows |
| `android/` | `.apk` and/or `.aab` packages | `npm run build:android` | macOS, Windows, or Linux |
| `ios/` | iOS packages produced by the configured Xcode build | `npm run build:ios` | macOS |

Run commands from the `app/` directory after `npm ci`. Mobile projects also require the one-time initialization described in [`../BUILDING.md`](../BUILDING.md).

The build scripts replace the selected platform's collected output with the newest successful build. Commit a package only when it is intended for distribution. Signing and notarization requirements still apply.

## Why `cargo/` is not tracked

`cargo/` is the Rust compiler target directory selected by `app/scripts/build-platform.mjs`. It contains downloaded dependency builds, intermediate object files, incremental compilation data, and temporary Tauri bundle output. It makes repeated local builds faster but is not a distributable Game Note package, can grow to several gigabytes, and is machine-specific. It remains ignored by Git and can be deleted safely when no build is running; Cargo recreates it during the next build.

# Building Game Note

Every command is run from the `app/` directory. Generated installers and application bundles are collected in the tracked platform folders below `build/`, where release packages may be committed for download. Intermediate Rust compilation output is written to the ignored `build/cargo/` directory.

## Common one-time setup

Install Node.js 22.13 or newer, npm, and the Rust stable toolchain. Then install JavaScript dependencies:

```sh
cd app
npm ci
```

To install Rust on a new build machine, follow [rustup.rs](https://rustup.rs/). Restart the terminal after installation.

## Company information

Before making a distribution build, update [`app/company-info.json`](./app/company-info.json). Every platform build validates its company name, legal name, support email, and license, then includes them in the app interface, native resources, and supported package metadata.

## macOS

Build macOS on a Mac with Apple Command Line Tools or Xcode installed:

```sh
xcode-select --install
cd app
npm run build:mac
```

Output: `build/macos/Game Note.app`

Optional commands:

```sh
# A drag-to-install disk image; requires the full macOS DMG tooling
npm run build:mac:dmg

# One app that supports both Apple Silicon and Intel Macs
npm run build:mac:universal
```

Unsigned local builds can be opened directly on the build Mac. Public distribution requires Apple Developer signing and notarization.

## Windows

Windows packages must be produced on Windows. Install Node.js, Rust with the MSVC toolchain, Microsoft C++ Build Tools, and WebView2, then run:

```powershell
cd app
npm ci
npm run build:windows
```

Output: `build/windows/` with MSI and NSIS installer artifacts. Public distribution should use a code-signing certificate.

## Android

Install Android Studio, its Android SDK and NDK, a supported JDK, Node.js, and Rust. Initialize the generated Android project once per checkout:

```sh
cd app
npm ci
npm run mobile:init:android
```

After that, every updated build is:

```sh
npm run build:android
```

Output: `build/android/` with APK or AAB artifacts. A store release requires an Android signing key and release configuration.

## iOS

iOS builds require a Mac with the full Xcode installation, Xcode command-line tools, CocoaPods, Node.js, and Rust. Initialize the generated Xcode project once per checkout:

```sh
cd app
npm ci
npm run mobile:init:ios
```

After that, every updated build is:

```sh
npm run build:ios
```

Output: `build/ios/` with the collected iOS package. Device and App Store builds require an Apple Developer team, signing identity, and provisioning profile.

## Command summary

| Target | Command | Required host | Collected output |
| --- | --- | --- | --- |
| macOS app | `npm run build:mac` | macOS | `build/macos/` |
| macOS DMG | `npm run build:mac:dmg` | macOS | `build/macos-dmg/` |
| Universal macOS app | `npm run build:mac:universal` | macOS | `build/macos-universal/` |
| Windows installers | `npm run build:windows` | Windows | `build/windows/` |
| Android package | `npm run build:android` | macOS, Windows, or Linux | `build/android/` |
| iOS package | `npm run build:ios` | macOS | `build/ios/` |

Cross-compiling a signed Windows or iOS release from macOS is not supported by this workflow; run the command on the required host or in a CI runner for that operating system.

## Packaged legal documents

Every native build includes the repository's `LICENSE`, `PRIVACY.md`, and `THIRD_PARTY_NOTICES.md`, together with `app/company-info.json`. Review the privacy policy and regenerate the third-party notice before a public release whenever data practices or dependencies change.

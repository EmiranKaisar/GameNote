# Game Note

Game Note is a lightweight native match-video review app for coaches, athletes, analysts, and referees. It opens local footage and attaches timestamped notes and freehand drawings without modifying the source video.

The interface is React/Vite and the native shell is Tauri 2. It targets macOS, Windows, iOS, and Android while continuing to support a browser-only development build.

## Features

- Open locally stored MP4, MOV, M4V, WebM, MKV, and AVI files when the operating system supports their codecs.
- Play, pause, seek, adjust volume, and enter fullscreen.
- Add text notes and drawings at precise timestamps.
- Choose pen colors and undo or redo strokes with `Ctrl+Z` / `Cmd+Z`.
- See annotation markers on the timeline and jump between annotated moments.
- Edit, delete, and restore annotations.
- Save a `.matchproject` folder containing the source video, manifest, and annotation data.
- Reopen project folders created by Game Note.

## Run as a native app during development

```sh
cd app
npm ci
npm run dev
```

`npm run dev` starts Vite automatically and opens Game Note in its own native window. You do not need to open a browser. Stop it with `Ctrl+C` in the terminal.

For the browser-only frontend, use `npm run dev:web` and open [http://127.0.0.1:1420](http://127.0.0.1:1420).

## Build for each platform

Install Node.js 22.13 or newer, npm, and the stable Rust toolchain first. From a fresh checkout, install the JavaScript dependencies once:

```sh
cd app
npm ci
```

Each platform build validates `company-info.json`, builds the Vite frontend, compiles the Tauri/Rust native shell, packages the application, and collects the result under the repository-level `build/<platform>/` folder. The complete `build/` folder is excluded by `.gitignore`.

### macOS

Build macOS packages on a Mac. Install the Xcode command-line tools first with `xcode-select --install`, then run:

```sh
cd app
npm ci
npm run build:mac
```

The application is written to `build/macos/Game Note.app`. Optional packaging commands are:

```sh
npm run build:mac:dmg       # DMG installer
npm run build:mac:universal # Intel + Apple Silicon universal app
```

### Windows

Build Windows packages on Windows. Install Node.js, Rust with the MSVC toolchain, Microsoft C++ Build Tools, and WebView2, then run in PowerShell or Command Prompt:

```powershell
cd app
npm ci
npm run build:windows
```

The generated MSI and/or NSIS installer is collected in `build/windows/`. Production distribution normally also requires a Windows code-signing certificate.

### Android

Install Android Studio, the Android SDK and NDK, a supported JDK, Node.js, and Rust. Initialize the Android project once per fresh checkout:

```sh
cd app
npm ci
npm run mobile:init:android
```

After initialization, use this command for every development update:

```sh
cd app
npm run build:android
```

APK and/or AAB artifacts are collected in `build/android/`. A release uploaded to an app store must be signed with your Android release key.

### iOS

Build iOS packages on a Mac with full Xcode, CocoaPods, Node.js, and Rust installed. Initialize the iOS project once per fresh checkout:

```sh
cd app
npm ci
npm run mobile:init:ios
```

After initialization, use this command for every development update:

```sh
cd app
npm run build:ios
```

The iOS artifacts are collected in `build/ios/`. Installing on devices or distributing through TestFlight/App Store requires an Apple Developer account and valid signing configuration.

| Target | Repeat-build command | Build host | Output |
| --- | --- | --- | --- |
| macOS | `npm run build:mac` | macOS | `build/macos/` |
| Windows | `npm run build:windows` | Windows | `build/windows/` |
| Android | `npm run build:android` | macOS, Windows, or Linux | `build/android/` |
| iOS | `npm run build:ios` | macOS | `build/ios/` |

Native desktop builds are not generally cross-compiled: run the macOS command on macOS and the Windows command on Windows. See [BUILDING.md](./BUILDING.md) for detailed SDK setup, signing, troubleshooting, and optional packaging commands.

## Company information

Edit [`app/company-info.json`](./app/company-info.json) before distributing Game Note. It is the single template for the company name, legal entity, copyright, website, support contact, privacy policy, terms, license, address, and trademark notice.

Every `npm run build:*` command validates this file. Its values appear in the in-app **About** dialog, are compiled into the web interface, are copied into native application resources, and populate supported installer/package metadata such as publisher, homepage, copyright, and license. Keep every field in the file; use an empty string only for the optional `address` and `trademarkNotice` fields.

## Quality checks

```sh
cd app
npm run typecheck
npm run lint
npm test
npm run build:web
```

## Project structure

```text
.
├── app/
│   ├── components/       React application UI
│   ├── company-info.json Company information build template
│   ├── lib/              Browser and native project bridges
│   ├── scripts/          Cross-platform packaging scripts
│   ├── src/              Vite entry point
│   └── src-tauri/        Native Rust shell and file operations
├── build/                Generated packages and caches (ignored)
├── BUILDING.md           Platform build guide
├── CONTEXT.md            Shared product terminology
├── PRODUCT_DESIGN.md     Product behavior and acceptance criteria
└── README.md
```

## Platform note

Video decoding is provided by each operating system WebView. H.264 video with AAC audio in MP4 or MOV is the safest compatibility baseline. A filename extension does not guarantee that the installed OS can decode the file’s internal codec.

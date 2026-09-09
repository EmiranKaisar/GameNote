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

## Build the macOS app

```sh
cd app
npm run build:mac
```

Open `build/macos/Game Note.app` after the command finishes. All generated packages and Rust build caches stay under the repository-level `build/` folder, which is excluded by `.gitignore`.

See [BUILDING.md](./BUILDING.md) for every platform command and one-time SDK setup.

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

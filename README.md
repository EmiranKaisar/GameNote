# Touchline

Touchline is a lightweight match-video review app for coaches, athletes, analysts, and referees. It opens local footage and attaches timestamped notes and freehand drawings without modifying the source video.

The application is an installable Progressive Web App that runs on macOS, Windows, iOS, and Android.

## Features

- Open locally stored match videos.
- Play, pause, seek, adjust volume, and enter fullscreen.
- Add text notes at precise media timestamps.
- Draw over the video with multiple pen colors.
- Undo and redo drawing strokes.
- Jump to annotations from the timeline or annotation list.
- Edit, delete, and restore annotations.
- Save portable projects containing the video and annotation data.
- Reopen project folders or portable `.matchproject` files.
- Work offline after the application shell has been cached.

## Requirements

- Node.js 22.13 or newer.
- npm 11 or newer.
- A modern browser. Chromium-based browsers provide the fullest project-folder support.

## Run locally

```sh
cd app
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) unless the development server prints a different address. Select **Open video** to begin reviewing footage.

## Core workflow

1. Open a supported local video.
2. Pause or seek to an important moment.
3. Select **Add note**, enter text, or activate the pen and draw over the video.
4. Select **Done** to add the annotation marker to the timeline.
5. Select **Save** to create a `.matchproject` folder in browsers with the File System Access API. Other browsers download one portable `.matchproject` file containing the same video and annotation data.
6. Reopen a saved folder with **Open folder**, or a portable file with **Open file**.

## Available commands

```sh
cd app

# Start the development server
npm run dev

# Run project-format tests
npm test

# Check application source
npm run lint

# Create a production build
npm run build
```

## Platform notes

Video decoding depends on the browser and operating system. H.264 video with AAC audio in an MP4 or MOV container is the guaranteed compatibility baseline. Other formats such as MKV, AVI, and WebM work when the device browser supports their codecs.

Chromium-based desktop browsers can create and reopen `.matchproject` folders through the File System Access API. Browsers without that API download a single portable `.matchproject` file instead. Project data and source videos remain local to the user's device.

## Project structure

```text
.
├── app/                 Application source and tests
├── CONTEXT.md           Shared product terminology
├── PRODUCT_DESIGN.md    Product behavior and acceptance criteria
└── README.md            Setup and usage guide
```

## Documentation

- [Product design](./PRODUCT_DESIGN.md)
- [Domain context](./CONTEXT.md)

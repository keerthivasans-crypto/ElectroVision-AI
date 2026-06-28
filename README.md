# ⚡ ElectroVision AI

Real-time electronic component identification in the browser, using your webcam, TensorFlow.js, and a local-first architecture (IndexedDB + localStorage — nothing leaves your device).

---

## 🚀 Quick Start

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

No build step, no API keys, no backend database — it's a static frontend served by a tiny Express server.

### Deploy to Vercel

```bash
npm i -g vercel
vercel
```

`vercel.json` is already configured to route everything through `server.js`. You can also deploy as a 100% static site (just upload the `/public` folder to any static host) since there's no real backend logic beyond serving files.

### Deploy to GitHub Pages / Netlify / any static host

Just serve the `/public` directory — `server.js`/`package.json` are only needed if you want the Express/Node path (e.g. for Vercel's Node runtime). Everything in `/public` is plain HTML/CSS/JS and works standalone.

---

## 🔍 What Actually Works (read this before you judge accuracy)

This is built to be **honest software**, not a demo that looks impressive and then fails in real use. Here's exactly what's real:

| Feature | Status | Notes |
|---|---|---|
| Webcam start/pause/stop/capture/upload, mirror, fullscreen, resolution selector, FPS counter | ✅ Fully working | Standard `getUserMedia` + Canvas |
| Live bounding-box object detection | ✅ Real, but generic | Uses TensorFlow.js **COCO-SSD**, which only knows 80 everyday object classes (bottle, book, cell phone, etc.) — it was **never trained on electronic components**, so it cannot reliably distinguish a resistor from a capacitor by image alone. We map any COCO label that happens to match a component name/alias in our database, and fall back to "Unknown Component" otherwise. |
| Resistor color-band reader | ✅ Real & functional | Genuinely samples pixel colors from the captured frame, segments them, and decodes them using the standard resistor color code table. Works best in good lighting with the resistor body filling much of the frame — like any computer-vision color reader, it's sensitive to lighting/glare/angle. |
| Component info panel (100+ parts) | ✅ Real | Full dataset in `/public/data/components.json` — name, category, working principle, applications, pin config, ratings, advantages/disadvantages, datasheet links. |
| Text-to-speech announcements (English/Tamil/Hindi) | ✅ Real | Uses the browser's `SpeechSynthesis` API. Voice availability/quality for Tamil/Hindi depends on the OS/browser's installed voices. |
| Voice search | ✅ Real | Uses `SpeechRecognition` (Chrome-based browsers only; not supported in Firefox/Safari). |
| Search + autocomplete + recent/popular | ✅ Real | Searches the local component database. |
| History (IndexedDB), export, delete, filter | ✅ Real | Every detection is saved locally with a thumbnail, never uploaded anywhere. |
| Training system (capture unknown + label) | ✅ Real, with an honest limit | Saves images + labels into IndexedDB and lets you export them as `dataset.json`. **It does not retrain a live model in the browser** — that's not realistically possible for image classification with no backend/GPU training pipeline. Use the export as a seed dataset to train a real TF.js model offline (e.g. with Teachable Machine or a Python pipeline), then drop the resulting model into `/public/models/custom/` and set `CUSTOM_MODEL_URL` in `js/ai.js`. |
| Dark/Light mode, glassmorphism UI, animated hero (Three.js particles/traces) | ✅ Real | |
| PWA / offline app shell caching | ✅ Real | `service-worker.js` caches the app shell and component data; cross-origin CDN scripts/models are not cached. |
| Settings (camera, voice, theme, detection speed) | ✅ Real | Persisted to `localStorage`. |

### Want true component recognition?

Plug in a custom-trained model:
1. Use the Training System to collect labeled images (or your own folder structure).
2. Train a classifier offline — the fastest path is [Google's Teachable Machine](https://teachablemachine.withgoogle.com/) (export as TensorFlow.js), or a custom Python/TensorFlow pipeline converted with `tensorflowjs_converter`.
3. Drop the exported model files into `/public/models/custom/`.
4. In `public/js/ai.js`, set `CUSTOM_MODEL_URL = '/models/custom/model.json'` and wire its output classes to `components.json` IDs in `mapDetectionToComponent`.

---

## 📁 Project Structure

```
electrovision-ai/
├── server.js              # Express static server
├── package.json
├── vercel.json
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── script.js      # App bootstrap & UI wiring
│   │   ├── camera.js       # Webcam controls + detection loop
│   │   ├── ai.js            # COCO-SSD wrapper + resistor color-band decoder
│   │   ├── voice.js        # TTS + voice search
│   │   ├── history.js      # IndexedDB-backed detection history
│   │   ├── database.js    # IndexedDB wrapper + component dataset loader
│   │   ├── search.js       # Search/autocomplete UI helpers
│   │   └── settings.js    # Settings persistence (localStorage)
│   ├── data/
│   │   ├── components.json # 100+ component knowledge base
│   │   └── dataset.json    # Training data export seed
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── README.md
```

---

## 🛠 Tech Stack

- **Frontend:** HTML5, CSS3 (glassmorphism), vanilla ES6 JS, Three.js (hero background)
- **AI:** TensorFlow.js + COCO-SSD (generic object detection), custom pixel-analysis for resistor color bands
- **Storage:** IndexedDB (history, training samples), localStorage (settings, recent searches)
- **Backend:** Node.js + Express (static file serving only — no server-side AI)
- **PWA:** Web App Manifest + Service Worker (offline app shell)

## 🔒 Privacy

Everything runs client-side. No images, detections, or history are ever sent to a server. Clearing your browser data or using "Clear All Local Data" in Settings removes everything.

## 📄 License

MIT — use it, fork it, extend it.

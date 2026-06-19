# potopda

A minimal, self-hosted vault for your **images**, **videos**, and **files** —
everything is uploaded straight into MongoDB (via GridFS) and organized into
three clean sections. Light and dark themes, fully responsive, no build step.

## Stack

- **Backend:** Node.js + Express
- **Database:** MongoDB, using **GridFS** so file bytes and metadata both live
  inside MongoDB itself (no local upload folder to manage or lose)
- **Frontend:** Plain HTML, CSS and vanilla JavaScript — served as static
  files by Express, no React/build tooling required

## Project structure

```
potopda/
├── server.js              # app entry point
├── config/
│   └── db.js               # Mongo connection + GridFS bucket
├── middleware/
│   └── multer.js            # in-memory upload handling
├── routes/
│   └── files.js             # upload / list / stream / download / delete
├── utils/
│   └── category.js          # mimetype -> images | videos | files
├── public/                  # the entire frontend
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── .env.example
├── package.json
└── README.md
```

## 1. Prerequisites

- [Node.js](https://nodejs.org) 18 or newer
- A MongoDB database — either:
  - **Local:** [install MongoDB Community Server](https://www.mongodb.com/try/download/community) and run it (`mongod`)
  - **Cloud:** a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (recommended if you don't want to install anything)

## 2. Setup

```bash
# from inside the potopda/ folder
npm install
cp .env.example .env
```

Open `.env` and set your connection string:

```
MONGODB_URI=mongodb://localhost:27017/potopda
PORT=5000
MAX_FILE_SIZE_MB=200
```

If you're using Atlas, it'll look more like:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/potopda
```

## 3. Run it

```bash
npm start
```

or, for auto-restart on file changes during development:

```bash
npm run dev
```

Then open **http://localhost:5000** — that's it. Everything (frontend +
API) is served from the same Express app, so there's no separate frontend
server or CORS setup to worry about.

## How it works

- Every upload is routed through `multer` in memory, then streamed into a
  MongoDB **GridFS bucket** named `uploads`. GridFS automatically splits
  large files into chunks, so videos and large files are stored reliably.
- Each file's `mimetype` decides which of the three sections it lands in:
  `image/*` → **Images**, `video/*` → **Videos**, everything else → **Files**.
  This is stored in GridFS's own `metadata.category` field — no extra
  collection needed.
- Video streaming supports HTTP range requests, so the native `<video>`
  player can seek properly instead of re-downloading the whole file.

## API reference

| Method | Route                  | Description                                   |
|--------|-------------------------|------------------------------------------------|
| POST   | `/api/upload`           | Upload a file (multipart field name: `file`)   |
| GET    | `/api/files/:category`  | List files — `:category` is `images`, `videos`, `files`, or `all` |
| GET    | `/api/stream/:id`       | Stream a file inline (range-aware)             |
| GET    | `/api/download/:id`     | Download a file as an attachment               |
| DELETE | `/api/files/:id`        | Delete a file and its chunks                   |

## Customizing

- **Accent color / theme:** edit the CSS variables at the top of
  `public/css/styles.css` (`:root` for light, `[data-theme='dark']` for dark).
- **Max upload size:** change `MAX_FILE_SIZE_MB` in `.env`.
- **Fonts:** swap the Google Fonts `<link>` in `index.html` and the
  `--font-display` / `--font-body` / `--font-mono` variables in the CSS.

## Possible next steps

- Generate real video thumbnails (would need `ffmpeg` on the server)
- Folders/tags, search, or multi-user accounts with authentication
- Pagination for very large libraries (currently all files in a category load at once)

---

potopda &copy; ishu

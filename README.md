# potopda

A minimal, self-hosted vault for your **images** and **files**. Binary data
lives on **Cloudinary**, compressed on the way in with **Sharp** — MongoDB
only ever holds lightweight metadata (filenames, URLs, users, comments,
reactions). Light and dark themes, fully responsive, no build step.

## Why it's built this way

The original version pushed every file straight into MongoDB via GridFS.
That works, but on a free-tier database (e.g. Atlas's 512MB cluster) it
fills up fast — a handful of photos can eat the entire quota. This version
fixes that:

- **File bytes never touch MongoDB.** They go to Cloudinary instead, whose
  free tier gives you 25GB of storage and bandwidth — purpose-built for
  exactly this.
- **Images are compressed before upload**, so even Cloudinary's free tier
  goes a lot further.
- **MongoDB only stores metadata** — a `File` document is typically well
  under 1KB, so you could store tens of thousands of them before coming
  anywhere near 512MB.
- **Video support has been removed.** Video files are large and this app
  was never optimized to handle that volume of data on free infrastructure.

## Stack

- **Backend:** Node.js + Express
- **File storage:** [Cloudinary](https://cloudinary.com) (images and documents)
- **Image compression:** [Sharp](https://sharp.pixelplumbing.com), applied
  before upload
- **Database:** MongoDB — metadata only (users, file records, comments,
  reactions)
- **Frontend:** Plain HTML, CSS and vanilla JavaScript — served as static
  files by Express, no React/build tooling required

## Project structure

```
potopda/
├── server.js                  # app entry point
├── config/
│   ├── db.js                   # Mongo connection
│   └── cloudinary.js           # Cloudinary config + upload/delete helpers
├── middleware/
│   ├── multer.js                # in-memory upload handling, 500KB cap
│   └── auth.js                  # JWT auth middleware
├── routes/
│   ├── files.js                 # upload / list / download / delete / reactions / comments
│   └── auth.js                  # signup / login / logout / me / avatar
├── models/
│   ├── User.js                   # includes avatarUrl / avatarPublicId
│   ├── File.js                   # metadata only — url + cloudinaryId point at the real bytes
│   ├── Comment.js
│   └── Reaction.js
├── utils/
│   ├── category.js               # mimetype -> images | files, + video rejection
│   └── imageCompress.js          # Sharp presets: profile photo (50%) vs post image (75%)
├── public/                      # the entire frontend
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
  - **Cloud:** a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (recommended)
- A free [Cloudinary](https://cloudinary.com/users/register/free) account —
  after signing up, your **Cloud name**, **API Key**, and **API Secret** are
  on your Dashboard's "Product Environment Credentials" panel.
  - ⚠️ **Important:** new free Cloudinary accounts block public delivery of
    PDFs and archive files (ZIP/RAR) by default, to prevent abuse. The
    "Files" tab in this app uploads exactly that kind of file. To make
    those downloadable, go to **Settings → Security → "PDF and ZIP files
    delivery"** in the Cloudinary console and enable **"Allow delivery of
    PDF and ZIP files."** Without this, uploads will succeed but the
    download link will fail with an error. Images aren't affected by this
    restriction.

## 2. Setup

```bash
# from inside the potopda/ folder
npm install
cp .env.example .env
```

Open `.env` and fill in:

```
MONGODB_URI=mongodb://localhost:27017/potopda
PORT=5000
MAX_UPLOAD_SIZE_KB=500
JWT_SECRET=some-long-random-string

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## 3. Run it

```bash
npm start
```

or, for auto-restart on file changes during development:

```bash
npm run dev
```

Then open **http://localhost:5000**.

## How it works

- Every upload is routed through `multer` in memory. Raw uploads are capped
  at `MAX_RAW_UPLOAD_MB` (15MB by default) — generous on purpose, since a
  normal phone photo is several MB before compression. **Images are never
  pre-checked against the 500KB target** — they're simply compressed down
  to it. **Documents** (which can't be compressed) are rejected up front if
  they're over `MAX_UPLOAD_SIZE_KB` (500KB by default), with a clear error
  explaining why. Videos are rejected outright with a clear error message.
- **Images are compressed twice:** first in the browser (Canvas API, before
  the upload request is even sent — smaller upload, faster on slow
  connections), then again on the server with Sharp as the authoritative
  pass. If browser-side compression fails for any reason (old browser,
  unusual file), the original is just sent as-is and the server handles it.
- **Images** are re-compressed with Sharp before upload:
  - **Profile photos** are resized to a 500×500 square and compressed
    starting at **50% quality** — they're only ever shown as a small
    avatar, so the extra compression isn't noticeable.
  - **Post images** (the "Images" tab) are resized to a max of 1600px and
    compressed starting at **75% quality** — they're the actual content
    people are viewing, so more quality is kept.
  - If the first compression pass is still over the `MAX_UPLOAD_SIZE_KB`
    target (rare — only very busy/detailed images), quality is stepped
    down automatically and retried until it fits or hits a floor. The
    person uploading never sees an error for this — it's silent, the same
    way it would feel uploading a normal photo anywhere else.
- **Documents** (anything not an image) are uploaded to Cloudinary as-is,
  under `resource_type: raw`, with no compression applied.
- The compressed/raw buffer is streamed straight to Cloudinary — nothing
  is written to local disk on the server, and nothing is written into
  MongoDB except a small metadata record afterward (filename, size,
  Cloudinary URL, Cloudinary public ID, uploader, category).
- Deleting a file removes both the Cloudinary asset and its metadata
  record.
- Downloads redirect (302) to a Cloudinary URL that forces a download with
  the original filename — bytes are served by Cloudinary's CDN, not
  proxied through this server.

## Accounts, profile photos, likes/dislikes & comments

- **Sign up / log in** from the header (top right). Sessions are stored in an httpOnly cookie (JWT), valid 30 days.
- Click your avatar in the header to upload or replace your **profile photo**.
- Every upload is tied to the account that uploaded it.
- Anyone logged in can **like or dislike** any file, and **comment** on it (click a card to open the detail view).
- **Delete rules:** a regular user can only delete their *own* uploads/comments. The fixed **admin** account can delete *anything*.
- A built-in admin account is created automatically the first time the server starts:
  - username: `ishu025dec2008`
  - password: `1234567890ishu2008@dec25`

| Method | Route                       | Description                          |
|--------|------------------------------|---------------------------------------|
| POST   | `/api/auth/signup`           | Create an account                     |
| POST   | `/api/auth/login`             | Log in                                |
| POST   | `/api/auth/logout`            | Log out                               |
| GET    | `/api/auth/me`                | Current logged-in user (or null)      |
| POST   | `/api/auth/avatar`            | Upload/replace profile photo (field: `avatar`) — 50% compression |
| DELETE | `/api/auth/avatar`            | Remove profile photo                  |
| POST   | `/api/files/:id/react`        | `{ type: 'like' \| 'dislike' }`       |
| GET    | `/api/files/:id/comments`     | List comments on a file               |
| POST   | `/api/files/:id/comments`     | `{ text }` — add a comment            |
| DELETE | `/api/comments/:id`           | Delete own comment, or any if admin   |

## API reference

| Method | Route                  | Description                                   |
|--------|-------------------------|------------------------------------------------|
| POST   | `/api/upload`           | Upload a file (multipart field name: `file`). Max 500KB; images compressed at 75% quality. |
| GET    | `/api/files/:category`  | List files — `:category` is `images`, `files`, or `all` |
| GET    | `/api/download/:id`     | Redirects to a Cloudinary URL that downloads the file as an attachment |
| DELETE | `/api/files/:id`        | Delete a file from Cloudinary and its metadata |

Image and file list responses now include a direct `url` field (the
Cloudinary `secure_url`) — the frontend uses it straight in `<img src>` and
download links, instead of proxying bytes through this server.

## Customizing

- **Accent color / theme:** edit the CSS variables at the top of
  `public/css/styles.css` (`:root` for light, `[data-theme='dark']` for dark).
- **Max upload size:** `MAX_UPLOAD_SIZE_KB` in `.env` is the compression
  target for images and the hard cap for documents. `MAX_RAW_UPLOAD_MB` is
  the raw ceiling before compression — raise it if you expect very large
  source photos.
- **Compression quality:** edit `PROFILE_PHOTO_QUALITY` / `POST_IMAGE_QUALITY`
  and the resize dimensions in `utils/imageCompress.js`.
- **Fonts:** swap the Google Fonts `<link>` in `index.html` and the
  `--font-display` / `--font-body` / `--font-mono` variables in the CSS.

## Possible next steps

- Folders/tags, search, or multi-user accounts with roles beyond admin/user
- Pagination for very large libraries (currently all files in a category load at once)
- A scheduled job to reconcile orphaned Cloudinary assets if a delete ever
  partially fails

---

potopda &copy; ishu

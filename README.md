# VideoSense — Video Upload, Sensitivity Processing & Streaming

A full-stack application for uploading videos, analyzing them for sensitive content, and streaming them with real-time progress updates.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     Frontend (Vite + React)          │
│  Login/Register → Dashboard → Library → Video Detail │
│        Socket.io client (real-time progress)         │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼──────────────────────────────┐
│                 Backend (Express + Node.js)           │
│  REST API  │  Socket.io  │  JWT Auth  │  RBAC        │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
    ┌─────▼──┐   ┌─────▼──┐  ┌─────▼──┐
    │MongoDB │   │ Uploads │  │FFmpeg  │
    │(meta)  │   │ (disk)  │  │(probe) │
    └────────┘   └─────────┘  └────────┘
```

### Processing Pipeline

```
Upload → Validate → Store (temp) → FFprobe metadata
      → Move to processed/ → Sensitivity Analysis
      → Mark safe/flagged → Emit Socket.io events
```

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 18, Vite, Tailwind CSS, Socket.io client  |
| Backend   | Node.js, Express 4, Socket.io                   |
| Database  | MongoDB with Mongoose ODM                        |
| Auth      | JWT (jsonwebtoken) + bcryptjs                   |
| Upload    | Multer (disk storage, UUID filenames)           |
| Video     | fluent-ffmpeg + ffmpeg-static + ffprobe-static  |
| Real-time | Socket.io (room-based per-video progress)        |
| Streaming | HTTP Range Requests (206 Partial Content)        |

---

## Setup & Installation

### Prerequisites

- Node.js 18+ (LTS)
- MongoDB (local or Atlas)
- Git

### 1. Clone & Install

```bash
git clone <repo-url>
cd test-assignement

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment

**Backend** — edit `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/videosense
JWT_SECRET=your-256-bit-secret-here-change-this
JWT_EXPIRES_IN=7d
UPLOAD_TEMP_DIR=uploads/temp
UPLOAD_PROCESSED_DIR=uploads/processed
MAX_FILE_SIZE_MB=500
FLAGGED_PROBABILITY=0.3      # 30% chance video gets flagged
PROCESSING_DELAY_MS=500      # delay between pipeline steps (ms)
CORS_ORIGIN=http://localhost:5173
```

**Frontend** — `frontend/.env` (optional, proxied in dev):
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Start MongoDB

```bash
# macOS with Homebrew
brew services start mongodb-community

# Or with Docker
docker run -d -p 27017:27017 --name mongo mongo:latest
```

### 4. Run the Application

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# → Server running on port 5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → Frontend on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173)

---

## First-Time Setup

The **first user to register** is automatically assigned the `admin` role. Subsequent users register as `editor` by default (or `viewer` if selected).

**Recommended setup:**
1. Register → becomes admin
2. Register a second account → editor (can upload)
3. Register a third account → viewer (read-only)

---

## User Roles & Permissions

| Feature                          | Viewer | Editor | Admin |
|----------------------------------|--------|--------|-------|
| View own videos                  | ✓      | ✓      | ✓     |
| View all org videos              |        | ✓      | ✓     |
| Upload videos                    |        | ✓      | ✓     |
| Delete own videos                |        | ✓      | ✓     |
| Delete any video                 |        |        | ✓     |
| Access admin panel               |        |        | ✓     |
| Manage user roles                |        |        | ✓     |
| View system stats                |        |        | ✓     |

---

## API Documentation

### Auth Endpoints

| Method | Path                | Auth | Description              |
|--------|---------------------|------|--------------------------|
| POST   | `/api/auth/register`|      | Create account           |
| POST   | `/api/auth/login`   |      | Login, get JWT token     |
| GET    | `/api/auth/me`      | JWT  | Get current user         |

**Register body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "organization": "Acme Corp",
  "role": "editor"
}
```

**Login body:**
```json
{ "email": "john@example.com", "password": "secret123" }
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "_id": "...", "name": "...", "role": "editor", "organization": "..." }
}
```

---

### Video Endpoints

| Method | Path                        | Auth   | Role          | Description            |
|--------|-----------------------------|--------|---------------|------------------------|
| GET    | `/api/videos`               | JWT    | any           | List videos (filtered) |
| POST   | `/api/videos/upload`        | JWT    | editor, admin | Upload video           |
| GET    | `/api/videos/:id`           | JWT    | any           | Get video metadata     |
| GET    | `/api/videos/:id/stream`    | token  | any           | Stream video (range)   |
| GET    | `/api/videos/:id/stream-token` | JWT | any          | Get 60s stream token   |
| DELETE | `/api/videos/:id`           | JWT    | editor, admin | Delete video           |

**List videos query params:**
- `status`: `pending | processing | safe | flagged`
- `category`: `general | education | entertainment | news | sports | other`
- `sortBy`: `createdAt | title | size | status`
- `order`: `asc | desc`
- `page`, `limit`

**Upload (multipart/form-data):**
- `video`: video file (mp4, webm, mov, avi, mpeg — max 500MB)
- `title`: string (required)
- `category`: string (optional)

**Stream endpoint:** requires `?token=<stream-token>` (60-second signed JWT). Token is obtained from `/stream-token` endpoint. Supports HTTP Range requests for seeking.

---

### Admin Endpoints

| Method | Path                        | Auth   | Role  | Description        |
|--------|-----------------------------|--------|-------|--------------------|
| GET    | `/api/admin/users`          | JWT    | admin | List all users     |
| PATCH  | `/api/admin/users/:id/role` | JWT    | admin | Change user role   |
| DELETE | `/api/admin/users/:id`      | JWT    | admin | Delete user        |
| GET    | `/api/admin/stats`          | JWT    | admin | System statistics  |

---

## Socket.io Events

### Client → Server

| Event              | Payload         | Description                      |
|--------------------|-----------------|----------------------------------|
| `join_video_room`  | `videoId`       | Subscribe to a video's updates   |
| `leave_video_room` | `videoId`       | Unsubscribe from video updates   |

### Server → Client

| Event                | Payload                                          | Description               |
|----------------------|--------------------------------------------------|---------------------------|
| `processing_started` | `{ videoId, message }`                           | Pipeline started          |
| `progress`           | `{ videoId, progress (0-100), message }`         | Pipeline progress update  |
| `processing_complete`| `{ videoId, status, video }`                     | Pipeline finished         |
| `processing_error`   | `{ videoId, error }`                             | Pipeline failed           |

Socket.io connections are authenticated via JWT in the handshake `auth.token` field.

---

## Video Processing Pipeline

```
1. Upload validation (file type, size) ............... Multer middleware
2. Create Video doc in MongoDB ........................ status: pending
3. Move to temp storage ............................... UUID filename
4. FFprobe metadata extraction ........................ duration, resolution, codec
5. Move to processed storage .......................... uploads/processed/
6. Sensitivity analysis (simulated) .................. safe or flagged (30% flagged)
7. Update MongoDB with final status ................... processingProgress: 100
8. Socket.io events emitted throughout ................ real-time updates
```

The sensitivity analysis is simulated. Replace `backend/src/services/sensitivityAnalyzer.js` with a real ML API call (e.g., Google Video Intelligence, AWS Rekognition) for production use.

---

## Project Structure

```
test-assignement/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # MongoDB connection
│   │   │   └── socket.js          # Socket.io init + getIO() singleton
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT verification
│   │   │   ├── rbac.js            # Role-based access control
│   │   │   └── upload.js          # Multer configuration
│   │   ├── models/
│   │   │   ├── User.js            # User schema + bcrypt hooks
│   │   │   └── Video.js           # Video schema + indexes
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── video.js
│   │   │   └── admin.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── videoController.js
│   │   │   └── adminController.js
│   │   ├── services/
│   │   │   ├── videoProcessor.js   # Main pipeline orchestration
│   │   │   ├── sensitivityAnalyzer.js  # Simulated content analysis
│   │   │   └── streamingService.js     # HTTP range request streaming
│   │   └── utils/
│   │       ├── jwt.js             # Token helpers + stream tokens
│   │       └── fileUtils.js       # moveFile, deleteFile
│   ├── uploads/
│   │   ├── temp/                  # Incoming uploads (staging)
│   │   └── processed/             # Final video storage
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── context/
    │   │   ├── AuthContext.jsx    # JWT + user state, localStorage
    │   │   └── SocketContext.jsx  # Socket.io lifecycle tied to auth
    │   ├── services/
    │   │   ├── api.js             # Axios instance + all API calls
    │   │   └── socket.js          # Socket.io client factory
    │   ├── hooks/
    │   │   ├── useVideoProcessing.js  # Real-time processing state
    │   │   └── useVideoUpload.js      # Upload with progress
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── DashboardPage.jsx  # Upload + recent videos + stats
    │   │   ├── VideoLibraryPage.jsx  # Filterable grid
    │   │   ├── VideoDetailPage.jsx   # Player + metadata
    │   │   └── AdminPage.jsx         # User management
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   ├── VideoCard.jsx      # Card with live progress
    │   │   ├── VideoPlayer.jsx    # HTML5 + stream token
    │   │   ├── UploadArea.jsx     # Drag-drop + dual progress bars
    │   │   ├── StatusBadge.jsx
    │   │   └── ProgressBar.jsx
    │   ├── App.jsx                # React Router setup
    │   └── main.jsx               # Root with providers
    ├── vite.config.js             # Proxy: /api + /socket.io → :5000
    ├── tailwind.config.js
    └── package.json
```

---

## Design Decisions & Assumptions

1. **Stream token authentication:** The HTML5 `<video src>` cannot send Authorization headers. A short-lived (60s) signed JWT is issued via `/stream-token` and passed as a query param to the stream endpoint. This avoids exposing unauthenticated streaming.

2. **Async processing:** Upload returns `202 Accepted` immediately with the `videoId`. Processing runs fully async in the background. Clients subscribe via Socket.io using the videoId to receive live updates.

3. **First user = admin:** To bootstrap the system without a separate seeding step, the first registered user is automatically granted the admin role.

4. **Simulated sensitivity analysis:** The analyzer uses a configurable probability (`FLAGGED_PROBABILITY=0.3`) to randomly classify videos as safe or flagged. Swap `sensitivityAnalyzer.js` for a real API integration.

5. **Multi-tenant isolation:** Videos are scoped by `organization` field (set at registration). Non-admins only see videos within their organization. Viewers see only their own uploads.

6. **File naming:** Uploaded files are renamed to UUID-based names to prevent collisions and avoid exposing original filenames on disk.

7. **S3-ready architecture:** Storage paths are abstracted. Replace the local `moveFile` calls in `videoProcessor.js` with a `StorageService` implementation to switch to S3.

---

## Security Features

- JWT authentication on all protected routes
- Bcrypt password hashing (12 rounds)
- Multer file type and size validation
- Socket.io JWT verification on handshake
- Helmet.js security headers
- Rate limiting: 200 req/15min global, 20 req/15min for auth
- CORS restricted to configured origin
- Organization-based data isolation
- Stream tokens expire in 60 seconds
- File paths never exposed to frontend
# VideoSense

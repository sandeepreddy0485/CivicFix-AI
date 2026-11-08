# CivicFix AI

AI-powered civic issue reporting and management system. Citizens report
problems (garbage, water leakage, road damage, broken streetlights,
drainage blockage) by uploading a photo; the system classifies the issue,
scores its severity, and routes it to the right municipal department
automatically. Admins track and resolve complaints through a dashboard.

Full project spec: see the original project description this build is based on.

## Project status

This is a complete, runnable **v1 scaffold**: full backend API, full
frontend UI, and the AI training pipeline are all implemented and wired
together end-to-end. One thing you still need to supply yourself:

- **A trained AI model.** No image dataset is bundled (see
  `ai-model/dataset/README.md`). Until you train a model, the backend
  automatically uses a transparent rule-based fallback classifier (see
  "How AI prediction works" below) — so you can run and demo the entire
  app, including the full complaint lifecycle, before training anything.

## Repository layout

```
civicfix-ai/
├── frontend/     React + Vite + Tailwind — citizen & admin UI
├── backend/      FastAPI — REST API, auth, business logic
├── ai-model/     PyTorch transfer-learning pipeline (train/evaluate/predict)
└── docs/         architecture.md, database.md, api.md
```

## Quick start

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # defaults work out of the box (SQLite)
uvicorn app.main:app --reload --port 8000
```

The API is now live at `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs`. On first run it creates `civicfix.db`
(SQLite) and seeds the five departments automatically. To use PostgreSQL
instead, set `DATABASE_URL` in `.env` to your Postgres connection string.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` and `/uploads`
requests to the backend on port 8000 (see `vite.config.js`), so no CORS
configuration is needed locally.

### 3. Try it out

1. Register a citizen account at `/register`.
2. Go to **Report Issue**, upload any photo, optionally add a description
   and capture your location, and submit.
3. You'll land on the complaint's tracking page showing the AI prediction,
   severity, and assigned department.
4. To see the admin side: register a second account, then promote it to
   admin directly in the database (there's no self-service admin signup,
   by design — see Security notes below):

   ```bash
   cd backend
   python3 -c "
   from app.database import SessionLocal
   from app.models.user import User, UserRole
   db = SessionLocal()
   u = db.query(User).filter(User.email == 'YOUR_EMAIL_HERE').first()
   u.role = UserRole.admin
   db.commit()
   print('Promoted', u.email, 'to admin')
   "
   ```
5. Log in as that admin account to see `/admin` — the dashboard, complaint
   table, and status/severity controls.

## Deadlines, moderation, and installable app

- Resolution targets are Critical: 4 hours, High: 24 hours, Medium: 3 days,
  and Low: 7 days. The admin dashboard counts and highlights overdue active
  reports; changing a report's priority recalculates its deadline.
- Residents can flag a nearby report for review. A flag never hides a report
  automatically; administrators can dismiss flags, hide reports, or restore
  them. Moderation actions are retained in the database audit history.
- Rate-limit defaults are five new reports per resident per rolling hour and
  ten flags per resident per rolling day.
- The frontend is a Progressive Web App. On a secure origin (`localhost` or
  HTTPS), use the browser's **Install app** button when available, or the
  browser's add-to-home-screen option. The offline cache contains the static
  app shell and public illustrations only; authenticated API data and uploaded
  report photos are intentionally not cached, so reporting and tracking need
  an internet connection.

## How AI prediction works

See `backend/app/services/ai_service.py`. On each complaint submission:

1. If a trained model exists at `AI_MODEL_PATH` (default
   `ai-model/models/civic_classifier.pt`), it's loaded and used for
   inference.
2. If not — or if loading/inference fails for any reason — the service
   falls back to a heuristic predictor (keyword matching on the filename,
   or the citizen's optional category hint). This is clearly labeled in
   the stored prediction's `model_version` field
   (`rule-based-fallback-v1` vs. `mobilenet_v3_small-finetuned-v1`), so
   it's never presented as more confident than it is.

## Training the real AI model

```bash
cd ai-model
pip install -r requirements.txt
# 1. Populate dataset/train, dataset/val, dataset/test — see dataset/README.md
python train.py --data-dir dataset --epochs 15
python evaluate.py --data-dir dataset --weights models/civic_classifier.pt
```

This writes `models/civic_classifier.pt`, which the backend will pick up
automatically on next startup (no code changes needed).

## Production deployment

The repository includes a Render Blueprint at `render.yaml` for the API and
`frontend/vercel.json` for client-side routing. Deploy the frontend from the
`frontend` directory and the API from the repository root using the Render
Blueprint. Provision a Supabase PostgreSQL database and a Cloudinary account
before the first production launch.

Configure these production values:

- **Render:** `DATABASE_URL` from Supabase; `FRONTEND_ORIGIN` set to the
  deployed Vercel origin (comma-separated origins are supported); and the
  three `CLOUDINARY_*` credentials. Render generates `SECRET_KEY` in the
  Blueprint. Keep `APP_ENV=production`.
- **Vercel:** `frontend/vercel.json` proxies `/api/*` requests to the Render
  service. If using a different Render service URL, update the API rewrite
  destination there and redeploy. Alternatively, set `VITE_API_BASE_URL` to
  the Render API origin followed by `/api` and configure the matching CORS
  origin on Render.
- **Supabase:** use a PostgreSQL connection string supported by psycopg2 and
  require SSL for external connections.

Production startup refuses to run with SQLite, a weak/default JWT secret, or
missing Cloudinary credentials. Complaint photos are uploaded to Cloudinary
instead of the ephemeral Render filesystem. The AI model remains optional; if
no trained weights are supplied, predictions still use the disclosed
rule-based fallback and are not image-based AI classifications.

The production backend omits the large PyTorch runtime packages by default.
If you later deploy trained weights at `AI_MODEL_PATH`, update the Render
build command to also install `backend/requirements-ai.txt`.

Before deploying, connect only this project directory to a dedicated Git
repository. Do not push from a parent directory that contains unrelated
personal projects or files.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system design, request flow, deployment topology
- [`docs/database.md`](docs/database.md) — full schema and relationships
- [`docs/api.md`](docs/api.md) — REST API reference

## Security notes (MVP-appropriate, see spec section 13)

- Passwords are bcrypt-hashed, never stored in plaintext.
- JWT-based auth with role-based access control (citizen vs admin).
- File uploads are validated by content type and size.
- Citizens cannot access another citizen's complaints (403 enforced
  server-side, not just hidden in the UI).
- GPS coordinates are range-validated (not otherwise verified — don't treat
  them as tamper-proof).
- There is intentionally no public "become an admin" endpoint; promote
  users to admin directly via the database, as shown above.

## Tech stack

Frontend: React, Vite, Tailwind CSS, React Router, Axios, Recharts, Leaflet
Backend: Python, FastAPI, SQLAlchemy, Pydantic, python-jose (JWT), passlib (bcrypt)
Database: PostgreSQL (SQLite fallback for local dev)
AI/ML: PyTorch, torchvision (MobileNetV3 transfer learning), Pillow
Deployment (suggested): Vercel (frontend), Render (backend), Supabase (Postgres), Cloudinary (images)

## License

Portfolio project — add a license of your choice before publishing.

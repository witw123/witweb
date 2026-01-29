# Sora2 Web Studio

Single-app setup based on Next.js (App Router). All pages and API routes live in Next.js; data is stored in local SQLite.

## Project Structure

```
.
?? web/            # Next.js app (pages + API routes)
?? data/           # SQLite database and config files
?? downloads/      # Generated videos
?? uploads/        # Uploaded files
?? README.md
```

## Local Development

```bash
cd web
npm install
npm run dev
```

Open:
- http://localhost:3000

## Data & Config

- SQLite DB: `data/blog.db`
- API config: `data/api_config.json`
- Studio data: `data/config.json`, `data/history.json`, `data/active_tasks.json`

Optional custom DB path:

```
SORA_DB_PATH=ABSOLUTE_PATH
```

## Notes

- FastAPI/uvicorn are no longer used.
- Generated videos are stored in `downloads/`, uploads in `uploads/`.

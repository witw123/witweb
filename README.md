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

- Users DB: `data/users.db`
- Blog DB: `data/blog.db`
- Channel DB: `data/channel.db`
- Studio DB: `data/studio.db`
- API config: `data/api_config.json`
- Studio data: `data/config.json`, `data/history.json`, `data/active_tasks.json`

Optional custom DB path:

```
SORA_USERS_DB_PATH=ABSOLUTE_PATH
SORA_BLOG_DB_PATH=ABSOLUTE_PATH
SORA_CHANNEL_DB_PATH=ABSOLUTE_PATH
SORA_STUDIO_DB_PATH=ABSOLUTE_PATH
```

## Notes

- FastAPI/uvicorn are no longer used.
- Generated videos are stored in `downloads/`, uploads in `uploads/`.

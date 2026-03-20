# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WitWeb is a full-stack community website built with Next.js App Router, featuring:
- Blog (posts, categories, comments, likes/favorites)
- User relationships (followers/following, profile pages)
- Private messaging system
- Admin dashboard
- Studio (Video, Agent, Radar features)

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- PostgreSQL 14+ with Drizzle ORM
- Vitest (unit tests) + Playwright (E2E tests)

## Common Commands

```bash
cd web

# Development
npm run dev              # Start dev server at http://localhost:3000
npm run build            # Build for production
npm run start            # Start production server

# Testing
npm run test             # Run unit tests with Vitest
npm run test:e2e         # Run E2E tests with Playwright
npm run test:coverage    # Run tests with coverage report

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript type check

# Database
npm run db:migrate           # Run database migrations
npm run db:migrate:status    # Check migration status
npm run db:drizzle:generate  # Generate Drizzle schema types
npm run db:drizzle:studio    # Open Drizzle Studio

# Data Migration (SQLite -> PostgreSQL)
npm run data:migrate         # Migrate legacy SQLite data
```

## Code Architecture

### Directory Structure

```
web/src/
├── app/                 # Next.js App Router pages
│   ├── api/             # API routes
│   ├── admin/           # Admin dashboard routes
│   ├── blog/            # Blog routes
│   ├── messages/        # Private messaging routes
│   ├── profile/         # User profile routes
│   ├── studio/          # Studio feature routes
│   └── ...
├── features/            # Feature-based modules
│   ├── auth/            # Authentication logic
│   ├── blog/            # Blog feature
│   ├── user/            # User feature
│   ├── friends/         # Friends feature
│   ├── messages/        # Messages feature
│   ├── admin/           # Admin feature
│   └── about/           # About page feature
├── components/          # Shared React components
├── lib/                 # Core utilities and libraries
│   ├── db/              # Database schema and connection
│   ├── repositories/    # Data access layer
│   ├── hooks/           # Custom React hooks
│   ├── security.ts      # Security utilities
│   ├── auth.ts          # Authentication utilities
│   └── ...
├── services/            # External service integrations
├── middleware/          # Next.js middleware
└── types/               # TypeScript type definitions
```

### Key Patterns

1. **Feature-based architecture**: Each feature (auth, blog, user, etc.) has its own module in `src/features/` with related components, hooks, and utilities.

2. **Repository pattern**: Data access is abstracted through repositories in `src/lib/repositories/`.

3. **Database**: Schema defined in `src/lib/db/schema.ts` using Drizzle ORM. Migrations use a custom system in `web/scripts/db-migrate.mjs` plus Drizzle.

4. **Authentication**: JWT-based auth with HTTP-only cookies. See `src/lib/auth.ts` and `src/lib/jwt.ts`.

5. **API routes**: RESTful APIs in `src/app/api/` following the pattern in `src/lib/api-response.ts` for consistent responses.

6. **State Management**: Uses React Query (`@tanstack/react-query`) for server state. See `src/lib/query-keys.ts` for query key conventions.

7. **Testing**: Unit tests in `src/__tests__/` using Vitest with `@testing-library/react`. E2E tests in `tests/` using Playwright.

## Environment Setup

Create `web/.env.local` with required variables:

```env
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/witweb
AUTH_SECRET=replace_with_at_least_32_chars
ENCRYPTION_KEY=replace_with_at_least_32_chars
```

Optional: Enable Turnstile for captcha:
```env
TURNSTILE_ENABLED=true
TURNSTILE_SECRET_KEY=your_secret_key
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key
```

## Database Schema Highlights

Key tables (defined in `src/lib/db/schema.ts`):
- `users` - User accounts
- `posts` - Blog posts
- `comments` - Post comments
- `likes` - Post likes
- `favorites` - Post favorites
- `follows` - User followers/following
- `messages` - Private messages
- `categories` - Post categories

## API Versioning

APIs follow versioning strategy documented in `docs/API_VERSIONING.md`. Use the `x-api-version` header to specify version.

## Security

- RBAC (Role-Based Access Control) in `src/lib/rbac.ts`
- Security middleware in `src/middleware/` and `src/lib/security-middleware.ts`
- Security fixes documented in `docs/SECURITY_FIXES.md`
- Never commit `.env.local` or sensitive credentials


### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---
## Task Management
1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

---
## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
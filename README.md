# ProspectForge

AI-powered personalized sales cadence builder. Build company profiles, import leads via CSV, and generate fully personalized sales playbooks — emails, call openers, objection handling, LinkedIn messages, and conversation callbacks — for every prospect.

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **AI**: Anthropic Claude (claude-sonnet-4-20250514)

## Deploy to Railway

### 1. Create Railway project
- Go to railway.app → New Project
- Connect this GitHub repo

### 2. Add PostgreSQL
- In your Railway project → Add Plugin → PostgreSQL
- Railway will automatically set `DATABASE_URL`

### 3. Set environment variables
In Railway project settings → Variables, add:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
JWT_SECRET=generate-with: openssl rand -base64 32
NODE_ENV=production
```

### 4. Deploy
Railway will auto-deploy on push to main. Build runs `npm run build` (installs deps + builds frontend), then starts the Express server which serves both the API and the built React app.

## Local Development

```bash
# Install all deps
npm run install:all

# Terminal 1 — backend
cd backend && cp ../.env.example .env  # fill in your values
npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend dev server runs on :5173 and proxies `/api` to the backend on :3001.

## CSV Import Format

Accepted column headers (flexible matching):
- `name` or `full_name` or `Full Name`
- `company` or `Company`
- `title` or `Title` or `role`
- `email` or `Email`
- `linkedin` or `LinkedIn` (optional)
- `notes` or `Notes` (optional)

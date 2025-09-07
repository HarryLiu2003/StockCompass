# Production Environment Configuration

## Railway Backend Environment Variables

```bash
# Django Configuration
DEBUG=False
SECRET_KEY=jq%$4xd(m8%2xmpgq77lzeg)$com=h7bb++x4-24sob^wptm@h
ALLOWED_HOSTS=stockcompass-production.up.railway.app
PORT=8080

# Database (Auto-provided by Railway PostgreSQL service)
DATABASE_URL=postgresql://postgres:password@postgres-service.railway.internal:5432/railway

# AI Services (Primary)
API_CLAUDE=sk-ant-your-claude-key-here
SERPAPI_KEY=your-serpapi-key-here

# AI Services (Fallback)
API_PER=pplx-your-perplexity-key-here
API_OPENAI=sk-your-openai-key-here

# CORS Configuration
FRONTEND_URL=https://your-app.vercel.app
```

## Vercel Frontend Environment Variables

```bash
# API Connection
NEXT_PUBLIC_API_URL=https://stockcompass-production.up.railway.app
```

## Architecture

- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Django + PostgreSQL)
- **AI Services**: Claude Sonnet 4 + SerpAPI
- **Database**: PostgreSQL (managed by Railway)

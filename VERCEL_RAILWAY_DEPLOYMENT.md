# StockCompass Deployment Guide: Vercel + Railway

## Overview
This guide will help you deploy StockCompass to the cloud using:
- **Vercel**: Frontend (Next.js) hosting
- **Railway**: Backend (Django) hosting with PostgreSQL

Total deployment time: **30 minutes**

## Prerequisites
- GitHub account
- Vercel account (free)
- Railway account (free tier available)
- Your API keys (Claude, SerpAPI, Perplexity)

## Step 1: Backend Deployment (Railway) - 15 minutes

### 1.1 Sign Up for Railway
1. Visit [railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your StockCompass repository

### 1.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your StockCompass repository
4. Select the `vercel-railway-deployment` branch

### 1.3 Add PostgreSQL Database
1. In your Railway project dashboard
2. Click "New" → "Database" → "PostgreSQL"
3. Railway automatically creates `DATABASE_URL` environment variable

### 1.4 Configure Environment Variables
In Railway dashboard, add these variables:
```
DEBUG=False
SECRET_KEY=your-django-secret-key-here
ALLOWED_HOSTS=your-backend.railway.app
API_CLAUDE=sk-ant-your-claude-key
SERPAPI_KEY=your-serpapi-key
API_PER=pplx-your-perplexity-key
```

### 1.5 Deploy
- Railway automatically deploys from your GitHub branch
- Wait for build to complete (~5 minutes)
- Note your backend URL: `https://your-backend.railway.app`

## Step 2: Frontend Deployment (Vercel) - 10 minutes

### 2.1 Sign Up for Vercel
1. Visit [vercel.com](https://vercel.com)
2. Sign up with GitHub

### 2.2 Import Project
1. Click "New Project"
2. Import your StockCompass repository
3. Select `frontend` as root directory
4. Framework preset: Next.js (auto-detected)

### 2.3 Configure Environment Variables
In Vercel dashboard, add:
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### 2.4 Deploy
- Vercel automatically builds and deploys
- Get your frontend URL: `https://your-app.vercel.app`

## Step 3: Final Configuration - 5 minutes

### 3.1 Update Railway CORS
In Railway, update the `ALLOWED_HOSTS` environment variable:
```
ALLOWED_HOSTS=your-backend.railway.app,your-app.vercel.app
```

### 3.2 Update Railway CORS Origins
Add your Vercel URL to Railway environment:
```
FRONTEND_URL=https://your-app.vercel.app
```

### 3.3 Test Deployment
1. Visit your Vercel app URL
2. Search for a stock (e.g., "AAPL")
3. Click "Event Analyzer"
4. Verify Claude + SerpAPI integration works

## Expected Costs

### Free Tier (Testing):
- **Railway**: $5/month (includes PostgreSQL)
- **Vercel**: Free (hobby projects)
- **Total**: $5/month

### Production Tier:
- **Railway**: $20/month (higher limits)
- **Vercel Pro**: $20/month (custom domains, analytics)
- **Total**: $40/month

## Troubleshooting

### Common Issues:
1. **Build Failures**: Check Railway logs for Python dependency issues
2. **Database Errors**: Verify DATABASE_URL is set by Railway
3. **CORS Errors**: Ensure frontend URL is in ALLOWED_HOSTS
4. **API Failures**: Verify all API keys are set in Railway

### Success Indicators:
- ✅ Backend responds at Railway URL
- ✅ Frontend loads at Vercel URL
- ✅ Stock data fetches successfully
- ✅ Event Analyzer produces AI analysis with citations

## Architecture After Deployment

```
User Browser
    ↓
Vercel (Next.js Frontend)
    ↓ API calls
Railway (Django Backend + PostgreSQL)
    ↓ External APIs
Yahoo Finance + SerpAPI + Claude Sonnet 4
```

Your StockCompass will be globally accessible with professional cloud infrastructure!

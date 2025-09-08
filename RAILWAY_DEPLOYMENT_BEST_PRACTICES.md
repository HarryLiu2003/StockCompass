# Railway Deployment Best Practices Guide

## Overview
This guide captures lessons learned from deploying StockCompass to Railway, providing a systematic approach to avoid common pitfalls and ensure smooth deployments for future projects.

---

## 🚀 Pre-Deployment Checklist

### 1. Repository Structure Preparation
- **✅ Monorepo Considerations**: If using monorepo (frontend + backend), plan deployment strategy
- **✅ Root Directory**: Ensure Railway can identify which part to deploy
- **✅ Clean Git History**: Remove any API keys or secrets from commit history
- **✅ Proper .gitignore**: Comprehensive protection for environment files

### 2. Environment Variables Strategy
- **✅ Local .env.example**: Create template with all required variables
- **✅ Production Planning**: Document all environment variables needed
- **✅ API Key Management**: Organize primary vs fallback services
- **✅ Secrets Security**: Never commit actual API keys to git

---

## 🐍 Django-Specific Best Practices

### 1. Database Configuration
```python
# ✅ GOOD: Conditional database configuration
if os.getenv('DATABASE_URL'):
    import dj_database_url
    DATABASES = {'default': dj_database_url.parse(os.getenv('DATABASE_URL'))}
else:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}

# ❌ BAD: Always importing dj_database_url
import dj_database_url  # Will fail if package not installed locally
```

### 2. Static Files Configuration
```python
# ✅ GOOD: WhiteNoise for cloud deployment
MIDDLEWARE = [
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Add early in middleware
    # ... other middleware
]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### 3. Environment-Based Settings
```python
# ✅ GOOD: Environment-driven configuration
DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
SECRET_KEY = os.getenv('SECRET_KEY', 'fallback-for-development')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
```

### 4. API Views Configuration
```python
# ✅ GOOD: Force JSON responses for APIs
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.renderers import JSONRenderer

@api_view(['GET'])
@renderer_classes([JSONRenderer])  # Prevents HTML error pages
def my_api_view(request):
    # API logic here
```

---

## 🐳 Docker Best Practices

### 1. Railway-Optimized Dockerfile
```dockerfile
# ✅ GOOD: Simple, production-ready Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p /app/staticfiles  # Prevent Django warnings
CMD python manage.py migrate && \
    python manage.py collectstatic --noinput && \
    gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 2 app.wsgi:application
```

### 2. Common Dockerfile Mistakes
```dockerfile
# ❌ BAD: Complex startup scripts
COPY <<EOF /app/start.sh
#!/bin/bash
# Complex script logic...
EOF
CMD ["/app/start.sh"]

# ❌ BAD: Build-time environment variables
EXPOSE $PORT  # $PORT not available during build

# ❌ BAD: Debug commands in production
CMD echo "Debug info..." && python manage.py runserver
```

---

## ⚙️ Railway Configuration

### 1. Railway.toml Best Practices
```toml
# ✅ GOOD: Minimal configuration
[build]
builder = "DOCKERFILE"

# Let Dockerfile CMD handle startup - no custom startCommand needed

# ❌ BAD: Overriding Dockerfile
[deploy]
startCommand = "custom command here"  # Can override and break Dockerfile CMD
```

### 2. Environment Variables Management
```bash
# ✅ GOOD: Systematic environment setup via CLI
railway variables --set "DEBUG=False"
railway variables --set "SECRET_KEY=generated-secret-key"
railway variables --set "ALLOWED_HOSTS=your-domain.railway.app"

# ✅ GOOD: Check all variables are set
railway variables | grep -E "(SECRET_KEY|DATABASE_URL|PORT)"
```

### 3. Database Connection
```bash
# ✅ GOOD: Add PostgreSQL via CLI
railway add -d postgres

# ✅ GOOD: Verify DATABASE_URL is auto-created
railway variables | grep DATABASE_URL

# ⚠️ WATCH: Sometimes need manual DATABASE_URL configuration
# Check both Django service and PostgreSQL service variables
```

---

## 🔧 Common Issues & Solutions

### 1. "Application Failed to Respond" (502 Errors)
**Root Causes & Solutions:**

#### Port Binding Issues
```bash
# ❌ PROBLEM: Missing PORT environment variable
railway variables | grep PORT  # Returns nothing

# ✅ SOLUTION: Add PORT variable
railway variables --set "PORT=8080"

# ✅ SOLUTION: Update domain target port to match
# Railway Dashboard → Service → Settings → Domain → Target Port: 8080
```

#### Database Connection Issues
```bash
# ❌ PROBLEM: Missing DATABASE_URL
railway variables | grep DATABASE_URL  # Returns nothing

# ✅ SOLUTION: Check PostgreSQL service variables
railway variables --service Postgres

# ✅ SOLUTION: Manually set DATABASE_URL if needed
railway variables --set "DATABASE_URL=postgresql://..."
```

### 2. "Nixpacks Was Unable to Generate a Build Plan"
**Solutions:**
```bash
# ✅ SOLUTION 1: Use Dockerfile instead
# Create Dockerfile and set railway.toml:
[build]
builder = "DOCKERFILE"

# ✅ SOLUTION 2: Deploy subdirectory for monorepos
# Railway Dashboard → New Project → Root Directory: backend/
```

### 3. Import Errors During Deployment
**Prevention:**
- **✅ Test imports locally** before deployment
- **✅ Check requirements.txt** includes all dependencies
- **✅ Conditional imports** for optional packages
- **✅ Avoid circular imports** between apps

### 4. Static Files Issues
**Solutions:**
```dockerfile
# ✅ Create staticfiles directory in Dockerfile
RUN mkdir -p /app/staticfiles

# ✅ Use WhiteNoise for static file serving
# Add to Django settings.py
```

---

## 🧪 Testing Strategy

### 1. Pre-Deployment Testing
```bash
# ✅ Local environment testing
python manage.py check
python manage.py migrate --dry-run
python manage.py collectstatic --dry-run

# ✅ Test with production-like settings
DEBUG=False python manage.py runserver
```

### 2. Post-Deployment Verification
```bash
# ✅ Health check endpoint (always create one)
curl https://your-app.railway.app/health/

# ✅ API endpoint testing
curl https://your-app.railway.app/api/endpoint/

# ✅ Check logs for warnings
railway logs | grep -E "(WARNING|ERROR)"
```

---

## 🔍 Debugging Workflow

### 1. Systematic Debugging Approach
1. **Check Railway logs first**: `railway logs`
2. **Verify environment variables**: `railway variables`
3. **Test database connection**: Check PostgreSQL service status
4. **Isolate the issue**: Remove complexity step by step
5. **Test locally with production settings**: Replicate environment

### 2. Common Debug Commands
```bash
# Check service status
railway status

# View all environment variables
railway variables

# Check specific service variables
railway variables --service ServiceName

# View build and deployment logs
railway logs -d

# Test in Railway environment
railway run python manage.py check
```

---

## 🎯 Deployment Strategy

### 1. Incremental Deployment
1. **Start simple**: Basic Django app without complex features
2. **Add database**: PostgreSQL connection
3. **Add environment variables**: One by one
4. **Add complex features**: AI integrations, external APIs
5. **Optimize**: Performance tuning, worker configuration

### 2. Rollback Strategy
```bash
# Keep working versions tagged
git tag v1.0-working

# Quick rollback if needed
git reset --hard v1.0-working
railway up --detach
```

---

## 📋 Environment Variables Checklist

### Essential Django Variables
- **SECRET_KEY**: Generated secure key
- **DEBUG**: False for production
- **ALLOWED_HOSTS**: Your Railway domain
- **DATABASE_URL**: Auto-provided by Railway PostgreSQL
- **PORT**: Usually 8080 for Railway

### Application-Specific Variables
- **API Keys**: Primary and fallback services
- **External Service URLs**: Third-party integrations
- **Feature Flags**: Enable/disable features per environment

---

## 🛠️ Project Structure Best Practices

### 1. Monorepo Structure
```
project/
├── backend/          # Django application
│   ├── requirements.txt
│   ├── manage.py
│   └── ...
├── frontend/         # Next.js application
│   ├── package.json
│   └── ...
├── Dockerfile        # For backend deployment
├── railway.toml      # Railway configuration
└── README.md
```

### 2. Configuration Files
- **Dockerfile**: Simple, focused on single service
- **railway.toml**: Minimal configuration, let Railway auto-detect
- **.env.example**: Complete template for all environments
- **requirements.txt**: Organized with clear sections

---

## 🚨 Common Pitfalls to Avoid

### 1. Configuration Conflicts
- **❌ Don't override Dockerfile CMD** with railway.toml startCommand
- **❌ Don't hardcode environment values** in settings.py
- **❌ Don't assume Railway provides all environment variables**

### 2. Import and Dependency Issues
- **❌ Don't import optional packages** at module level
- **❌ Don't forget to update requirements.txt** when adding dependencies
- **❌ Don't use development-only packages** in production

### 3. Database and Static Files
- **❌ Don't run collectstatic during build** without database access
- **❌ Don't assume staticfiles directory exists**
- **❌ Don't hardcode database URLs**

---

## 🎊 Success Indicators

### Healthy Deployment Shows
- ✅ **Build completes** without errors
- ✅ **Migrations run** successfully
- ✅ **Gunicorn starts** and listens on correct port
- ✅ **Health check responds** with 200 OK
- ✅ **API endpoints work** with proper JSON responses
- ✅ **Logs show no errors** or warnings

### Final Verification
```bash
# All these should return 200
curl https://your-app.railway.app/health/
curl https://your-app.railway.app/api/your-endpoint/

# Logs should show successful startup
railway logs | tail -20
```

---

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [Railway Error Reference](https://docs.railway.com/reference/errors)

---

## 🎯 Summary

**The key to smooth Railway deployments:**
1. **Start simple** and add complexity incrementally
2. **Test locally** with production-like settings
3. **Use systematic debugging** when issues arise
4. **Keep configuration minimal** and let Railway handle auto-detection
5. **Always create health check endpoints** for easy verification

**Following these practices will save hours of debugging and ensure reliable deployments!**

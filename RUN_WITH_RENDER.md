# Running with Render Backend

This guide explains how to run the Language Game frontend locally while using Render as the backend.

## ✅ Configuration Complete

The project has been configured to use Render as the backend:

- ✓ `.env` file created with `VITE_BACKEND_URL` pointing to Render
- ✓ Server enhanced with better startup logging and error handling
- ✓ Health check endpoint configured in `render.yaml`
- ✓ Graceful shutdown handlers added to prevent hanging

## 🚀 Quick Start

### 1. Update Backend URL

Edit `.env` file and replace with your actual Render service URL:

```bash
VITE_BACKEND_URL=https://YOUR-SERVICE-NAME.onrender.com
```

If you used the Blueprint deployment, your service URL should be:
`https://language-game-backend.onrender.com`

You can find your service URL in the Render dashboard:
1. Go to https://dashboard.render.com/
2. Click on your `language-game-backend` service
3. Copy the URL shown at the top (e.g., `https://language-game-backend-xxxx.onrender.com`)

### 2. Set Environment Variables on Render

Make sure these environment variables are set in your Render service:

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `REPLICATE_API_TOKEN` - Your Replicate API token for image generation

**Optional:**
- `RPM_API_KEY` - Ready Player Me API key (for avatar features)
- `ORIGIN` - Already set to `*` in render.yaml (allows CORS from any origin)

### 3. Build Frontend

```bash
npm run build
```

This builds the frontend with the Render backend URL embedded.

### 4. Run Development Server

For local development with live reload:

```bash
npm run dev
```

This will start the Vite dev server on http://localhost:5173

Or serve the production build:

```bash
npm run preview
```

## 🔍 Verifying Connection

### Check Render Backend Health

Visit your Render service health endpoint:
```
https://YOUR-SERVICE-NAME.onrender.com/api/health
```

You should see a JSON response like:
```json
{
  "ok": true,
  "ts": 1699999999999,
  "hasOpenAI": true,
  "hasReplicate": true,
  "llmProvider": "openai"
}
```

### Check Frontend Connection

1. Open the browser console (F12)
2. Look for any network errors when the app makes API calls
3. The app should successfully fetch data from `/api/story`, `/api/dialogues`, etc.

## 🐛 Troubleshooting

### Server won't boot / gets stuck

The server now includes:
- ✓ Detailed startup logs showing configuration
- ✓ Health check endpoint for Render to verify the service is up
- ✓ Error handling for port conflicts
- ✓ Graceful shutdown on SIGTERM/SIGINT
- ✓ Non-blocking startup even if API keys are missing (warnings only)

Check the Render logs:
1. Go to your service in Render dashboard
2. Click "Logs" tab
3. Look for the startup messages:
   ```
   === Server Startup ===
   Environment: production
   Host: 0.0.0.0
   Port: 10000
   ...
   ✓ Server is ready to accept connections
   ```

### CORS errors

If you see CORS errors in the browser console:
- The `ORIGIN` env var in Render is set to `*` which allows all origins
- Make sure your Render service is actually running (check the health endpoint)

### "Failed to fetch" errors

Common causes:
1. **Render service is sleeping** - Free tier services sleep after 15 mins of inactivity
   - Solution: Visit the health endpoint to wake it up, or upgrade to paid tier
   
2. **Wrong backend URL** - Check that `.env` has the correct Render URL
   - Solution: Update `.env` and rebuild: `npm run build`

3. **API keys not set** - Backend responds with errors if keys are missing
   - Solution: Set `OPENAI_API_KEY` and `REPLICATE_API_TOKEN` in Render dashboard

### Need to switch back to local backend?

Edit `.env`:
```bash
# VITE_BACKEND_URL=https://language-game-backend.onrender.com
VITE_BACKEND_URL=http://127.0.0.1:8888
```

Then rebuild:
```bash
npm run build
```

And start the local server:
```bash
npm run server
```

## 📝 Notes

- **Cold starts**: Render free tier services sleep after inactivity. First request after sleep can take 30-60 seconds.
- **Build required**: Any time you change `.env`, you must rebuild the frontend with `npm run build`
- **Development mode**: `npm run dev` also respects `VITE_BACKEND_URL` from `.env`
- **Health checks**: Render uses `/api/health` to monitor service status. Server has 60 second initial delay for startup.

## 🔒 Security

- Never commit `.env` file (already in `.gitignore`)
- Keep API keys secure in Render dashboard
- Use environment-specific values for `ORIGIN` in production (instead of `*`)

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Deploy Guide](./RENDER_DEPLOYMENT.md)
- [Development Guide](./DEV_RUN.md)

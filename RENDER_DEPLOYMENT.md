# Deploying to Render

This guide explains how to deploy the Language Game backend to Render.

## Overview

The Language Game backend can be deployed to Render as a Web Service. The repository includes a `render.yaml` Blueprint configuration file for easy deployment.

## Prerequisites

1. A Render account ([Sign up here](https://render.com))
2. OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
3. Replicate API token ([Get one here](https://replicate.com/account/api-tokens))
4. (Optional) Ready Player Me API key

## Deployment Options

### Option 1: Deploy using Blueprint (Recommended)

1. Fork or push this repository to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Render will automatically detect the `render.yaml` file
6. Configure the environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key (required)
   - `REPLICATE_API_TOKEN`: Your Replicate API token (required for image generation)
   - `RPM_API_KEY`: Your Ready Player Me API key (optional)
   - `ORIGIN`: Set to `*` or your frontend URL for CORS
7. Click "Apply" to create the service

### Option 2: Manual Deployment

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: language-game-backend (or your preferred name)
   - **Environment**: Node
   - **Region**: Choose your preferred region
   - **Branch**: main (or your deployment branch)
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
5. Add environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `REPLICATE_API_TOKEN`: Your Replicate API token
   - `RPM_API_KEY`: Your Ready Player Me API key (optional)
   - `ORIGIN`: Set to `*` or your frontend URL
   - `NODE_ENV`: production
6. Click "Create Web Service"

## Environment Variables

The following environment variables must be configured in Render:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for text generation |
| `REPLICATE_API_TOKEN` | Yes | Replicate API token for image generation |
| `RPM_API_KEY` | No | Ready Player Me API key for avatar export |
| `ORIGIN` | No | CORS origin (default: `*`) |
| `NODE_ENV` | No | Set to `production` for production deployment |
| `PORT` | No | Automatically set by Render |
| `HOST` | No | Automatically set to `0.0.0.0` by default |

## Health Check

The backend exposes a health check endpoint at `/api/health` which Render uses to monitor service status.

## After Deployment

1. Your backend will be available at `https://your-service-name.onrender.com`
2. Test the health endpoint: `https://your-service-name.onrender.com/api/health`
3. Update your frontend configuration to point to the new backend URL:
   - Set `VITE_BACKEND_URL=https://your-service-name.onrender.com` in your frontend environment

## Troubleshooting

### Service fails to start

- Check the Render logs for error messages
- Verify all required environment variables are set
- Ensure your API keys are valid

### API calls fail with CORS errors

- Set the `ORIGIN` environment variable to your frontend URL
- Or set it to `*` to allow all origins (not recommended for production)

### "Missing OPENAI_API_KEY" errors

- Verify the `OPENAI_API_KEY` environment variable is set in Render
- Check that the API key is valid and has sufficient credits

## Cost

Render offers a free tier for web services with the following limitations:
- Services spin down after 15 minutes of inactivity
- Cold starts may take 30+ seconds
- 750 hours/month of usage

For production use, consider upgrading to a paid plan for:
- No cold starts
- Persistent services
- Better performance

## Local Development vs Production

The server automatically adapts to the deployment environment:

- **Local Development**: 
  - Binds to `127.0.0.1:8888` by default
  - Can be overridden with `HOST=127.0.0.1 PORT=8888`

- **Render Production**:
  - Binds to `0.0.0.0` with Render's assigned PORT
  - Environment variables are automatically set

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Render Blueprint Specification](https://render.com/docs/blueprint-spec)
- [Render Environment Variables](https://render.com/docs/environment-variables)

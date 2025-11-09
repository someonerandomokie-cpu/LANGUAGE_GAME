# Setup Guide for Language Game

This guide will help you set up the Language Game application on your local machine.

## Prerequisites

- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- An **OpenAI API key** (for text generation) - [Get API key](https://platform.openai.com/api-keys)
- A **Replicate API token** (for image generation) - [Get token](https://replicate.com/account/api-tokens)

## Step-by-Step Setup

### 1. Install Dependencies

The application has two sets of dependencies: frontend (root) and backend (server).

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory by copying the example file:

```bash
cp .env.example .env
```

Then edit `.env` and replace the placeholder values with your actual API keys:

```env
# Frontend build-time envs (optional)
VITE_BACKEND_URL=http://127.0.0.1:8888

# Server envs
OPENAI_API_KEY=sk-your-actual-openai-key-here
REPLICATE_API_TOKEN=r8_your-actual-replicate-token-here

# CORS origin (use * for dev)
ORIGIN=*
```

**Important**: 
- Never commit the `.env` file to version control (it's already in `.gitignore`)
- The `.env` file contains sensitive API keys
- Get your OpenAI API key from: https://platform.openai.com/api-keys
- Get your Replicate API token from: https://replicate.com/account/api-tokens

### 3. Start the Application

You have two options:

**Option A: Start both servers at once (recommended)**
```bash
npm run dev:full
```

**Option B: Start servers separately**
```bash
# Terminal 1 - Start the backend server
npm run server

# Terminal 2 - Start the frontend dev server
npm run dev
```

### 4. Access the Application

Once both servers are running:

- Frontend: http://localhost:5173/LANGUAGE_GAME/
- Backend API: http://127.0.0.1:8888

## Troubleshooting

### "App stuck on booting screen"

This usually means:
1. **Dependencies not installed** - Run `npm install` in both root and `server/` directories
2. **Missing .env file** - Create `.env` from `.env.example` with valid API keys
3. **Invalid API keys** - Verify your OpenAI and Replicate keys are correct

### "Cannot find module"

Run:
```bash
npm install
cd server && npm install
```

### "Missing OPENAI_API_KEY" error

1. Make sure you've created the `.env` file
2. Verify it contains a valid OpenAI API key
3. Restart the server after updating `.env`

### "REPLICATE_API_TOKEN required" error

1. Add your Replicate token to the `.env` file
2. Get a token from https://replicate.com/account/api-tokens
3. Restart the server

### Server won't start

1. Check if port 8888 is already in use
2. Verify Node.js version is 18 or higher: `node --version`
3. Check for error messages in the console

## Alternative: Using Ollama (No Cloud API Keys Required)

If you don't want to use cloud APIs, you can run the app locally with Ollama:

1. Install Ollama from https://ollama.com/download
2. Pull a model: `ollama pull llama3.1:8b`
3. Leave `OPENAI_API_KEY` empty in your `.env` (the app will auto-detect Ollama)
4. Start the app normally

Note: Image generation will still require Replicate API token.

## Need Help?

- Check the [README.md](./README.md) for detailed API documentation
- Review [DEV_RUN.md](./DEV_RUN.md) for development notes
- Open an issue on GitHub if you encounter problems

SatriaCb - Node.js (safe) version
================================

WHAT'S INSIDE
-------------
This ZIP contains a ready-to-deploy Node.js project that:
 - Serves a frontend (public/) with the same UI you provided.
 - Provides a backend server (server.js) that proxies requests to Google Generative Language (Gemini) for text and image generation, and handles image analysis.
 - Uses a .env file for secrets (GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).

IMPORTANT: The .env file contains placeholders. Replace them with your actual keys before running.

USAGE (local)
-------------
1. Extract the ZIP
2. Run:
   npm install
   # create .env file (or edit the provided .env)
   npm start
3. Open http://localhost:3000

DEPLOY
------
You can deploy this to Vercel, Render, Railway, or any Node.js host. Make sure to set environment variables in your host settings rather than committing .env to Git.

SECURITY
--------
Do NOT commit your .env to a public repository. .gitignore is configured to ignore .env.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7afc0c45-932b-42d8-bbda-7fc70632641a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_GEMINI_API_KEY` in `.env.local`
   You can copy from [.env.example](.env.example). `GEMINI_API_KEY` also works as a backward-compatible fallback.
3. Run the app:
   `npm run dev`

## Deploy

Add `VITE_GEMINI_API_KEY` or `GEMINI_API_KEY` to your hosting provider's environment variables before running the production build, then redeploy.

This app currently calls Gemini from the browser, so a build-time API key can be exposed to users. For a production deployment that must keep the key secret, move the Gemini calls to a server or serverless API route.

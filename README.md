# Luma AI

A responsive AI chat app powered by Groq. Includes streaming responses, selectable models, browser-local chat history, saved memory notes, personality settings, and Markdown formatting.

## Requirements
- Node.js 18 or newer (Node.js 20+ recommended)
- A Groq API key

## Run locally
1. Extract this folder.
2. Open a terminal in the `luma-ai` folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env`.
5. Put your Groq API key after `GROQ_API_KEY=` in `.env`.
6. Start Luma:
   ```bash
   npm start
   ```
7. Open http://localhost:3000

## Configuration
- `GROQ_API_KEY`: your secret Groq API key.
- `GROQ_MODEL`: optional default model. Supported choices in this build are `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, and `qwen/qwen3.8-27b`. Defaults to `openai/gpt-oss-120b`.
- `PORT`: local server port (defaults to `3000`).

The browser talks to the local Express server. The server keeps the API key private and calls Groq's chat completions endpoint. Chat history, memory notes, and personality preferences are stored in this browser's local storage; they are not synced between devices.

## Privacy and deployment
Do not commit `.env` or put the API key in frontend code. Before making the app public, add authentication, rate limiting, and appropriate access controls. Use HTTPS in production.

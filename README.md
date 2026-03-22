# DeepGuard AI

DeepGuard AI is a React + Vite web app for analyzing images and videos with modern vision-capable LLMs through OpenRouter. It provides a polished forensic-style interface for uploading media, running AI-assisted authenticity checks, and reviewing structured detection results.

## Features

- Image and video upload with preview support
- AI-powered media analysis through OpenRouter
- Switchable vision models in the Settings page
- Supported models:
  - `google/gemini-2.5-pro`
  - `openai/gpt-4o`
  - `openai/gpt-4.1`
- Detection history stored locally in the browser
- Configurable analysis settings and model selection

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- OpenRouter API
- Lucide React
- Motion

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- An OpenRouter API key

### Installation

```bash
npm install
```

### Environment Setup

Create a local `.env` file or update the existing one:

```env
OPENROUTER_API_KEY="your_openrouter_api_key"
OPENROUTER_MODEL="google/gemini-2.5-pro"
APP_URL="http://localhost:3000"
```

You can also copy values from [`.env.example`](.env.example).

## Running Locally

```bash
npm run dev
```

The app will start on `http://localhost:3000`.

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## How It Works

1. Upload an image or video.
2. The app converts the file into a data URL in the browser.
3. A multimodal request is sent to OpenRouter using the selected vision model.
4. The model returns a structured verdict with confidence, reasoning, and detected artifacts.
5. Results can be reviewed in the UI and saved to local history.

## Project Structure

```text
src/
  App.tsx        Main application UI and analysis flow
  main.tsx       React entry point
  index.css      Global styles
```

## Important Security Note

This project currently sends OpenRouter requests directly from the frontend. That means your API key is exposed to the browser at runtime.

For production use, move the OpenRouter request to a backend or serverless API route and keep the API key server-side.

## Future Improvements

- Add a backend proxy for secure API usage
- Add stronger result validation and structured output parsing
- Add export formats beyond plain text reports
- Add automated tests for analysis and settings flows

## License

This project is provided as-is for educational and development use.

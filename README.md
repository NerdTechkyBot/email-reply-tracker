# The Global Associates - AI Email Reply Analyzer

Modern React + Gemini + Gmail API application for analyzing and classifying email campaign replies.

## Features

- 📧 Multi-mailbox Gmail integration
- 🤖 AI-powered classification using Google Gemini
- 📊 Real-time analytics dashboard
- 🎨 Modern UI with Lexend font and teal/orange theme
- 🔔 Smart alerts for positive/warm replies
- 📱 Responsive design

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- TailwindCSS
- Recharts for analytics
- React Router
- Lucide React icons

### Backend
- Node.js + Express
- TypeScript
- Gmail API
- Google Gemini API
- Supabase (PostgreSQL)

## Project Structure

```
mails-response-tracker/
├── frontend/          # React application
├── backend/           # Node.js API server
├── supabase/          # Database migrations
└── docs/              # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Google Cloud Project with Gmail API enabled
- Google Gemini API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. Set up environment variables (see `.env.example` in each directory)

4. Run database migrations:
   ```bash
   cd supabase
   # Apply migrations to your Supabase project
   ```

5. Start development servers:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

## Deployment

- **Frontend**: Deploy to Netlify
- **Backend**: Deploy to Railway, Render, or any Node.js hosting
- **Database**: Supabase (managed PostgreSQL)

## License

Proprietary - The Global Associates

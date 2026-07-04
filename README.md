# Web Graph

A visual knowledge graph app for ingesting websites, extracting metadata, and organizing them into an interactive personal knowledge map.

## What it does
- Ingests URLs and scrapes their content
- Uses AI to extract titles, descriptions, tags, and types
- Builds a graph of nodes and semantic connections
- Lets you create parent categories and manually connect related ideas
- Stores everything locally with Prisma and SQLite

## Tech stack
- React + TypeScript - Vite - Express - Prisma + SQLite - OpenRouter for LLM-based metadata extraction
## Project structure

src/ — frontend UI and graph components
server.ts — backend API and ingestion logic
prisma/ — Prisma schema and database setup

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a .env file in the project root with:

```env
OPENROUTER_API_KEY=your_openrouter_key
APP_URL=http://localhost:3000
OPENROUTER_MODEL=openai/gpt-4o-mini
```

### 3. Initialize the database

```bash
npx prisma generate
npx prisma db push
```

### 4. Run the app

```bash
npm run dev


## Notes

- The app currently uses a local SQLite database file.
- If you want to deploy it later, you may want to migrate from SQLite to Postgres.
- If the ingestion flow fails, the app falls back to a lightweight title/description parser so the graph still works.

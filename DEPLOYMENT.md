# DocuMind AI - Deployment Guide

This guide describes how to deploy the DocuMind AI application in a production environment. 

---

## Architecture Overview

DocuMind AI is composed of four primary components:
1. **Database**: PostgreSQL database with the `pgvector` extension enabled (e.g., Supabase).
2. **ML Microservice (Python / Flask)**: Extracts text from PDFs, generates vector embeddings, and performs retrieval-augmented generation (RAG) using Groq.
3. **Backend API Gateway (Node.js / Express)**: Manages authentication, routes requests, proxies heavy ML operations, and queries the database directly.
4. **Frontend (React / Vite)**: User interface that communicates with the API Gateway.

```mermaid
graph TD
    Client[Browser / Frontend SPA] -->|HTTP / JSON| Gateway[Express API Gateway]
    Gateway -->|Database Queries| DB[(PostgreSQL + pgvector)]
    Gateway -->|Internal API Calls| ML[Flask ML Service]
    ML -->|Read / Write Chunks| DB
    ML -->|LLM Completion| Groq[Groq API Cloud]
```

---

## 1. Database Setup (Prerequisite)

The application requires a PostgreSQL database with `pgvector` support. **Supabase** is the recommended provider.

### Steps:
1. Create a project in [Supabase](https://supabase.com) or your preferred PostgreSQL provider.
2. Open the **SQL Editor** in your database dashboard.
3. Copy the contents of the [schema.sql](schema.sql) file.
4. Run the SQL script to:
   - Enable the `vector` extension.
   - Create the `users`, `documents`, `document_chunks`, and `chat_messages` tables.
   - Create the HNSW index on the `document_chunks` table for fast similarity searches.
5. Retrieve your database connection string (e.g., `postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres`).

---

## 2. ML Microservice Deployment (Flask)

The ML microservice is located in the `ml-service` directory. It requires Python 3.10+ and sufficient memory (at least 1GB RAM) to load the sentence-transformer model in memory.

### Environment Variables
Configure the following environment variables on your hosting provider:

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | The port the Flask app binds to. | `5001` |
| `DATABASE_URL` | PostgreSQL connection string with `pgvector`. | `postgresql://postgres:pass@host:5432/db` |
| `GROQ_API_KEY` | Your Groq Cloud API Key. | `gsk_...` |
| `EMBEDDING_MODEL_NAME` | Hugging Face model for embeddings. | `all-MiniLM-L6-v2` |

### Option A: Hosting on Render / Railway / Heroku
1. Connect your repository to the hosting provider.
2. Set the root directory for this service to `ml-service`.
3. Select **Python** as the runtime.
4. Configure the environment variables list above.
5. Set the **Build Command**:
   ```bash
   pip install -r requirements.txt
   ```
6. Set the **Start Command**:
   ```bash
   gunicorn --workers 1 --bind 0.0.0.0:$PORT --timeout 120 app:app
   ```
   *(Note: The `--timeout 120` flag is recommended as LLM generation and document indexing are long-running operations).*

### Option B: Deploying with Docker
A production [Dockerfile](ml-service/Dockerfile) is provided in the `ml-service` directory.
It pre-downloads the embedding model during the image build phase to speed up container boot times and prevent runtime network failures.
```bash
cd ml-service
docker build -t documind-ml-service .
docker run -d -p 5001:5001 --env-file .env documind-ml-service
```

---

## 3. Backend API Gateway Deployment (Express.js)

The backend API gateway is located in the `backend` directory. It requires Node.js 18+ or 20+.

### Environment Variables
Configure the following environment variables on your hosting provider:

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | The port the Express server binds to. | `5000` |
| `NODE_ENV` | App environment. Set to `production`. | `production` |
| `DATABASE_URL` | PostgreSQL connection string. | `postgresql://postgres:pass@host:5432/db` |
| `JWT_SECRET` | Secret key used to sign JWT tokens. | `a_long_random_secret_string` |
| `ML_SERVICE_URL` | URL where the ML service is hosted. | `https://your-ml-service.onrender.com` |
| `GROQ_API_KEY` | Your Groq Cloud API Key. | `gsk_...` |

### Option A: Hosting on Render / Railway / Heroku
1. Connect your repository to the hosting provider.
2. Set the root directory for this service to `backend`.
3. Select **Node.js** as the runtime.
4. Configure the environment variables.
5. Set the **Build Command**:
   ```bash
   npm ci --omit=dev
   ```
6. Set the **Start Command**:
   ```bash
   npm start
   ```

### Option B: Deploying with Docker
A multi-stage [Dockerfile](backend/Dockerfile) is provided in the `backend` directory.
```bash
cd backend
docker build -t documind-backend .
docker run -d -p 5000:5000 --env-file .env documind-backend
```

---

## 4. Frontend SPA Deployment (React / Vite)

The frontend is a static Single Page Application (SPA) located in the `fronend` directory. It should be built into static assets and hosted on a Content Delivery Network (CDN).

### Environment Variables
The frontend requires the API Gateway URL to be baked in during the build process.

| Variable | Description | Example / Default |
|---|---|---|
| `VITE_API_URL` | The public URL of your deployed Express API Gateway. | `https://your-backend-gateway.onrender.com/api` |

### Deploying to Vercel / Netlify / Cloudflare Pages
1. Connect your repository to the hosting platform.
2. Set the root directory for the build to `fronend`.
3. Configure the build settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the environment variable `VITE_API_URL` pointing to your production backend gateway API (make sure to append `/api` at the end).
5. Deploy.

---

## 5. Unified Deployment using Docker Compose

A [docker-compose.yml](docker-compose.yml) file is provided in the root directory to run the entire backend stack locally or on a single virtual private server (VPS).

### Prerequisites
- Docker and Docker Compose installed.
- A Groq API Key.

### Steps:
1. Create a `.env` file in the **root** directory of the project:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   JWT_SECRET=your_custom_production_jwt_secret_here
   ```
2. Run the command:
   ```bash
   docker compose up -d --build
   ```
3. This command will:
   - Spin up a local PostgreSQL database with the `pgvector` extension.
   - Automatically run [schema.sql](schema.sql) to initialize the database tables.
   - Build and launch the `ml-service` on port `5001`.
   - Build and launch the `backend` gateway on port `5000`.
4. Run the frontend locally pointing to this Docker stack:
   ```bash
   cd fronend
   npm install
   VITE_API_URL=http://localhost:5000/api npm run dev
   ```

---

## Troubleshooting & Best Practices

- **Cold Starts**: If using free-tier services like Render, the ML service might time out during a cold start due to the time required to load the model into memory. Consider using paid tiers or keep-alive pings to avoid spin-down.
- **File Upload Limits**: By default, Nginx or hosting providers might limit request body sizes. Ensure your hosting configurations permit uploads of the size of PDFs you intend to process (e.g., set `client_max_body_size 20M` in Nginx).
- **Database Indexing**: If you notice similar-document query speeds degrading over time as thousands of pages are uploaded, verify that the HNSW index is active on the database using your database manager.

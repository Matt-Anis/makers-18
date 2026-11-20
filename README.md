# Contract Privacy Gateway

The Next.js app lives in `frontend/` and the FastAPI app lives in `backend/`.
Both run on the app server. FastAPI will call the optional filtering model over
HTTP on a separate GPU server.

## Run locally

From the repo root, build and start both apps.

```bash
docker compose up --build
```

Open the frontend at `http://127.0.0.1:3000`. Check the API with this command.

```bash
curl -fsS http://127.0.0.1:8000/health
```

Stop the stack with `docker compose down`.

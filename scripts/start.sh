#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BUILD_FLAG=""
CLEAN_CACHE=false

for arg in "$@"; do
  case "$arg" in
    --build)
      BUILD_FLAG="--build"
      ;;
    --clean-cache)
      CLEAN_CACHE=true
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/start.sh [--build] [--clean-cache]

Options:
  --build        Rebuild Docker images before starting
  --clean-cache  Clear Next.js .next cache inside the frontend container and restart it
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

echo "Starting NYXORA services (Redis, FastAPI backend, Next.js frontend)..."
docker compose -f compose.yaml -f compose.dev.yaml up -d ${BUILD_FLAG}

if [ "$CLEAN_CACHE" = true ]; then
  echo "Clearing Next.js .next cache in frontend container..."
  docker compose exec -T frontend sh -c 'rm -rf /app/.next/*'
  docker compose restart frontend
fi

echo "Waiting for backend (http://127.0.0.1:8000/health)..."
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Waiting for frontend (http://127.0.0.1:3000)..."
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
docker compose ps
echo ""
cat <<'EOF'
============================================================
 NYXORA is up!
------------------------------------------------------------
 Frontend : http://127.0.0.1:3000
 Backend  : http://127.0.0.1:8000/health

 Local Demo Accounts (SEED_DEMO_USERS=true):
   Owner  : owner@acme.local / demo-owner-pass
            (/chat, /rules, /metrics)
   User   : user@acme.local  / demo-user-pass
            (/chat only)

 Helpful commands:
   Logs   : docker compose logs -f frontend backend
   Stop   : docker compose down
   Cache  : ./scripts/start.sh --clean-cache
============================================================
EOF

#!/usr/bin/env bash
set -euo pipefail

# Automated setup script for the NYXORA Layer 2/3 GPU SLM server (vLLM).
# Supports:
#   1) RunPod GPU Pods (runs `vllm serve` directly inside the Pod):
#        ./scripts/setup-gpu-server.sh --runpod
#   2) Dedicated Ubuntu/Debian GPU VM with Docker + NVIDIA Container Toolkit:
#        ./scripts/setup-gpu-server.sh --docker

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
GPU_DIR="${REPO_ROOT}/gpu"

MODE="auto"
if [[ "${1:-}" == "--runpod" ]]; then
  MODE="runpod"
elif [[ "${1:-}" == "--docker" ]]; then
  MODE="docker"
elif [[ -n "${RUNPOD_POD_ID:-}" ]]; then
  MODE="runpod"
else
  MODE="docker"
fi

SLM_MODEL="${SLM_MODEL:-Qwen/Qwen2.5-7B-Instruct-AWQ}"
QUANTIZATION="${QUANTIZATION:-awq}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-2048}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-0.90}"
MAX_NUM_SEQS="${MAX_NUM_SEQS:-16}"
VLLM_PORT="${VLLM_PORT:-8000}"
VLLM_API_KEY="${VLLM_API_KEY:-}"

run_on_runpod() {
  echo "[NYXORA GPU] Starting RunPod direct vLLM setup..."
  if ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "ERROR: nvidia-smi not found. Launch a GPU Pod (RTX 4090 / L4 / A10G)." >&2
    exit 1
  fi
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

  if ! command -v vllm >/dev/null 2>&1; then
    echo "[NYXORA GPU] Installing vLLM..."
    python3 -m pip install --upgrade pip
    python3 -m pip install vllm
  fi

  ARGS=(
    --host 0.0.0.0
    --port "${VLLM_PORT}"
    --model "${SLM_MODEL}"
    --enable-prefix-caching
    --max-model-len "${MAX_MODEL_LEN}"
    --gpu-memory-utilization "${GPU_MEMORY_UTILIZATION}"
    --max-num-seqs "${MAX_NUM_SEQS}"
  )
  if [[ -n "${QUANTIZATION}" ]]; then
    ARGS+=(--quantization "${QUANTIZATION}")
  fi
  if [[ -n "${VLLM_API_KEY}" ]]; then
    ARGS+=(--api-key "${VLLM_API_KEY}")
  fi

  echo ""
  echo "[NYXORA GPU] Ready to serve ${SLM_MODEL} on port ${VLLM_PORT}."
  if [[ -n "${RUNPOD_POD_ID:-}" ]]; then
    echo "[NYXORA GPU] Paste this into NYXORA Owner Settings (/rules):"
    echo "  Endpoint: https://${RUNPOD_POD_ID}-${VLLM_PORT}.proxy.runpod.net/v1"
    echo "  Model ID: ${SLM_MODEL}"
  fi
  echo ""

  exec vllm serve "${ARGS[@]}"
}

run_on_docker_vm() {
  echo "[NYXORA GPU] Starting Docker + vLLM GPU server setup..."
  if ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "ERROR: NVIDIA GPU driver (nvidia-smi) not detected on host." >&2
    exit 1
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is not installed. Install Docker Engine + nvidia-container-toolkit first." >&2
    exit 1
  fi

  if [[ ! -f "${GPU_DIR}/.env" ]]; then
    cp "${GPU_DIR}/.env.example" "${GPU_DIR}/.env"
    echo "[NYXORA GPU] Created ${GPU_DIR}/.env from .env.example (edit to set VLLM_API_KEY)."
  fi

  docker compose --env-file "${GPU_DIR}/.env" -f "${GPU_DIR}/compose.gpu.yaml" up -d

  echo "[NYXORA GPU] Waiting for vLLM health endpoint on http://127.0.0.1:${VLLM_PORT}/health ..."
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${VLLM_PORT}/health" >/dev/null 2>&1; then
      echo "[NYXORA GPU] vLLM is healthy and ready!"
      echo "  Endpoint: http://<gpu-server-ip>:${VLLM_PORT}/v1"
      echo "  Model ID: ${SLM_MODEL}"
      exit 0
    fi
    sleep 5
  done

  echo "WARNING: vLLM is still warming up (downloading model weights). Check logs with:"
  echo "  docker compose -f ${GPU_DIR}/compose.gpu.yaml logs -f vllm"
}

if [[ "${MODE}" == "runpod" ]]; then
  run_on_runpod
else
  run_on_docker_vm
fi

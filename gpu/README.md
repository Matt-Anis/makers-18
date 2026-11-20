# NYXORA Layer 2/3 GPU SLM Server (vLLM)

Runs an OpenAI-compatible **vLLM** inference server for NYXORA's extraction-only SLM pass (`OpenAICompatibleSLMDetector`), tuned for 8-way concurrent ~380-word chunks (`--enable-prefix-caching`, `--max-model-len 2048`, `--quantization awq`).

## Option A — RunPod GPU Pod (Recommended for Hackathon)

1. Deploy a **1× RTX 4090 / L4 / A10G (24 GB VRAM)** Pod on RunPod using the **PyTorch** or **vLLM** template, and **expose HTTP Port `8000`**.
2. Open the Pod terminal (or SSH in) and run:

   ```bash
   export VLLM_API_KEY="replace-with-a-random-secret"
   ./scripts/setup-gpu-server.sh --runpod
   ```

   *(Or run `vllm serve` directly without cloning the repo:)*

   ```bash
   vllm serve Qwen/Qwen2.5-7B-Instruct-AWQ \
     --host 0.0.0.0 --port 8000 \
     --quantization awq \
     --enable-prefix-caching \
     --max-model-len 2048 \
     --gpu-memory-utilization 0.90 \
     --max-num-seqs 16 \
     --api-key "replace-with-a-random-secret"
   ```

3. In NYXORA, log in as **Owner** (`owner@acme.local` / `demo-owner-pass`) → **`/rules`** → **Workspace Settings**:
   - **Enable GPU SLM:** `ON`
   - **Endpoint:** `https://<your-pod-id>-8000.proxy.runpod.net/v1`
   - **SLM Model ID:** `Qwen/Qwen2.5-7B-Instruct-AWQ`
   - **Optional Bearer API Key:** the `VLLM_API_KEY` you chose above (stored Fernet-encrypted in SQLite)

## Option B — Dedicated NVIDIA Linux VM (Docker Compose)

```bash
cp gpu/.env.example gpu/.env
# Edit gpu/.env to set VLLM_API_KEY (recommended)
./scripts/setup-gpu-server.sh --docker
```

## Quick Verification

```bash
curl -fsS -H "Authorization: Bearer $VLLM_API_KEY" \
  https://<your-pod-id>-8000.proxy.runpod.net/v1/models
```

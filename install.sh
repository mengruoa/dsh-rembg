#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
export PIP_CACHE_DIR="$ROOT_DIR/.pip-cache"
export PIP_DISABLE_PIP_VERSION_CHECK=1
export PYTHONNOUSERSITE=1
export ORT_DISABLE_TELEMETRY=1
PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}"
export PIP_INDEX_URL
VENV_DIR="$ROOT_DIR/.venv"
MODEL_FILE="$ROOT_DIR/.u2net/models/u2net/u2net.onnx"
MODEL_URL="${GH_MIRROR:-https://ghfast.top/}https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"
MODEL_MD5="60024c5c889badc19c04ad937298a77b"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/install.log"
log() { printf '\n[gpu-install] %s\n' "$*" | tee -a "$LOG_FILE"; }
is_ready() {
  [ -x "$VENV_DIR/bin/python" ] || return 1
  "$VENV_DIR/bin/python" -c 'import rembg, onnxruntime; assert "CUDAExecutionProvider" in onnxruntime.get_available_providers()' >/dev/null 2>&1 || return 1
  [ -f "$MODEL_FILE" ] || return 1
  echo "$MODEL_MD5  $MODEL_FILE" | md5sum -c - >/dev/null 2>&1
}
if is_ready; then log "GPU rembg 环境已就绪"; exit 0; fi
command -v nvidia-smi >/dev/null 2>&1 || { log "未找到 nvidia-smi，无法安装 GPU 环境"; exit 2; }
nvidia-smi -L | tee -a "$LOG_FILE"
python3 -m venv "$VENV_DIR"
PY="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"
"$PY" -m pip install --upgrade pip >>"$LOG_FILE" 2>&1
log "安装 rembg 与 onnxruntime-gpu"
"$PIP" install 'rembg' 'onnxruntime-gpu' >>"$LOG_FILE" 2>&1
"$PY" -c 'import onnxruntime; assert "CUDAExecutionProvider" in onnxruntime.get_available_providers(), onnxruntime.get_available_providers()' >>"$LOG_FILE" 2>&1
mkdir -p "$(dirname "$MODEL_FILE")"
curl -L --fail --retry 3 --retry-delay 2 -o "$MODEL_FILE" "$MODEL_URL" >>"$LOG_FILE" 2>&1
echo "$MODEL_MD5  $MODEL_FILE" | md5sum -c - | tee -a "$LOG_FILE"
log "GPU rembg 环境安装完成"
rm -rf PIP_CACHE_DIR
#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
mkdir -p "$ROOT_DIR"
cd "$ROOT_DIR"
PYTHON311_DIR="$ROOT_DIR/.python3.11"
PYTHON311="$PYTHON311_DIR/bin/python3"
PYTHON311_VERSION="3.11.16"
PYTHON311_RELEASE="20260825"
PYTHON311_TGZ="cpython-${PYTHON311_VERSION}+${PYTHON311_RELEASE}-x86_64-unknown-linux-gnu-install_only.tar.gz"
PYTHON311_URL="https://gh-proxy.com/https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON311_RELEASE}/${PYTHON311_TGZ}"
export PIP_CACHE_DIR="$ROOT_DIR/.pip-cache"
export PIP_DISABLE_PIP_VERSION_CHECK=1
export PYTHONNOUSERSITE=1
export ORT_DISABLE_TELEMETRY=1
: "${PIP_INDEX_URL:=https://mirrors.aliyun.com/pypi/simple/}"
case "$PIP_INDEX_URL" in
  https://mirrors.aliyun.com/pypi/simple/|https://pypi.org/simple) ;;
  *) echo "只允许阿里云或官方 PyPI 镜像" >&2; exit 2 ;;
esac
export PIP_INDEX_URL
VENV_DIR="$ROOT_DIR/.venv"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/install.log"
log() { printf '\n[gpu-install] %s\n' "$*" | tee -a "$LOG_FILE"; }
is_ready() {
  if [ -f "$ROOT_DIR/.install-mode" ] && [ "$(cat "$ROOT_DIR/.install-mode")" = "gpu" ] && [ -x "$VENV_DIR/bin/python" ]; then
    NVIDIA_LIBS=$(find "$VENV_DIR/lib" -path '*/nvidia/*/lib' -type d 2>/dev/null | tr '\n' ':')
    LD_LIBRARY_PATH="${NVIDIA_LIBS}${LD_LIBRARY_PATH:-}" "$VENV_DIR/bin/python" -c 'import rembg, onnxruntime; assert "CUDAExecutionProvider" in onnxruntime.get_available_providers()' >/dev/null 2>&1
  else
    return 1
  fi
}
if is_ready; then log "GPU Python 环境已就绪，跳过安装"; exit 0; fi
command -v nvidia-smi >/dev/null 2>&1 || { log "未找到 nvidia-smi，无法安装 GPU 环境"; exit 2; }
nvidia-smi -L | tee -a "$LOG_FILE"
if [ ! -x "$PYTHON311" ]; then
  log "下载独立 Python ${PYTHON311_VERSION} ..."
  PYTHON_TGZ_PATH="$ROOT_DIR/python3.11.tar.gz"
  if command -v curl >/dev/null 2>&1; then
    curl -fL -o "$PYTHON_TGZ_PATH" "$PYTHON311_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$PYTHON_TGZ_PATH" "$PYTHON311_URL"
  else
    log "未找到 curl 或 wget，无法下载独立 Python"; exit 2
  fi
  mkdir -p "$PYTHON311_DIR"
  tar xzf "$PYTHON_TGZ_PATH" -C "$PYTHON311_DIR" --strip-components=1
  rm -f "$PYTHON_TGZ_PATH"
  log "独立 Python ${PYTHON311_VERSION} 就绪"
fi
log "清理旧 Python 环境"
rm -rf "$VENV_DIR"
"$PYTHON311" -m venv "$VENV_DIR"
PY="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"
"$PY" -m pip install --upgrade pip >>"$LOG_FILE" 2>&1
log "安装 rembg 与 onnxruntime-gpu==1.24.1 及 CUDA 运行时库"
"$PIP" install rembg "onnxruntime-gpu==1.24.1" \
  nvidia-cublas-cu12 nvidia-cudnn-cu12 nvidia-curand-cu12 \
  nvidia-cusolver-cu12 nvidia-cusparse-cu12 nvidia-cufft-cu12 \
  nvidia-cuda-runtime-cu12 nvidia-cuda-nvrtc-cu12 >>"$LOG_FILE" 2>&1
# 设置 LD_LIBRARY_PATH 以便 onnxruntime 找到 CUDA 库
NVIDIA_LIBS=$(find "$VENV_DIR/lib" -path '*/nvidia/*/lib' -type d 2>/dev/null | tr '\n' ':')
export LD_LIBRARY_PATH="${NVIDIA_LIBS}${LD_LIBRARY_PATH:-}"
"$PY" -c 'import onnxruntime; assert "CUDAExecutionProvider" in onnxruntime.get_available_providers(), onnxruntime.get_available_providers()' >>"$LOG_FILE" 2>&1
printf 'gpu\n' > "$ROOT_DIR/.install-mode"
log "清理 pip 缓存"
rm -rf "$PIP_CACHE_DIR"
log "GPU Python 环境安装完成；请在设置页单独管理模型"

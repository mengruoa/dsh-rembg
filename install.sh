#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
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
  [ -f "$ROOT_DIR/.install-mode" ] && [ "$(cat "$ROOT_DIR/.install-mode")" = "gpu" ] && [ -x "$VENV_DIR/bin/python" ] && "$VENV_DIR/bin/python" -c 'import rembg, onnxruntime; assert "CUDAExecutionProvider" in onnxruntime.get_available_providers()' >/dev/null 2>&1
}
if is_ready; then log "GPU Python 环境已就绪，跳过安装"; exit 0; fi
command -v nvidia-smi >/dev/null 2>&1 || { log "未找到 nvidia-smi，无法安装 GPU 环境"; exit 2; }
nvidia-smi -L | tee -a "$LOG_FILE"
log "清理旧 Python 环境"
rm -rf "$VENV_DIR"
python3 -m venv "$VENV_DIR"
PY="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"
"$PY" -m pip install --upgrade pip >>"$LOG_FILE" 2>&1
log "安装 rembg 与 onnxruntime-gpu（不下载模型）"
"$PIP" install rembg onnxruntime-gpu >>"$LOG_FILE" 2>&1
"$PY" -c 'import onnxruntime; assert "CUDAExecutionProvider" in onnxruntime.get_available_providers(), onnxruntime.get_available_providers()' >>"$LOG_FILE" 2>&1
printf 'gpu\n' > "$ROOT_DIR/.install-mode"
log "清理 pip 缓存"
rm -rf "$PIP_CACHE_DIR"
log "GPU Python 环境安装完成；请在设置页单独管理模型"

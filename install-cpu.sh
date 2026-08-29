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
LOG_FILE="$LOG_DIR/install-cpu.log"
log() { printf '\n[cpu-install] %s\n' "$*" | tee -a "$LOG_FILE"; }

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
log "安装 rembg CPU 依赖（不下载模型）"
"$PIP" install 'rembg[cpu]' >>"$LOG_FILE" 2>&1
"$PY" -c 'import rembg, onnxruntime; assert "CPUExecutionProvider" in onnxruntime.get_available_providers()' >>"$LOG_FILE" 2>&1
printf 'cpu\n' > "$ROOT_DIR/.install-mode"
log "清理 pip 缓存"
rm -rf "$PIP_CACHE_DIR"
log "CPU Python 环境安装完成；请在设置页单独管理模型"

#!/usr/bin/env bash
# =============================================================================
# install.sh —— 在插件目录内搭建 rembg 环境并下载 u2net 模型（幂等）
#
# 与 setup.sh 相同的隔离原则：只操作本脚本所在目录，不碰全局/用户环境。
#   - venv -> 本目录 .venv
#   - pip 下载缓存 -> 本目录 .pip-cache（不写 ~/.cache/pip）
#   - 模型 -> 本目录 .u2net（U2NET_HOME 指向本目录）
#   - 关闭 pip 版本自检 / 用户 site-packages / onnxruntime 遥测
#
# 幂等：如果 venv + rembg + 模型（MD5 校验）均已就绪，直接退出，不重复安装。
# 用法：bash install.sh   （插件首次调用 rembg 工具时会自动执行）
# =============================================================================

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export PIP_CACHE_DIR="$ROOT_DIR/.pip-cache"
export PIP_DISABLE_PIP_VERSION_CHECK=1
export PYTHONNOUSERSITE=1
export ORT_DISABLE_TELEMETRY=1

VENV_DIR="$ROOT_DIR/.venv"
MODEL_HOME="$ROOT_DIR/.u2net"
MODEL_DIR="$MODEL_HOME/models/u2net"
MODEL_FILE="$MODEL_DIR/u2net.onnx"

MODEL_URL="https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"
MODEL_MD5="60024c5c889badc19c04ad937298a77b"

LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/install.log"

log() { printf '\n[install] %s\n' "$*" | tee -a "$LOG_FILE"; }

# --- 幂等检查：venv、rembg、模型（MD5）三者都就绪即视为已安装 ---
is_ready() {
  [ -x "$VENV_DIR/bin/python" ] || return 1
  "$VENV_DIR/bin/python" -c "import rembg" >/dev/null 2>&1 || return 1
  [ -f "$MODEL_FILE" ] || return 1
  echo "$MODEL_MD5  $MODEL_FILE" | md5sum -c - >/dev/null 2>&1 || return 1
  return 0
}

if is_ready; then
  log "rembg 环境已就绪，跳过安装：$ROOT_DIR"
  exit 0
fi

log "开始安装 rembg 环境：$ROOT_DIR（$(date '+%Y-%m-%d %H:%M:%S %z')）"
printf '系统 Python：%s -> %s\n' "$(python3 --version 2>&1)" "$(command -v python3)" | tee -a "$LOG_FILE"

# 1. venv（若已损坏则重建）
if [ -d "$VENV_DIR" ]; then
  log "检测到旧 .venv，删除重建以保证干净环境"
  rm -rf "$VENV_DIR"
fi
python3 -m venv "$VENV_DIR"
PY="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"
log "venv 就绪：$("$PY" --version)"
"$PY" -m pip install --upgrade pip >> "$LOG_FILE" 2>&1

# 2. rembg[cpu]（首次约需数分钟）
log "安装 rembg[cpu] …"
"$PIP" install "rembg[cpu]" >> "$LOG_FILE" 2>&1

# 3. 下载 u2net 模型（MD5 校验）
log "下载 u2net 模型 …"
mkdir -p "$MODEL_DIR"
curl -L --fail --retry 3 --retry-delay 2 -o "$MODEL_FILE" "$MODEL_URL" >> "$LOG_FILE" 2>&1
echo "$MODEL_MD5  $MODEL_FILE" | md5sum -c - | tee -a "$LOG_FILE"

log "安装完成：venv + rembg[cpu] + u2net.onnx 均已就绪（日志见 logs/install.log）"

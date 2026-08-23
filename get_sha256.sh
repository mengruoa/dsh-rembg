#!/usr/bin/env bash
# Usage: ./get_sha256.sh <github_release_download_url>
# Example: ./get_sha256.sh https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <github_release_download_url>"
  echo "Example: $0 https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx"
  exit 1
fi

URL="$1"

# 从 URL 提取 owner/repo/tag/asset_name
# 格式: https://github.com/{owner}/{repo}/releases/download/{tag}/{asset_name}
if [[ ! "$URL" =~ ^https?://github\.com/([^/]+)/([^/]+)/releases/download/([^/]+)/(.+)$ ]]; then
  echo "错误: URL 格式不合法"
  echo "期望格式: https://github.com/{owner}/{repo}/releases/download/{tag}/{asset_name}"
  exit 1
fi

OWNER="${BASH_REMATCH[1]}"
REPO="${BASH_REMATCH[2]}"
TAG="${BASH_REMATCH[3]}"
ASSET_NAME="${BASH_REMATCH[4]}"

echo "仓库: $OWNER/$REPO"
echo "Tag:  $TAG"
echo "资源: $ASSET_NAME"
echo "---"

API_URL="https://api.github.com/repos/$OWNER/$REPO/releases/tags/$TAG"

# 使用 Python 解析 JSON（jq 不可用时作为备选）
DIGEST=$(python3 - "$API_URL" "$ASSET_NAME" <<'PYEOF'
import sys
import json
import urllib.request
import os

api_url = sys.argv[1]
asset_name = sys.argv[2]

# 如果有 gh token，使用它
token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
headers = {}
if token:
    headers["Authorization"] = f"token {token}"
    headers["Accept"] = "application/vnd.github.v3+json"

req = urllib.request.Request(api_url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
except urllib.error.HTTPError as e:
    if e.code == 404:
        print(f"错误: Tag '{asset_name}' 不存在或仓库为私有", file=sys.stderr)
        sys.exit(1)
    elif e.code == 403:
        print("错误: 仓库是私有的，请先设置 GH_TOKEN 并登录 (gh auth login)", file=sys.stderr)
        sys.exit(1)
    raise

digest = None
for asset in data.get("assets", []):
    if asset.get("name") == asset_name:
        d = asset.get("digest") or ""
        # 移除 sha256: 前缀
        if d.startswith("sha256:"):
            d = d[7:]
        digest = d
        break

if not digest:
    print(f"错误: 未找到资产 '{asset_name}' 或 digest 不可用", file=sys.stderr)
    sys.exit(1)

print(digest)
PYEOF
)

if [[ -z "$DIGEST" ]]; then
  echo "错误: 未找到资产 '$ASSET_NAME' 或 digest 不可用"
  echo "可能原因:"
  echo "  1. Tag 不存在"
  echo "  2. 资产名称不匹配"
  echo "  3. 仓库是私有的，需要认证 (gh auth login)"
  exit 1
fi

echo "SHA256: $DIGEST"

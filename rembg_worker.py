#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rembg_worker.py —— 供插件调用的 Python 工作进程：移除图像背景。

用法:
    python rembg_worker.py --input IN.png --output OUT.png [--model u2net]

行为:
    - import rembg 之前把 U2NET_HOME 固定到本脚本所在目录的 .u2net，
      保证只读本插件目录下的模型，不访问 ~ 目录。
    - 成功时最后一行打印 JSON:
        {"input": ..., "output": ..., "model": ..., "width": W, "height": H}
    - 失败时向 stderr 打印 {"error": "..."} 并以非零码退出。
"""

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("U2NET_HOME", os.path.join(ROOT, ".u2net"))
os.environ.setdefault("ORT_DISABLE_TELEMETRY", "1")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="输入图像绝对路径")
    ap.add_argument("--output", required=True, help="输出透明背景 PNG 绝对路径")
    ap.add_argument("--model", default="u2net", help="rembg 模型名")
    args = ap.parse_args()

    # 延迟导入：确保上面 U2NET_HOME 已生效后再加载 rembg
    from rembg import remove, new_session
    from PIL import Image

    session = new_session(args.model)
    img = Image.open(args.input)
    out = remove(img, session=session).convert("RGBA")

    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)
    out.save(args.output)

    print(json.dumps({
        "input": os.path.abspath(args.input),
        "output": os.path.abspath(args.output),
        "model": args.model,
        "width": out.size[0],
        "height": out.size[1],
    }))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": f"{type(e).__name__}: {e}"}), file=sys.stderr)
        sys.exit(1)

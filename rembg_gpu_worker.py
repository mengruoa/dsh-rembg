#!/usr/bin/env python3
import argparse, json, os, sys, glob
ROOT = os.path.dirname(os.path.abspath(__file__))
# 数据目录：优先用 U2NET_HOME 的父目录（新布局 ~/.dsh/rembg），否则退回脚本目录（兼容旧布局）
DATA_DIR = os.path.dirname(os.path.expanduser(os.environ['U2NET_HOME'])) if os.environ.get('U2NET_HOME') else ROOT
os.environ.setdefault('U2NET_HOME', os.path.join(DATA_DIR, '.u2net'))
os.environ.setdefault('ORT_DISABLE_TELEMETRY', '1')
# 设置 LD_LIBRARY_PATH 以便 onnxruntime 找到 CUDA 运行时库
_nvidia_libs = ':'.join(glob.glob(os.path.join(DATA_DIR, '.venv/lib/python*/site-packages/nvidia/*/lib')))
if _nvidia_libs:
    os.environ['LD_LIBRARY_PATH'] = _nvidia_libs + ':' + os.environ.get('LD_LIBRARY_PATH', '')
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True); ap.add_argument('--output', required=True); ap.add_argument('--model', default='u2net'); ap.add_argument('--cpu', action='store_true', help='强制使用 CPU 推理')
    args = ap.parse_args()
    from rembg import remove, new_session
    from PIL import Image
    import onnxruntime
    if args.cpu:
        session = new_session(args.model, providers=['CPUExecutionProvider'])
    else:
        providers = onnxruntime.get_available_providers()
        if 'CUDAExecutionProvider' in providers:
            session = new_session(args.model, providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
        elif 'CPUExecutionProvider' in providers:
            session = new_session(args.model, providers=['CPUExecutionProvider'])
        else:
            raise RuntimeError(f'onnxruntime 未提供可用执行 provider：{providers}')
    out = remove(Image.open(args.input), session=session).convert('RGBA')
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    out.save(args.output)
    print(json.dumps({'input': os.path.abspath(args.input), 'output': os.path.abspath(args.output), 'model': args.model, 'width': out.width, 'height': out.height}))
if __name__ == '__main__':
    try: main()
    except Exception as e:
        print(json.dumps({'error': f'{type(e).__name__}: {e}'}), file=sys.stderr); sys.exit(1)

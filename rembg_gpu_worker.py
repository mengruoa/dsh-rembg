#!/usr/bin/env python3
import argparse, json, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault('U2NET_HOME', os.path.join(ROOT, '.u2net'))
os.environ.setdefault('ORT_DISABLE_TELEMETRY', '1')
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True); ap.add_argument('--output', required=True); ap.add_argument('--model', default='u2net')
    args = ap.parse_args()
    from rembg import remove, new_session
    from PIL import Image
    import onnxruntime
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

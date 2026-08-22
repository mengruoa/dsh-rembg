# dsh-rembg-gpu —— GPU 版图像背景移除工具

在 DSH 里给大模型注册一个 `rembg_gpu` 工具：输入一张图片路径，使用本地 NVIDIA GPU 输出透明背景 PNG。

首次调用工具时，插件会在**自己的目录**内自动安装 rembg + onnxruntime-gpu 环境（等价于 `install.sh` 做的事）：

```
rembg-gpu-plugin/
├── .venv/                  # Python 虚拟环境（rembg + onnxruntime-gpu）
├── .u2net/                 # u2net.onnx 模型（MD5 校验）
├── .pip-cache/             # pip 下载缓存（不写 ~/.cache/pip）
├── logs/install.log        # 安装日志
├── install.sh              # 幂等安装脚本（可手动预装：bash install.sh）
├── rembg_gpu_worker.py     # 实际执行 remove() 的 Python 工作进程
├── index.js                # 插件入口（导出 apply）
├── cordis.patch.yml        # 打包安装用的补丁层
└── package.json            # bundle 清单（dsh.bundle）
```

全流程只写插件目录，不触碰系统/用户 Python。

## GPU 要求

设置页会调用 `nvidia-smi -L` 检查 NVIDIA GPU。没有 NVIDIA 设备、驱动不可用或 `nvidia-smi` 失败时，页面会显示原因，并禁用「初始化环境」。

安装脚本还会在虚拟环境中验证 `onnxruntime-gpu` 提供 `CUDAExecutionProvider`。安装失败不会被标记为已安装。

## 一、安装

插件是纯 ESM JS，无需构建，可直接安装。

### 方式 A：从 npm 安装（推荐）

```sh
dsh plugin --profile web add dsh-rembg-gpu
```

`dsh plugin` 会把 `dsh-rembg-gpu` 装进 `web` profile 并追加为 bundle 层。

验证：

```sh
dsh --profile web --dump-config   # 应出现 "# == dsh-rembg-gpu" 层
dsh --profile web
```

卸载：

```sh
dsh plugin --profile web remove dsh-rembg-gpu
```

### 方式 B：从 GitHub 安装

```sh
dsh plugin --profile web add github:mengruoa/dsh-rembg-gpu
```

### 方式 C：本地开发（--patch）

Clone 仓库后，先把 `cordis.patch.dev.yml` 里的 `name` 改成**你本机的绝对路径**
（`--patch` 的插件路径必须是绝对路径），然后在仓库根目录运行：

```sh
pnpm dsh web --patch ./cordis.patch.dev.yml
```

打开 http://127.0.0.1:3080，对模型说：

> 用 rembg_gpu 工具把 /path/to/photo.png 的背景去掉。

首次调用会触发自动安装（pip 装 rembg + onnxruntime-gpu，约几分钟），完成后在输入图同目录生成
`photo_no_bg_gpu.png`。

> 想避免首次调用的等待，可先手动 `bash install.sh` 预装。

### 安装后的 installDir 注意点

安装为 bundle 后，插件默认把环境装到 `import.meta.url` 所在目录（即
`node_modules/dsh-rembg-gpu/`）。它通常可写，但 **重装/升级会清掉已装环境**。
建议在 profile 的 `cordis.patch.yml` 里把安装目录固定到持久位置：

```yaml
- id: rembg-gpu
  name: dsh-rembg-gpu
  config:
    installDir: '/home/you/.dsh/rembg-gpu'
```

## 二、设置页面

打开 Web GUI 的**设置 → 插件 → 插件配置 → rembg GPU 图像背景移除**，可以选择 PyPI/GitHub 镜像源，查看当前安装状态（已安装、未安装、正在安装），并点击**初始化环境**。初始化会在 `installDir` 内执行幂等的 `install.sh`，不会写入全局 Python 环境；之后工具调用直接复用该环境。

页面显示：
- GPU 环境是否满足要求
- 已安装 / 未安装 / 正在安装
- 安装错误信息

设置页保存的镜像源会同时影响 pip 依赖与 u2net 模型下载。

### 参数配置

| 字段 | 默认 | 说明 |
|------|------|------|
| `model` | `u2net` | 默认模型；调用时可用参数覆盖 |
| `timeoutMs` | `600000` | 单次调用（含首次安装）超时 |
| `autoInstall` | `true` | 首次调用自动安装；`false` 则需先手动 `bash install.sh` |

### 镜像源（国内加速）

`install.sh` 默认已走国内镜像，全部可用环境变量覆盖，留空则回退官方源：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PIP_INDEX_URL` | `https://pypi.tuna.tsinghua.edu.cn/simple` | pip 下载源；备选：阿里云 `https://mirrors.aliyun.com/pypi/simple/`、中科大 `https://pypi.mirrors.ustc.edu.cn/simple/` |
| `GH_MIRROR` | `https://ghfast.top/` | GitHub 下载加速前缀；备选 `https://gh-proxy.com/`、`https://ghproxy.net/`；留空 = 直连 GitHub |

手动预装时同样生效：`bash install.sh`。

## 三、工具契约

- **入参**：`path`（必填，输入图绝对路径）、`model`（可选）。
- **返回**（canonical 值，同时是 Code Mode 的 `await tools.rembg_gpu(...)` 返回值）：
  `{ output, input, model, width, height }`。
- **输出文件**：写在输入同目录，文件名 `<原名>_no_bg_gpu.png`。
- 首次安装、进程超时/取消均遵循 `exec.signal`。

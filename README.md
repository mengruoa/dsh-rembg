# dsh-rembg —— 为模型提供「移除图像背景」工具

在 DSH 里给大模型注册一个 `rembg` 工具：输入一张图片路径，输出透明背景 PNG。

首次调用工具时，插件会在**自己的目录**内自动安装 rembg 环境（等价于 `install.sh` 做的事）：

```
rembg-plugin/
├── .venv/            # Python 虚拟环境（rembg[cpu] + onnxruntime）
├── .u2net/           # u2net.onnx 模型（MD5 校验）
├── .pip-cache/       # pip 下载缓存（不写 ~/.cache/pip）
├── logs/install.log  # 安装日志
├── install.sh        # 幂等安装脚本（可手动预装：bash install.sh）
├── rembg_worker.py   # 实际执行 remove() 的 Python 工作进程
├── index.js          # 插件入口（导出 apply）
├── cordis.patch.yml  # 打包安装用的补丁层
└── package.json      # bundle 清单（dsh.bundle）
```

全流程只写插件目录，不触碰系统/用户 Python。

## 一、安装

插件是纯 ESM JS，无需构建，可直接安装。

### 方式 A：从 npm 安装（推荐）

```sh
dsh plugin --profile web add dsh-rembg
```

`dsh plugin` 会把 `dsh-rembg` 装进 `web` profile 并追加为 bundle 层。

验证：

```sh
dsh --profile web --dump-config   # 应出现 "# == dsh-rembg" 层
dsh --profile web
```

卸载：

```sh
dsh plugin --profile web remove dsh-rembg
```

### 方式 B：从 GitHub 安装

```sh
dsh plugin --profile web add github:mengruoa/dsh-rembg
```

### 方式 C：本地开发（--patch）

Clone 仓库后，先把 `cordis.patch.dev.yml` 里的 `name` 改成**你本机的绝对路径**
（`--patch` 的插件路径必须是绝对路径），然后在仓库根目录运行：

```sh
pnpm dsh web --patch ./cordis.patch.dev.yml
```

打开 http://127.0.0.1:3080，对模型说：

> 用 rembg 工具把 /path/to/photo.png 的背景去掉。

首次调用会触发自动安装（pip 装 rembg[cpu]，约几分钟），完成后在输入图同目录生成
`photo_no_bg.png`。

> 想避免首次调用的等待，可先手动 `bash install.sh` 预装。

### 安装后的 installDir 注意点

安装为 bundle 后，插件默认把环境装到 `import.meta.url` 所在目录（即
`node_modules/dsh-rembg/`）。它通常可写，但 **重装/升级会清掉已装环境**。
建议在 profile 的 `cordis.patch.yml` 里把安装目录固定到持久位置：

```yaml
- id: rembg
  name: dsh-rembg
  config:
    installDir: '/home/you/.dsh/rembg'
```

## 二、设置页面

打开 Web GUI 的**设置 → 插件 → 插件配置 → rembg 图像背景移除**，可以选择 PyPI/GitHub 镜像源，查看当前安装状态（已安装、未安装、正在安装），并点击**初始化环境**。初始化会在 `installDir` 内执行幂等的 `install.sh`，不会写入全局 Python 环境；之后工具调用直接复用该环境。设置页保存的镜像源会同时影响 pip 依赖与 u2net 模型下载。


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
- **返回**（canonical 值，同时是 Code Mode 的 `await tools.rembg(...)` 返回值）：
  `{ output, input, model, width, height }`。
- **输出文件**：写在输入同目录，文件名 `<原名>_no_bg.png`。
- 首次安装、进程超时/取消均遵循 `exec.signal`。

## 四、如果要 TypeScript

把 `index.js` 改写为 `index.ts`（`defineTool` 会给 `args` 自动推断类型），
并在 `package.json` 加 `prepare` 脚本用 tsdown 编译出 `index.js` 再发布
（见 DSH 文档 docs/user/develop/basic/publish.md「git 安装的 build-script 坑」）。

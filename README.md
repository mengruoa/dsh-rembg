# dsh-rembg —— 为模型提供「移除图像背景」工具

在 DSH 里给大模型注册一个 `rembg` 工具：输入一张图片路径，输出透明背景 PNG。

首次调用工具时，插件会在**自己的目录**内自动安装 rembg 环境（等价于 `setup.sh` 做的事）：

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

## 一、开发期加载（--patch）

在 deepseek-harness 仓库根目录运行：

```sh
pnpm dsh web --patch /root/test2/rembg-plugin/cordis.patch.dev.yml
```

打开 http://127.0.0.1:3080，对模型说：

> 用 rembg 工具把 /root/test2/spr_dongqing.png 的背景去掉。

首次调用会触发自动安装（pip 装 rembg[cpu]，约几分钟），完成后返回输出路径
`/root/test2/spr_dongqing_no_bg.png`。

> 想避免首次调用的等待，可先手动 `bash /root/test2/rembg-plugin/install.sh` 预装。

## 二、打包成 bundle 并安装

`index.js` 是纯 ESM JS，无需构建，可直接打包/安装。在 `rembg-plugin` 的上级目录：

```sh
# 方式 A：本地 checkout 安装进 profile
dsh plugin --profile demo add ./rembg-plugin

# 方式 B：打成 tarball 再装
pnpm pack ./rembg-plugin
dsh plugin --profile demo add ./dsh-rembg-0.1.0.tgz

# 验证
dsh --profile demo --dump-config   # 应出现 "# == dsh-rembg" 层
dsh --profile demo
```

`dsh plugin --profile demo remove dsh-rembg` 卸载。

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

## 三、配置项

| 字段 | 默认 | 说明 |
|------|------|------|
| `installDir` | 插件源文件目录 | venv + 模型 + 日志所在目录 |
| `model` | `u2net` | 默认模型；调用时可用参数覆盖 |
| `timeoutMs` | `600000` | 单次调用（含首次安装）超时 |
| `autoInstall` | `true` | 首次调用自动安装；`false` 则需先手动 `bash install.sh` |

### 镜像源（国内加速）

`install.sh` 默认已走国内镜像，全部可用环境变量覆盖，留空则回退官方源：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PIP_INDEX_URL` | `https://pypi.tuna.tsinghua.edu.cn/simple` | pip 下载源；备选：阿里云 `https://mirrors.aliyun.com/pypi/simple/`、中科大 `https://pypi.mirrors.ustc.edu.cn/simple/` |
| `GH_MIRROR` | `https://ghfast.top/` | GitHub 下载加速前缀；备选 `https://gh-proxy.com/`、`https://ghproxy.net/`；留空 = 直连 GitHub |

手动预装时同样生效：`bash install.sh`，或用 `GH_MIRROR= GH_MIRROR="" ...` 之类覆盖。

## 四、工具契约

- **入参**：`path`（必填，输入图绝对路径）、`model`（可选）。
- **返回**（canonical 值，同时是 Code Mode 的 `await tools.rembg(...)` 返回值）：
  `{ output, input, model, width, height }`。
- **输出文件**：写在输入同目录，文件名 `原名_no_bg.png`。
- 首次安装、进程超时/取消均遵循 `exec.signal`。

## 五、如果要 TypeScript

把 `index.js` 改写为 `index.ts`（`defineTool` 会给 `args` 自动推断类型），
并在 `package.json` 加 `prepare` 脚本用 tsdown 编译出 `index.js` 再发布
（见 docs/user/develop/basic/publish.md「git 安装的 build-script 坑」）。

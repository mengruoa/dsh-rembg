# dsh-rembg-gpu

DSH 的 GPU 图像背景移除插件，使用本地 NVIDIA GPU 注册 `rembg_gpu` 工具。

## 安装

### npm（推荐）

```sh
dsh plugin --profile web add dsh-rembg-gpu
```

### GitHub

```sh
dsh plugin --profile web add github:mengruoa/dsh-rembg-gpu
```

安装后启动 DSH：

```sh
dsh --profile web
```

也可以在插件目录中提前安装 Python GPU 依赖：

```sh
bash install.sh
```

插件不会修改系统 Python，依赖和模型均保存在插件的安装目录中。

## 配置

打开 Web GUI 的**设置 → 插件 → 插件配置 → rembg GPU 图像背景移除**：

1. 确认 GPU 环境检查通过。
2. 点击**初始化环境**安装 `rembg` 和 `onnxruntime-gpu`。
3. 在模型列表中安装要使用的模型。
4. 在配置中选择默认模型。

需要 NVIDIA GPU、可用驱动和 `nvidia-smi`。初始化环境和模型下载均支持页面提供的镜像源。

## 使用

在 DSH 中让模型调用：

```text
用 rembg_gpu 工具把 /path/to/photo.png 的背景去掉。
```

工具参数：

```text
rembg_gpu(path, model?)
```

- `path`：输入图片的绝对路径，必填。
- `model`：已安装的模型名称，可选，默认使用设置中的模型。

处理完成后，透明背景 PNG 会写入输入图片同目录，文件名为：

```text
photo_no_bg_gpu.png
```

如需查看可用模型，先调用 `rembg_gpu_models`，再使用已安装且校验有效的模型调用 `rembg_gpu`。

## 卸载

```sh
dsh plugin --profile web remove dsh-rembg-gpu
```

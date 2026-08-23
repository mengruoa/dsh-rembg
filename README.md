# dsh-rembg

DSH 图像背景移除插件，支持选择 CPU 或本地 NVIDIA GPU 模式。

## 安装

### npm（推荐）

```sh
dsh plugin --profile web add dsh-rembg
```

### GitHub

```sh
dsh plugin --profile web add github:mengruoa/dsh-rembg
```

启动 DSH：

```sh
dsh --profile web
```

## 配置

打开 Web GUI 的**设置 → 插件 → 插件配置 → rembg 图像背景移除**：

1. 选择是否使用 GPU。
2. 点击**初始化环境**安装对应的 Python 依赖。
3. 在模型列表中安装要使用的模型。
4. 选择默认模型并保存设置。

GPU 模式需要 NVIDIA GPU、可用驱动和 `nvidia-smi`；CPU 模式无需 NVIDIA GPU。依赖和模型保存在插件安装目录中，不会修改系统 Python。

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

如需查看可用模型，先调用 `rembg_gpu_models`，再使用已安装且校验有效的模型调用 `rembg_gpu`。处理完成后会返回输出文件信息。

## 卸载

```sh
dsh plugin --profile web remove dsh-rembg
```

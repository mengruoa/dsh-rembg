# dsh-rembg-gpu

GPU 版 rembg DSH 插件。插件使用本地 NVIDIA CUDA，工具名为 `rembg_gpu`。

## GPU 要求

设置页会调用 `nvidia-smi -L` 检查 NVIDIA GPU。没有 NVIDIA 设备、驱动不可用或 `nvidia-smi` 失败时，页面会显示原因，并禁用「初始化环境」。

安装脚本还会在虚拟环境中验证 `onnxruntime-gpu` 提供 `CUDAExecutionProvider`。安装失败不会被标记为已安装。

## 设置

进入 **设置 → 插件 → 插件配置 → rembg GPU 图像背景移除**，选择镜像源后保存。只有 GPU 基础检查通过时才能点击「初始化环境」。页面显示：

- GPU 环境是否满足要求
- 已安装 / 未安装 / 正在安装
- 安装错误信息

## 工具

```text
rembg_gpu(path, model?)
```

结果写入输入文件旁边的 `<name>_no_bg_gpu.png`。

## 本机验证

本机检测到 NVIDIA GeForce RTX 2060，驱动报告 CUDA 12.4。临时 Python 3.14 虚拟环境成功安装：

- rembg 2.0.81
- onnxruntime-gpu 1.29.0

并检测到：

```text
['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
```

因此 GPU Python 依赖安装可行。实际模型推理仍取决于 NVIDIA 驱动、CUDA 运行库和具体模型兼容性。

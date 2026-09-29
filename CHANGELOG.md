# Changelog

## 0.2.0

适配 DSH 0.1.7-rc.1+（含 0.2.0-rc.1）的破坏性变更，修复在 0.2.0 上插件设置面板失效、工具注册抛错的问题：

- `ctx.settings.register()` 在 0.1.7-alpha.1 被移除。可编辑字段改为在 `Config` 上声明 `.volatile()`，
  值随 profile 的 `cordis.patch.yml` 持久化；插件内每次读取都经 `resolveConfig()` 解包 volatile 引用。
  **设置命名空间不再是自定字符串，而是 Loader 条目的 id**：本包在 `cordis.patch.yml` 里声明的行 id 是
  `rembg`，因此桥接路由使用 `rembg` 而不是旧的 `rembg-gpu-tool`。
- 客户端设置页挂载点由已废弃的 `settings.plugin.item` 改为 `plugins.row.config`，键为
  `<包名>#<行 id>`（`ui-plugin-manager` 的 `rowConfigKey`），即 `dsh-rembg#rembg`。
  页面入口：侧栏「插件」→ `dsh-rembg` → `rembg` 行。
- `dsh.client.inject` 里的 `@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-settings`、
  `@deepseek-ai/dsh-client-ui-settings-plugins` 在新版已不是客户端行，改为
  `@deepseek-ai/dsh-client-ui-plugin-manager`（`plugins.row.config` 的声明方）。
- `peerDependencies` 收紧为 `>=0.1.7-rc.1` / `>=3.18.2`：宽泛的 `*` 会让新版兼容性检查通过，
  但插件实际在旧版上无法工作。
- 设置页在 `page` 视图下不再自带折叠卡片头（外层已渲染标题），只在 `summary` 视图保留折叠壳。
- 样式 `<style>` 标签的生命周期改由 `ctx.effect` 统一持有，插件卸载时一并移除。

## 0.1.14

- 美化设置界面：卡片交互态、SVG 折叠箭头、GPU 开关、状态徽章、下载进度百分比
- 新增「默认模型」选择器，可在设置页直接切换默认模型
- 设置路由增加跨站请求（CSRF）防护，破坏性操作要求可写权限
- 缓存 GPU 检测结果，避免设置页轮询时反复调用 nvidia-smi
- 模型安装失败时在界面显示具体错误原因
- 环境初始化改为异步执行，不再阻塞请求；中止工具调用会一并取消安装
- 清空环境前增加目标目录安全校验
- Python 独立版压缩包增加 SHA256 校验，防止供应链篡改
- 移除设置中无效的 installDir 字段

## 0.1.3

- 优化了设置菜单的状态显示

## 0.1.2

- Initial public release

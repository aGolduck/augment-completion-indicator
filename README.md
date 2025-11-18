# Augment Completion Indicator

一个 VSCode 扩展，用于监控 Augment AI 助手的活动状态，并在任务完成时在窗口标题栏显示标记。

## 功能特性

- 🔍 **自动监控**: 自动检测 Augment 的活动状态（通过监控代码变化、诊断信息等）
- ✅ **完成提示**: 当 Augment 从活跃状态转为空闲时，在窗口标题添加 ✓ 标记
- 🎯 **智能清除**: 当你点击或激活已标记的窗口时，标记自动消失
- ⚙️ **可配置**: 支持自定义空闲阈值、活跃阈值和标记符号

## 使用场景

当你同时打开多个 VSCode 窗口，每个窗口都在使用 Augment 时，很难知道哪个窗口的任务已经完成。这个扩展会在窗口标题栏添加一个 ✓ 标记，让你一眼就能看出哪个窗口的 Augment 任务已完成。

## 安装

### 从源码安装

1. 克隆此仓库：
```bash
git clone <repository-url>
cd smart-shell
```

2. 安装依赖：
```bash
npm install
```

3. 编译：
```bash
npm run compile
```

4. 在 VSCode 中按 F5 启动调试，或者打包安装：
```bash
npm install -g vsce
vsce package
code --install-extension augment-completion-indicator-0.1.0.vsix
```

## 配置选项

在 VSCode 设置中搜索 "Augment Completion Indicator" 或直接编辑 `settings.json`：

```json
{
  // 是否启用监控
  "augmentCompletionIndicator.enabled": true,

  // 空闲时间阈值（秒），命令结束后超过此时间无活动视为完成
  "augmentCompletionIndicator.idleThreshold": 60,

  // 命令超时时间（秒），命令执行超过此时间自动开始倒计时
  "augmentCompletionIndicator.commandTimeout": 120,

  // 预热期时间（秒），插件启动后此时间内忽略所有活动
  "augmentCompletionIndicator.warmupPeriod": 10,

  // 完成标记符号
  "augmentCompletionIndicator.completionMarker": "🔔 ",

  // 是否显示详细日志
  "augmentCompletionIndicator.verbose": false
}
```

## 命令

- `Augment: 启用完成监控` - 启用监控功能
- `Augment: 禁用完成监控` - 禁用监控功能
- `Augment: 清除完成标记` - 手动清除窗口标题的完成标记

## 工作原理

1. **活动检测**: 扩展监控以下事件来检测 Augment 的活动：
   - 终端命令执行（命令开始和结束）
   - 文本文档变化（代码生成）
   - 网络请求（Augment API 调用）

2. **状态转换**:
   - **命令开始** → 进入"等待命令完成"状态
   - **命令结束或超时(2分钟)** → 开始 60 秒空闲倒计时
   - **空闲 60 秒** → 触发完成标记
   - **窗口获得焦点** → 重置所有状态

3. **智能等待**:
   - 当检测到 Augment 执行命令时，会等待命令完成
   - 如果命令超过 2 分钟未完成，自动开始倒计时
   - 避免在命令执行过程中误判为完成

4. **标题标记**:
   - 在窗口标题前添加 🔔 标记
   - 当窗口获得焦点时自动清除标记

## 注意事项

- 此扩展通过监控编辑器事件来间接检测 Augment 的活动，可能不是 100% 准确
- 建议根据实际使用情况调整空闲阈值和活跃阈值
- 如果发现误报或漏报，可以启用详细日志查看检测情况

## 📚 文档

- [状态流程文档](docs/状态流程.md) - 详细的状态转换流程和设计思想
- [测试流程文档](docs/测试流程.md) - 完整的测试用例和验证步骤

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式（自动重新编译）
npm run watch

# 运行 lint
npm run lint
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！


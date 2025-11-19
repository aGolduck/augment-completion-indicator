# Augment Completion Indicator

一个 VSCode 扩展，用于监控 Augment AI 助手的活动状态，并在任务完成时在窗口标题栏显示标记。

## 功能特性

- 🔍 **自动监控**: 自动检测 Augment 的活动状态（通过监控代码变化、文件变化、终端命令等）
- 📁 **Augment Store 监控**: 直接监控 Augment 的 KV store 文件变化，最可靠的监控方式
- 🎯 **工作区隔离**: 精确定位当前工作区，多窗口场景下不会混淆
- ✅ **完成提示**: 当 Augment 从活跃状态转为空闲时，在窗口标题添加标记
- 🔄 **智能清除**: 当你点击或激活已标记的窗口时，标记自动消失
- ⚙️ **可配置**: 支持自定义空闲阈值、预热期和标记符号

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
  // 基础配置
  "augmentCompletionIndicator.enabled": true,
  "augmentCompletionIndicator.idleThreshold": 60,
  "augmentCompletionIndicator.warmupPeriod": 10,
  "augmentCompletionIndicator.completionMarker": "🔔 ",
  "augmentCompletionIndicator.verbose": false,

  // 监控方法配置（可选择性启用/禁用）
  "augmentCompletionIndicator.useAugmentStoreWatcher": true,      // Augment Store 监控 - 最全面，推荐启用
  "augmentCompletionIndicator.useDocumentWatcher": true,  // 文档监控 - 捕获代码变化
  "augmentCompletionIndicator.useTerminalWatcher": true   // 终端监控 - 捕获命令执行
}
```

### 配置说明

**基础配置**：
- `enabled`: 是否启用监控
- `idleThreshold`: 空闲时间阈值（秒），超过此时间无活动视为完成
- `warmupPeriod`: 预热期时间（秒），插件启动后此时间内忽略所有活动
- `completionMarker`: 完成标记符号
- `verbose`: 是否显示详细日志

**监控方法配置**：
- `useAugmentStoreWatcher`: Augment Store 监控 - 监控 Augment KV store 文件变化，最全面的监控方式
- `useDocumentWatcher`: 文档监控 - 监控文档内容变化、文件创建/删除/重命名，捕获所有文件操作
- `useTerminalWatcher`: 终端监控 - 监控终端命令执行，捕获命令执行结果

**✨ 所有配置项都支持热生效**：修改配置后会自动应用，无需手动重启。

## 命令

- `Augment: 启用完成监控` - 启用监控功能
- `Augment: 禁用完成监控` - 禁用监控功能
- `Augment: 清除完成标记` - 手动清除窗口标题的完成标记

## 工作原理

1. **活动检测**: 扩展监控以下事件来检测 Augment 的活动：
   - ✅ **文本文档变化**（代码生成和修改）- 最可靠的监控方法
   - ✅ **终端命令执行**（命令开始和结束）
   - ✅ **Augment KV Store 文件变化**（监控 Augment 的 LevelDB 数据库文件）- **新增！最直接的监控方法**

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

## 技术限制

由于 VSCode 扩展的设计限制，以下监控方法**无法实现**：
- ❌ 网络请求监控（进程隔离、HTTP 客户端多样性）
- ❌ 输出通道监控（OutputChannel 是私有资源）
- ❌ 状态栏消息监控（无相关 API）
- ❌ 扩展状态监控（只能检测激活状态，无法检测实际工作）

详细的技术原因请参考 [TECHNICAL_LIMITATIONS.md](TECHNICAL_LIMITATIONS.md)

**结论**：这些方法都已从代码中移除，扩展仅依赖上述三种可靠的监控方法。

## 注意事项

- 此扩展通过监控编辑器事件来间接检测 Augment 的活动，可能不是 100% 准确
- 建议根据实际使用情况调整空闲阈值和活跃阈值
- 如果发现误报或漏报，可以启用详细日志查看检测情况

## 📚 文档

- [使用指南](docs/GUIDE.md) - 安装、配置、测试和调试指南
- [架构和原理](docs/ARCHITECTURE.md) - 系统架构、监控方法、状态流程和技术细节
- [技术限制说明](TECHNICAL_LIMITATIONS.md) - 详细解释为什么某些监控方法无法实现

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

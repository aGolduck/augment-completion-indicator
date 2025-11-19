# 使用指南

## 📦 安装

### 从 VSIX 安装

```bash
code --install-extension augment-completion-indicator-0.1.0.vsix
```

### 从源码构建

```bash
# 克隆仓库
git clone <repository-url>
cd augment-completion-indicator

# 安装依赖
npm install

# 编译
npm run compile

# 打包
npm install -g @vscode/vsce
vsce package

# 安装
code --install-extension augment-completion-indicator-0.1.0.vsix
```

## ⚙️ 配置

### 基础配置

```json
{
  "augmentCompletionIndicator.enabled": true,
  "augmentCompletionIndicator.idleThreshold": 60,
  "augmentCompletionIndicator.warmupPeriod": 10,
  "augmentCompletionIndicator.completionMarker": "🔔 ",
  "augmentCompletionIndicator.verbose": false
}
```

**配置说明**：
- `enabled`: 是否启用监控
- `idleThreshold`: 空闲阈值（秒），超过此时间无活动视为完成
- `warmupPeriod`: 预热期（秒），启动后此时间内忽略活动
- `completionMarker`: 完成标记符号
- `verbose`: 是否显示详细日志

### 监控方法配置

```json
{
  "augmentCompletionIndicator.useAugmentStoreWatcher": true,
  "augmentCompletionIndicator.useDocumentWatcher": true,
  "augmentCompletionIndicator.useTerminalWatcher": true
}
```

**配置说明**：
- `useAugmentStoreWatcher`: Augment Store 监控（推荐启用）
- `useDocumentWatcher`: 文档监控
- `useTerminalWatcher`: 终端监控

### 配置场景

#### 场景1：只关心代码生成
```json
{
  "augmentCompletionIndicator.useAugmentStoreWatcher": true,
  "augmentCompletionIndicator.useDocumentWatcher": true,
  "augmentCompletionIndicator.useTerminalWatcher": false
}
```

#### 场景2：只关心命令执行
```json
{
  "augmentCompletionIndicator.useAugmentStoreWatcher": true,
  "augmentCompletionIndicator.useDocumentWatcher": false,
  "augmentCompletionIndicator.useTerminalWatcher": true
}
```

#### 场景3：最小配置（仅 Store 监控）
```json
{
  "augmentCompletionIndicator.useAugmentStoreWatcher": true,
  "augmentCompletionIndicator.useDocumentWatcher": false,
  "augmentCompletionIndicator.useTerminalWatcher": false
}
```

## 🧪 测试

### 1. 启用详细日志

设置中搜索 `augmentCompletionIndicator.verbose` 并勾选

### 2. 打开输出面板

```
Ctrl+Shift+U -> 选择 "Augment Completion Indicator"
```

### 3. 测试监控

1. **切换到浏览器**（让 VSCode 失去焦点）
2. **向 Augment 提出请求**（如修改文件、执行命令）
3. **切回 VSCode 查看日志**

### 4. 预期日志

```
[时间戳] ℹ️ 🔍 fs.watch 检测到变化: change - augment-user-assets/...
[时间戳] ℹ️ 活动检测 #1 [来源: Augment Store: ...]
[时间戳] ℹ️ ✅ 进入活跃状态
```

### 5. 测试完成标记

1. 向 Augment 提出请求
2. 等待任务完成
3. **不要切回 VSCode**
4. 等待 60 秒
5. 观察 VSCode 窗口标题是否出现 🔔 标记

## 🔍 调试

### 查看监控的目录

启用 verbose 模式后，启动日志会显示：

```
[时间戳] ℹ️ 📡 方法 2: 设置 Node.js fs.watch...
[时间戳] ℹ️    ✅ fs.watch 已设置，监控 15 个目录
[时间戳] ℹ️    监控的目录列表:
[时间戳] ℹ️      - (根目录)
[时间戳] ℹ️      - augment-kv-store
[时间戳] ℹ️      - augment-user-assets
[时间戳] ℹ️      - augment-user-assets/checkpoint-documents
[时间戳] ℹ️      - ...
```

### 常见问题

#### 问题1：没有检测到活动

**可能原因**：
- 窗口有焦点（会被过滤）
- 在预热期内（默认10秒）
- Augment 没有执行文件操作（如简单对话）

**解决方案**：
- 确保窗口失去焦点
- 等待预热期结束
- 尝试让 Augment 执行文件编辑或命令

#### 问题2：监控器没有启动

**可能原因**：
- 没有找到 Augment 存储目录
- 权限问题

**解决方案**：
- 查看启动日志中的错误信息
- 确认 Augment 扩展已安装并激活

#### 问题3：日志太多

**解决方案**：
- 关闭 verbose 模式
- 只启用需要的监控方法

## 📊 性能

### 资源占用

- **CPU**: 几乎为 0（事件驱动）
- **内存**: < 10 MB
- **文件监听器**: 约 15 个（取决于 Augment 目录结构）

### 优化建议

1. **关闭不需要的监控方法**
2. **调整空闲阈值**（减少检查频率）
3. **关闭 verbose 模式**（减少日志输出）

## 🎯 最佳实践

### 推荐配置

```json
{
  "augmentCompletionIndicator.enabled": true,
  "augmentCompletionIndicator.idleThreshold": 60,
  "augmentCompletionIndicator.warmupPeriod": 10,
  "augmentCompletionIndicator.completionMarker": "🔔 ",
  "augmentCompletionIndicator.verbose": false,
  "augmentCompletionIndicator.useAugmentStoreWatcher": true,
  "augmentCompletionIndicator.useDocumentWatcher": true,
  "augmentCompletionIndicator.useTerminalWatcher": true
}
```

### 使用技巧

1. **多窗口场景**：每个窗口独立监控，不会混淆
2. **调试时**：启用 verbose 模式查看详细日志
3. **性能优化**：只启用需要的监控方法


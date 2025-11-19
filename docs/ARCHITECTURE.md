# 架构和原理

## 🏗️ 系统架构

### 核心组件

```
┌─────────────────────────────────────────────────────────┐
│                    Extension (主入口)                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ├─────────────────────────────┐
                            │                             │
                            ▼                             ▼
                ┌───────────────────────┐    ┌──────────────────────┐
                │   ActivityMonitor     │    │  Window Title API    │
                │   (活动监控器)         │    │  (窗口标题管理)       │
                └───────────────────────┘    └──────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│ AugmentStore │  │ DocumentWatcher  │  │ Terminal     │
│ Watcher      │  │ (文档监控)        │  │ Watcher      │
│ (Store监控)   │  └──────────────────┘  │ (终端监控)    │
└──────────────┘                         └──────────────┘
        │
        ├─ VSCode FileSystemWatcher (方法1)
        └─ Node.js fs.watch (方法2，SSH环境更可靠)
```

## 🔍 监控方法

### 1. Augment Store 监控（最全面）

**监控目标**：Augment 的存储目录
```
Augment.vscode-augment/
├── augment-kv-store/              # LevelDB 数据库
├── augment-user-assets/           # 用户资产
│   ├── agent-edits/               # 代理编辑记录
│   ├── checkpoint-documents/      # 文档检查点（最活跃）
│   ├── task-storage/              # 任务存储
│   └── commandExecutionHistory    # 命令执行历史
└── augment-global-state/          # 全局状态
```

**实现方式**：
- **方法1**：VSCode FileSystemWatcher - 与 VSCode 集成良好
- **方法2**：Node.js fs.watch - SSH 环境下更可靠，递归监控所有子目录

**触发时机**：
- 文件编辑：创建 checkpoint 文档
- 命令执行：更新 commandExecutionHistory
- 代理操作：更新 agent-edits

### 2. 文档监控

**监控目标**：`vscode.workspace.onDidChangeTextDocument`

**触发时机**：
- Augment 生成代码
- Augment 修改文件

### 3. 终端监控

**监控目标**：
- `vscode.window.onDidWriteTerminalData` - 终端输出
- `vscode.window.onDidCloseTerminal` - 终端关闭

**触发时机**：
- Augment 执行命令
- 命令输出结果

## 🔄 状态流程

### 状态定义

```typescript
enum MonitorState {
    IDLE = 'idle',              // 空闲
    ACTIVE = 'active',          // 活跃
    MARKED = 'marked'           // 已标记
}
```

### 状态转换

```
[空闲] ──检测到活动──> [活跃] ──空闲60秒──> [已标记]
   ▲                      │                    │
   │                      │                    │
   └──────────────────────┴────窗口获得焦点────┘
```

### 关键过滤

1. **预热期过滤**（默认10秒）
   - 扩展启动后的预热期内忽略所有活动
   - 避免启动时的误触发

2. **窗口焦点过滤**
   - 窗口有焦点时忽略活动
   - 只在窗口失去焦点时监控

3. **活动去重**
   - 短时间内的重复活动只计为一次

## 🎯 工作区隔离

### 问题
多个 VSCode 窗口可能打开不同的工作区，每个工作区都有自己的 Augment 会话。

### 解决方案
使用 `ExtensionContext.storageUri` 精确定位当前工作区：

```typescript
// storageUri 格式
file:///.../workspaceStorage/{workspace-id}/augment.augment-completion-indicator

// 通过 workspace-id 定位同级的 Augment 目录
file:///.../workspaceStorage/{workspace-id}/Augment.vscode-augment
```

### 优势
- ✅ 每个窗口只监控自己工作区的 Augment 会话
- ✅ 多窗口场景下不会混淆
- ✅ 不需要用户配置

## ⚙️ 配置热生效

### 实现原理

监听配置变化：
```typescript
vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('augmentCompletionIndicator')) {
        updateConfiguration();
    }
});
```

### 配置类型

1. **直接生效**：
   - `verbose` - 日志级别
   - `idleThreshold` - 空闲阈值
   - `completionMarker` - 完成标记

2. **需要重启监控**：
   - `useAugmentStoreWatcher`
   - `useDocumentWatcher`
   - `useTerminalWatcher`

## 🔧 技术细节

### SSH 环境下的文件监控

**问题**：VSCode FileSystemWatcher 在 SSH 环境下可能不可靠

**解决方案**：双重监控
- 使用 Node.js `fs.watch` 作为备份
- 递归监控所有子目录
- 动态监控新创建的目录

### 临时文件处理

Augment 的文件操作流程：
1. 创建临时文件（`.tmp`）
2. 写入内容
3. 重命名为正式文件

监控器会捕获所有这些事件。


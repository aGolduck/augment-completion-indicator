# 更新日志

## [0.1.1] - 2025-11-19

### 重构 🏗️

#### 架构优化 - 统一监控器设计
- ✅ 将文档监控和终端监控提取为独立的类
  - 新增 `DocumentWatcher` 类（107 行）
  - 新增 `TerminalWatcher` 类（88 行）
  - 与 `AugmentStoreWatcher` 保持一致的架构
- ✅ 统一监控器接口：
  - `start()` - 启动监控
  - `stop()` - 停止监控
  - `updateConfig()` - 更新配置
  - `onActivity()` / `onCommandEnd()` - 活动回调
- ✅ 简化 `extension.ts`（从 430 行减少到 347 行）
- ✅ 删除冗余的 `setupDocumentWatcher` 和 `setupTerminalWatcher` 函数

#### 代码优化
- ✅ 提取 `log()` 辅助函数，统一日志输出
- ✅ 提取 `registerCommands()` 函数，分离命令注册逻辑
- ✅ 简化 `startMonitoring()` 的日志输出（从 15 行减少到 6 行）
- ✅ 使用可选链操作符简化代码
- ✅ 统一配置更新机制

#### 文档整合
- ✅ 合并 11 个文档为 2 个核心文档：
  - `docs/ARCHITECTURE.md` - 架构、监控方法、状态流程、技术细节
  - `docs/GUIDE.md` - 安装、配置、测试、调试、最佳实践
- ✅ 删除 9 个临时测试文档和脚本
- ✅ 保留核心文档：README.md、CHANGELOG.md、TECHNICAL_LIMITATIONS.md

### 改进 ✨
- ✅ 更清晰的模块职责划分
- ✅ 更统一的生命周期管理
- ✅ 更简洁的日志输出
- ✅ 更好的代码可维护性

### 统计 📊
- **源代码**：6 个文件，1193 行（+112 行）
  - `activityMonitor.ts`: 295 行
  - `augmentStoreWatcher.ts`: 235 行
  - `documentWatcher.ts`: 107 行（新增）
  - `extension.ts`: 347 行（-83 行）
  - `terminalWatcher.ts`: 88 行（新增）
  - `titleManager.ts`: 121 行
- **文档**：5 个文件（-9 个）

---

## [0.1.0] - 2025-11-18

### 新增功能 🎉

#### Augment Store 监控 - 最可靠的监控方式
- ✅ 新增 `AugmentStoreWatcher` 类，直接监控 Augment 的 LevelDB 数据库文件
- ✅ 监控 `LOG`, `CURRENT`, `MANIFEST-*`, `*.log`, `*.ldb` 等文件变化
- ✅ 能够捕获 Augment 的所有活动，包括读文件、思考、索引等操作

#### 可配置的监控方法
- ✅ 新增配置项 `useAugmentStoreWatcher` - 控制是否启用 Augment Store 监控（默认启用）
- ✅ 新增配置项 `useDocumentWatcher` - 控制是否启用文档监控（默认启用）
- ✅ 新增配置项 `useTerminalWatcher` - 控制是否启用终端监控（默认启用）
- ✅ 用户可以根据需求选择性启用/禁用监控方法
- ✅ **所有配置项支持热生效** - 修改配置后自动应用，无需手动重启
- ✅ **详细的配置变更日志** - 配置变更时输出详细日志，方便调试
- ✅ **所有配置项支持热生效** - 修改配置后自动应用，无需手动重启

#### 工作区隔离 - 多窗口场景下的精确监控
- ✅ 使用 `ExtensionContext.storageUri` 精确定位当前工作区
- ✅ 确保只监控当前工作区的 Augment 会话
- ✅ 避免多窗口场景下的混淆和误报
- ✅ 每个窗口独立监控，互不干扰

### 改进 🔧

#### 日志优化
- ✅ 优化清除标记时的日志输出
  - 需要清除时：`✅ 窗口标题已清除: "🔔 second-cc" → "second-cc"`
  - 不需要清除时：不打印日志（静默）
- ✅ 移除重复的日志输出
- ✅ 统一日志格式，更清晰易读

#### 文档完善
- ✅ 新增 [Augment Store 监控原理](docs/Augment Store 监控原理.md) 文档
- ✅ 新增 [工作区隔离机制](docs/工作区隔离.md) 文档
- ✅ 更新 README 说明新功能
- ✅ 新增测试脚本 `test-workspace-path.sh`

### 技术细节

#### Augment KV Store 位置
```
~/.vscode-server/data/User/workspaceStorage/{workspace-id}/Augment.vscode-augment/augment-kv-store/
```

#### 监控的文件类型
- `LOG` - 数据库操作日志
- `CURRENT` - 当前 manifest 文件指针
- `MANIFEST-*` - 数据库元数据
- `*.log` - 写前日志（WAL）
- `*.ldb` - 数据文件（SSTable）

#### 工作区定位方法
```typescript
// 方法1: 使用 ExtensionContext.storageUri（推荐）
const storageUriPath = context.storageUri.fsPath;
const workspaceStorageDir = path.dirname(storageUriPath);
const augmentPath = path.join(workspaceStorageDir, 'Augment.vscode-augment', 'augment-kv-store');

// 方法2: 遍历所有工作区（备用，可能不准确）
// 仅在 storageUri 不可用时使用
```

### 配置变更

新增配置项：
```json
{
  "augmentCompletionIndicator.useAugmentStoreWatcher": true,      // Augment Store 监控
  "augmentCompletionIndicator.useDocumentWatcher": true,  // 文档监控
  "augmentCompletionIndicator.useTerminalWatcher": true   // 终端监控
}
```

**注意**：修改监控方法配置后，需要重启监控或重新加载 VSCode 窗口才能生效。

### 性能影响

- Augment Store 监控使用 VSCode 原生的 `FileSystemWatcher` API
- 性能开销极小，不会影响编辑器性能
- 只监控特定文件类型，不读取文件内容

### 隐私保护

- 扩展只监控文件的**变化事件**，不读取文件内容
- 不会访问 Augment 的任何数据
- 完全尊重用户隐私

### 测试验证

运行测试脚本查看工作区信息：
```bash
./test-workspace-path.sh
```

启用详细日志查看监控状态：
```json
{
  "augmentCompletionIndicator.verbose": true
}
```

### 已知问题

无

### 下一步计划

- [ ] 添加更多测试用例
- [ ] 优化预热期逻辑
- [ ] 支持自定义监控文件类型
- [ ] 添加性能监控和统计

---

## [0.1.0] - 初始版本

### 功能
- 基本的活动监控（文档变化、终端命令）
- 窗口标题标记
- 配置选项
- 命令支持


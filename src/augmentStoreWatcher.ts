/**
 * Augment Store 监控器
 * 监控 Augment 扩展的 KV store 文件变化来检测活动
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class AugmentStoreWatcher {
    private vscodeWatcher: vscode.FileSystemWatcher | null = null;
    private fsWatchers: fs.FSWatcher[] = [];
    private onActivityCallback: ((source: string) => void) | null = null;
    private outputChannel: vscode.OutputChannel;
    private verbose: boolean;
    private augmentStorePath: string | null = null;
    private context: vscode.ExtensionContext;
    private watchedPaths: Set<string> = new Set();

    constructor(verbose: boolean, outputChannel: vscode.OutputChannel, context: vscode.ExtensionContext) {
        this.verbose = verbose;
        this.outputChannel = outputChannel;
        this.context = context;
    }

    /**
     * 记录日志
     */
    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
        const logMessage = `[${timestamp}] ${prefix} ${message}`;

        if (this.verbose || level === 'error') {
            this.outputChannel.appendLine(logMessage);
            console.log(`[File Watcher] ${logMessage}`);
        }
    }

    /**
     * 查找当前工作区的 Augment 存储路径
     * 使用 ExtensionContext.storageUri 精确定位当前工作区
     */
    private async findAugmentStorePath(): Promise<string | null> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            this.log('没有打开的工作区', 'warn');
            return null;
        }

        if (!this.context.storageUri) {
            this.log('无法获取扩展存储路径', 'error');
            return null;
        }

        // storageUri 格式: file:///.../workspaceStorage/{workspace-id}/augment.augment-completion-indicator
        // 我们需要找到同级的 Augment.vscode-augment 目录
        const workspaceStorageDir = path.dirname(this.context.storageUri.fsPath);
        const augmentRootPath = path.join(workspaceStorageDir, 'Augment.vscode-augment');

        if (!fs.existsSync(augmentRootPath)) {
            this.log(`未找到 Augment 目录: ${augmentRootPath}`, 'warn');
            this.log('请确保 Augment 扩展已安装并激活', 'warn');
            return null;
        }

        this.log(`✅ 找到 Augment 目录: ${augmentRootPath}`, 'info');

        // 列出子目录（仅在 verbose 模式下）
        if (this.verbose) {
            try {
                const subdirs = fs.readdirSync(augmentRootPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                this.log(`   子目录: ${subdirs.join(', ')}`, 'info');
            } catch (err) {
                this.log(`   无法读取目录: ${err}`, 'warn');
            }
        }

        return augmentRootPath;
    }

    /**
     * 设置活动回调
     */
    public onActivity(callback: (source: string) => void): void {
        this.onActivityCallback = callback;
    }

    /**
     * 使用 Node.js fs.watch 递归监控目录
     * 在 SSH 环境下比 VSCode FileSystemWatcher 更可靠
     */
    private setupFsWatch(dirPath: string): void {
        try {
            const watcher = fs.watch(dirPath, { recursive: false }, (eventType, filename) => {
                if (!filename) return;

                const fullPath = path.join(dirPath, filename);
                const relativePath = path.relative(this.augmentStorePath!, fullPath);

                this.log(`🔍 fs.watch 检测到变化: ${eventType} - ${relativePath}`, 'info');

                // 检查是否是新创建的目录，如果是则开始监控它
                if (eventType === 'rename') {
                    try {
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory() && !this.watchedPaths.has(fullPath)) {
                            this.log(`   📁 检测到新目录，开始监控: ${relativePath}`, 'info');
                            this.setupFsWatch(fullPath);
                        }
                    } catch {
                        // 文件可能已被删除，忽略错误
                    }
                }

                this.onActivityCallback?.(`Augment Store: ${relativePath}`);
            });

            watcher.on('error', (error) => {
                this.log(`fs.watch 错误: ${error}`, 'error');
            });

            this.fsWatchers.push(watcher);
            this.watchedPaths.add(dirPath);

            // 递归监控所有现有子目录
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const subDirPath = path.join(dirPath, entry.name);
                    if (!this.watchedPaths.has(subDirPath)) {
                        this.setupFsWatch(subDirPath);
                    }
                }
            }
        } catch (error) {
            this.log(`设置 fs.watch 失败: ${error}`, 'error');
        }
    }

    /**
     * 启动 Augment Store 监控
     */
    public async start(): Promise<boolean> {
        this.augmentStorePath = await this.findAugmentStorePath();
        if (!this.augmentStorePath) {
            this.log('无法启动监控：未找到 Augment 存储路径', 'error');
            return false;
        }

        this.setupVscodeWatcher();
        this.setupFsWatch(this.augmentStorePath);

        this.log(`🚀 Augment Store 监控已启动`, 'info');
        this.log(`   路径: ${this.augmentStorePath}`, 'info');
        this.log(`   方法: VSCode FileSystemWatcher + Node.js fs.watch`, 'info');
        this.log(`   监控目录数: ${this.watchedPaths.size}`, 'info');

        // 列出监控的目录（仅在 verbose 模式下）
        if (this.verbose) {
            const sortedPaths = Array.from(this.watchedPaths).sort();
            this.log(`   监控的目录列表:`, 'info');
            for (const watchedPath of sortedPaths) {
                const relativePath = path.relative(this.augmentStorePath, watchedPath);
                this.log(`     - ${relativePath || '(根目录)'}`, 'info');
            }
        }

        return true;
    }

    /**
     * 设置 VSCode FileSystemWatcher
     */
    private setupVscodeWatcher(): void {
        const pattern = new vscode.RelativePattern(this.augmentStorePath!, '**/*');
        this.vscodeWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        // 监听文件变化
        this.vscodeWatcher.onDidChange(uri => {
            const relativePath = path.relative(this.augmentStorePath!, uri.fsPath);
            this.log(`🔍 VSCode 检测到文件变化: ${relativePath}`, 'info');
            this.onActivityCallback?.(`Augment Store: ${relativePath}`);
        });

        // 监听文件创建
        this.vscodeWatcher.onDidCreate(uri => {
            const relativePath = path.relative(this.augmentStorePath!, uri.fsPath);
            this.log(`🔍 VSCode 检测到文件创建: ${relativePath}`, 'info');
            this.onActivityCallback?.(`Augment Store: ${relativePath}`);
        });

        // 监听文件删除
        this.vscodeWatcher.onDidDelete(uri => {
            const relativePath = path.relative(this.augmentStorePath!, uri.fsPath);
            this.log(`🔍 VSCode 检测到文件删除: ${relativePath}`, 'info');
        });
    }

    /**
     * 停止 Augment Store 监控
     */
    public stop(): void {
        // 停止 VSCode 监控器
        if (this.vscodeWatcher) {
            this.vscodeWatcher.dispose();
            this.vscodeWatcher = null;
            this.log('🛑 VSCode FileSystemWatcher 已停止', 'info');
        }

        // 停止所有 fs.watch 监控器
        for (const watcher of this.fsWatchers) {
            try {
                watcher.close();
            } catch (error) {
                this.log(`关闭 fs.watch 失败: ${error}`, 'warn');
            }
        }
        this.fsWatchers = [];
        this.watchedPaths.clear();
        this.log('🛑 Node.js fs.watch 已停止', 'info');

        this.log('🛑 Augment Store 监控已完全停止', 'info');
    }

    /**
     * 更新配置
     */
    public updateConfig(verbose: boolean): void {
        this.verbose = verbose;
        this.log('⚙️ 配置已更新', 'info');
    }
}


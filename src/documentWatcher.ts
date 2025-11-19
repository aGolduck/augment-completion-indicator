/**
 * 文档监控器
 * 监控文档内容变化、文件新建和删除来检测 Augment 的活动
 */

import * as vscode from 'vscode';

export class DocumentWatcher {
    private disposables: vscode.Disposable[] = [];
    private onActivityCallback: ((source: string) => void) | null = null;
    private outputChannel: vscode.OutputChannel;
    private verbose: boolean;

    constructor(verbose: boolean, outputChannel: vscode.OutputChannel) {
        this.verbose = verbose;
        this.outputChannel = outputChannel;
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
        }
    }

    /**
     * 设置活动回调
     */
    public onActivity(callback: (source: string) => void): void {
        this.onActivityCallback = callback;
    }

    /**
     * 检查文件是否应该被排除
     */
    private shouldExcludeFile(uri: vscode.Uri): boolean {
        const scheme = uri.scheme;
        const allowedSchemes = ['file', 'vscode-remote', 'untitled'];

        // 排除非文件系统的文档
        if (!allowedSchemes.includes(scheme)) {
            return true;
        }

        // 排除配置文件
        const filePath = uri.path;
        const excludedPaths = [
            '/.vscode/settings.json',
            '/.vscode/launch.json',
            '/.vscode/tasks.json',
            '/.vscode/extensions.json'
        ];

        if (excludedPaths.some(excluded => filePath.endsWith(excluded))) {
            return true;
        }

        return false;
    }

    /**
     * 获取文件名（用于日志）
     */
    private getFileName(uri: vscode.Uri): string {
        return uri.path.split('/').pop() || 'unknown';
    }

    /**
     * 启动文档监控
     */
    public start(): boolean {
        if (this.disposables.length > 0) {
            this.log('文档监控已在运行中', 'warn');
            return false;
        }

        this.log('📡 文档监控: ✅ 已启用', 'info');

        // 1. 监控文本文档变化（Augment 生成代码时会触发）
        const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
            if (this.shouldExcludeFile(e.document.uri)) {
                return;
            }

            // 记录文档变化
            if (e.contentChanges.length > 0) {
                const totalChanges = e.contentChanges.reduce(
                    (sum, change) => sum + change.text.length,
                    0
                );

                const fileName = this.getFileName(e.document.uri);
                this.onActivityCallback?.(`文档变化: ${fileName} (${totalChanges}字符)`);
            }
        });
        this.disposables.push(changeDisposable);

        // 2. 监控文件创建（Augment 创建新文件时会触发）
        const createDisposable = vscode.workspace.onDidCreateFiles(e => {
            for (const uri of e.files) {
                if (this.shouldExcludeFile(uri)) {
                    continue;
                }

                const fileName = this.getFileName(uri);
                this.log(`🆕 文件创建: ${fileName}`, 'info');
                this.onActivityCallback?.(`文件创建: ${fileName}`);
            }
        });
        this.disposables.push(createDisposable);

        // 3. 监控文件删除（Augment 删除文件时会触发）
        const deleteDisposable = vscode.workspace.onDidDeleteFiles(e => {
            for (const uri of e.files) {
                if (this.shouldExcludeFile(uri)) {
                    continue;
                }

                const fileName = this.getFileName(uri);
                this.log(`🗑️ 文件删除: ${fileName}`, 'info');
                this.onActivityCallback?.(`文件删除: ${fileName}`);
            }
        });
        this.disposables.push(deleteDisposable);

        // 4. 监控文件重命名（Augment 重命名文件时会触发）
        const renameDisposable = vscode.workspace.onDidRenameFiles(e => {
            for (const file of e.files) {
                if (this.shouldExcludeFile(file.oldUri) && this.shouldExcludeFile(file.newUri)) {
                    continue;
                }

                const oldName = this.getFileName(file.oldUri);
                const newName = this.getFileName(file.newUri);
                this.log(`📝 文件重命名: ${oldName} → ${newName}`, 'info');
                this.onActivityCallback?.(`文件重命名: ${oldName} → ${newName}`);
            }
        });
        this.disposables.push(renameDisposable);

        return true;
    }

    /**
     * 停止文档监控
     */
    public stop(): void {
        if (this.disposables.length > 0) {
            for (const disposable of this.disposables) {
                disposable.dispose();
            }
            this.disposables = [];
            this.log('🛑 文档监控已停止', 'info');
        }
    }

    /**
     * 更新配置
     */
    public updateConfig(verbose: boolean): void {
        this.verbose = verbose;
        this.log('⚙️ 配置已更新', 'info');
    }
}


/**
 * 文档监控器
 * 监控文档内容变化来检测 Augment 的活动
 */

import * as vscode from 'vscode';

export class DocumentWatcher {
    private disposable: vscode.Disposable | null = null;
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
     * 启动文档监控
     */
    public start(): boolean {
        if (this.disposable) {
            this.log('文档监控已在运行中', 'warn');
            return false;
        }

        this.log('📡 文档监控: ✅ 已启用', 'info');

        // 监控文本文档变化（Augment 生成代码时会触发）
        this.disposable = vscode.workspace.onDidChangeTextDocument(e => {
            // 使用白名单：只监控真实文件和远程文件
            const scheme = e.document.uri.scheme;
            const allowedSchemes = ['file', 'vscode-remote', 'untitled'];

            if (!allowedSchemes.includes(scheme)) {
                return;  // 排除所有非文件系统的文档
            }

            // 排除配置文件
            const filePath = e.document.uri.path;
            const excludedPaths = [
                '/.vscode/settings.json',
                '/.vscode/launch.json',
                '/.vscode/tasks.json',
                '/.vscode/extensions.json'
            ];

            if (excludedPaths.some(excluded => filePath.endsWith(excluded))) {
                return;
            }

            // 记录文档变化
            if (e.contentChanges.length > 0) {
                const totalChanges = e.contentChanges.reduce(
                    (sum, change) => sum + change.text.length,
                    0
                );

                const fileName = e.document.fileName.split('/').pop() || 'unknown';
                this.onActivityCallback?.(`文档变化: ${fileName} (${totalChanges}字符)`);
            }
        });

        return true;
    }

    /**
     * 停止文档监控
     */
    public stop(): void {
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = null;
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


/**
 * 窗口标题管理器
 * 负责修改和恢复窗口标题
 */

import * as vscode from 'vscode';

export class TitleManager {
    private isMarked: boolean = false;
    private completionMarker: string;
    private verbose: boolean;
    private outputChannel: vscode.OutputChannel;

    constructor(
        completionMarker: string = '🔔 ',
        verbose: boolean = false,
        outputChannel: vscode.OutputChannel
    ) {
        this.completionMarker = completionMarker;
        this.verbose = verbose;
        this.outputChannel = outputChannel;
        this.log('TitleManager 已创建', 'info');
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
            console.log(`[Title Manager] ${logMessage}`);
        }
    }
    
    /**
     * 标记窗口为完成状态
     */
    public markCompletion(): void {
        if (this.isMarked) {
            this.verbose && this.log('窗口已标记，跳过', 'warn');
            return;
        }

        const workspaceName = this.getWorkspaceName();
        const newTitle = `${this.completionMarker}${workspaceName}`;

        this.setTitle(newTitle);
        this.isMarked = true;

        this.log(`✅ 窗口标题已标记: "${workspaceName}" → "${newTitle}"`, 'info');
        this.outputChannel.show(true);
    }
    
    /**
     * 清除完成标记
     */
    public async clearMarker(): Promise<void> {
        if (!this.isMarked) {
            // 不需要清除时，不打印日志
            return;
        }

        // 获取当前标题用于日志
        const workspaceName = this.getWorkspaceName();
        const markedTitle = `${this.completionMarker}${workspaceName}`;

        // 删除 window.title 配置，恢复默认
        const config = vscode.workspace.getConfiguration();
        try {
            await config.update('window.title', undefined, vscode.ConfigurationTarget.Workspace);
            this.log(`✅ 窗口标题已清除: "${markedTitle}" → "${workspaceName}"`, 'info');
        } catch (error) {
            this.log(`❌ 清除窗口标记失败: ${error}`, 'error');
        }

        this.isMarked = false;
    }
    
    /**
     * 获取工作区名称
     */
    private getWorkspaceName(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].name;
        }
        return 'VSCode';
    }
    
    /**
     * 设置窗口标题
     * 注意: VSCode API 不直接支持修改窗口标题
     * 我们使用 window.title 配置项来实现
     */
    private setTitle(title: string): void {
        const config = vscode.workspace.getConfiguration();
        config.update('window.title', title, vscode.ConfigurationTarget.Workspace);
    }
    
    /**
     * 检查是否已标记
     */
    public isWindowMarked(): boolean {
        return this.isMarked;
    }
    
    /**
     * 更新配置
     */
    public updateConfig(completionMarker: string, verbose: boolean): void {
        const oldMarker = this.completionMarker;
        this.completionMarker = completionMarker;
        this.verbose = verbose;
        this.log(`⚙️ 配置已更新: 标记 "${oldMarker}" → "${completionMarker}"`, 'info');
    }
}


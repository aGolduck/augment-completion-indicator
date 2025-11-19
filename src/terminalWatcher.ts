/**
 * 终端监控器
 * 监控终端命令执行来检测 Augment 的活动
 */

import * as vscode from 'vscode';

export class TerminalWatcher {
    private disposable: vscode.Disposable | null = null;
    private onCommandEndCallback: ((command: string, exitCode: number | undefined) => void) | null = null;
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
     * 设置命令结束回调
     */
    public onCommandEnd(callback: (command: string, exitCode: number | undefined) => void): void {
        this.onCommandEndCallback = callback;
    }

    /**
     * 启动终端监控
     */
    public start(): boolean {
        if (this.disposable) {
            this.log('终端监控已在运行中', 'warn');
            return false;
        }

        this.log('📡 终端监控: ✅ 已启用', 'info');

        // 监听终端命令结束事件
        this.disposable = vscode.window.onDidEndTerminalShellExecution(event => {
            const commandLine = event.execution.commandLine;
            const command = commandLine?.value || 'unknown';
            const exitCode = event.exitCode;
            const confidence = commandLine?.confidence;

            // 只记录高或中等置信度的命令
            if (confidence === vscode.TerminalShellExecutionCommandLineConfidence.High ||
                confidence === vscode.TerminalShellExecutionCommandLineConfidence.Medium) {

                const shortCommand = command.length > 50 ? command.substring(0, 50) + '...' : command;
                this.onCommandEndCallback?.(shortCommand, exitCode);
            }
        });

        return true;
    }

    /**
     * 停止终端监控
     */
    public stop(): void {
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = null;
            this.log('🛑 终端监控已停止', 'info');
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


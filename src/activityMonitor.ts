/**
 * 活动监控器
 * 通过监控编辑器事件来检测 Augment 的活动状态
 */

import * as vscode from 'vscode';

export class ActivityMonitor {
    // 状态管理
    private lastActivityTime: number | null = null;
    private isActive: boolean = false;
    private wasActive: boolean = false;
    private activityCount: number = 0;
    private windowHasFocus: boolean = true;

    // 定时器
    private checkInterval: NodeJS.Timeout | null = null;

    // 配置
    private idleThreshold: number;
    private warmupPeriod: number;
    private verbose: boolean;
    private startTime: number;

    // 回调和输出
    private onCompletionCallback: (() => void) | null = null;
    private outputChannel: vscode.OutputChannel;

    constructor(
        idleThreshold: number = 60,
        warmupPeriod: number = 10,
        verbose: boolean = false,
        outputChannel: vscode.OutputChannel
    ) {
        this.idleThreshold = idleThreshold * 1000; // 转换为毫秒
        this.warmupPeriod = warmupPeriod * 1000; // 转换为毫秒
        this.verbose = verbose;
        this.outputChannel = outputChannel;
        this.startTime = Date.now();

        this.log('ActivityMonitor 已创建', 'info');
        this.log(`配置: 空闲阈值=${idleThreshold}秒, 预热期=${warmupPeriod}秒`, 'info');
    }

    // ==================== 私有方法 ====================

    /**
     * 记录日志
     */
    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
        const logMessage = `[${timestamp}] ${prefix} ${message}`;

        if (this.verbose || level === 'error') {
            this.outputChannel.appendLine(logMessage);
            console.log(`[Augment Monitor] ${logMessage}`);
        }
    }

    /**
     * 检查空闲状态
     */
    private checkIdleState(): void {
        if (!this.lastActivityTime) {
            return;
        }

        const now = Date.now();
        const idleTime = now - this.lastActivityTime;

        // 每10秒输出一次当前状态（仅在 verbose 模式）
        if (this.verbose && Math.floor(idleTime / 1000) % 10 === 0) {
            const status = this.isActive ? '活跃' : '空闲';
            this.log(`当前状态: ${status}, 距上次活动: ${(idleTime / 1000).toFixed(0)}秒`, 'info');
        }

        if (idleTime >= this.idleThreshold) {
            if (this.isActive && this.wasActive) {
                // 从活跃转为空闲 - 任务完成
                this.isActive = false;
                this.log(
                    `🎉 检测到任务完成！(空闲 ${(idleTime / 1000).toFixed(1)} 秒, 总活动次数: ${this.activityCount})`,
                    'info'
                );
                this.outputChannel.show(true);

                // 显示完成标记
                if (this.onCompletionCallback) {
                    this.onCompletionCallback();
                }

                this.wasActive = false;
                this.activityCount = 0;
            }
        }
    }

    /**
     * 重置所有状态（窗口获得焦点时调用）
     */
    private resetAllState(): void {
        this.lastActivityTime = null;
        this.isActive = false;
        this.wasActive = false;
        this.activityCount = 0;
        this.log('🔄 窗口获得焦点，所有状态已重置', 'info');
    }

    /**
     * 进入活跃状态
     */
    private enterActiveState(): void {
        if (!this.isActive) {
            this.isActive = true;
            this.wasActive = true;
            this.log(`✅ 进入活跃状态`, 'info');
            this.outputChannel.show(true);
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 设置完成回调函数
     */
    public onCompletion(callback: () => void): void {
        this.onCompletionCallback = callback;
    }

    /**
     * 设置窗口焦点状态
     */
    public setWindowFocus(hasFocus: boolean): void {
        if (this.windowHasFocus === hasFocus) return;

        this.log(`🔍 窗口焦点状态变化: ${this.windowHasFocus ? '有焦点' : '无焦点'} → ${hasFocus ? '有焦点' : '无焦点'}`, 'info');
        this.windowHasFocus = hasFocus;

        // 窗口获得焦点时，重置所有状态
        if (hasFocus) {
            this.resetAllState();
        }
    }

    /**
     * 记录命令结束
     */
    public recordCommandEnd(command: string, exitCode: number | undefined): void {
        const now = Date.now();
        const status = exitCode === 0 ? '成功' : `失败(${exitCode})`;

        // 预热期内忽略
        if (now - this.startTime < this.warmupPeriod) {
            this.verbose && this.log(`⏳ 预热期内，忽略命令结束: ${command} [${status}]`, 'info');
            return;
        }

        // 如果窗口有焦点，忽略（用户能看到）
        if (this.windowHasFocus) {
            this.verbose && this.log(`👁️ 窗口有焦点，忽略命令结束: ${command} [${status}]`, 'info');
            return;
        }

        // 窗口无焦点，记录为有效活动
        this.activityCount++;
        this.log(`✅ 命令结束 [${status}] #${this.activityCount}: ${command}`, 'info');

        this.enterActiveState();
        this.lastActivityTime = now;
    }

    /**
     * 记录活动（非命令类活动，如文档变化）
     */
    public recordActivity(source: string = 'unknown'): void {
        const now = Date.now();

        // 预热期内忽略活动
        if (now - this.startTime < this.warmupPeriod) {
            this.log(`⏳ 预热期内，忽略活动: ${source}`, 'info');
            return;
        }

        // 如果窗口有焦点，不记录活动（用户能看到变化）
        if (this.windowHasFocus) {
            this.log(`👁️ 窗口有焦点，忽略活动: ${source}`, 'info');
            return;
        }

        this.activityCount++;
        this.lastActivityTime = now;
        this.log(`活动检测 #${this.activityCount} [来源: ${source}]`, 'info');

        this.enterActiveState();
    }
    
    /**
     * 启动监控
     */
    public start(): void {
        if (this.checkInterval) {
            this.log('监控已在运行中', 'warn');
            return;
        }

        this.log('🚀 监控已启动', 'info');
        this.outputChannel.show(true);

        // 每秒检查一次状态
        this.checkInterval = setInterval(() => {
            this.checkIdleState();
        }, 1000);
    }

    /**
     * 停止监控
     */
    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.log('🛑 监控已停止', 'info');
    }

    /**
     * 重置完成标志
     */
    public resetCompletionFlag(): void {
        this.wasActive = false;
        this.isActive = false;
        this.activityCount = 0;
        // 不打印日志，避免重复（由调用方打印）
    }

    /**
     * 更新配置
     */
    public updateConfig(
        idleThreshold: number,
        warmupPeriod: number,
        verbose: boolean
    ): void {
        const oldIdle = this.idleThreshold / 1000;
        const oldWarmup = this.warmupPeriod / 1000;

        this.idleThreshold = idleThreshold * 1000;
        this.warmupPeriod = warmupPeriod * 1000;
        this.verbose = verbose;

        this.log(
            `⚙️ 配置已更新: 空闲阈值 ${oldIdle}s → ${idleThreshold}s, ` +
            `预热期 ${oldWarmup}s → ${warmupPeriod}s`,
            'info'
        );
    }

    /**
     * 获取当前状态信息
     */
    public getStatus(): string {
        const now = Date.now();
        const parts: string[] = [];

        // 基本状态
        if (this.isActive) {
            parts.push('状态: 活跃');
        } else {
            parts.push('状态: 空闲');
        }

        // 距上次活动时间
        const idleTime = this.lastActivityTime
            ? ((now - this.lastActivityTime) / 1000).toFixed(0)
            : 'N/A';
        parts.push(`距上次活动: ${idleTime}秒`);

        // 总活动次数
        parts.push(`总活动: ${this.activityCount}次`);

        // 窗口焦点状态
        parts.push(`窗口焦点: ${this.windowHasFocus ? '有' : '无'}`);

        // 预热期状态
        const timeSinceStart = (now - this.startTime) / 1000;
        if (timeSinceStart < this.warmupPeriod / 1000) {
            const remaining = (this.warmupPeriod / 1000 - timeSinceStart).toFixed(0);
            parts.push(`预热期: 剩余${remaining}秒`);
        }

        return parts.join(', ');
    }
}


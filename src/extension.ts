/**
 * Augment Completion Indicator Extension
 * 监控 Augment 活动并在窗口标题显示完成状态
 */

import * as vscode from 'vscode';
import { ActivityMonitor } from './activityMonitor';
import { TitleManager } from './titleManager';
import { NetworkMonitor } from './networkMonitor';

let activityMonitor: ActivityMonitor | null = null;
let titleManager: TitleManager | null = null;
let networkMonitor: NetworkMonitor | null = null;
let isEnabled: boolean = true;
let outputChannel: vscode.OutputChannel;

/**
 * 激活扩展
 */
export function activate(context: vscode.ExtensionContext) {
    // 创建输出通道
    outputChannel = vscode.window.createOutputChannel('Augment Completion Indicator');
    outputChannel.appendLine('='.repeat(60));
    outputChannel.appendLine('Augment Completion Indicator 已激活');
    outputChannel.appendLine('='.repeat(60));
    outputChannel.appendLine('');

    console.log('Augment Completion Indicator 已激活');

    // 读取配置
    const config = vscode.workspace.getConfiguration('augmentCompletionIndicator');
    isEnabled = config.get('enabled', true);

    outputChannel.appendLine(`配置: 启用=${isEnabled}`);

    // 清除启动时可能存在的遗留标记
    clearStartupMarker();

    // 设置活动监控事件监听器（只需要设置一次）
    setupActivityMonitoring(context);

    if (isEnabled) {
        startMonitoring();
    } else {
        outputChannel.appendLine('监控已禁用（可通过命令启用）');
    }

    // 显示输出面板
    outputChannel.show(true);

    // 注册命令
    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.enable', () => {
            isEnabled = true;
            vscode.workspace.getConfiguration('augmentCompletionIndicator')
                .update('enabled', true, vscode.ConfigurationTarget.Global);
            outputChannel.appendLine('📢 用户启用了监控');
            startMonitoring();
            vscode.window.showInformationMessage('Augment 完成监控已启用');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.disable', () => {
            isEnabled = false;
            vscode.workspace.getConfiguration('augmentCompletionIndicator')
                .update('enabled', false, vscode.ConfigurationTarget.Global);
            outputChannel.appendLine('📢 用户禁用了监控');
            stopMonitoring();
            vscode.window.showInformationMessage('Augment 完成监控已禁用');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.clearMarker', async () => {
            outputChannel.appendLine('📢 用户手动清除标记');
            if (titleManager) {
                await titleManager.clearMarker();
                if (activityMonitor) {
                    activityMonitor.resetCompletionFlag();
                }
                vscode.window.showInformationMessage('已清除完成标记');
            }
        })
    );

    // 添加查看状态命令
    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.showStatus', () => {
            try {
                if (activityMonitor) {
                    const status = activityMonitor.getStatus();
                    outputChannel.appendLine('📊 ' + status);
                    vscode.window.showInformationMessage(status);
                    outputChannel.show(true);
                } else {
                    const message = `监控未启动 (enabled=${isEnabled})`;
                    outputChannel.appendLine('⚠️ ' + message);
                    vscode.window.showWarningMessage(message);
                    outputChannel.show(true);
                }
            } catch (error) {
                const errorMsg = `获取状态失败: ${error}`;
                outputChannel.appendLine('❌ ' + errorMsg);
                vscode.window.showErrorMessage(errorMsg);
                outputChannel.show(true);
            }
        })
    );

    // 添加测试标记命令（用于调试）
    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.testMark', () => {
            outputChannel.appendLine('📢 用户手动测试标记');
            if (titleManager) {
                titleManager.markCompletion();
            } else {
                vscode.window.showWarningMessage('TitleManager 未初始化');
            }
        })
    );
    
    // 监听配置变化
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('augmentCompletionIndicator')) {
                updateConfiguration();
            }
        })
    );
}

/**
 * 启动监控
 */
function startMonitoring(): void {
    if (activityMonitor && titleManager) {
        outputChannel.appendLine('⚠️ 监控已在运行中');
        return; // 已经在运行
    }

    const config = vscode.workspace.getConfiguration('augmentCompletionIndicator');
    const idleThreshold = config.get('idleThreshold', 60);
    const warmupPeriod = config.get('warmupPeriod', 10);
    const completionMarker = config.get('completionMarker', '🔔 ');
    const verbose = config.get('verbose', false);

    outputChannel.appendLine('');
    outputChannel.appendLine('='.repeat(60));
    outputChannel.appendLine('🚀 启动监控');
    outputChannel.appendLine(`   空闲阈值: ${idleThreshold} 秒`);
    outputChannel.appendLine(`   预热期: ${warmupPeriod} 秒`);
    outputChannel.appendLine(`   完成标记: "${completionMarker}"`);
    outputChannel.appendLine(`   详细日志: ${verbose ? '开启' : '关闭'}`);
    outputChannel.appendLine('='.repeat(60));
    outputChannel.appendLine('');

    activityMonitor = new ActivityMonitor(idleThreshold, warmupPeriod, verbose, outputChannel);
    titleManager = new TitleManager(completionMarker, verbose, outputChannel);
    networkMonitor = new NetworkMonitor(outputChannel, verbose);

    // 设置完成回调
    activityMonitor.onCompletion(() => {
        if (titleManager) {
            titleManager.markCompletion();
        }
    });

    // 设置网络监控的活动回调
    networkMonitor.onActivity((source: string) => {
        if (activityMonitor) {
            activityMonitor.recordActivity(source);
        }
    });

    activityMonitor.start();
    networkMonitor.start();
}

/**
 * 停止监控
 */
function stopMonitoring(): void {
    outputChannel.appendLine('');
    outputChannel.appendLine('🛑 停止监控');

    if (activityMonitor) {
        activityMonitor.stop();
        activityMonitor = null;
    }

    if (titleManager) {
        titleManager.clearMarker();
        titleManager = null;
    }

    if (networkMonitor) {
        networkMonitor.stop();
        networkMonitor = null;
    }
}

/**
 * 更新配置
 */
function updateConfiguration(): void {
    const config = vscode.workspace.getConfiguration('augmentCompletionIndicator');
    const enabled = config.get('enabled', true);

    if (enabled !== isEnabled) {
        isEnabled = enabled;
        if (enabled) {
            startMonitoring();
        } else {
            stopMonitoring();
        }
        return;
    }

    if (activityMonitor && titleManager) {
        const idleThreshold = config.get('idleThreshold', 60);
        const warmupPeriod = config.get('warmupPeriod', 10);
        const completionMarker = config.get('completionMarker', '🔔 ');
        const verbose = config.get('verbose', false);

        outputChannel.appendLine('⚙️ 配置已更新');
        activityMonitor.updateConfig(idleThreshold, warmupPeriod, verbose);
        titleManager.updateConfig(completionMarker, verbose);
    }
}

/**
 * 设置活动监控
 * 通过监控各种编辑器事件来检测 Augment 的活动
 */
function setupActivityMonitoring(context: vscode.ExtensionContext): void {
    outputChannel.appendLine('📡 设置活动监控事件监听器...');

    // 监控文本文档变化（Augment 生成代码时会触发）
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            if (activityMonitor && isEnabled) {
                // 使用白名单：只监控真实文件和远程文件
                const scheme = e.document.uri.scheme;
                const allowedSchemes = ['file', 'vscode-remote', 'untitled'];

                if (!allowedSchemes.includes(scheme)) {
                    return;  // 排除所有非文件系统的文档（输出面板、调试控制台、Git、搜索结果等）
                }

                // 排除 .vscode/settings.json 和其他配置文件
                const filePath = e.document.uri.path;
                const excludedPaths = [
                    '/.vscode/settings.json',
                    '/.vscode/launch.json',
                    '/.vscode/tasks.json',
                    '/.vscode/extensions.json'
                ];

                if (excludedPaths.some(excluded => filePath.endsWith(excluded))) {
                    return;  // 排除配置文件的变化
                }

                // 记录文档变化（已通过白名单过滤，任何变化都可能是 Augment 的活动）
                if (e.contentChanges.length > 0) {
                    const totalChanges = e.contentChanges.reduce(
                        (sum, change) => sum + change.text.length,
                        0
                    );

                    const fileName = e.document.fileName.split('/').pop() || 'unknown';
                    activityMonitor.recordActivity(`文档变化: ${fileName} (${totalChanges}字符)`);
                }
            }
        })
    );

    // 注意：不监控诊断信息变化，因为 VSCode 启动时会频繁触发，容易误报
    // context.subscriptions.push(
    //     vscode.languages.onDidChangeDiagnostics(e => {
    //         if (activityMonitor && isEnabled && e.uris.length > 0) {
    //             const fileCount = e.uris.length;
    //             activityMonitor.recordActivity(`诊断信息变化: ${fileCount}个文件`);
    //         }
    //     })
    // );

    // 监听终端命令结束事件
    context.subscriptions.push(
        vscode.window.onDidEndTerminalShellExecution(event => {
            if (activityMonitor && isEnabled) {
                const commandLine = event.execution.commandLine;
                const command = commandLine?.value || 'unknown';
                const exitCode = event.exitCode;
                const confidence = commandLine?.confidence;

                // 只记录高或中等置信度的命令
                if (confidence === vscode.TerminalShellExecutionCommandLineConfidence.High ||
                    confidence === vscode.TerminalShellExecutionCommandLineConfidence.Medium) {

                    const shortCommand = command.length > 50 ? command.substring(0, 50) + '...' : command;

                    // 记录命令结束
                    activityMonitor.recordCommandEnd(shortCommand, exitCode);
                }
            }
        })
    );

    // 监听窗口焦点变化
    context.subscriptions.push(
        vscode.window.onDidChangeWindowState(async state => {
            // 更新 ActivityMonitor 的焦点状态
            if (activityMonitor) {
                activityMonitor.setWindowFocus(state.focused);
            }

            // 窗口获得焦点时清除标记
            if (state.focused && titleManager && titleManager.isWindowMarked()) {
                outputChannel.appendLine('🔄 窗口获得焦点，清除完成标记');
                await titleManager.clearMarker();
                if (activityMonitor) {
                    activityMonitor.resetCompletionFlag();
                }
            }
        })
    );

    outputChannel.appendLine('✅ 活动监控事件监听器已设置');

    // 监控状态栏消息（Augment 显示状态时会触发）
    // 注意：VSCode API 不直接提供状态栏消息监听
    // 我们可以通过监控扩展激活来间接检测

    // 定期检查 Augment 扩展的状态
    const checkInterval = setInterval(() => {
        if (!isEnabled) {
            return;
        }

        // 检查 Augment 扩展是否活跃
        const augmentExtension = vscode.extensions.getExtension('augment.augment');
        if (augmentExtension && augmentExtension.isActive) {
            // 可以在这里添加更多检测逻辑
        }
    }, 5000);

    context.subscriptions.push({
        dispose: () => clearInterval(checkInterval)
    });
}

/**
 * 清除启动时的遗留标记
 */
function clearStartupMarker(): void {
    const config = vscode.workspace.getConfiguration();
    const currentTitle = config.get<string>('window.title');

    if (currentTitle && (currentTitle.includes('🔔') || currentTitle.includes('✓') || currentTitle.includes('✅'))) {
        outputChannel.appendLine('🧹 检测到遗留的完成标记，正在清除...');
        outputChannel.appendLine(`   当前标题: "${currentTitle}"`);

        // 删除 window.title 配置，恢复默认
        config.update('window.title', undefined, vscode.ConfigurationTarget.Workspace);

        outputChannel.appendLine('✅ 遗留标记已清除');
    } else {
        outputChannel.appendLine('✓ 未检测到遗留标记');
    }
}

/**
 * 停用扩展
 */
export function deactivate() {
    stopMonitoring();
    console.log('Augment Completion Indicator 已停用');
}


/**
 * Augment Completion Indicator Extension
 * 监控 Augment 活动并在窗口标题显示完成状态
 */

import * as vscode from 'vscode';
import { ActivityMonitor } from './activityMonitor';
import { TitleManager } from './titleManager';
import { AugmentStoreWatcher } from './augmentStoreWatcher';
import { DocumentWatcher } from './documentWatcher';
import { TerminalWatcher } from './terminalWatcher';

let activityMonitor: ActivityMonitor | null = null;
let titleManager: TitleManager | null = null;
let augmentStoreWatcher: AugmentStoreWatcher | null = null;
let documentWatcher: DocumentWatcher | null = null;
let terminalWatcher: TerminalWatcher | null = null;
let isEnabled: boolean = true;
let outputChannel: vscode.OutputChannel;
let extensionContext: vscode.ExtensionContext;

/**
 * 日志辅助函数
 */
function log(message: string): void {
    outputChannel.appendLine(message);
}

/**
 * 激活扩展
 */
export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    outputChannel = vscode.window.createOutputChannel('Augment Completion Indicator');

    log('='.repeat(60));
    log('Augment Completion Indicator 已激活');
    log('='.repeat(60));

    const config = vscode.workspace.getConfiguration('augmentCompletionIndicator');
    isEnabled = config.get('enabled', true);

    log(`配置: 启用=${isEnabled}`);

    // 清除启动时可能存在的遗留标记
    clearStartupMarker();

    if (isEnabled) {
        startMonitoring();
    } else {
        log('监控已禁用（可通过命令启用）');
    }

    outputChannel.show(true);

    // 注册命令
    registerCommands(context);
    
    // 监听配置变化
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('augmentCompletionIndicator')) {
                updateConfiguration();
            }
        })
    );

    // 监听窗口焦点变化（全局监听器，不随监控方法配置变化）
    context.subscriptions.push(
        vscode.window.onDidChangeWindowState(async state => {
            // 更新 ActivityMonitor 的焦点状态
            if (activityMonitor) {
                activityMonitor.setWindowFocus(state.focused);
            }

            // 窗口获得焦点时清除标记
            if (state.focused && titleManager && titleManager.isWindowMarked()) {
                await titleManager.clearMarker();
                if (activityMonitor) {
                    activityMonitor.resetCompletionFlag();
                }
            }
        })
    );
}

/**
 * 启动监控
 */
async function startMonitoring(): Promise<void> {
    if (activityMonitor && titleManager) {
        log('⚠️ 监控已在运行中');
        return;
    }

    const config = vscode.workspace.getConfiguration('augmentCompletionIndicator');
    const idleThreshold = config.get('idleThreshold', 60);
    const warmupPeriod = config.get('warmupPeriod', 10);
    const completionMarker = config.get('completionMarker', '🔔 ');
    const verbose = config.get('verbose', false);
    const useAugmentStoreWatcher = config.get('useAugmentStoreWatcher', true);
    const useDocumentWatcher = config.get('useDocumentWatcher', true);
    const useTerminalWatcher = config.get('useTerminalWatcher', true);

    log('');
    log('='.repeat(60));
    log('🚀 启动监控');
    log(`   空闲阈值: ${idleThreshold}秒 | 预热期: ${warmupPeriod}秒 | 标记: "${completionMarker}"`);
    log(`   详细日志: ${verbose ? '开启' : '关闭'}`);
    log(`   监控方法: Store[${useAugmentStoreWatcher ? '✅' : '❌'}] 文档[${useDocumentWatcher ? '✅' : '❌'}] 终端[${useTerminalWatcher ? '✅' : '❌'}]`);
    log('='.repeat(60));

    activityMonitor = new ActivityMonitor(idleThreshold, warmupPeriod, verbose, outputChannel);
    titleManager = new TitleManager(completionMarker, verbose, outputChannel);

    activityMonitor.onCompletion(() => titleManager?.markCompletion());
    activityMonitor.start();

    // 启动 Augment Store 监控
    if (useAugmentStoreWatcher) {
        augmentStoreWatcher = new AugmentStoreWatcher(verbose, outputChannel, extensionContext);
        augmentStoreWatcher.onActivity((source) => activityMonitor?.recordActivity(source));
        const started = await augmentStoreWatcher.start();
        if (!started) {
            log('⚠️ Augment Store 监控启动失败');
        }
    }

    // 启动文档监控
    if (useDocumentWatcher) {
        documentWatcher = new DocumentWatcher(verbose, outputChannel);
        documentWatcher.onActivity((source) => activityMonitor?.recordActivity(source));
        documentWatcher.start();
    }

    // 启动终端监控
    if (useTerminalWatcher) {
        terminalWatcher = new TerminalWatcher(verbose, outputChannel);
        terminalWatcher.onCommandEnd((command, exitCode) => activityMonitor?.recordCommandEnd(command, exitCode));
        terminalWatcher.start();
    }
}

/**
 * 停止监控
 */
function stopMonitoring(): void {
    log('');
    log('🛑 停止监控');

    activityMonitor?.stop();
    activityMonitor = null;

    titleManager?.clearMarker();
    titleManager = null;

    augmentStoreWatcher?.stop();
    augmentStoreWatcher = null;

    documentWatcher?.stop();
    documentWatcher = null;

    terminalWatcher?.stop();
    terminalWatcher = null;
}

/**
 * 更新配置
 */
function updateConfiguration(): void {
    outputChannel.appendLine('');
    outputChannel.appendLine('🔧 检测到配置变更...');

    const config = vscode.workspace.getConfiguration('augmentCompletionIndicator');
    const enabled = config.get('enabled', true);
    const useAugmentStoreWatcher = config.get('useAugmentStoreWatcher', true);
    const useDocumentWatcher = config.get('useDocumentWatcher', true);
    const useTerminalWatcher = config.get('useTerminalWatcher', true);

    // 检查 enabled 配置是否变化
    if (enabled !== isEnabled) {
        outputChannel.appendLine(`📊 enabled 配置变更: ${isEnabled} → ${enabled}`);
        isEnabled = enabled;
        if (enabled) {
            outputChannel.appendLine('✅ 启用监控');
            startMonitoring();
        } else {
            outputChannel.appendLine('❌ 禁用监控');
            stopMonitoring();
        }
        return;
    }

    // 检查监控方法配置是否变化
    const currentUseAugmentStoreWatcher = augmentStoreWatcher !== null;
    const currentUseDocumentWatcher = documentWatcher !== null;
    const currentUseTerminalWatcher = terminalWatcher !== null;

    const augmentStoreWatcherChanged = useAugmentStoreWatcher !== currentUseAugmentStoreWatcher;
    const documentWatcherChanged = useDocumentWatcher !== currentUseDocumentWatcher;
    const terminalWatcherChanged = useTerminalWatcher !== currentUseTerminalWatcher;

    const monitoringMethodsChanged =
        augmentStoreWatcherChanged ||
        documentWatcherChanged ||
        terminalWatcherChanged;

    if (monitoringMethodsChanged) {
        log('📊 监控方法配置变更:');
        if (augmentStoreWatcherChanged) {
            log(`   - Augment Store 监控: ${currentUseAugmentStoreWatcher} → ${useAugmentStoreWatcher}`);
        }
        if (documentWatcherChanged) {
            log(`   - 文档监控: ${currentUseDocumentWatcher} → ${useDocumentWatcher}`);
        }
        if (terminalWatcherChanged) {
            log(`   - 终端监控: ${currentUseTerminalWatcher} → ${useTerminalWatcher}`);
        }

        if (isEnabled && activityMonitor) {
            log('🔄 自动重启监控以应用新配置...');
            stopMonitoring();
            startMonitoring();
        } else {
            log('ℹ️ 监控未运行，配置将在下次启动时生效');
        }
        return;
    }

    // 更新其他配置（不需要重启监控）
    if (activityMonitor && titleManager) {
        const idleThreshold = config.get('idleThreshold', 60);
        const warmupPeriod = config.get('warmupPeriod', 10);
        const completionMarker = config.get('completionMarker', '🔔 ');
        const verbose = config.get('verbose', false);

        log('📊 其他配置变更:');
        log(`   - idleThreshold: ${idleThreshold}`);
        log(`   - warmupPeriod: ${warmupPeriod}`);
        log(`   - completionMarker: "${completionMarker}"`);
        log(`   - verbose: ${verbose}`);
        log('✅ 配置已更新（无需重启监控）');

        activityMonitor.updateConfig(idleThreshold, warmupPeriod, verbose);
        titleManager.updateConfig(completionMarker, verbose);
        augmentStoreWatcher?.updateConfig(verbose);
        documentWatcher?.updateConfig(verbose);
        terminalWatcher?.updateConfig(verbose);
    } else {
        log('ℹ️ 监控未运行，配置将在下次启动时生效');
    }
}

/**
 * 注册所有命令
 */
function registerCommands(context: vscode.ExtensionContext): void {
    // 启用监控
    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.enable', () => {
            isEnabled = true;
            vscode.workspace.getConfiguration('augmentCompletionIndicator')
                .update('enabled', true, vscode.ConfigurationTarget.Global);
            log('📢 用户启用了监控');
            startMonitoring();
            vscode.window.showInformationMessage('Augment 完成监控已启用');
        })
    );

    // 禁用监控
    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.disable', () => {
            isEnabled = false;
            vscode.workspace.getConfiguration('augmentCompletionIndicator')
                .update('enabled', false, vscode.ConfigurationTarget.Global);
            log('📢 用户禁用了监控');
            stopMonitoring();
            vscode.window.showInformationMessage('Augment 完成监控已禁用');
        })
    );

    // 清除标记
    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.clearMarker', async () => {
            log('📢 用户手动清除标记');
            if (titleManager) {
                await titleManager.clearMarker();
                activityMonitor?.resetCompletionFlag();
                vscode.window.showInformationMessage('已清除完成标记');
            }
        })
    );

    // 查看状态
    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.showStatus', () => {
            if (activityMonitor) {
                const status = activityMonitor.getStatus();
                log('📊 ' + status);
                vscode.window.showInformationMessage(status);
                outputChannel.show(true);
            } else {
                const message = `监控未启动 (enabled=${isEnabled})`;
                log('⚠️ ' + message);
                vscode.window.showWarningMessage(message);
                outputChannel.show(true);
            }
        })
    );

    // 测试标记（调试用）
    context.subscriptions.push(
        vscode.commands.registerCommand('augmentCompletionIndicator.testMark', () => {
            log('📢 用户手动测试标记');
            if (titleManager) {
                titleManager.markCompletion();
            } else {
                vscode.window.showWarningMessage('TitleManager 未初始化');
            }
        })
    );
}

/**
 * 清除启动时的遗留标记
 */
function clearStartupMarker(): void {
    const config = vscode.workspace.getConfiguration();
    const currentTitle = config.get<string>('window.title');

    if (currentTitle && (currentTitle.includes('🔔') || currentTitle.includes('✓') || currentTitle.includes('✅'))) {
        log('🧹 检测到遗留的完成标记，正在清除...');
        log(`   当前标题: "${currentTitle}"`);
        config.update('window.title', undefined, vscode.ConfigurationTarget.Workspace);
        log('✅ 遗留标记已清除');
    } else {
        log('✓ 未检测到遗留标记');
    }
}

/**
 * 停用扩展
 */
export function deactivate() {
    stopMonitoring();
}


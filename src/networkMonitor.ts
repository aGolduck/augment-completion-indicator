/**
 * 网络监控模块
 * 通过 Hook Node.js 的 https/http 模块来监控 Augment 的网络请求
 */

import * as https from 'https';
import * as http from 'http';
import * as vscode from 'vscode';

export class NetworkMonitor {
    private outputChannel: vscode.OutputChannel;
    private onActivityCallback?: (source: string) => void;
    private originalHttpsRequest: typeof https.request;
    private originalHttpRequest: typeof http.request;
    private isHooked: boolean = false;
    private verbose: boolean = false;

    constructor(outputChannel: vscode.OutputChannel, verbose: boolean = false) {
        this.outputChannel = outputChannel;
        this.verbose = verbose;
        
        // 保存原始的 request 方法
        this.originalHttpsRequest = https.request;
        this.originalHttpRequest = http.request;
    }

    /**
     * 设置活动回调函数
     */
    public onActivity(callback: (source: string) => void): void {
        this.onActivityCallback = callback;
    }

    /**
     * 启动网络监控
     */
    public start(): void {
        if (this.isHooked) {
            this.log('网络监控已经在运行', 'warn');
            return;
        }

        this.log('🌐 启动网络监控...', 'info');
        this.log(`🔍 原始 https.request 类型: ${typeof https.request}`, 'info');
        this.log(`🔍 原始 http.request 类型: ${typeof http.request}`, 'info');
        this.hookHttpsRequest();
        this.hookHttpRequest();
        this.isHooked = true;
        this.log('✅ 网络监控已启动', 'info');
        this.log('💡 提示: 如果使用 Augment 后看不到网络请求日志，说明 Augment 可能不使用 Node.js 的 http/https 模块', 'info');
    }

    /**
     * 停止网络监控
     */
    public stop(): void {
        if (!this.isHooked) {
            return;
        }

        this.log('🛑 停止网络监控...', 'info');
        
        // 恢复原始方法
        (https as any).request = this.originalHttpsRequest;
        (http as any).request = this.originalHttpRequest;
        
        this.isHooked = false;
        this.log('✅ 网络监控已停止', 'info');
    }

    /**
     * Hook HTTPS 请求
     */
    private hookHttpsRequest(): void {
        const self = this;

        (https as any).request = function(...args: any[]): http.ClientRequest {
            // 调用原始方法
            const req = self.originalHttpsRequest.apply(https, args as any);

            // 调试：记录所有 HTTPS 请求
            if (self.verbose) {
                self.log(`🔍 HTTPS 请求被 hook: ${JSON.stringify(args[0]).substring(0, 100)}`, 'info');
            }

            // 监听请求事件
            self.monitorRequest(req, args, 'https');

            return req;
        };
    }

    /**
     * Hook HTTP 请求
     */
    private hookHttpRequest(): void {
        const self = this;

        (http as any).request = function(...args: any[]): http.ClientRequest {
            // 调用原始方法
            const req = self.originalHttpRequest.apply(http, args as any);

            // 调试：记录所有 HTTP 请求
            if (self.verbose) {
                self.log(`🔍 HTTP 请求被 hook: ${JSON.stringify(args[0]).substring(0, 100)}`, 'info');
            }

            // 监听请求事件
            self.monitorRequest(req, args, 'http');

            return req;
        };
    }

    /**
     * 监控请求
     */
    private monitorRequest(req: http.ClientRequest, args: any[], protocol: string): void {
        try {
            // 提取 URL 信息
            let url = '';
            let hostname = '';
            
            if (typeof args[0] === 'string') {
                url = args[0];
            } else if (typeof args[0] === 'object') {
                hostname = args[0].hostname || args[0].host || '';
                const path = args[0].path || '/';
                url = `${protocol}://${hostname}${path}`;
            }

            // 检查是否是 Augment 的请求
            if (this.isAugmentRequest(url, hostname)) {
                const shortUrl = this.shortenUrl(url);
                this.log(`🌐 检测到 Augment 请求: ${shortUrl}`, 'info');
                
                // 触发活动回调
                if (this.onActivityCallback) {
                    this.onActivityCallback(`网络请求: ${shortUrl}`);
                }
            } else if (this.verbose) {
                // 详细模式下记录所有请求
                const shortUrl = this.shortenUrl(url);
                this.log(`  其他请求: ${shortUrl}`, 'debug');
            }
        } catch (error) {
            // 忽略错误，避免影响正常请求
            if (this.verbose) {
                this.log(`监控请求时出错: ${error}`, 'error');
            }
        }
    }

    /**
     * 判断是否是 Augment 的请求
     */
    private isAugmentRequest(url: string, hostname: string): boolean {
        const augmentDomains = [
            'augmentcode.com',
            'augment.com',
            'api.augmentcode.com',
            'auth.augmentcode.com',
            'app.augmentcode.com'
        ];

        return augmentDomains.some(domain => 
            url.includes(domain) || hostname.includes(domain)
        );
    }

    /**
     * 缩短 URL 用于显示
     */
    private shortenUrl(url: string): string {
        if (url.length <= 60) {
            return url;
        }
        return url.substring(0, 60) + '...';
    }

    /**
     * 记录日志
     */
    private log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = level === 'info' ? 'ℹ️' : 
                      level === 'warn' ? '⚠️' : 
                      level === 'error' ? '❌' : 
                      '🔍';
        
        if (level === 'debug' && !this.verbose) {
            return;
        }
        
        this.outputChannel.appendLine(`[${timestamp}] ${prefix} ${message}`);
    }
}


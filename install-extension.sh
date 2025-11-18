#!/bin/bash
# 安装 Augment Completion Indicator 扩展

set -e

echo "=================================="
echo "Augment Completion Indicator"
echo "安装脚本"
echo "=================================="
echo

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm"
    exit 1
fi

# 检查 VSCode
if ! command -v code &> /dev/null; then
    echo "错误: 未找到 VSCode 命令行工具"
    echo "请确保 VSCode 已安装并添加到 PATH"
    exit 1
fi

echo "✓ 环境检查通过"
echo

# 安装依赖
echo "正在安装依赖..."
npm install

# 编译
echo "正在编译..."
npm run compile

# 检查是否安装了 vsce
if ! command -v vsce &> /dev/null; then
    echo "正在安装 vsce..."
    npm install -g vsce
fi

# 打包
echo "正在打包扩展..."
vsce package

# 查找生成的 .vsix 文件
VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -n1)

if [ -z "$VSIX_FILE" ]; then
    echo "错误: 未找到 .vsix 文件"
    exit 1
fi

echo "找到扩展包: $VSIX_FILE"

# 安装到 VSCode
echo "正在安装到 VSCode..."
code --install-extension "$VSIX_FILE"

echo
echo "=================================="
echo "✓ 安装完成！"
echo "=================================="
echo
echo "使用方法:"
echo "1. 重启 VSCode"
echo "2. 扩展会自动启动监控"
echo "3. 使用 Ctrl+Shift+P 打开命令面板，输入 'Augment' 查看可用命令"
echo
echo "配置:"
echo "- 打开 VSCode 设置，搜索 'Augment Completion Indicator'"
echo "- 或查看 README.md 和 USAGE.md 了解详细信息"
echo


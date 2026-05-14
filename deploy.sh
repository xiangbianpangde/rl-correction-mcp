#!/bin/bash
# RL Correction MCP 部署脚本
# 在服务器上运行此脚本

set -e

echo "========================================"
echo "RL Correction MCP 部署脚本"
echo "========================================"

# 检查 Python 版本
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python 版本: $PYTHON_VERSION"

# 创建工作目录
INSTALL_DIR="/opt/rl-correction-mcp"
echo "安装目录: $INSTALL_DIR"

# 创建目录
sudo mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 克隆代码（假设已通过 Git 拉取）
if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo "错误: 请先克隆 Git 仓库到 $INSTALL_DIR"
    echo "运行: git clone <your-repo-url> $INSTALL_DIR"
    exit 1
fi

# 创建虚拟环境
echo "创建 Python 虚拟环境..."
python3 -m venv venv
source venv/bin/activate

# 安装依赖
echo "安装依赖..."
pip install --upgrade pip
pip install -e .

# 创建数据目录
mkdir -p data/chroma_db

# 设置权限
chmod -R 755 $INSTALL_DIR

echo "========================================"
echo "安装完成!"
echo "========================================"
echo ""
echo "启动服务:"
echo "  开发模式: python web_api.py"
echo "  生产模式: sudo systemctl start rl-correction-mcp"
echo ""
echo "查看状态:"
echo "  sudo systemctl status rl-correction-mcp"
echo ""
echo "访问地址:"
echo "  http://$(hostname -I | awk '{print $1}'):8080"

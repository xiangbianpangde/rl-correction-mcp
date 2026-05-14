# RL Correction MCP 部署指南

## 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **Python**: 3.10+
- **内存**: 2GB+
- **磁盘**: 10GB+
- **端口**: 8080 (Web 服务)

## 部署步骤

### 1. 在您的服务器上执行以下命令

```bash
# 1. 安装 Git (如未安装)
apt-get update && apt-get install -y git

# 2. 创建工作目录
mkdir -p /opt
cd /opt

# 3. 克隆代码（请替换为实际的 Git 仓库地址）
git clone https://github.com/your-username/rl-correction-mcp.git
# 或者使用您上传的代码压缩包
# cd /opt && tar -xzf rl-correction-mcp.tar.gz

# 4. 进入项目目录
cd /opt/rl-correction-mcp

# 5. 运行部署脚本
chmod +x deploy.sh
sudo ./deploy.sh
```

### 2. 配置 systemd 服务（推荐用于生产环境）

```bash
# 复制服务配置文件
sudo cp rl-correction-mcp.service /etc/systemd/system/

# 重新加载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start rl-correction-mcp

# 设置开机自启
sudo systemctl enable rl-correction-mcp

# 查看状态
sudo systemctl status rl-correction-mcp
```

### 3. 验证部署

```bash
# 检查服务是否运行
curl http://localhost:8080/api/stats

# 查看日志
sudo journalctl -u rl-correction-mcp -f
```

### 4. 防火墙配置（如需要）

```bash
# 开放 8080 端口
sudo ufw allow 8080/tcp
# 或
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

## 访问方式

- **Web 界面**: http://124.221.46.190:8080
- **API 文档**: http://124.221.46.190:8080/docs (如果配置了 FastAPI docs)

## 常用命令

```bash
# 启动服务
sudo systemctl start rl-correction-mcp

# 停止服务
sudo systemctl stop rl-correction-mcp

# 重启服务
sudo systemctl restart rl-correction-mcp

# 查看日志
sudo journalctl -u rl-correction-mcp -f

# 查看最近 100 行日志
sudo journalctl -u rl-correction-mcp -n 100
```

## 数据备份

数据存储在 `data/chroma_db/` 目录下，建议定期备份：

```bash
# 备份数据
tar -czf backup-$(date +%Y%m%d).tar.gz data/chroma_db/

# 恢复数据
tar -xzf backup-20240101.tar.gz
```

## 故障排查

### 服务无法启动

```bash
# 检查日志
sudo journalctl -u rl-correction-mcp -n 50

# 检查端口占用
sudo lsof -i :8080

# 手动运行查看错误
cd /opt/rl-correction-mcp
source venv/bin/activate
python web_api.py
```

### 权限问题

```bash
# 修复权限
sudo chown -R root:root /opt/rl-correction-mcp
sudo chmod -R 755 /opt/rl-correction-mcp
```

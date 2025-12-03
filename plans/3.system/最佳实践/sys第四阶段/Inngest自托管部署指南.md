# Inngest 自托管部署指南（不使用 Docker）

## 📋 概述

本文档说明如何在不使用 Docker 的情况下自托管部署 Inngest 服务。

**注意**：Inngest 官方推荐使用 Docker 部署，但也可以通过以下方式实现非 Docker 部署。

---

## 🚀 部署方式

### 方式一：使用 npm 全局安装（推荐用于开发环境）

#### 1. 安装 Inngest

```bash
npm install -g inngest
```

#### 2. 创建配置文件

在项目根目录创建 `inngest.config.json`：

```json
{
  "event_api": {
    "port": 8288,
    "host": "0.0.0.0"
  },
  "database": {
    "url": "postgresql://postgres:postgres@localhost:5432/riveredge",
    "pool_size": 10
  },
  "log_level": "info"
}
```

**配置说明**：
- `event_api.port`: Inngest 事件 API 端口（默认 8288）
- `event_api.host`: 监听地址（0.0.0.0 表示所有网络接口）
- `database.url`: PostgreSQL 数据库连接字符串
- `database.pool_size`: 数据库连接池大小
- `log_level`: 日志级别（info 或 debug）

#### 3. 启动服务

**Linux/macOS**：
```bash
chmod +x start-inngest.sh
./start-inngest.sh
```

**Windows**：
```cmd
start-inngest.bat
```

**或直接使用命令**：
```bash
inngest dev --config inngest.config.json
```

---

### 方式二：下载二进制文件（推荐用于生产环境）

#### 1. 下载二进制文件

从 Inngest 官方 GitHub Releases 下载对应平台的二进制文件：
- **Windows**: `inngest-windows-amd64.exe`
- **Linux**: `inngest-linux-amd64`
- **macOS**: `inngest-darwin-amd64` 或 `inngest-darwin-arm64`

**下载地址**：
- GitHub Releases: https://github.com/inngest/inngest/releases
- 或访问 Inngest 官网获取最新下载链接

#### 2. 设置执行权限（Linux/macOS）

```bash
chmod +x inngest-linux-amd64
```

#### 3. 创建配置文件

同方式一，创建 `inngest.config.json` 配置文件。

#### 4. 启动服务

**Linux/macOS**：
```bash
./inngest-linux-amd64 dev --config inngest.config.json
```

**Windows**：
```cmd
inngest-windows-amd64.exe dev --config inngest.config.json
```

---

## ⚙️ 配置说明

### 数据库配置

Inngest 需要 PostgreSQL 数据库来存储工作流状态和执行历史。

**连接字符串格式**：
```
postgresql://用户名:密码@主机:端口/数据库名
```

**示例**：
```json
{
  "database": {
    "url": "postgresql://postgres:postgres@localhost:5432/riveredge",
    "pool_size": 10
  }
}
```

**注意事项**：
- ✅ 确保 PostgreSQL 服务已启动
- ✅ 确保数据库已创建（如 `riveredge`）
- ✅ 确保用户有足够的权限

### 端口配置

默认端口为 8288，可以根据需要修改：

```json
{
  "event_api": {
    "port": 8288,
    "host": "0.0.0.0"
  }
}
```

**注意事项**：
- ✅ 确保端口未被占用
- ✅ 生产环境建议使用反向代理（如 Nginx）

---

## 🔧 生产环境部署

### 1. 使用 systemd（Linux）

创建 systemd 服务文件 `/etc/systemd/system/inngest.service`：

```ini
[Unit]
Description=Inngest Workflow Engine
After=network.target postgresql.service

[Service]
Type=simple
User=inngest
WorkingDirectory=/opt/inngest
ExecStart=/usr/local/bin/inngest dev --config /opt/inngest/inngest.config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable inngest
sudo systemctl start inngest
```

### 2. 使用 NSSM（Windows）

使用 NSSM（Non-Sucking Service Manager）将 Inngest 注册为 Windows 服务：

```cmd
nssm install Inngest "C:\path\to\inngest-windows-amd64.exe" "dev --config C:\path\to\inngest.config.json"
nssm start Inngest
```

### 3. 使用 PM2（Node.js 进程管理器）

如果使用 npm 安装的版本：

```bash
npm install -g pm2
pm2 start inngest -- dev --config inngest.config.json
pm2 save
pm2 startup
```

---

## 📊 验证部署

### 1. 检查服务状态

访问 Inngest 事件 API：
```bash
curl http://localhost:8288/api/health
```

应该返回：
```json
{
  "status": "ok"
}
```

### 2. 检查日志

查看 Inngest 服务日志，确认没有错误信息。

### 3. 测试事件发送

使用 Python SDK 发送测试事件：

```python
from inngest import Inngest, Event

inngest = Inngest(app_id="riveredge", event_api_base_url="http://localhost:8288")

# 发送测试事件
await inngest.send_event(
    event=Event(
        name="test/event",
        data={"message": "Hello, Inngest!"}
    )
)
```

---

## ⚠️ 注意事项

### 1. 数据库要求

- ✅ **必须使用 PostgreSQL**（不支持其他数据库）
- ✅ 确保数据库连接稳定
- ✅ 建议定期备份数据库

### 2. 性能考虑

- ✅ 生产环境建议使用独立的 PostgreSQL 实例
- ✅ 根据负载调整 `pool_size` 参数
- ✅ 监控数据库连接数和性能

### 3. 安全考虑

- ✅ 使用强密码保护数据库
- ✅ 生产环境使用 HTTPS（通过反向代理）
- ✅ 限制 Inngest API 的访问权限

### 4. 故障排查

**常见问题**：

1. **端口被占用**：
   ```bash
   # Linux/macOS
   lsof -i :8288
   
   # Windows
   netstat -ano | findstr :8288
   ```

2. **数据库连接失败**：
   - 检查 PostgreSQL 服务是否运行
   - 检查数据库连接字符串是否正确
   - 检查用户权限

3. **服务无法启动**：
   - 检查配置文件格式是否正确（JSON）
   - 查看错误日志
   - 确认所有依赖已安装

---

## 🔄 与 Docker 部署的对比

| 特性 | 非 Docker 部署 | Docker 部署 |
|------|---------------|-------------|
| 安装复杂度 | ⭐⭐⭐ 中等 | ⭐⭐ 简单 |
| 资源占用 | ⭐⭐ 较低 | ⭐⭐⭐ 较高 |
| 隔离性 | ⭐⭐ 较低 | ⭐⭐⭐ 高 |
| 可移植性 | ⭐⭐ 较低 | ⭐⭐⭐ 高 |
| 维护成本 | ⭐⭐⭐ 较高 | ⭐⭐ 较低 |

**推荐**：
- **开发环境**：使用 npm 全局安装（方式一）
- **生产环境**：推荐使用 Docker 部署（更稳定、易维护）

---

## 📚 参考资源

- [Inngest 官方文档](https://www.inngest.com/docs)
- [Inngest GitHub](https://github.com/inngest/inngest)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

---

## 🆘 获取帮助

如果遇到问题，可以：
1. 查看 Inngest 官方文档
2. 访问 Inngest GitHub Issues
3. 查看项目日志文件


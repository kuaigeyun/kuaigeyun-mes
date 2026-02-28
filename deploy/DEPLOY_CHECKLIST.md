# RiverEdge 传统部署清单

## 需要您提供的信息

| 项目 | 说明 | 示例 |
|------|------|------|
| **服务器 IP** | 部署目标服务器地址 | `1.2.3.4` 或 `your-domain.com` |
| **SSH 用户** | 能执行 `sudo` 的用户 | `root` 或 `ubuntu` |
| **数据库密码** | Postgres 密码（可自动生成） | 留空则脚本生成 |
| **平台管理员密码** | 首次登录 /infra/login 的密码 | 必填，勿使用弱密码 |

## 部署步骤

### 1. 生成配置（本地执行）

```bash
cd deploy
bash setup-env.sh
```

按提示输入，直接回车可使用默认值。会生成 `deploy/.env`。

### 2. 前置条件（服务器需满足）

- 已安装 Postgres、Redis、Caddy、Node.js、Python 3.11、UV（或 pip/venv）
- SSH 免密登录已配置（或准备好输入密码）
- 防火墙已开放 80、443 端口
- 域名已解析到服务器 IP

### 3. 按 TRADITIONAL_DEPLOY.md 执行部署

参考 `deploy/TRADITIONAL_DEPLOY.md` 完成：

1. 安装系统依赖
2. 配置 Postgres、Redis
3. 克隆代码、构建前后端
4. 配置 .env、Caddyfile、systemd 服务
5. 执行数据库迁移、启动服务

### 4. 部署后验证

```bash
# 检查服务状态
sudo systemctl status riveredge-backend
sudo systemctl status riveredge-inngest
sudo systemctl status caddy
```

访问：https://你的域名/infra/login  
用户名：`infra_admin`  
密码：步骤 1 中设置的平台管理员密码

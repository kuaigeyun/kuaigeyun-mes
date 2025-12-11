# 恢复端口 9000 使用方案

## 问题分析

端口 9000 位于 Windows 保留的端口范围内（8989-9088），这通常由以下原因引起：
1. **Hyper-V 或 WSL2** - 虚拟化功能会保留大量端口
2. **Docker Desktop** - 容器运行时保留端口范围
3. **Windows 更新** - 系统更新可能改变端口保留策略
4. **其他虚拟化软件**

## 解决方案

### 方案 1：禁用 Hyper-V 端口保留（如果不需要 Hyper-V）

```powershell
# 以管理员身份运行 PowerShell
netsh int ipv4 set excludedportrange protocol=tcp startport=8989 number=100 store=persistent
```

**注意**：这需要管理员权限，且可能影响 Hyper-V 功能。

### 方案 2：修改 Hyper-V 动态端口范围

如果使用 Hyper-V 或 WSL2，可以修改其动态端口范围，避开 9000：

```powershell
# 以管理员身份运行 PowerShell
netsh int ipv4 set dynamicport tcp start=49152 num=16384
```

### 方案 3：检查并禁用相关服务

检查是否有服务占用了端口范围：

```bash
# 检查 Hyper-V 相关服务
sc query vmcompute
sc query vmms

# 如果不需要，可以禁用（需要管理员权限）
sc stop vmcompute
sc stop vmms
```

### 方案 4：使用 netsh 命令查看详细信息

```bash
netsh interface ipv4 show excludedportrange protocol=tcp
```

查看哪个服务保留了端口范围。

## 临时解决方案（已实施）

如果无法恢复端口 9000，已将所有配置改为使用端口 9100：
- 后端：`start-backend.sh` → 端口 9100
- 前端：`vite.config.ts` → 代理到 9100
- 服务：`user.ts` → API 地址 9100

## 验证

恢复后，运行以下命令验证：

```bash
cd riveredge-backend
python scripts/check_port_9000.py
```

如果显示"端口可用"，说明已恢复。


# Inngest 启动问题排查总结

**问题发生时间**: 2025-12-27  
**问题解决时间**: 2025-12-27  
**排查耗时**: 较长时间（配置分散，问题隐蔽）

---

## 🔍 问题现象

Inngest Dev Server 无法启动，错误信息：
```
listen tcp 127.0.0.1:8288: bind: An attempt was made to access a socket in a way forbidden by its access permissions.
```

或
```
listen tcp 127.0.0.1:8300: bind: An attempt was made to access a socket in a way forbidden by its access permissions.
```

---

## 🎯 根本原因

**端口配置不一致** - 这是导致启动失败的根本原因。

### 问题链条

1. **环境变量设置**: `INNGEST_PORT=8300`（在 `.env` 和 `Launch.sh` 中）
2. **启动命令缺失**: 启动命令中**没有使用 `--port` 参数**
3. **默认行为**: Inngest 在没有 `--port` 参数时，使用**默认端口 8288**（不是环境变量的 8300）
4. **端口冲突**: Windows 系统可能保留了 8288 端口范围（8262-8361）
5. **绑定失败**: Inngest 尝试绑定到 8288，但被系统拒绝

### 配置不一致的具体表现

| 配置位置 | 设置的端口 | 实际使用的端口 | 状态 |
|---------|-----------|--------------|------|
| `.env` | `8300` | - | ✅ |
| `Launch.sh` (环境变量) | `8300` | - | ✅ |
| `Launch.sh` (启动命令) | **未指定** | **8288** (默认) | ❌ |
| `infra_config.py` | `8300` | - | ✅ |
| `client.py` | `8300` | - | ✅ |

**问题**: 启动命令没有将环境变量中的端口传递给 Inngest，导致使用了默认端口。

---

## 🔧 解决方案

### 修复内容

在两个启动脚本中添加 `--port $INNGEST_PORT` 参数：

#### 1. Launch.sh (第 872 行)

**修复前**:
```bash
("$inngest_exe" dev -u "$INNGEST_BACKEND_URL" --config "$config_file" --host 127.0.0.1 >> "$log_file" 2>&1) &
```

**修复后**:
```bash
("$inngest_exe" dev -u "$INNGEST_BACKEND_URL" --config "$config_file" --host 127.0.0.1 --port "$INNGEST_PORT" >> "$log_file" 2>&1) &
```

#### 2. bin/inngest/start-inngest.sh (第 118 行)

**修复前**:
```bash
("$inngest_exe" dev -u "$BACKEND_URL" --config "$config_file" --host 127.0.0.1 >> "$LOG_FILE" 2>&1) &
```

**修复后**:
```bash
("$inngest_exe" dev -u "$BACKEND_URL" --config "$config_file" --host 127.0.0.1 --port "$INNGEST_PORT" >> "$LOG_FILE" 2>&1) &
```

---

## 🤔 为什么排查这么久？

### 1. 配置分散

端口配置分布在多个文件中：
- `riveredge-backend/.env`
- `riveredge-frontend/.env`
- `Launch.sh`
- `bin/inngest/start-inngest.sh`
- `riveredge-backend/src/infra/config/infra_config.py`
- `riveredge-backend/src/core/inngest/client.py`

需要逐一检查才能发现不一致。

### 2. Inngest 的默认行为

Inngest 的 `dev` 命令：
- **有 `--port` 参数**: 使用指定的端口
- **没有 `--port` 参数**: 使用默认端口 8288（**不会自动读取环境变量**）

这是一个容易忽略的细节。

### 3. 错误信息误导

错误信息 `bind: An attempt was made to access a socket in a way forbidden by its access permissions` 看起来像：
- 权限问题（需要管理员权限）
- 端口被占用
- 防火墙问题

但实际上是因为：
- 端口被 Windows 系统保留
- 或者端口配置不一致，尝试绑定错误的端口

### 4. 历史配置影响

之前可能：
- 直接使用默认端口 8288 能正常工作
- 后来 Windows 系统更新或配置变更，保留了该端口范围
- 或者环境变量从 8288 改为 8300，但启动脚本没有同步更新

---

## 💡 经验教训

### 1. 明确指定参数

**不要依赖默认值**，特别是对于端口这种关键配置：
```bash
# ❌ 不好：依赖默认值
inngest.exe dev -u "$BACKEND_URL"

# ✅ 好：明确指定
inngest.exe dev -u "$BACKEND_URL" --port "$INNGEST_PORT"
```

### 2. 配置一致性检查

确保所有配置位置使用相同的值：
- 环境变量
- 启动脚本
- 代码配置
- 文档说明

### 3. 统一管理配置

所有端口配置应该：
- 统一从环境变量读取
- 启动脚本明确使用环境变量
- 代码配置回退到环境变量

### 4. 日志检查

启动日志中应该能看到实际使用的端口：
```json
{"level":"INFO","msg":"starting server","addr":"127.0.0.1:8300"}
```

如果看到的是 8288，说明配置没有生效。

### 5. 系统性检查

遇到配置问题时，应该：
1. 列出所有配置位置
2. 逐一检查每个位置的配置值
3. 检查配置的传递路径（环境变量 → 启动脚本 → 应用程序）
4. 验证实际使用的值（通过日志或进程检查）

---

## 📋 检查清单

为了避免类似问题，建议定期检查：

- [ ] 环境变量中的端口配置
- [ ] 启动脚本是否使用 `--port` 参数
- [ ] 启动脚本中的端口变量是否正确传递
- [ ] 代码配置中的默认端口
- [ ] 日志中显示的实际端口
- [ ] 进程监听的端口（`netstat` 或 `lsof`）
- [ ] 文档中的端口说明

---

## ✅ 验证修复

修复后验证：

1. **检查启动命令**:
   ```bash
   grep -A 1 "inngest_exe.*dev" Launch.sh | grep --port
   # 应该看到: --port "$INNGEST_PORT"
   ```

2. **检查日志**:
   ```bash
   tail -20 .logs/inngest.log | grep "starting server"
   # 应该看到: "addr":"127.0.0.1:8300"
   ```

3. **检查进程**:
   ```bash
   netstat -ano | grep :8300
   # 应该看到: TCP    127.0.0.1:8300    LISTENING
   ```

4. **访问 Dashboard**:
   ```
   http://127.0.0.1:8300/_dashboard
   # 应该能正常访问
   ```

---

## 🎉 最终结果

- ✅ 端口配置已统一为 `8300`
- ✅ 启动脚本已修复，明确使用 `--port $INNGEST_PORT`
- ✅ Inngest 成功启动在端口 `8300`
- ✅ Dashboard 可正常访问
- ✅ 后端端点 `/api/inngest` 正常响应

**问题已彻底解决！**

---

**总结**: 根本原因是**端口配置不一致** - 环境变量设置了 8300，但启动命令没有使用 `--port` 参数，导致 Inngest 使用了默认端口 8288，而该端口在 Windows 上可能被系统保留。修复方法是在启动命令中明确添加 `--port $INNGEST_PORT` 参数。


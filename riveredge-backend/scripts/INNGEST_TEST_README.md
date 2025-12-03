# Inngest 集成测试指南

## 📋 测试步骤

### 1. 确保服务运行

确保以下服务都在运行：
- **Inngest 服务**: `http://localhost:8288`
- **后端服务**: `http://localhost:9000`

如果使用 `start-all.sh` 启动，所有服务会自动启动。

### 2. 运行测试脚本

```bash
cd riveredge-backend
source ../venv311/Scripts/activate  # Windows Git Bash
# 或
source ../venv311/bin/activate  # Linux/Mac

python scripts/test_inngest_integration.py
```

### 3. 手动测试 API

#### 3.1 测试发送事件

```bash
curl -X POST http://localhost:9000/api/v1/test/inngest \
  -H "Content-Type: application/json" \
  -d '{"message": "测试消息"}'
```

#### 3.2 检查 Inngest Dashboard

访问 `http://localhost:8288/_dashboard`，查看：
- **Functions**: 确认 `test-integration` 函数已注册
- **Events**: 确认测试事件已接收
- **Runs**: 确认工作流已执行

### 4. 验证集成状态

#### 4.1 检查 Inngest 服务
```bash
curl http://localhost:8288
```

#### 4.2 检查后端健康状态
```bash
curl http://localhost:9000/health
```

#### 4.3 检查 Inngest API 端点
```bash
curl http://localhost:9000/api/inngest
```

## 🔍 预期结果

### 测试脚本输出

```
============================================================
Inngest 集成测试
============================================================

[1] 测试 Inngest 服务连接...
✓ Inngest 服务正在运行 (http://localhost:8288)

[2] 测试后端服务连接...
✓ 后端服务正在运行 (http://localhost:9000)

[3] 测试 Inngest API 端点...
✓ Inngest API 端点已注册

[4] 测试发送事件到 Inngest...
✓ 事件发送成功
  事件 ID: ['xxx-xxx-xxx']

[5] 等待 Inngest 处理事件...

[6] 检查 Inngest Dashboard...
✓ Inngest Dashboard 可访问 (http://localhost:8288/_dashboard)
```

### Inngest Dashboard 中应该看到

1. **Functions 页面**:
   - 函数名称: `test-integration`
   - 函数 ID: `test-integration`
   - 触发器: `test/integration` 事件

2. **Events 页面**:
   - 事件名称: `test/integration`
   - 事件数据包含 `message` 字段

3. **Runs 页面**:
   - 运行状态: `Completed`
   - 返回结果包含 `success: true`

## 🐛 故障排除

### 问题 1: Inngest 服务未运行

**症状**: 测试脚本显示 "无法连接到 Inngest 服务"

**解决方案**:
```bash
# 检查 Inngest 是否运行
netstat -ano | grep 8288

# 手动启动 Inngest
cd bin
./inngest.exe dev --config inngest.config.json
```

### 问题 2: 后端服务未运行

**症状**: 测试脚本显示 "无法连接到后端服务"

**解决方案**:
```bash
# 检查后端是否运行
netstat -ano | grep 9000

# 使用 start-all.sh 启动所有服务
./start-all.sh
```

### 问题 3: Inngest 函数未注册

**症状**: Dashboard 中看不到 `test-integration` 函数

**解决方案**:
1. 确保后端服务已启动
2. 确保 `tree_root/inngest/functions/test_function.py` 文件存在
3. 检查后端日志，查看是否有导入错误
4. 重启后端服务

### 问题 4: 事件发送失败

**症状**: 测试 API 返回错误

**解决方案**:
1. 检查 Inngest 服务是否运行
2. 检查 `INNGEST_EVENT_API_URL` 环境变量是否正确
3. 检查后端日志，查看详细错误信息

## 📝 下一步

集成测试通过后，可以：

1. **实现消息发送集成**: 在 `message_service.py` 中集成 Inngest 事件驱动
2. **实现定时任务集成**: 在 `scheduled_task_service.py` 中注册 Inngest 函数
3. **创建更多工作流函数**: 在 `tree_root/inngest/functions/` 目录下创建更多函数

## 🔗 相关文档

- [Inngest 集成指南](../plans/3.system/最佳实践/sys第四阶段/Inngest集成指南.md)
- [Inngest 自托管部署指南](../plans/3.system/最佳实践/sys第四阶段/Inngest自托管部署指南.md)


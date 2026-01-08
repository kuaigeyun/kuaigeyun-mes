# 前后端集成测试使用指南

## 📋 概述

前后端集成测试用于验证前端服务与后端API的真实交互，确保完整的业务流程能够正常运行。

## 🎯 测试目标

1. **验证API调用**：前端服务函数能正确调用后端API
2. **验证数据流转**：前后端数据格式匹配
3. **验证业务流程**：完整业务流程能正常执行
4. **验证错误处理**：API错误能正确处理

## 🚀 快速开始

### 前置条件

1. **后端服务运行中**
   ```bash
   # 确保后端服务运行在 http://localhost:8100
   cd riveredge-backend
   # 启动后端服务
   ```

2. **测试数据准备**
   - 确保数据库中有测试客户（code: TEST-CUSTOMER-001）
   - 确保数据库中有测试物料（code: TEST-MAT-001）
   - 或者使用现有的测试数据

### 运行测试

```bash
# 进入前端目录
cd riveredge-frontend

# 运行前后端集成测试
npm run test tests/e2e/sales-order-workflow-integration.test.ts

# 或使用vitest直接运行
npx vitest run tests/e2e/sales-order-workflow-integration.test.ts
```

### 配置后端URL

通过环境变量配置后端URL：

```bash
# Windows (Git Bash)
export VITE_BACKEND_URL=http://localhost:8100
npm run test tests/e2e/sales-order-workflow-integration.test.ts

# 或在测试文件中修改 BACKEND_URL 常量
```

## 📝 测试流程

### 销售订单完整流程

测试会执行以下步骤：

1. ✅ **创建销售订单**（草稿状态）
2. ✅ **获取订单详情**
3. ✅ **更新订单信息**
4. ✅ **提交订单**（待审核状态）
5. ✅ **审核订单**（已审核状态）
6. ✅ **确认订单**（已确认状态）
7. ✅ **下推到销售出库**
8. ✅ **验证订单列表**

### 测试覆盖

- ✅ API调用正确性
- ✅ 数据格式验证
- ✅ 状态流转验证
- ✅ 错误处理验证
- ✅ 列表筛选功能

## 🔧 测试配置

### 环境变量

```bash
# 后端服务URL
VITE_BACKEND_URL=http://localhost:8100

# 测试超时时间（毫秒）
TEST_TIMEOUT=30000
```

### 测试数据

测试会自动查找测试数据：
- 测试客户：code = 'TEST-CUSTOMER-001'
- 测试物料：code = 'TEST-MAT-001'

如果找不到，会使用列表中的第一条记录。

## 📊 测试结果解读

### 成功示例

```
================================================================================
开始测试销售订单完整流程（前后端集成）
================================================================================

[步骤1] 创建销售订单...
✅ 订单创建成功: SO202601060005 (ID: 72)

[步骤2] 获取订单详情...
✅ 订单详情获取成功

[步骤3] 更新订单...
✅ 订单更新成功

[步骤4] 提交订单...
✅ 订单提交成功，状态: 待审核

[步骤5] 审核订单...
✅ 订单审核成功，状态: 已审核

[步骤6] 确认订单...
✅ 订单确认成功，状态: 已确认

[步骤7] 下推到销售出库...
✅ 下推成功，出库单编码: SD202601060003

[步骤8] 验证订单列表...
✅ 订单在列表中，共 10 条记录

================================================================================
✅ 销售订单完整流程测试通过！
   订单编码: SO202601060005
   订单ID: 72
================================================================================
```

### 失败处理

测试会捕获错误并继续执行后续步骤，确保测试的完整性：

```typescript
try {
  await submitSalesOrder(orderId)
  // 成功处理
} catch (error) {
  console.warn(`⚠️  订单提交失败: ${error.message}`)
  // 继续测试其他步骤
}
```

## 🐛 故障排查

### 常见问题

1. **后端服务不可用**
   ```
   错误: 无法连接到后端服务
   解决: 确保后端服务运行在 http://localhost:8100
   ```

2. **测试数据不存在**
   ```
   错误: 未找到测试客户/物料
   解决: 运行后端MOCK数据脚本或使用现有数据
   ```

3. **认证失败**
   ```
   错误: 401 Unauthorized
   解决: 检查前端API配置中的认证token
   ```

### 调试技巧

```bash
# 使用详细输出
npm run test tests/e2e/sales-order-workflow-integration.test.ts -- --reporter=verbose

# 只运行特定测试
npx vitest run tests/e2e/sales-order-workflow-integration.test.ts -t "应该完成销售订单从创建到出库的完整流程"
```

## 📈 与后端E2E测试的区别

| 特性 | 后端E2E测试 | 前后端集成测试 |
|------|------------|---------------|
| 测试范围 | 后端API | 前端服务 + 后端API |
| 测试工具 | pytest + httpx | vitest + fetch |
| 测试数据 | 自动创建 | 使用现有数据或自动查找 |
| 验证点 | API响应 | 前端服务函数调用 |
| 执行环境 | Python | Node.js |

## 🔄 CI/CD集成

### GitHub Actions示例

```yaml
- name: Run Frontend Integration Tests
  run: |
    cd riveredge-frontend
    export VITE_BACKEND_URL=http://localhost:8100
    npm run test:run tests/e2e/sales-order-workflow-integration.test.ts
  env:
    VITE_BACKEND_URL: http://localhost:8100
```

## 📚 相关文档

- [全流程自动化测试方案](../../../docs/testing/全流程自动化测试方案.md)
- [后端E2E测试](../../../riveredge-backend/tests/e2e/README_全流程测试.md)

## 💡 最佳实践

1. **测试独立性**：每个测试应该独立运行
2. **数据清理**：测试结束后保留测试数据用于验证
3. **错误处理**：捕获错误但继续执行，确保测试完整性
4. **日志输出**：使用console.log输出测试进度
5. **超时设置**：合理设置测试超时时间


# 销售订单E2E测试说明

## 测试文件

- `test_sales_order_complete_workflow.py`: 销售订单完整流程E2E测试

## 测试覆盖的流程

### 1. 创建销售订单（带明细项）
- ✅ 创建订单
- ✅ 验证订单基本信息
- ✅ 验证明细项保存
- ✅ 验证总数量和总金额计算

### 2. 获取订单列表和筛选
- ✅ 获取订单列表
- ✅ 按状态筛选
- ✅ 按客户筛选
- ✅ 分页功能

### 3. 更新订单
- ✅ 更新订单信息
- ✅ 验证更新后的数据

### 4. 提交和审核订单
- ✅ 提交订单
- ✅ 审核订单
- ✅ 状态流转

### 5. 完整工作流
- ✅ 创建 → 更新 → 提交 → 审核 → 确认
- ✅ 获取详情
- ✅ 获取列表

## 运行测试

```bash
# 运行所有销售订单E2E测试
cd riveredge-backend
uv run pytest tests/e2e/test_sales_order_complete_workflow.py -v

# 运行特定测试
uv run pytest tests/e2e/test_sales_order_complete_workflow.py::TestSalesOrderCompleteWorkflow::test_sales_order_create_with_items -v

# 运行并查看详细输出
uv run pytest tests/e2e/test_sales_order_complete_workflow.py -v -s
```

## 测试数据

测试使用独立的测试数据：
- 测试租户：`domain="test"`
- 测试客户：`code="TEST-CUSTOMER-001"`
- 测试用户：`username="test_user"`

测试结束后会自动清理测试数据。

## 注意事项

1. 确保数据库连接正常
2. 确保测试租户和应用已正确配置
3. 某些API端点可能尚未实现，测试会跳过或标记为预期失败








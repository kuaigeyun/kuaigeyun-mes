# 端到端测试运行说明

## ✅ 测试框架已就绪

测试框架已成功创建并配置完成。当前状态：

- ✅ 测试文件已创建（8个测试用例）
- ✅ 测试依赖已安装
- ✅ 数据库配置已修复（移除了已删除的BOM模型引用）
- ✅ 测试可以正常收集

## 🚀 运行测试

### 方法1：使用便捷脚本

```bash
# 在项目根目录
./run-e2e-tests.sh
```

### 方法2：使用uv run

```bash
cd riveredge-backend

# 运行所有测试
uv run pytest tests/e2e/ -v

# 运行特定测试
uv run pytest tests/e2e/test_mts_workflow.py -v

# 生成HTML报告
uv run pytest tests/e2e/ -v --html=test_report.html --self-contained-html
```

## ⚠️ 注意事项

### 1. 测试环境要求

- ✅ 数据库服务必须运行
- ✅ 数据库连接配置正确
- ✅ 测试数据库已创建（建议使用独立的测试数据库）

### 2. 测试数据

测试会自动创建和清理测试数据，但需要：
- 基础数据（物料、BOM、工艺路线等）需要在数据库中预先存在
- 或者修改测试用例，在测试中创建所需的基础数据

### 3. 认证问题

当前测试使用模拟的认证头，实际运行时需要：
- 实现真实的登录逻辑
- 或者配置测试环境的认证绕过机制

### 4. 异步任务

某些测试涉及异步任务（如应付单/应收单生成），需要：
- Inngest服务运行
- 或者增加等待时间
- 或者使用轮询机制等待任务完成

## 📊 测试报告

测试运行后会生成：

1. **控制台输出**：实时显示测试进度
2. **JUnit XML**：`test_results.xml`（用于CI/CD）
3. **HTML报告**：`test_report.html`（详细报告）

## 🔧 下一步优化建议

1. **完善测试数据准备**
   - 创建测试fixtures来准备基础数据
   - 使用工厂模式创建测试对象

2. **实现真实认证**
   - 在`conftest.py`中实现真实的登录流程
   - 获取真实的JWT token

3. **优化异步任务等待**
   - 使用轮询机制等待Inngest任务完成
   - 添加超时和重试机制

4. **添加更多测试场景**
   - 边界条件测试
   - 错误处理测试
   - 性能测试

## 📝 测试用例列表

当前已创建的测试用例：

1. **MTS模式完整流程** (`test_mts_workflow.py`)
   - `test_mts_complete_workflow` - MTS完整流程测试

2. **MTO模式完整流程** (`test_mto_workflow.py`)
   - `test_mto_complete_workflow` - MTO完整流程测试

3. **采购流程闭环** (`test_purchase_workflow.py`)
   - `test_purchase_complete_workflow` - 采购流程测试

4. **质量管理流程** (`test_quality_workflow.py`)
   - `test_incoming_inspection_workflow` - 来料检验流程
   - `test_process_inspection_workflow` - 过程检验流程
   - `test_finished_goods_inspection_workflow` - 成品检验流程

5. **财务协同流程** (`test_finance_workflow.py`)
   - `test_payable_workflow` - 应付单流程
   - `test_receivable_workflow` - 应收单流程

**总计：8个测试用例**

---

**最后更新**：2026-01-03  
**状态**：测试框架已就绪，可以运行测试


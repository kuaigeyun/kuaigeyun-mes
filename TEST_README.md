# 用户创建功能测试套件

## 📋 概述

这个测试套件包含三个脚本，用于全面测试用户创建功能的各个方面：

1. `check_api_health.py` - API健康检查
2. `test_user_creation.py` - 全面功能测试
3. `test_password_length.py` - 密码长度专项测试
4. `cleanup_test_users.py` - 测试数据清理

## 🚀 快速开始

### 1. 环境准备

确保后端服务正在运行：
```bash
cd riveredge-backend
uv run uvicorn src.server.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. API健康检查

```bash
python check_api_health.py
# 或指定自定义URL
python check_api_health.py http://your-server:8000
```

### 3. 密码长度测试

```bash
python test_password_length.py
```

这个脚本会测试不同长度的密码：
- 1字符（应该失败）
- 7字符（应该失败）
- 8字符（应该成功）
- 50字符（应该成功）
- 72字符（应该成功）
- 73字符（应该成功）
- 100字符（应该成功）
- 200字符（应该成功）
- 500字符（应该成功）

### 4. 全面功能测试

```bash
python test_user_creation.py
```

脚本会提示输入管理员账号信息，然后运行12个测试用例：

#### 测试用例说明

| 测试项目 | 预期结果 | 说明 |
|---------|---------|------|
| 正常用户创建 | ✅ 成功 | 完整的用户信息 |
| 密码过短 | ❌ 失败 | 密码少于8字符 |
| 超长密码 | ✅ 成功 | 100字符密码测试bcrypt处理 |
| 重复用户名 | ❌ 失败 | 用户名已存在 |
| 无效电话号码 | ❌ 失败 | 非11位手机号格式 |
| 无效邮箱 | ❌ 失败 | 邮箱格式错误 |
| 缺失用户名 | ❌ 失败 | 必填字段验证 |
| 缺失密码 | ❌ 失败 | 必填字段验证 |
| 缺失电话 | ❌ 失败 | 必填字段验证 |
| 无邮箱可选字段 | ✅ 成功 | 邮箱为可选字段 |
| 中文用户名 | ✅ 成功 | 支持中文用户名 |
| 特殊字符密码 | ✅ 成功 | 复杂密码支持 |

### 5. 清理测试数据

```bash
python cleanup_test_users.py
```

脚本会自动识别并删除所有测试用户（用户名包含 `testuser`、`test_pwd_`、`测试` 等关键词）。

## 📊 测试结果解读

### 成功标准

- **API健康检查**: 返回成功状态
- **密码长度测试**: 8字符以上密码全部成功，8字符以下全部失败
- **功能测试**: 7个成功用例 + 5个失败用例 = 12/12 通过
- **数据清理**: 成功删除所有测试用户

### 常见问题

#### 1. 连接失败
```
❌ 连接失败: 无法连接到 http://localhost:8000
```
**解决**: 检查后端服务是否启动，端口是否正确

#### 2. 登录失败
```
❌ 登录失败，无法进行测试
```
**解决**: 确认管理员账号密码正确，或修改脚本中的默认值

#### 3. 密码测试失败
```
❌ 密码长度 8 字符: 失败
```
**可能原因**:
- 前端验证规则未更新
- 后端schema仍有长度限制
- bcrypt处理异常

## 🔧 故障排除

### 检查后端日志

如果测试失败，查看后端日志：
```bash
tail -f riveredge-backend/.logs/backend.log
```

### 手动测试API

使用curl手动测试：
```bash
# 测试用户创建
curl -X POST http://localhost:8000/api/v1/core/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "verylongpassword123456789",
    "full_name": "测试用户",
    "phone": "13800138000",
    "email": "test@example.com"
  }'
```

### 验证bcrypt行为

检查bcrypt对长密码的处理：
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

# 测试长密码
long_password = "a" * 100
hash_result = pwd_context.hash(long_password)
print(f"哈希长度: {len(hash_result)}")  # 应该约60字符
```

## 📝 自定义配置

### 修改测试参数

在脚本中修改：
```python
# 修改服务器地址
base_url = "http://your-custom-server:port"

# 修改管理员账号
admin_username = "your_admin"
admin_password = "your_password"
```

### 添加更多测试用例

在 `test_user_creation.py` 的 `test_cases` 列表中添加新的测试用例。

## 🎯 测试覆盖范围

- ✅ 用户名验证（唯一性、中文支持）
- ✅ 密码验证（长度、复杂度）
- ✅ 电话号码格式验证
- ✅ 邮箱格式验证（可选字段）
- ✅ 必填字段验证
- ✅ bcrypt密码哈希处理
- ✅ API错误处理和响应格式
- ✅ 数据库约束和外键关联

---

## 📞 技术支持

如果测试失败，请提供：
1. 完整的错误输出
2. 后端日志片段
3. 使用的测试脚本版本

这将帮助快速定位和解决问题。

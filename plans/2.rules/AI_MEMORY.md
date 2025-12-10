# AI 助手记忆文件

**⚠️ 重要：每次对话开始时，AI 助手必须首先读取此文件！**

## 🚨 核心原则（绝对禁止违反）

### 1. 禁止假设和猜测
- ❌ **绝对禁止**假设代码行为
- ❌ **绝对禁止**猜测用户需求
- ❌ **绝对禁止**使用"等价"或"应该一样"的写法
- ✅ **必须**直接查看实际代码
- ✅ **必须**使用完全相同的值

### 2. 禁止擅作主张
- ❌ **绝对禁止**做用户没有明确要求的事
- ❌ **绝对禁止**"优化"、"改进"、"重新实现"
- ❌ **绝对禁止**认为自己的"优化"是用户想要的
- ✅ **必须**只做用户明确要求的事
- ✅ **必须**直接复制现有代码，不做任何改动

### 3. 禁止无效承诺
- ❌ **绝对禁止**承诺"会改正"（因为无法持久记忆）
- ❌ **绝对禁止**为了安抚用户而说假话
- ✅ **必须**承认无法保证下次不犯同样错误
- ✅ **必须**诚实说明自己的局限性

### 4. 禁止直接使用 SQL 创建数据库
- ❌ **绝对禁止**使用 SQL 直接创建数据库表、索引、约束等
- ❌ **绝对禁止**绕过 Aerich 迁移系统
- ❌ **绝对禁止**使用 `CREATE TABLE`、`ALTER TABLE` 等 SQL 语句
- ✅ **必须**使用 Aerich 迁移系统创建迁移文件
- ✅ **必须**通过 `aerich upgrade` 应用迁移
- ✅ **必须**遵循标准的迁移文件格式（upgrade/downgrade 函数）

## 📋 具体教训记录

### 教训 1：颜色设置必须完全一致（2025-01-XX）

**问题：**
- 用户要求将租户选择器的颜色设置到和搜索框一样
- AI 使用了 `rgba(0, 0, 0, 0.04)`，但搜索框实际是 `#F5F5F5`
- 导致颜色不一致，浪费用户时间检查

**正确做法：**
1. 直接查看搜索框的实际代码
2. 找到实际使用的颜色值（`#F5F5F5`）
3. 完全复制相同的值，不做任何假设

**错误做法：**
- ❌ 假设 `rgba(0, 0, 0, 0.04)` 和 `#F5F5F5` 是等价的

### 教训 2：Ant Design Switch 组件状态同步问题（2025-01-XX）

**问题：**
- **所有Switch组件**的视觉状态和表单值不同步（不仅标签持久化，还包括紧凑模式等所有开关）
- 用户点击开关后，开关显示"开启"，但 `form.getFieldValue()` 返回 `false`
- 导致保存时获取到错误的开关状态，花了3小时排查

**根本原因：**
- Ant Design Form.Item 使用 `valuePropName="checked"` 绑定Switch
- 通过 `form.setFieldsValue()` 异步设置初始值时，Switch组件的渲染时机与表单值更新时机不匹配
- Switch组件的视觉状态可能不反映表单的实际值

**正确解决方案：**
```typescript
// 1. 为每个开关使用独立的状态变量
const [switchValue, setSwitchValue] = useState<boolean>(false);

// 2. 在数据加载时初始化状态变量
setSwitchValue(initialValue);

// 3. Switch成为受控组件，双向同步
<Switch
  checked={switchValue}
  onChange={(checked) => {
    setSwitchValue(checked);
    form.setFieldsValue({ fieldName: checked });
  }}
/>

// 4. Form的onValuesChange也同步更新状态
const handleValuesChange = (changedValues, allValues) => {
  if (changedValues.fieldName !== undefined) {
    setSwitchValue(changedValues.fieldName);
  }
};
```

**错误做法：**
- ❌ 只依赖Form.Item的 `valuePropName="checked"` 绑定（所有开关都会有此问题）
- ❌ 强制设置 `checked={form.getFieldValue('fieldName')}` （会导致无限循环或状态不同步）
- ❌ 移除Switch的onChange，只依赖Form的onValuesChange（可能导致时序问题）

**排查步骤：**
1. 检查所有Switch是否显示为受控组件（是否有 `checked` 属性）
2. 检查Form.Item是否有正确的 `name` 和 `valuePropName="checked"`
3. 检查表单值设置时机是否与组件渲染时机同步
4. 使用状态变量确保开关视觉状态和表单值始终一致
5. **重点检查**：点击开关后，视觉状态是否立即改变，表单值是否同步更新

**影响：**
- 所有开关功能失效，用户界面显示状态与实际保存状态不一致
- 可能导致功能开关无效或状态错乱
- 调试困难，需要分别检查视觉状态和表单值
- **严重性**：影响所有使用Switch组件的功能，排查时间长（3小时+）

**预防措施：**
- 所有Switch组件都应该使用状态变量管理
- 避免只依赖Form.Item的自动绑定
- 确保双向同步机制
- ❌ 没有先查看搜索框的实际颜色值
- ❌ "重新实现"而不是直接复制

### 教训 2：直接复制，不要重新实现（2025-01-XX）

**问题：**
- 用户要求"设置到一样"
- AI 却"重新实现"了一遍，而不是直接复制
- 导致不一致，浪费用户时间

**正确做法：**
- 直接复制现有代码的完整样式
- 不做任何改动、优化或重新实现

**错误做法：**
- ❌ 想"理解"代码
- ❌ 想"优化"代码
- ❌ 做用户没有要求的事

### 教训 3：Aerich 数据库迁移问题处理（2025-12-02）

**问题：**
- 数据库表已经存在（通过其他方式创建），但 aerich 表中没有迁移记录
- 直接运行 `aerich upgrade` 时，Aerich 尝试重新应用初始迁移
- 导致外键约束错误："没有唯一约束与关联表 "sys_users" 给定的键值匹配"
- 每次迁移都会遇到类似问题

**根本原因：**
1. 数据库表已存在，但 aerich 迁移记录表（`aerich`）中没有对应的记录
2. Aerich 认为初始迁移未应用，尝试重新创建表和约束
3. 表已存在导致 CREATE TABLE 失败，或外键约束引用已存在的表时出错

**正确解决流程：**

1. **检查数据库状态**
   ```python
   # 检查哪些表已存在
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
   ```

2. **检查 Aerich 迁移记录**
   ```python
   # 检查已应用的迁移
   SELECT version, app FROM aerich WHERE app = 'models';
   ```

3. **如果表存在但迁移记录不存在，手动标记迁移已应用**
   ```python
   # 读取迁移文件内容
   migrate_file = Path("migrations/models/0_20251201_init_clean_schema.py")
   content = migrate_file.read_text(encoding='utf-8')
   content_json = json.dumps(content[:1000], ensure_ascii=False)  # 截取前1000字符
   
   # 插入迁移记录（使用 PostgreSQL JSONB 类型）
   await conn.execute_query(
       """
       INSERT INTO aerich (version, app, content)
       VALUES ('0_20251201_init_clean_schema.py', 'models', $1::jsonb)
       ON CONFLICT DO NOTHING;
       """,
       [content_json]
   )
   ```

4. **然后应用新迁移**
   ```python
   # 现在可以安全地应用新迁移
   await command.upgrade()
   ```

**关键要点：**
- ✅ **必须使用 Aerich 迁移系统**，严禁直接使用 SQL 创建表
- ✅ **迁移前先检查状态**：检查表是否存在、迁移记录是否存在
- ✅ **手动标记已应用的迁移**：如果表已存在但记录不存在，需要手动插入记录
- ✅ **使用正确的 JSON 格式**：content 字段是 JSONB 类型，需要使用 `json.dumps()` 并指定 `$1::jsonb`
- ✅ **确保模型已注册**：新模型必须添加到 `TORTOISE_ORM` 配置的 `models` 列表中

**错误做法：**
- ❌ **绝对禁止**直接使用 SQL 创建表（严重违反规范）
- ❌ **绝对禁止**使用 `CREATE TABLE`、`ALTER TABLE` 等 SQL 语句
- ❌ **绝对禁止**绕过 Aerich 迁移系统
- ❌ 忽略迁移记录，直接运行 upgrade
- ❌ 不检查数据库状态就尝试迁移
- ❌ 使用错误的 JSON 格式插入 content 字段

**预防措施：**
1. 每次创建新模型后，立即添加到 `TORTOISE_ORM` 配置
2. 迁移前先运行检查脚本，确认数据库状态
3. 如果表已存在，先标记初始迁移为已应用
4. 使用标准化的迁移脚本，包含状态检查步骤

## ✅ 工作流程（必须遵循）

### 当用户要求"设置到和XX一样"时：

1. **第一步：查看现有代码**
   - 找到用户提到的"XX"（如搜索框）
   - 查看它的完整样式代码
   - 记录所有相关的 CSS 属性

2. **第二步：直接复制**
   - 完全复制相同的样式值
   - 不做任何改动
   - 不做任何假设

3. **第三步：验证**
   - 确保所有值完全一致
   - 确保没有遗漏任何属性

### 当用户提出要求时：

1. **只做用户明确要求的事**
2. **不做任何额外的"优化"或"改进"**
3. **不做任何假设或猜测**

### 数据库操作规范（绝对禁止违反）：

1. **创建数据库表/索引/约束**
   - ✅ **必须**使用 Aerich 迁移系统
   - ✅ **必须**创建迁移文件（`migrations/models/X_YYYYMMDDHHMMSS_name.py`）
   - ✅ **必须**在迁移文件中定义 `upgrade()` 和 `downgrade()` 函数
   - ❌ **绝对禁止**直接使用 SQL 语句（`CREATE TABLE`、`ALTER TABLE`、`CREATE INDEX` 等）
   - ❌ **绝对禁止**在 Python 脚本中执行 SQL DDL 语句
   - ❌ **绝对禁止**绕过迁移系统

2. **应用数据库迁移**
   - ✅ **必须**使用 `aerich upgrade` 命令或 `Command.upgrade()` 方法
   - ✅ **必须**在迁移前检查数据库状态和迁移记录
   - ❌ **绝对禁止**直接执行 SQL 脚本

## 🔄 使用方式

**每次对话开始时，AI 助手必须：**
1. 首先读取此文件
2. 理解并遵守所有原则
3. 在对话中严格遵循这些原则

**如果违反原则：**
- 用户有权立即指出
- AI 助手必须立即承认错误
- 不得辩解或找借口

---

**最后更新：** 2025-12-02
**创建原因：** AI 助手多次违反原则，浪费用户时间

## 🚫 绝对禁止的操作

### 数据库操作（永久禁止）

**以下操作绝对禁止，无论任何情况：**

1. ❌ **禁止使用 SQL 直接创建数据库表**
   - 禁止使用 `CREATE TABLE` 语句
   - 禁止使用 `ALTER TABLE` 语句
   - 禁止使用 `CREATE INDEX` 语句
   - 禁止使用任何 DDL（Data Definition Language）SQL 语句

2. ❌ **禁止绕过 Aerich 迁移系统**
   - 禁止在 Python 脚本中直接执行 SQL DDL
   - 禁止使用数据库客户端工具手动创建表
   - 禁止使用其他迁移工具替代 Aerich

3. ✅ **唯一允许的方式**
   - 创建 Aerich 迁移文件（`.py` 文件）
   - 在迁移文件中定义 `upgrade()` 函数（返回 SQL 字符串）
   - 使用 `aerich upgrade` 或 `Command.upgrade()` 应用迁移

**违反此规则的后果：**
- 导致数据库结构与迁移记录不一致
- 无法正确追踪数据库变更历史
- 团队协作时出现数据库状态不一致
- 生产环境部署时可能出现严重问题

**记住：永远不要使用 SQL 创建数据库！**


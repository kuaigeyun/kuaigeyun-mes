# UnifiedProTable - 统一表格组件

## 功能说明

`UnifiedProTable` 是一个封装了所有表格通用配置和功能的统一组件，确保所有表格使用统一的格式。后续完善时，只需修改此组件，所有表格都会同步更新。

## 主要特性

- ✅ **统一的排序处理**：自动处理排序参数转换（`ascend`/`descend` → `asc`/`desc`）
- ✅ **统一的按钮容器**：自动将按钮容器移动到表格内部
- ✅ **统一的分页配置**：默认分页大小、快速跳转等
- ✅ **统一的行选择**：可选的复选框行选择
- ✅ **统一的行编辑**：可选的表格行内编辑
- ✅ **统一的工具栏**：统一的工具栏按钮配置
- ✅ **高级搜索集成**：内置 `QuerySearchButton` 支持

## 使用方法

### 基础用法

```typescript
import { UnifiedProTable } from '@/components/UnifiedProTable';
import { ProColumns } from '@ant-design/pro-components';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface User {
  id: number;
  name: string;
  email: string;
}

const UserList: React.FC = () => {
  const columns: ProColumns<User>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 150,
      sorter: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
    },
  ];

  return (
    <UnifiedProTable<User>
      headerTitle="用户列表"
      columns={columns}
      request={async (params, sort, filter) => {
        // 排序参数已自动处理，sort 对象包含排序信息
        const result = await getUserList({
          page: params.current || 1,
          page_size: params.pageSize || 10,
          sort: sort.name === 'ascend' ? 'name' : sort.name === 'descend' ? '-name' : undefined,
        });
        return {
          data: result.items,
          success: true,
          total: result.total,
        };
      }}
      afterSearchButtons={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/users/create')}
        >
          新建用户
        </Button>
      }
    />
  );
};
```

### 启用行选择

```typescript
<UnifiedProTable<User>
  enableRowSelection={true}
  onRowSelectionChange={(selectedRowKeys) => {
    console.log('选中的行:', selectedRowKeys);
  }}
  // ... 其他配置
/>
```

### 启用行编辑

```typescript
<UnifiedProTable<User>
  enableRowEdit={true}
  onRowEditSave={async (key, row) => {
    await updateUser(row.id, row);
    message.success('保存成功');
  }}
  onRowEditDelete={async (key, row) => {
    await deleteUser(row.id);
    message.success('删除成功');
  }}
  // ... 其他配置
/>
```

### 自定义工具栏按钮

```typescript
<UnifiedProTable<User>
  toolBarActions={[
    <Button key="custom1" onClick={() => {}}>自定义按钮1</Button>,
    <Button key="custom2" onClick={() => {}}>自定义按钮2</Button>,
  ]}
  showExportButton={true}
  onExport={(selectedRowKeys) => {
    console.log('导出选中的行:', selectedRowKeys);
  }}
  // ... 其他配置
/>
```

### 禁用高级搜索

```typescript
<UnifiedProTable<User>
  showAdvancedSearch={false}
  // ... 其他配置
/>
```

## API 文档

### UnifiedProTableProps

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `request` | `(params, sort, filter) => Promise<{data, success, total}>` | 必填 | 数据请求函数，已内置排序参数处理 |
| `columns` | `ProColumns<T>[]` | 必填 | 表格列定义 |
| `headerTitle` | `string` | - | 表格标题 |
| `rowKey` | `string` | `'id'` | 行主键字段名 |
| `showAdvancedSearch` | `boolean` | `true` | 是否显示高级搜索按钮 |
| `beforeSearchButtons` | `ReactNode` | - | 高级搜索按钮前的自定义按钮 |
| `afterSearchButtons` | `ReactNode` | - | 高级搜索按钮后的自定义按钮 |
| `enableRowSelection` | `boolean` | `false` | 是否启用行选择 |
| `onRowSelectionChange` | `(selectedRowKeys) => void` | - | 行选择变化回调 |
| `enableRowEdit` | `boolean` | `false` | 是否启用行编辑 |
| `onRowEditSave` | `(key, row) => Promise<void>` | - | 行编辑保存回调 |
| `onRowEditDelete` | `(key, row) => Promise<void>` | - | 行编辑删除回调 |
| `toolBarActions` | `ReactNode[]` | `[]` | 工具栏自定义按钮 |
| `showExportButton` | `boolean` | `false` | 是否显示导出按钮 |
| `onExport` | `(selectedRowKeys) => void` | - | 导出按钮点击回调 |
| `defaultPageSize` | `number` | `10` | 默认分页大小 |
| `showQuickJumper` | `boolean` | `true` | 是否显示快速跳转 |

### 其他 ProTable 属性

`UnifiedProTable` 继承所有 `ProTable` 的原生属性，可以通过 `...restProps` 传入。

## 注意事项

1. **排序参数处理**：`request` 函数接收的 `sort` 参数是 ProTable 的原始格式（`'ascend'`/`'descend'`），需要根据后端 API 的要求进行转换。

2. **按钮容器位置**：按钮容器会自动移动到 `ant-pro-table` 内部，确保样式统一。

3. **Ref 传递**：如果需要在外部控制表格（如手动刷新），可以传入 `actionRef` 和 `formRef`。

4. **后续完善**：所有表格相关的通用功能都会在此组件中统一完善，所有使用此组件的表格都会自动获得更新。


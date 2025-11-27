# RiverEdge Query - ProTable 查询条件保存插件

## 功能说明

`riveredge-query` 是一个用于增强 ProTable 的插件，提供查询条件的保存和恢复功能，提升用户体验。

## 主要功能

- ✅ 保存当前查询条件
- ✅ 加载已保存的查询条件
- ✅ 删除已保存的查询条件
- ✅ 清除所有保存的查询条件
- ✅ 每个页面独立的查询条件存储（基于路由路径）

## 使用方法

### 基础用法

```typescript
import { ProTable } from '@ant-design/pro-components';
import { useQuerySave, QuerySaveButton } from '@/components/riveredge-query';
import { useRef, useState } from 'react';

const UserList: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [currentParams, setCurrentParams] = useState<Record<string, any>>({});

  // 创建查询条件管理器
  const queryManager = useQuerySave(actionRef, (params) => {
    setCurrentParams(params);
    // 这里可以将参数应用到 ProTable
  });

  return (
    <ProTable
      actionRef={actionRef}
      request={async (params) => {
        // 更新当前查询参数
        queryManager.updateCurrentParams(params);
        setCurrentParams(params);
        
        // 执行查询
        const result = await getUserList(params);
        return {
          data: result.items,
          success: true,
          total: result.total,
        };
      }}
      toolBarRender={() => [
        <Button key="add" type="primary">新建</Button>,
        <QuerySaveButton
          key="query-save"
          queryManager={queryManager}
          currentParams={currentParams}
          onParamsChange={(params) => {
            setCurrentParams(params);
            // 将参数应用到 ProTable
            actionRef.current?.reload();
          }}
        />,
      ]}
      columns={columns}
    />
  );
};
```

## API 文档

### useQuerySave

查询条件保存 Hook

**参数：**
- `actionRef`: ProTable 的 actionRef
- `onLoadQuery`: 加载查询条件时的回调函数

**返回值：**
- `saveCurrent`: 保存当前查询条件
- `loadSaved`: 加载保存的查询条件
- `deleteSaved`: 删除保存的查询条件
- `getSavedQueries`: 获取所有保存的查询条件
- `clearAll`: 清除所有保存的查询条件
- `updateCurrentParams`: 更新当前查询参数（内部使用）

### QuerySaveButton

查询条件保存按钮组件

**属性：**
- `queryManager`: 查询条件管理器
- `currentParams`: 当前查询参数
- `onParamsChange`: 参数变化回调

## 注意事项

1. 查询条件基于页面路径存储，不同页面的查询条件互不影响
2. 每个页面最多保存 10 个查询条件，超过后自动删除最旧的
3. 查询条件存储在 localStorage 中，清除浏览器数据会丢失


/**
 * 统一 ProTable 组件
 * 
 * 封装了所有表格的通用配置和功能，确保所有表格使用统一的格式。
 * 后续完善时，只需修改此组件，所有表格都会同步更新。
 */

import React, { useRef, useLayoutEffect, ReactNode } from 'react';
import { ProTable, ActionType, ProColumns, ProFormInstance, ProTableProps } from '@ant-design/pro-components';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { QuerySearchButton } from '@/components/riveredge-query';

/**
 * 统一 ProTable 组件属性
 */
export interface UnifiedProTableProps<T extends Record<string, any> = Record<string, any>> extends Omit<ProTableProps<T, any>, 'request'> {
  /**
   * 数据请求函数
   * 已内置排序参数处理，直接使用即可
   */
  request: (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => Promise<{
    data: T[];
    success: boolean;
    total: number;
  }>;
  /**
   * 表格列定义
   */
  columns: ProColumns<T>[];
  /**
   * 表格标题
   */
  headerTitle?: string;
  /**
   * 行主键字段名（默认：'id'）
   */
  rowKey?: string;
  /**
   * 是否显示高级搜索按钮（默认：true）
   */
  showAdvancedSearch?: boolean;
  /**
   * 高级搜索按钮前的自定义按钮
   */
  beforeSearchButtons?: ReactNode;
  /**
   * 高级搜索按钮后的自定义按钮
   */
  afterSearchButtons?: ReactNode;
  /**
   * 是否启用行选择（默认：false）
   */
  enableRowSelection?: boolean;
  /**
   * 行选择变化回调
   */
  onRowSelectionChange?: (selectedRowKeys: React.Key[]) => void;
  /**
   * 是否启用行编辑（默认：false）
   */
  enableRowEdit?: boolean;
  /**
   * 行编辑保存回调
   */
  onRowEditSave?: (key: React.Key, row: T) => Promise<void>;
  /**
   * 行编辑删除回调
   */
  onRowEditDelete?: (key: React.Key, row: T) => Promise<void>;
  /**
   * 工具栏自定义按钮
   */
  toolBarActions?: ReactNode[];
  /**
   * 是否显示导出按钮（默认：false）
   */
  showExportButton?: boolean;
  /**
   * 导出按钮点击回调
   */
  onExport?: (selectedRowKeys: React.Key[]) => void;
  /**
   * 默认分页大小（默认：10）
   */
  defaultPageSize?: number;
  /**
   * 是否显示快速跳转（默认：true）
   */
  showQuickJumper?: boolean;
}

/**
 * 统一 ProTable 组件
 */
export function UnifiedProTable<T extends Record<string, any> = Record<string, any>>({
  request,
  columns,
  headerTitle,
  rowKey = 'id',
  showAdvancedSearch = true,
  beforeSearchButtons,
  afterSearchButtons,
  enableRowSelection = false,
  onRowSelectionChange,
  enableRowEdit = false,
  onRowEditSave,
  onRowEditDelete,
  toolBarActions = [],
  showExportButton = false,
  onExport,
  defaultPageSize = 10,
  showQuickJumper = true,
  actionRef: externalActionRef,
  formRef: externalFormRef,
  ...restProps
}: UnifiedProTableProps<T>) {
  const internalActionRef = useRef<ActionType>();
  const internalFormRef = useRef<ProFormInstance>();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  // 使用外部传入的 ref 或内部创建的 ref
  const actionRef = externalActionRef || internalActionRef;
  const formRef = externalFormRef || internalFormRef;

  /**
   * 将按钮容器移动到 ant-pro-table 内部
   */
  useLayoutEffect(() => {
    if (containerRef.current && buttonContainerRef.current) {
      const proTable = containerRef.current.querySelector('.ant-pro-table');
      if (proTable && buttonContainerRef.current.parentElement !== proTable) {
        proTable.insertBefore(buttonContainerRef.current, proTable.firstChild);
      }
    }
  }, []);

  /**
   * 处理排序参数转换
   */
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    // 直接调用用户提供的 request 函数
    return await request(params, sort, filter);
  };

  /**
   * 构建工具栏按钮
   */
  const buildToolBarActions = (selectedRowKeys?: React.Key[]) => {
    const actions: ReactNode[] = [];

    // 添加自定义工具栏按钮
    if (toolBarActions && toolBarActions.length > 0) {
      actions.push(...toolBarActions);
    }

    // 添加导出按钮
    if (showExportButton) {
      actions.push(
        <Button
          key="export"
          icon={<DownloadOutlined />}
          onClick={() => onExport?.(selectedRowKeys || [])}
          disabled={selectedRowKeys && selectedRowKeys.length === 0}
        >
          导出
        </Button>
      );
    }

    return actions.length > 0 ? actions : undefined;
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* 按钮容器（会被移动到 ant-pro-table 内部） */}
      {(showAdvancedSearch || beforeSearchButtons || afterSearchButtons) && (
        <div
          ref={buttonContainerRef}
          className="pro-table-button-container"
        >
          {beforeSearchButtons}
          {showAdvancedSearch && (
            <QuerySearchButton
              columns={columns}
              formRef={formRef as React.MutableRefObject<ProFormInstance>}
              actionRef={actionRef as React.MutableRefObject<ActionType>}
            />
          )}
          {afterSearchButtons}
        </div>
      )}

      <ProTable<T>
        headerTitle={headerTitle}
        actionRef={actionRef}
        formRef={formRef}
        columns={columns}
        request={handleRequest}
        rowKey={rowKey}
        search={false}
        rowSelection={
          enableRowSelection
            ? {
                type: 'checkbox',
                onChange: onRowSelectionChange,
              }
            : undefined
        }
        editable={
          enableRowEdit
            ? {
                type: 'multiple',
                onSave: onRowEditSave as any,
                onDelete: onRowEditDelete as any,
              }
            : undefined
        }
        toolBarRender={(_action, { selectedRowKeys }) => buildToolBarActions(selectedRowKeys) || []}
        pagination={{
          defaultPageSize,
          showSizeChanger: true,
          showQuickJumper,
        }}
        {...restProps}
      />
    </div>
  );
}

export default UnifiedProTable;


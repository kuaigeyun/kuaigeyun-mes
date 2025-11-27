/**
 * 统一 ProTable 组件
 * 
 * 封装了所有表格的通用配置和功能，确保所有表格使用统一的格式。
 * 后续完善时，只需修改此组件，所有表格都会同步更新。
 */

import React, { useRef, useLayoutEffect, ReactNode, useState } from 'react';
import { ProTable, ActionType, ProColumns, ProFormInstance, ProTableProps } from '@ant-design/pro-components';
import { Button, Space, Radio, Dropdown, MenuProps } from 'antd';
import { DownloadOutlined, UploadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, TableOutlined, AppstoreOutlined, BarsOutlined, BarChartOutlined, DownOutlined } from '@ant-design/icons';
import { QuerySearchButton } from '@/components/riveredge-query';
import { useProTableSearch } from '@/hooks/useProTableSearch';
import { LuckysheetImportModal } from '@/components/LuckysheetImportModal';

/**
 * 统一 ProTable 组件属性
 */
export interface UnifiedProTableProps<T extends Record<string, any> = Record<string, any>> extends Omit<ProTableProps<T, any>, 'request'> {
  /**
   * 数据请求函数
   * 已内置排序参数处理，直接使用即可
   * 
   * @param params - 分页参数（current, pageSize）
   * @param sort - 排序参数
   * @param filter - 筛选参数
   * @param searchFormValues - 搜索表单值（从 searchParamsRef 或 formRef 获取）
   * @returns 数据响应
   */
  request: (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>,
    searchFormValues?: Record<string, any>
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
   * 表格标题（已废弃，使用 headerActions 替代）
   * @deprecated 使用 headerActions 替代
   */
  headerTitle?: string;
  /**
   * 头部操作按钮（显示在原来标题的位置）
   * 包括新建、修改、删除等按钮
   */
  headerActions?: ReactNode;
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
   * 是否显示导入按钮（默认：false）
   */
  showImportButton?: boolean;
  /**
   * 导入按钮点击回调
   * @param data - 导入的数据（二维数组格式）
   */
  onImport?: (data: any[][]) => void;
  /**
   * 是否显示导出按钮（默认：false）
   */
  showExportButton?: boolean;
  /**
   * 导出按钮点击回调
   * @param type - 导出类型：'selected' 导出选中、'currentPage' 导出本页、'all' 导出全部
   * @param selectedRowKeys - 选中的行键数组（仅当 type 为 'selected' 时有效）
   * @param currentPageData - 当前页数据（仅当 type 为 'currentPage' 时有效）
   */
  onExport?: (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: T[]
  ) => void;
  /**
   * 是否显示新建按钮（默认：false）
   */
  showCreateButton?: boolean;
  /**
   * 新建按钮点击回调
   */
  onCreate?: () => void;
  /**
   * 是否显示修改按钮（默认：false）
   * 需要先选中一行才能点击
   */
  showEditButton?: boolean;
  /**
   * 修改按钮点击回调
   * @param selectedRowKeys - 选中的行键数组
   */
  onEdit?: (selectedRowKeys: React.Key[]) => void;
  /**
   * 是否显示删除按钮（默认：false）
   * 需要先选中一行才能点击
   */
  showDeleteButton?: boolean;
  /**
   * 删除按钮点击回调
   * @param selectedRowKeys - 选中的行键数组
   */
  onDelete?: (selectedRowKeys: React.Key[]) => void;
  /**
   * 默认分页大小（默认：10）
   */
  defaultPageSize?: number;
  /**
   * 是否显示快速跳转（默认：true）
   */
  showQuickJumper?: boolean;
  /**
   * 视图类型配置
   * 支持：'table' | 'card' | 'kanban' | 'stats'
   */
  viewTypes?: Array<'table' | 'card' | 'kanban' | 'stats'>;
  /**
   * 默认视图类型（默认：'table'）
   */
  defaultViewType?: 'table' | 'card' | 'kanban' | 'stats';
  /**
   * 视图切换回调
   */
  onViewTypeChange?: (viewType: 'table' | 'card' | 'kanban' | 'stats') => void;
  /**
   * 卡片视图配置（仅当 viewTypes 包含 'card' 时生效）
   */
  cardViewConfig?: {
    /**
     * 卡片渲染函数
     * @param item - 数据项
     * @param index - 索引
     */
    renderCard?: (item: T, index: number) => ReactNode;
    /**
     * 每行卡片数量（响应式，默认：[2, 3, 4]）
     */
    columns?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; xxl?: number };
  };
  /**
   * 看板视图配置（仅当 viewTypes 包含 'kanban' 时生效）
   */
  kanbanViewConfig?: {
    /**
     * 状态字段名（用于分组，默认：'status'）
     */
    statusField?: string;
    /**
     * 状态分组配置
     * @example { 'pending': '待处理', 'processing': '处理中', 'completed': '已完成' }
     */
    statusGroups?: Record<string, { title: string; color?: string }>;
    /**
     * 卡片渲染函数
     * @param item - 数据项
     * @param status - 状态值
     */
    renderCard?: (item: T, status: string) => ReactNode;
  };
  /**
   * 统计视图配置（仅当 viewTypes 包含 'stats' 时生效）
   */
  statsViewConfig?: {
    /**
     * 统计指标配置
     */
    metrics?: Array<{
      key: string;
      label: string;
      value: (data: T[]) => number | string;
      formatter?: (value: number | string) => string;
    }>;
    /**
     * 图表配置
     */
    charts?: Array<{
      type: 'bar' | 'line' | 'pie' | 'area';
      title: string;
      data: (data: T[]) => any[];
      config?: any;
    }>;
  };
}

/**
 * 统一 ProTable 组件
 */
export function UnifiedProTable<T extends Record<string, any> = Record<string, any>>({
  request,
  columns,
  headerTitle,
  headerActions,
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
  showImportButton = false,
  onImport,
  showExportButton = false,
  onExport,
  showCreateButton = false,
  onCreate,
  showEditButton = false,
  onEdit,
  showDeleteButton = false,
  onDelete,
  defaultPageSize = 10,
  showQuickJumper = true,
  viewTypes = ['table'],
  defaultViewType = 'table',
  onViewTypeChange,
  cardViewConfig,
  kanbanViewConfig,
  statsViewConfig,
  actionRef: externalActionRef,
  formRef: externalFormRef,
  ...restProps
}: UnifiedProTableProps<T>) {
  // 导入弹窗状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  // 视图类型状态
  const [currentViewType, setCurrentViewType] = useState<'table' | 'card' | 'kanban' | 'stats'>(defaultViewType);
  // 表格数据状态（用于其他视图）
  const [tableData, setTableData] = useState<T[]>([]);
  // ⭐ 关键：使用 useProTableSearch Hook 管理搜索参数
  const { searchParamsRef, formRef: hookFormRef, actionRef: hookActionRef } = useProTableSearch();
  
  const internalActionRef = useRef<ActionType>();
  const internalFormRef = useRef<ProFormInstance>();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  // 使用外部传入的 ref 或内部创建的 ref（优先使用外部传入的）
  const actionRef = externalActionRef || hookActionRef || internalActionRef;
  const formRef = externalFormRef || hookFormRef || internalFormRef;

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
   * 处理排序参数转换和搜索参数获取
   */
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    // ⭐ 关键：获取搜索表单值（优先使用 searchParamsRef，避免表单值更新时机问题）
    const formValues = formRef.current?.getFieldsValue() || {};
    const searchFormValues = searchParamsRef.current || formValues;
    
    // 调用用户提供的 request 函数，传递搜索表单值
    const result = await request(params, sort, filter, searchFormValues);
    
    // 保存数据到 state（用于其他视图）
    if (result.data) {
      setTableData(result.data);
    }
    
    return result;
  };

  /**
   * 处理视图类型切换
   */
  const handleViewTypeChange = (viewType: 'table' | 'card' | 'kanban' | 'stats') => {
    setCurrentViewType(viewType);
    if (onViewTypeChange) {
      onViewTypeChange(viewType);
    }
  };

  /**
   * 构建视图切换按钮
   */
  const buildViewTypeButtons = () => {
    if (!viewTypes || viewTypes.length <= 1) {
      return null;
    }

    const viewTypeOptions = [
      { value: 'table', label: '表格', icon: TableOutlined },
      { value: 'card', label: '卡片', icon: AppstoreOutlined },
      { value: 'kanban', label: '看板', icon: BarsOutlined },
      { value: 'stats', label: '统计', icon: BarChartOutlined },
    ].filter(option => viewTypes.includes(option.value as any));

    return (
      <Radio.Group
        value={currentViewType}
        onChange={(e) => handleViewTypeChange(e.target.value)}
        buttonStyle="solid"
        style={{ marginLeft: 8 }}
      >
        {viewTypeOptions.map(option => {
          const IconComponent = option.icon;
          return (
            <Radio.Button key={option.value} value={option.value} title={option.label}>
              <IconComponent style={{ marginRight: 4, fontSize: '14px' }} />
              {option.label}
            </Radio.Button>
          );
        })}
      </Radio.Group>
    );
  };

  /**
   * 处理导入按钮点击
   */
  const handleImportClick = () => {
    setImportModalVisible(true);
  };

  /**
   * 处理导入确认
   */
  const handleImportConfirm = (data: any[][]) => {
    if (onImport) {
      onImport(data);
    }
  };

  // 存储选中的行键
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  /**
   * 构建头部操作按钮（显示在原来标题的位置）
   */
  const buildHeaderActions = () => {
    const actions: ReactNode[] = [];

    // 如果提供了自定义 headerActions，直接使用
    if (headerActions) {
      return headerActions;
    }

    // 否则根据配置自动生成按钮
    // 新建按钮
    if (showCreateButton && onCreate) {
      actions.push(
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={onCreate}
        >
          新建
        </Button>
      );
    }

    // 修改按钮（需要选中一行）
    if (showEditButton && onEdit) {
      actions.push(
        <Button
          key="edit"
          icon={<EditOutlined />}
          onClick={() => {
            if (selectedRowKeys.length === 1) {
              onEdit(selectedRowKeys);
            }
          }}
          disabled={selectedRowKeys.length !== 1}
        >
          修改
        </Button>
      );
    }

    // 删除按钮（需要选中至少一行）
    if (showDeleteButton && onDelete) {
      actions.push(
        <Button
          key="delete"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            if (selectedRowKeys.length > 0) {
              onDelete(selectedRowKeys);
            }
          }}
          disabled={selectedRowKeys.length === 0}
        >
          删除
        </Button>
      );
    }

    return actions.length > 0 ? <Space>{actions}</Space> : undefined;
  };

  /**
   * 处理行选择变化
   */
  const handleRowSelectionChange = (keys: React.Key[]) => {
    setSelectedRowKeys(keys);
    if (onRowSelectionChange) {
      onRowSelectionChange(keys);
    }
  };

  /**
   * 构建工具栏按钮（右上角）
   */
  const buildToolBarActions = (selectedRowKeys?: React.Key[]) => {
    const actions: ReactNode[] = [];

    // 添加自定义工具栏按钮
    if (toolBarActions && toolBarActions.length > 0) {
      actions.push(...toolBarActions);
    }

    // 添加导入按钮（在导出按钮前面）
    if (showImportButton) {
      actions.push(
        <Button
          key="import"
          icon={<UploadOutlined />}
          onClick={handleImportClick}
        >
          导入
        </Button>
      );
    }

    // 添加导出按钮（下拉菜单）
    if (showExportButton) {
      // 构建导出菜单项
      const exportMenuItems: MenuProps['items'] = [
        {
          key: 'selected',
          label: '导出选中',
          icon: <DownloadOutlined />,
          disabled: !selectedRowKeys || selectedRowKeys.length === 0,
        },
        {
          key: 'currentPage',
          label: '导出本页',
          icon: <DownloadOutlined />,
        },
        {
          key: 'all',
          label: '导出全部',
          icon: <DownloadOutlined />,
        },
      ];

      // 处理导出菜单点击
      const handleExportMenuClick: MenuProps['onClick'] = ({ key }) => {
        if (!onExport) return;
        
        switch (key) {
          case 'selected':
            onExport('selected', selectedRowKeys || []);
            break;
          case 'currentPage':
            // 获取当前页数据
            onExport('currentPage', undefined, tableData);
            break;
          case 'all':
            onExport('all');
            break;
        }
      };

      actions.push(
        <Dropdown
          key="export"
          menu={{ items: exportMenuItems, onClick: handleExportMenuClick }}
          trigger={['click']}
        >
          <Button icon={<DownloadOutlined />}>
            导出
            <DownOutlined style={{ marginLeft: 4, fontSize: '12px' }} />
          </Button>
        </Dropdown>
      );
    }

    return actions.length > 0 ? actions : undefined;
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* 按钮容器（会被移动到 ant-pro-table 内部） */}
      {(showAdvancedSearch || beforeSearchButtons || afterSearchButtons || (viewTypes && viewTypes.length > 1)) && (
        <div
          ref={buttonContainerRef}
          className="pro-table-button-container"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {beforeSearchButtons}
            {showAdvancedSearch && (
              <QuerySearchButton
                columns={columns}
                formRef={formRef as React.MutableRefObject<ProFormInstance>}
                actionRef={actionRef as React.MutableRefObject<ActionType>}
                searchParamsRef={searchParamsRef}
              />
            )}
            {afterSearchButtons}
          </div>
          {/* 视图切换按钮（右侧） */}
          {buildViewTypeButtons()}
        </div>
      )}

      {/* 根据视图类型渲染不同视图 */}
      {currentViewType === 'table' && (
        <ProTable<T>
          headerTitle={buildHeaderActions() || headerTitle || undefined}
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
                onChange: handleRowSelectionChange,
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
        toolBarRender={(_action, { selectedRowKeys: toolBarSelectedRowKeys }) => {
          // 同步工具栏的选中行键到 state（用于头部按钮状态）
          if (toolBarSelectedRowKeys) {
            // 使用 useEffect 或直接在这里更新，但要注意避免无限循环
            // 这里使用浅比较，避免不必要的更新
            const currentKeys = selectedRowKeys;
            const newKeys = toolBarSelectedRowKeys;
            if (currentKeys.length !== newKeys.length || 
                currentKeys.some((key, index) => key !== newKeys[index])) {
              setSelectedRowKeys(newKeys);
            }
          }
          return buildToolBarActions(toolBarSelectedRowKeys) || [];
        }}
        pagination={{
          defaultPageSize,
          showSizeChanger: true,
          showQuickJumper,
        }}
        {...restProps}
        />
      )}

      {/* 卡片视图 */}
      {currentViewType === 'card' && viewTypes.includes('card') && (
        <div style={{ padding: '16px', minHeight: '400px' }}>
          {cardViewConfig?.renderCard ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {tableData.map((item, index) => cardViewConfig.renderCard!(item, index))}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              color: '#999',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px dashed #d9d9d9'
            }}>
              <AppstoreOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>卡片视图</div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                请配置 <code>cardViewConfig.renderCard</code> 来自定义卡片渲染
              </div>
            </div>
          )}
        </div>
      )}

      {/* 看板视图 */}
      {currentViewType === 'kanban' && viewTypes.includes('kanban') && (
        <div style={{ padding: '16px', minHeight: '400px' }}>
          {kanbanViewConfig?.renderCard && kanbanViewConfig.statusGroups ? (
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', minHeight: '400px' }}>
              {Object.entries(kanbanViewConfig.statusGroups).map(([status, config]) => {
                const statusData = tableData.filter(item => (item as any)[kanbanViewConfig?.statusField || 'status'] === status);
                return (
                  <div 
                    key={status} 
                    style={{ 
                      flex: '0 0 300px', 
                      border: '1px solid #d9d9d9', 
                      borderRadius: '4px', 
                      padding: '16px',
                      background: '#fafafa',
                      minHeight: '400px'
                    }}
                  >
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 'bold', 
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '2px solid #d9d9d9'
                    }}>
                      {config.title}
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '12px', 
                        color: '#999',
                        fontWeight: 'normal'
                      }}>
                        ({statusData.length})
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {statusData.map((item) => kanbanViewConfig.renderCard!(item, status))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              color: '#999',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px dashed #d9d9d9'
            }}>
              <BarsOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>看板视图</div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                请配置 <code>kanbanViewConfig</code> 来启用看板视图
              </div>
            </div>
          )}
        </div>
      )}

      {/* 统计视图 */}
      {currentViewType === 'stats' && viewTypes.includes('stats') && (
        <div style={{ padding: '16px', minHeight: '400px' }}>
          {statsViewConfig?.metrics ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {statsViewConfig.metrics.map((metric) => (
                  <div 
                    key={metric.key} 
                    style={{ 
                      padding: '20px', 
                      border: '1px solid #d9d9d9', 
                      borderRadius: '4px',
                      background: '#fff',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>{metric.label}</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1890ff' }}>
                      {metric.formatter ? metric.formatter(metric.value(tableData)) : metric.value(tableData)}
                    </div>
                  </div>
                ))}
              </div>
              {statsViewConfig.charts && statsViewConfig.charts.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  {/* TODO: 实现图表渲染 */}
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '1px dashed #d9d9d9', borderRadius: '4px' }}>
                    图表功能开发中...
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              color: '#999',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px dashed #d9d9d9'
            }}>
              <BarChartOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#d9d9d9' }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>统计视图</div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                请配置 <code>statsViewConfig.metrics</code> 来启用统计视图
              </div>
            </div>
          )}
        </div>
      )}

      {/* 导入弹窗 */}
      {showImportButton && (
        <LuckysheetImportModal
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleImportConfirm}
        />
      )}
    </div>
  );
}

export default UnifiedProTable;


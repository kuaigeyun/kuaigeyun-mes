/**
 * 工艺路线管理页面
 * 
 * 提供工艺路线的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptions, ProForm } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, message, Select, Divider, Typography, Row, Col, Spin, Empty, Alert, Table } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, HolderOutlined, BranchesOutlined, HistoryOutlined, DiffOutlined, FileTextOutlined, CopyOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, DragOverEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { processRouteApi, operationApi } from '../../../services/process';
import { materialApi, materialGroupApi } from '../../../services/material';
import type { ProcessRoute, ProcessRouteCreate, ProcessRouteUpdate, Operation, ProcessRouteVersionCreate, ProcessRouteVersionCompare, ProcessRouteVersionCompareResult } from '../../../types/process';
import type { Material, MaterialGroup } from '../../../types/material';
import { ProFormDateTimePicker, ProFormSelect } from '@ant-design/pro-components';
import { MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import CodeField from '../../../../../components/code-field';
import { generateCode, testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';

/**
 * 工序项接口
 */
interface OperationItem {
  /**
   * 工序UUID（作为唯一标识）
   */
  uuid: string;
  /**
   * 工序编码
   */
  code: string;
  /**
   * 工序名称
   */
  name: string;
  /**
   * 工序描述
   */
  description?: string;
  /**
   * 报工类型
   */
  reportingType?: 'quantity' | 'status';
  /**
   * 是否允许跳转
   */
  allowJump?: boolean;
}

/**
 * 可拖拽的工序项组件
 */
interface SortableOperationItemProps {
  /**
   * 工序项
   */
  operation: OperationItem;
  /**
   * 删除回调
   */
  onDelete: () => void;
}

/**
 * 可拖拽的工序项组件
 */
const SortableOperationItem: React.FC<SortableOperationItemProps> = ({ operation, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: operation.uuid });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 12,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: '6px',
        cursor: 'grab',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
      }}>
        <div
          {...listeners}
          style={{
            width: 28,
            height: 28,
            background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
            color: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 600,
            flexShrink: 0,
            boxShadow: '0 2px 4px rgba(24, 144, 255, 0.3)',
            cursor: 'grab',
          }}
        >
          <HolderOutlined style={{ fontSize: 12 }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600,
            color: '#262626',
            marginBottom: 2,
            fontSize: '14px'
          }}>
            {operation.code} - {operation.name}
          </div>
          {operation.description && (
            <div style={{
              color: '#8c8c8c',
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {operation.description}
            </div>
          )}
        </div>

        <Button
          size="small"
          danger
          onClick={onDelete}
          style={{ flexShrink: 0 }}
        >
          删除
        </Button>
      </div>
    </div>
  );
};

/**
 * 工序序列编辑器组件
 */
interface OperationSequenceEditorProps {
  /**
   * 当前工序列表
   */
  value?: OperationItem[];
  /**
   * 变化回调
   */
  onChange?: (operations: OperationItem[]) => void;
}

/**
 * 工序序列编辑器组件
 */
const OperationSequenceEditor: React.FC<OperationSequenceEditorProps> = ({ value = [], onChange }) => {
  const [operations, setOperations] = useState<OperationItem[]>(value);
  const [allOperations, setAllOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedOperationUuids, setSelectedOperationUuids] = useState<string[]>([]);
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [replacingOperationUuid, setReplacingOperationUuid] = useState<string | null>(null);
  const [replacementOperationUuid, setReplacementOperationUuid] = useState<string | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * 加载所有工序列表
   */
  useEffect(() => {
    const loadOperations = async () => {
      try {
        setLoading(true);
        const result = await operationApi.list({ is_active: true, limit: 1000 });
        setAllOperations(result);
      } catch (error: any) {
        message.error(error.message || '加载工序列表失败');
      } finally {
        setLoading(false);
      }
    };
    loadOperations();
  }, []);

  /**
   * 同步外部值变化
   */
  useEffect(() => {
    setOperations(value);
  }, [value]);

  /**
   * 处理拖拽开始
   */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  };

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (over && active.id !== over.id) {
      const oldIndex = operations.findIndex((op) => op.uuid === active.id);
      const newIndex = operations.findIndex((op) => op.uuid === over.id);

      const newOperations = arrayMove(operations, oldIndex, newIndex);
      setOperations(newOperations);
      onChange?.(newOperations);
    }
  };

  /**
   * 添加工序
   */
  const handleAddOperation = () => {
    if (!selectedOperationUuids || selectedOperationUuids.length === 0) {
      message.warning('请选择要添加的工序');
      return;
    }

    // 过滤出未添加的工序
    const newOperations = selectedOperationUuids
      .map((uuid) => allOperations.find((op) => op.uuid === uuid))
      .filter((op): op is Operation => {
        if (!op) {
          return false;
        }
        // 检查是否已添加
        if (operations.some((existingOp) => existingOp.uuid === op.uuid)) {
          return false;
        }
        return true;
      });

    if (newOperations.length === 0) {
      message.warning('所选工序均已添加或未找到');
      return;
    }

    // 批量添加工序
    const newOperationItems: OperationItem[] = newOperations.map((op) => ({
      uuid: op.uuid,
      code: op.code,
      name: op.name,
      description: op.description || undefined,
      reportingType: op.reportingType,
      allowJump: op.allowJump,
    }));

    // 添加新工序到列表
    const updatedOperations = [...operations, ...newOperationItems];
    setOperations(updatedOperations);
    onChange?.(updatedOperations);

    // 关闭 Modal 并清空选择
    setAddModalVisible(false);
    setSelectedOperationUuids([]);
    message.success(`成功添加 ${newOperationItems.length} 个工序`);
  };

  /**
   * 删除工序
   */
  const handleDeleteOperation = (uuid: string) => {
    const newOperations = operations.filter((op) => op.uuid !== uuid);
    setOperations(newOperations);
    onChange?.(newOperations);
  };

  /**
   * 打开替换工序 Modal
   */
  const handleOpenReplaceModal = (uuid: string) => {
    setReplacingOperationUuid(uuid);
    setReplacementOperationUuid(undefined);
    setReplaceModalVisible(true);
  };

  /**
   * 替换工序
   */
  const handleReplaceOperation = () => {
    if (!replacingOperationUuid || !replacementOperationUuid) {
      message.warning('请选择要替换的工序');
      return;
    }

    // 检查是否选择了相同的工序
    if (replacingOperationUuid === replacementOperationUuid) {
      message.warning('不能替换为相同的工序');
      return;
    }

    // 检查替换的工序是否已在列表中（排除当前要替换的）
    if (operations.some((op) => op.uuid === replacementOperationUuid && op.uuid !== replacingOperationUuid)) {
      message.warning('该工序已在列表中');
      return;
    }

    // 查找要替换的工序和替换的工序
    const replacingIndex = operations.findIndex((op) => op.uuid === replacingOperationUuid);
    if (replacingIndex === -1) {
      message.error('未找到要替换的工序');
      return;
    }

    const replacementOperation = allOperations.find((op) => op.uuid === replacementOperationUuid);
    if (!replacementOperation) {
      message.error('未找到替换的工序');
      return;
    }

    // 替换工序
    const newOperations = [...operations];
    newOperations[replacingIndex] = {
      uuid: replacementOperation.uuid,
      code: replacementOperation.code,
      name: replacementOperation.name,
      description: replacementOperation.description || undefined,
      reportingType: replacementOperation.reportingType,
      allowJump: replacementOperation.allowJump,
    };

    setOperations(newOperations);
    onChange?.(newOperations);

    // 关闭 Modal 并清空选择
    setReplaceModalVisible(false);
    setReplacingOperationUuid(null);
    setReplacementOperationUuid(undefined);
    message.success('工序替换成功');
  };

  // 获取可选的工序列表（排除已添加的）
  const availableOperations = allOperations.filter(
    (op) => !operations.some((addedOp) => addedOp.uuid === op.uuid)
  );

  // 获取替换时可选的工序列表（排除已添加的，但包括当前要替换的工序）
  const getAvailableOperationsForReplace = (excludeUuid: string | null) => {
    if (!excludeUuid) return availableOperations;
    return allOperations.filter(
      (op) => op.uuid === excludeUuid || !operations.some((addedOp) => addedOp.uuid === op.uuid)
    );
  };

  // 表格列定义
  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 100,
      render: (_: any, record: OperationItem, index: number) => (
        <Space>
          <span 
            className="drag-handle" 
            style={{ 
              color: '#1890ff', 
              cursor: 'move', 
              display: 'inline-flex', 
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              padding: '4px',
              minWidth: '24px',
              minHeight: '24px',
            }}
            title="拖拽排序"
          >
            <HolderOutlined style={{ fontSize: '16px' }} />
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '28px',
              height: '28px',
              padding: '0 8px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #91d5ff',
              borderRadius: '6px',
              color: '#1890ff',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {index + 1}
          </span>
        </Space>
      ),
    },
    {
      title: '工序代码/名称',
      key: 'operation',
      render: (_: any, record: OperationItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.code} - {record.name}</div>
          {record.description && (
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4 }}>
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '报工类型',
      key: 'reportingType',
      width: 120,
      render: (_: any, record: OperationItem) => (
        <Tag color={record.reportingType === 'quantity' ? 'blue' : 'green'}>
          {record.reportingType === 'quantity' ? '按数量报工' : record.reportingType === 'status' ? '按状态报工' : '-'}
        </Tag>
      ),
    },
    {
      title: '允许跳转',
      key: 'allowJump',
      width: 100,
      render: (_: any, record: OperationItem) => (
        <Tag color={record.allowJump ? 'success' : 'default'}>
          {record.allowJump ? '允许' : '不允许'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: OperationItem) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenReplaceModal(record.uuid);
            }}
          >
            替换
          </Button>
          <Button
            type="link"
            danger
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteOperation(record.uuid);
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 可拖拽的行组件
  const DraggableRow = ({ children, ...props }: any) => {
    const index = operations.findIndex((op) => op.uuid === props['data-row-key']);
    const operation = operations[index];
    
    if (!operation) {
      return <tr {...props}>{children}</tr>;
    }

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
      isOver,
    } = useSortable({ id: operation.uuid });

    const isActiveOver = activeId && overId === operation.uuid && activeId !== operation.uuid;
    const activeIndex = activeId ? operations.findIndex((op) => op.uuid === activeId) : -1;
    const currentIndex = operations.findIndex((op) => op.uuid === operation.uuid);
    const showInsertBefore = isActiveOver && activeIndex < currentIndex;
    const showInsertAfter = isActiveOver && activeIndex > currentIndex;

    const style = {
      ...props.style,
      transform: CSS.Transform.toString(transform),
      transition: isDragging ? 'none' : transition,
      opacity: isDragging ? 0.4 : 1,
      backgroundColor: isDragging ? '#f0f9ff' : isOver && !isDragging ? '#e6f7ff' : 'transparent',
      boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
      position: 'relative' as const,
    };

    return (
      <tr
        ref={setNodeRef}
        style={style}
        {...props}
      >
        {React.Children.map(children, (child: any, idx: number) => {
          // 第一个单元格（序号列）包含拖拽手柄，应用拖拽监听器
          if (idx === 0 && React.isValidElement(child)) {
            return React.cloneElement(child, {
              children: React.Children.map(child.props.children, (cellContent: any) => {
                if (React.isValidElement(cellContent) && cellContent.type === Space) {
                  return React.cloneElement(cellContent, {
                    children: React.Children.map(cellContent.props.children, (item: any) => {
                      // 找到包含 drag-handle class 的 span，应用拖拽监听器
                      if (React.isValidElement(item) && item.props?.className === 'drag-handle') {
                        return React.cloneElement(item, {
                          ...attributes,
                          ...listeners,
                        });
                      }
                      return item;
                    }),
                  });
                }
                return cellContent;
              }),
            });
          }
          // 操作列阻止事件冒泡
          if (idx === 4 && React.isValidElement(child)) {
            return React.cloneElement(child, {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
              },
            });
          }
          return child;
        })}
      </tr>
    );
  };

  // 获取正在拖拽的工序
  const activeOperation = activeId ? operations.find((op) => op.uuid === activeId) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
      {operations.length > 0 ? (
        <SortableContext
          items={operations.map((op) => op.uuid)}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ position: 'relative', width: '100%', margin: 0, padding: 0 }}>
            <Table
                columns={columns}
                dataSource={operations}
                rowKey="uuid"
                pagination={false}
                size="small"
                components={{
                  body: {
                    wrapper: (props: any) => {
                      const activeIndex = activeId ? operations.findIndex((op) => op.uuid === activeId) : -1;
                      const overIndex = overId ? operations.findIndex((op) => op.uuid === overId) : -1;
                      const showInsertLine = activeId && overId && activeId !== overId && activeIndex !== -1 && overIndex !== -1;
                      const insertBefore = showInsertLine && activeIndex < overIndex;
                      const insertAfter = showInsertLine && activeIndex > overIndex;
                      const insertIndex = insertBefore ? overIndex : insertAfter ? overIndex + 1 : -1;

                      return (
                        <tbody {...props}>
                          {operations.map((op, idx) => {
                            const isInsertBefore = showInsertLine && insertIndex === idx && insertBefore;
                            const isInsertAfter = showInsertLine && insertIndex === idx && insertAfter;
                            
                            return (
                              <React.Fragment key={op.uuid}>
                                {isInsertBefore && (
                                  <tr>
                                    <td colSpan={5} style={{ padding: 0, height: 0, lineHeight: 0 }}>
                                      <div
                                        style={{
                                          height: '2px',
                                          backgroundColor: '#1890ff',
                                          margin: '0',
                                          boxShadow: '0 0 4px rgba(24, 144, 255, 0.5)',
                                        }}
                                      />
                                    </td>
                                  </tr>
                                )}
                                <DraggableRow data-row-key={op.uuid}>
                                  <td>
                                    <Space>
                                      <span 
                                        className="drag-handle" 
                                        style={{ 
                                          color: '#1890ff', 
                                          cursor: 'move', 
                                          display: 'inline-flex', 
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '16px',
                                          padding: '4px',
                                          minWidth: '24px',
                                          minHeight: '24px',
                                        }}
                                        title="拖拽排序"
                                      >
                                        <HolderOutlined style={{ fontSize: '16px' }} />
                                      </span>
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          minWidth: '28px',
                                          height: '28px',
                                          padding: '0 8px',
                                          backgroundColor: '#f0f9ff',
                                          border: '1px solid #91d5ff',
                                          borderRadius: '6px',
                                          color: '#1890ff',
                                          fontWeight: 600,
                                          fontSize: '13px',
                                        }}
                                      >
                                        {idx + 1}
                                      </span>
                                    </Space>
                                  </td>
                                  <td>
                                    <div>
                                      <div style={{ fontWeight: 500 }}>{op.code} - {op.name}</div>
                                      {op.description && (
                                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4 }}>
                                          {op.description}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <Tag color={op.reportingType === 'quantity' ? 'blue' : 'green'}>
                                      {op.reportingType === 'quantity' ? '按数量报工' : op.reportingType === 'status' ? '按状态报工' : '-'}
                                    </Tag>
                                  </td>
                                  <td>
                                    <Tag color={op.allowJump ? 'success' : 'default'}>
                                      {op.allowJump ? '允许' : '不允许'}
                                    </Tag>
                                  </td>
                                  <td onClick={(e) => e.stopPropagation()}>
                                    <Space>
                                      <Button
                                        type="link"
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenReplaceModal(op.uuid);
                                        }}
                                      >
                                        替换
                                      </Button>
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteOperation(op.uuid);
                                        }}
                                      >
                                        删除
                                      </Button>
                                    </Space>
                                  </td>
                                </DraggableRow>
                                {isInsertAfter && (
                                  <tr>
                                    <td colSpan={5} style={{ padding: 0, height: 0, lineHeight: 0 }}>
                                      <div
                                        style={{
                                          height: '2px',
                                          backgroundColor: '#1890ff',
                                          margin: '0',
                                          boxShadow: '0 0 4px rgba(24, 144, 255, 0.5)',
                                        }}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      );
                    },
                    row: DraggableRow,
                  },
                }}
                style={{ width: '100%' }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无数据"
                    />
                  ),
                }}
              />
            </div>
          </SortableContext>
        ) : (
          <Table
            columns={columns}
            dataSource={operations}
            rowKey="uuid"
            pagination={false}
            size="small"
            style={{ width: '100%' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无数据"
                />
              ),
            }}
          />
        )}
        
        {/* 拖拽时的覆盖层 */}
        <DragOverlay>
          {activeOperation ? (
            <div
              style={{
                padding: '12px 16px',
                background: '#fff',
                border: '1px solid #1890ff',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                width: '100%',
                minWidth: 300,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <HolderOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#262626' }}>
                    {activeOperation.code} - {activeOperation.name}
                  </div>
                  {activeOperation.description && (
                    <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4 }}>
                      {activeOperation.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      
      {/* 新增工序按钮 */}
      <div
        onClick={() => setAddModalVisible(true)}
        style={{
          marginTop: 16,
          padding: '12px',
          border: '1px dashed #1890ff',
          borderRadius: '4px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          color: '#1890ff',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#40a9ff';
          e.currentTarget.style.backgroundColor = '#f0f9ff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#1890ff';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <PlusOutlined style={{ marginRight: 8 }} />
        <span>新增工序</span>
      </div>

      {/* 添加工序 Modal */}
      <Modal
        title="选择工序"
        open={addModalVisible}
        onOk={handleAddOperation}
        onCancel={() => {
          setAddModalVisible(false);
          setSelectedOperationUuids([]);
        }}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ disabled: !selectedOperationUuids || selectedOperationUuids.length === 0 || loading }}
      >
        <Select
          mode="multiple"
          placeholder="搜索并选择工序（可多选）..."
          options={availableOperations.map((op) => ({
            label: `${op.code} - ${op.name}`,
            value: op.uuid,
            title: op.description || `${op.code} - ${op.name}`,
          }))}
          value={selectedOperationUuids}
          onChange={setSelectedOperationUuids}
          style={{ width: '100%' }}
          loading={loading}
          showSearch
          allowClear
          maxTagCount="responsive"
          filterOption={(input: string, option: any) => {
            const label = option?.label || '';
            return label.toLowerCase().includes(input.toLowerCase());
          }}
          notFoundContent={loading ? '加载中...' : '暂无可用工序'}
        />
        {availableOperations.length === 0 && !loading && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text type="danger" style={{ fontSize: '12px' }}>
              没有可用的工序，请先在"工序管理"中创建工序
            </Typography.Text>
          </div>
        )}
      </Modal>

      {/* 替换工序 Modal */}
      <Modal
        title="替换工序"
        open={replaceModalVisible}
        onOk={handleReplaceOperation}
        onCancel={() => {
          setReplaceModalVisible(false);
          setReplacingOperationUuid(null);
          setReplacementOperationUuid(undefined);
        }}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ disabled: !replacementOperationUuid || loading }}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            当前工序：
          </Typography.Text>
          <div style={{ marginTop: 4 }}>
            {replacingOperationUuid && (() => {
              const currentOp = operations.find((op) => op.uuid === replacingOperationUuid);
              return currentOp ? (
                <Tag color="blue">{currentOp.code} - {currentOp.name}</Tag>
              ) : null;
            })()}
          </div>
        </div>
        <Select
          placeholder="搜索并选择要替换的工序..."
          options={getAvailableOperationsForReplace(replacingOperationUuid).map((op) => ({
            label: `${op.code} - ${op.name}`,
            value: op.uuid,
            title: op.description || `${op.code} - ${op.name}`,
          }))}
          value={replacementOperationUuid}
          onChange={setReplacementOperationUuid}
          style={{ width: '100%' }}
          loading={loading}
          showSearch
          allowClear
          filterOption={(input: string, option: any) => {
            const label = option?.label || '';
            return label.toLowerCase().includes(input.toLowerCase());
          }}
          notFoundContent={loading ? '加载中...' : '暂无可用工序'}
        />
        {getAvailableOperationsForReplace(replacingOperationUuid).length === 0 && !loading && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text type="danger" style={{ fontSize: '12px' }}>
              没有可用的工序，请先在"工序管理"中创建工序
            </Typography.Text>
          </div>
        )}
      </Modal>
    </>
  );
};

/**
 * 工艺路线管理列表页面组件
 */
const ProcessRoutesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentProcessRouteUuid, setCurrentProcessRouteUuid] = useState<string | null>(null);
  const [processRouteDetail, setProcessRouteDetail] = useState<ProcessRoute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工艺路线）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [operationSequence, setOperationSequence] = useState<OperationItem[]>([]);
  /** 预览编码（自动编码时使用，提交时若未修改则正式生成） */
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  
  // 版本管理相关状态
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionHistoryModalVisible, setVersionHistoryModalVisible] = useState(false);
  const [versionCompareModalVisible, setVersionCompareModalVisible] = useState(false);
  const [currentProcessRouteCode, setCurrentProcessRouteCode] = useState<string | null>(null);
  const [versionList, setVersionList] = useState<ProcessRoute[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<{ version1: string; version2: string } | null>(null);
  const [versionCompareResult, setVersionCompareResult] = useState<ProcessRouteVersionCompareResult | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const versionFormRef = useRef<ProFormInstance>();
  
  // 绑定管理相关状态
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [currentBindProcessRouteUuid, setCurrentBindProcessRouteUuid] = useState<string | null>(null);
  const [boundMaterials, setBoundMaterials] = useState<{
    materials: Array<{ uuid: string; code: string; name: string }>;
    material_groups: Array<{ uuid: string; code: string; name: string }>;
  }>({ materials: [], material_groups: [] });
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [allMaterialGroups, setAllMaterialGroups] = useState<MaterialGroup[]>([]);
  const [bindLoading, setBindLoading] = useState(false);

  // 模板管理相关状态
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [createFromTemplateModalVisible, setCreateFromTemplateModalVisible] = useState(false);
  const [currentProcessRouteForTemplate, setCurrentProcessRouteForTemplate] = useState<ProcessRoute | null>(null);
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const templateFormRef = useRef<ProFormInstance>();
  const createFromTemplateFormRef = useRef<ProFormInstance>();

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!modalVisible) return;

      // Ctrl/Cmd + Enter 保存
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        formRef.current?.submit();
      }

      // Escape 关闭
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalVisible]);

  /**
   * 处理新建工艺路线
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentProcessRouteUuid(null);
    setOperationSequence([]);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });

    // 如果启用了自动编码，获取预览编码
    if (isAutoGenerateEnabled('master-data-process-route')) {
      const ruleCode = getPageRuleCode('master-data-process-route');
      if (ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          // 如果返回的编码为空，说明规则不存在或未启用，静默处理
          if (codeResponse.code) {
            setPreviewCode(codeResponse.code);
            formRef.current?.setFieldsValue({
              code: codeResponse.code,
            });
          } else {
            console.info(`编码规则 ${ruleCode} 不存在或未启用，跳过自动生成`);
            setPreviewCode(null);
          }
        } catch (error: any) {
          // 处理其他错误（网络错误等）
          console.warn('自动生成编码失败:', error?.message || error);
          setPreviewCode(null);
        }
      }
    } else {
      setPreviewCode(null);
    }
  };

  /**
   * 处理编辑工艺路线
   */
  const handleEdit = async (record: ProcessRoute) => {
    try {
      setIsEdit(true);
      setCurrentProcessRouteUuid(record.uuid);
      setModalVisible(true);
      
      // 获取工艺路线详情
      const detail = await processRouteApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        description: detail.description,
        isActive: detail.is_active,
      });
      
      // 加载工序序列
      if (detail.operation_sequence) {
        try {
          // operation_sequence 可能是数组或对象，需要根据实际数据结构解析
          let sequenceData: any[] = [];

          if (Array.isArray(detail.operation_sequence)) {
            sequenceData = detail.operation_sequence;
          } else if (typeof detail.operation_sequence === 'object') {
            // 如果是对象，尝试转换为数组
            if (detail.operation_sequence.operations) {
              sequenceData = detail.operation_sequence.operations;
            } else if (detail.operation_sequence.sequence) {
              sequenceData = detail.operation_sequence.sequence;
            } else {
              // 尝试直接使用对象的值
              const entries = Object.entries(detail.operation_sequence);

              for (const [key, value] of entries) {
                if (Array.isArray(value)) {
                  sequenceData = value;
                  break;
                }
              }

              // 如果还没找到，尝试将所有值合并
              if (sequenceData.length === 0) {
                const allValues = Object.values(detail.operation_sequence).filter(v => v != null);
                if (allValues.length > 0 && Array.isArray(allValues[0])) {
                  sequenceData = allValues[0] as any[];
                } else if (allValues.length > 0) {
                  sequenceData = allValues as any[];
                }
              }
            }
          }
          
          // 如果序列数据包含工序信息，需要获取工序详情
          if (sequenceData.length > 0) {
            const operations: OperationItem[] = [];

            // 如果序列数据是UUID数组
            if (typeof sequenceData[0] === 'string') {
              // 获取所有工序
              const allOperations = await operationApi.list({ limit: 1000 });

              // 根据UUID匹配工序
              for (const uuid of sequenceData) {
                const operation = allOperations.find((op) => op.uuid === uuid);
                if (operation) {
                  operations.push({
                    uuid: operation.uuid,
                    code: operation.code,
                    name: operation.name,
                    description: operation.description,
                  });
                }
              }
            } else {
              // 如果序列数据已经是工序对象，直接使用
              for (const item of sequenceData) {
                if (item && item.uuid) {
                  operations.push({
                    uuid: item.uuid,
                    code: item.code || '',
                    name: item.name || '',
                    description: item.description || '',
                  });
                }
              }
            }

            setOperationSequence(operations);
          } else {
            console.log('No operations to load');
            setOperationSequence([]);
          }
        } catch (error: any) {
          console.error('解析工序序列失败:', error);
          setOperationSequence([]);
        }
      } else {
        setOperationSequence([]);
      }
    } catch (error: any) {
      messageApi.error(error.message || '获取工艺路线详情失败');
    }
  };

  /**
   * 处理删除工艺路线
   */
  const handleDelete = async (record: ProcessRoute) => {
    try {
      await processRouteApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除工艺路线
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await processRouteApi.delete(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理创建新版本
   */
  const handleCreateVersion = async (record: ProcessRoute) => {
    try {
      setCurrentProcessRouteCode(record.code);
      setVersionModalVisible(true);
      // 获取当前版本号，建议新版本号
      const currentVersion = record.version || '1.0';
      const versionMatch = currentVersion.match(/^v?(\d+)\.(\d+)$/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        const suggestedVersion = `v${major}.${minor + 1}`;
        versionFormRef.current?.setFieldsValue({
          version: suggestedVersion,
          applyStrategy: 'new_only',
        });
      } else {
        versionFormRef.current?.setFieldsValue({
          version: 'v1.1',
          applyStrategy: 'new_only',
        });
      }
    } catch (error: any) {
      messageApi.error(error.message || '打开版本创建失败');
    }
  };

  /**
   * 处理版本创建提交
   */
  const handleVersionCreateSubmit = async (values: ProcessRouteVersionCreate) => {
    if (!currentProcessRouteCode) {
      messageApi.error('工艺路线编码不存在');
      return;
    }

    try {
      setVersionLoading(true);
      await processRouteApi.createVersion(currentProcessRouteCode, values);
      messageApi.success('版本创建成功');
      setVersionModalVisible(false);
      versionFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '版本创建失败');
    } finally {
      setVersionLoading(false);
    }
  };

  /**
   * 处理查看版本历史
   */
  const handleViewVersionHistory = async (record: ProcessRoute) => {
    try {
      setCurrentProcessRouteCode(record.code);
      setVersionLoading(true);
      // 获取该工艺路线的所有版本
      const versions = await processRouteApi.getVersions(record.code);
      // 按版本号排序（降序）
      const sortedVersions = versions.sort((a, b) => {
        const aMatch = a.version.match(/^v?(\d+)\.(\d+)$/);
        const bMatch = b.version.match(/^v?(\d+)\.(\d+)$/);
        if (aMatch && bMatch) {
          const aMajor = parseInt(aMatch[1]);
          const aMinor = parseInt(aMatch[2]);
          const bMajor = parseInt(bMatch[1]);
          const bMinor = parseInt(bMatch[2]);
          if (aMajor !== bMajor) {
            return bMajor - aMajor;
          }
          return bMinor - aMinor;
        }
        return b.version.localeCompare(a.version);
      });
      setVersionList(sortedVersions);
      setVersionHistoryModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取版本历史失败');
    } finally {
      setVersionLoading(false);
    }
  };

  /**
   * 处理版本对比
   */
  const handleCompareVersions = async (version1: string, version2: string) => {
    if (!currentProcessRouteCode) {
      messageApi.error('工艺路线编码不存在');
      return;
    }

    try {
      setVersionLoading(true);
      const compareData: ProcessRouteVersionCompare = {
        version1,
        version2,
      };
      const result = await processRouteApi.compareVersions(currentProcessRouteCode, compareData);
      setVersionCompareResult(result);
      setSelectedVersions({ version1, version2 });
      setVersionCompareModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '版本对比失败');
    } finally {
      setVersionLoading(false);
    }
  };

  /**
   * 处理版本回退
   */
  const handleRollbackVersion = async (targetVersion: string) => {
    if (!currentProcessRouteCode) return;
    
    try {
      setVersionLoading(true);
      
      // 计算建议的新版本号
      const currentVersion = versionList[0]?.version || '1.0';
      const versionMatch = currentVersion.match(/^v?(\d+)\.(\d+)$/);
      let suggestedVersion = 'v1.1';
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        suggestedVersion = `v${major}.${minor + 1}`;
      }
      
      await processRouteApi.rollbackVersion(currentProcessRouteCode, targetVersion, suggestedVersion);
      messageApi.success('版本回退成功');
      setVersionHistoryModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '版本回退失败');
    } finally {
      setVersionLoading(false);
    }
  };

  /**
   * 处理打开绑定管理
   */
  const handleOpenBindModal = async (record: ProcessRoute) => {
    try {
      setCurrentBindProcessRouteUuid(record.uuid);
      setBindLoading(true);
      
      // 加载绑定的物料和物料分组
      const bound = await processRouteApi.getBoundMaterials(record.uuid);
      setBoundMaterials(bound);
      
      // 加载所有物料和物料分组（用于选择）
      const [materials, materialGroups] = await Promise.all([
        materialApi.list({ limit: 1000 }),
        materialGroupApi.list({ limit: 1000 }),
      ]);
      setAllMaterials(materials);
      setAllMaterialGroups(materialGroups);
      
      setBindModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '加载绑定信息失败');
    } finally {
      setBindLoading(false);
    }
  };

  /**
   * 处理绑定物料分组
   */
  const handleBindMaterialGroup = async (materialGroupUuid: string) => {
    if (!currentBindProcessRouteUuid) return;
    
    try {
      await processRouteApi.bindMaterialGroup(currentBindProcessRouteUuid, materialGroupUuid);
      messageApi.success('绑定成功');
      // 重新加载绑定信息
      const bound = await processRouteApi.getBoundMaterials(currentBindProcessRouteUuid);
      setBoundMaterials(bound);
    } catch (error: any) {
      messageApi.error(error.message || '绑定失败');
    }
  };

  /**
   * 处理解绑物料分组
   */
  const handleUnbindMaterialGroup = async (materialGroupUuid: string) => {
    if (!currentBindProcessRouteUuid) return;
    
    try {
      await processRouteApi.unbindMaterialGroup(currentBindProcessRouteUuid, materialGroupUuid);
      messageApi.success('解绑成功');
      // 重新加载绑定信息
      const bound = await processRouteApi.getBoundMaterials(currentBindProcessRouteUuid);
      setBoundMaterials(bound);
    } catch (error: any) {
      messageApi.error(error.message || '解绑失败');
    }
  };

  /**
   * 处理绑定物料
   */
  const handleBindMaterial = async (materialUuid: string) => {
    if (!currentBindProcessRouteUuid) return;
    
    try {
      await processRouteApi.bindMaterial(currentBindProcessRouteUuid, materialUuid);
      messageApi.success('绑定成功');
      // 重新加载绑定信息
      const bound = await processRouteApi.getBoundMaterials(currentBindProcessRouteUuid);
      setBoundMaterials(bound);
    } catch (error: any) {
      messageApi.error(error.message || '绑定失败');
    }
  };

  /**
   * 处理解绑物料
   */
  const handleUnbindMaterial = async (materialUuid: string) => {
    if (!currentBindProcessRouteUuid) return;
    
    try {
      await processRouteApi.unbindMaterial(currentBindProcessRouteUuid, materialUuid);
      messageApi.success('解绑成功');
      // 重新加载绑定信息
      const bound = await processRouteApi.getBoundMaterials(currentBindProcessRouteUuid);
      setBoundMaterials(bound);
    } catch (error: any) {
      messageApi.error(error.message || '解绑失败');
    }
  };

  /**
   * 处理保存为模板
   */
  const handleSaveAsTemplate = async (record: ProcessRoute) => {
    try {
      setCurrentProcessRouteForTemplate(record);
      // 加载模板列表（用于分类选择）
      const templates = await processRouteApi.listTemplates();
      setTemplateList(templates);
      setTemplateModalVisible(true);
      templateFormRef.current?.resetFields();
      templateFormRef.current?.setFieldsValue({
        code: `${record.code}_TEMPLATE`,
        name: `${record.name}模板`,
        category: '',
        description: `基于工艺路线 ${record.name} 创建的模板`,
        scope: 'all_materials',
        version: '1.0',
        isActive: true,
      });
    } catch (error: any) {
      messageApi.error(error.message || '打开模板创建页面失败');
    }
  };

  /**
   * 处理提交保存模板
   */
  const handleTemplateSubmit = async (values: any) => {
    if (!currentProcessRouteForTemplate) return;
    
    try {
      setTemplateLoading(true);
      
      // 获取工艺路线详情（包含完整配置）
      const routeDetail = await processRouteApi.get(currentProcessRouteForTemplate.uuid);
      
      // 构建模板数据
      const templateData = {
        ...values,
        process_route_config: {
          operation_sequence: routeDetail.operationSequence,
          // 可以扩展更多配置
        },
      };
      
      await processRouteApi.createTemplate(templateData);
      messageApi.success('模板创建成功');
      setTemplateModalVisible(false);
      setCurrentProcessRouteForTemplate(null);
    } catch (error: any) {
      messageApi.error(error.message || '模板创建失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  /**
   * 处理从模板创建
   */
  const handleCreateFromTemplate = async () => {
    try {
      // 加载模板列表
      const templates = await processRouteApi.listTemplates({ isActive: true });
      setTemplateList(templates);
      setCreateFromTemplateModalVisible(true);
      createFromTemplateFormRef.current?.resetFields();
    } catch (error: any) {
      messageApi.error(error.message || '加载模板列表失败');
    }
  };

  /**
   * 处理提交从模板创建
   */
  const handleCreateFromTemplateSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      const routeData = {
        templateUuid: values.templateUuid,
        code: values.code,
        name: values.name,
        description: values.description,
        isActive: values.isActive !== false,
      };
      
      await processRouteApi.createFromTemplate(routeData);
      messageApi.success('从模板创建工艺路线成功');
      setCreateFromTemplateModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '从模板创建失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProcessRoute) => {
    try {
      setCurrentProcessRouteUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await processRouteApi.get(record.uuid);
      setProcessRouteDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取工艺路线详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentProcessRouteUuid(null);
    setProcessRouteDetail(null);
  };

  /**
   * 处理提交表单（创建/更新工艺路线）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);

      // 前端验证
      if (!values.code?.trim()) {
        messageApi.error('请输入工艺路线编码');
        return;
      }
      if (!values.name?.trim()) {
        messageApi.error('请输入工艺路线名称');
        return;
      }
      if (operationSequence.length === 0) {
        messageApi.error('请至少添加一个工序');
        return;
      }

      // 将工序序列转换为JSON格式
      const operationSequenceData = operationSequence.length > 0
        ? {
            sequence: operationSequence.map((op) => op.uuid),
            operations: operationSequence.map((op) => ({
              uuid: op.uuid,
              code: op.code,
              name: op.name,
            })),
          }
        : null;

      let finalCode = values.code.trim();

      // 如果是新建且启用了自动编码，且编码是预览编码或为空，则正式生成编码
      if (!isEdit && isAutoGenerateEnabled('master-data-process-route')) {
        const ruleCode = getPageRuleCode('master-data-process-route');
        const currentCode = values.code?.trim();
        if (ruleCode && (currentCode === previewCode || !currentCode)) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCode });
            finalCode = codeResponse.code;
          } catch (error: any) {
            console.warn('正式生成编码失败，使用预览编码:', error);
            // 如果正式生成失败，继续使用预览编码
          }
        }
      }

      const submitData = {
        code: finalCode,
        name: values.name.trim(),
        description: values.description?.trim() || null,
        is_active: values.isActive ?? true,
        operation_sequence: operationSequenceData,
      };

      if (isEdit && currentProcessRouteUuid) {
        // 更新工艺路线
        await processRouteApi.update(currentProcessRouteUuid, submitData as ProcessRouteUpdate);
        messageApi.success('工艺路线更新成功');
      } else {
        // 创建工艺路线
        await processRouteApi.create(submitData as ProcessRouteCreate);
        messageApi.success('工艺路线创建成功');
      }

      setModalVisible(false);
      setOperationSequence([]);
      setPreviewCode(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      console.error('提交工艺路线失败:', error);
      const errorMessage = error.response?.data?.message || error.message || (isEdit ? '更新失败' : '创建失败');
      messageApi.error(errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setOperationSequence([]);
    setPreviewCode(null);
    formRef.current?.resetFields();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ProcessRoute>[] = [
    {
      title: '工艺路线编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '工艺路线名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '版本号',
      dataIndex: 'version',
      width: 100,
      hideInSearch: true,
      render: (_, record) => (
        <Tag color="blue">{record.version || '1.0'}</Tag>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<BranchesOutlined />}
            onClick={() => handleCreateVersion(record)}
          >
            新版本
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewVersionHistory(record)}
          >
            版本历史
          </Button>
          <Button
            type="link"
            size="small"
            icon={<BranchesOutlined />}
            onClick={() => handleOpenBindModal(record)}
          >
            绑定物料
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleSaveAsTemplate(record)}
          >
            保存为模板
          </Button>
          <Popconfirm
            title="确定要删除这个工艺路线吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ProcessRoute>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.is_active = searchFormValues.isActive;
          }
          
          try {
            const result = await processRouteApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取工艺路线列表失败:', error);
            messageApi.error(error?.message || '获取工艺路线列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建工艺路线
          </Button>,
          <Button
            key="createFromTemplate"
            icon={<CopyOutlined />}
            onClick={handleCreateFromTemplate}
          >
            从模板创建
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            批量删除
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      <DetailDrawerTemplate<ProcessRoute>
        title="工艺路线详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={processRouteDetail || undefined}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        columns={[
          { title: '工艺路线编码', dataIndex: 'code' },
          { title: '工艺路线名称', dataIndex: 'name' },
          { title: '描述', dataIndex: 'description', span: 2 },
          {
            title: '启用状态',
            dataIndex: 'is_active',
            render: (_, record) => (
              <Tag color={record.is_active ? 'success' : 'default'}>
                {record.is_active ? '启用' : '禁用'}
              </Tag>
            ),
          },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
          {
            title: '工序序列',
            span: 2,
            render: (_, record) => {
              if (!record.operation_sequence) {
                return <span style={{ color: '#999' }}>暂无工序</span>;
              }

              try {
                let operations: any[] = [];

                // 解析工序序列数据
                if (Array.isArray(record.operation_sequence)) {
                  operations = record.operation_sequence;
                } else if (typeof record.operation_sequence === 'object' && record.operation_sequence !== null) {
                  // 优先使用 operations 数组（包含完整信息）
                  if (record.operation_sequence.operations && Array.isArray(record.operation_sequence.operations)) {
                    operations = record.operation_sequence.operations;
                  } else if (record.operation_sequence.sequence && Array.isArray(record.operation_sequence.sequence)) {
                    operations = record.operation_sequence.sequence.map((uuid: string) => ({
                      uuid,
                      code: uuid.substring(0, 8),
                      name: '工序',
                    }));
                  } else {
                    // 尝试直接使用对象的值
                    const entries = Object.entries(record.operation_sequence);
                    for (const [key, value] of entries) {
                      if (Array.isArray(value)) {
                        operations = value;
                        break;
                      }
                    }

                    // 如果还没找到，尝试将所有值合并
                    if (operations.length === 0) {
                      const allValues = Object.values(record.operation_sequence).filter(v => v != null);
                      if (allValues.length > 0 && Array.isArray(allValues[0])) {
                        operations = allValues[0] as any[];
                      } else if (allValues.length > 0) {
                        operations = allValues as any[];
                      }
                    }
                  }
                }

                if (!operations || operations.length === 0) {
                  console.log('operations 为空或长度为0');
                  return <span style={{ color: '#999' }}>暂无工序</span>;
                }

                // 显示工序列表
                return (
                  <div>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>
                      共 {operations.length} 个工序：
                    </div>
                    <Space wrap>
                      {operations.map((op: any, index: number) => (
                        <Tag key={op?.uuid || op || index} color="blue">
                          {op?.code || op || `工序${index + 1}`} - {op?.name || '未知工序'}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                );
              } catch (error: any) {
                console.error('解析工序序列失败:', error, record.operation_sequence);
                return <span style={{ color: '#ff4d4f' }}>工序数据解析失败: {error.message}</span>;
              }
            },
          },
        ]}
      />

      <FormModalTemplate
        title={isEdit ? '编辑工艺路线' : '新建工艺路线'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={{ is_active: true }}
        className="process-route-modal"
      >
        <style>{`
          /* 只给工序配置的 ProForm.Item 的内容区域添加 8px 左边距，与 ant-col 对齐 */
          /* 不影响其他 ProFormText 等组件 */
          .process-route-modal .operation-sequence-form-item .ant-form-item-control-input {
            padding-left: 8px;
          }
          /* 调整工序标签的左边距，与输入框对齐 */
          .process-route-modal .operation-sequence-form-item .ant-form-item-label {
            padding-left: 8px;
          }
        `}</style>
        <CodeField
          pageCode="master-data-process-route"
          name="code"
          label="工艺路线编码"
          required={true}
          colProps={{ span: 12 }}
          fieldProps={{
            style: { textTransform: 'uppercase' },
          }}
          autoGenerateOnCreate={!isEdit}
          showGenerateButton={false}
        />
        <ProFormText
          name="name"
          label="工艺路线名称"
          placeholder="请输入工艺路线名称"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入工艺路线名称' },
            { max: 200, message: '工艺路线名称不能超过200个字符' },
          ]}
          extra="工艺路线的显示名称"
        />

        {/* 工序序列配置 */}
        <ProForm.Item
          label="工序"
          colProps={{ span: 24 }}
          className="operation-sequence-form-item"
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Space>
              <Tag color={operationSequence.length > 0 ? 'processing' : 'default'}>
                已配置 {operationSequence.length} 个工序
              </Tag>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              支持拖拽排序，点击删除移除工序
            </Typography.Text>
          </div>
          <OperationSequenceEditor
            value={operationSequence}
            onChange={setOperationSequence}
          />
        </ProForm.Item>

        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入工艺路线的详细描述（可选）"
          colProps={{ span: 24 }}
          fieldProps={{
            rows: 3,
            maxLength: 500,
            showCount: true,
          }}
          extra="工艺路线的详细说明信息"
        />

        {/* 状态设置 */}
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          checkedChildren="启用"
          unCheckedChildren="禁用"
          colProps={{ span: 24 }}
          extra="禁用后该工艺路线将不可用"
        />
      </FormModalTemplate>

      {/* 创建版本 Modal */}
      <FormModalTemplate
        title="创建工艺路线新版本"
        open={versionModalVisible}
        onClose={() => setVersionModalVisible(false)}
        onFinish={handleVersionCreateSubmit}
        isEdit={false}
        loading={versionLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={versionFormRef}
      >
        <ProFormText
          name="version"
          label="版本号"
          placeholder="请输入版本号（如：v1.1）"
          rules={[
            { required: true, message: '请输入版本号' },
            { max: 20, message: '版本号不能超过20个字符' },
          ]}
          extra="系统会自动复制当前最新版本创建新版本"
        />
        <ProFormTextArea
          name="versionDescription"
          label="版本说明"
          placeholder="请输入版本说明（可选）"
          fieldProps={{
            rows: 3,
            maxLength: 500,
          }}
        />
        <ProFormDateTimePicker
          name="effectiveDate"
          label="生效日期"
          placeholder="请选择生效日期（可选，默认为当前日期）"
          fieldProps={{
            showTime: false,
            format: 'YYYY-MM-DD',
          }}
        />
        <ProFormSelect
          name="applyStrategy"
          label="版本应用策略"
          options={[
            { label: '仅新工单使用新版本（推荐）', value: 'new_only' },
            { label: '所有工单使用新版本（谨慎使用）', value: 'all' },
          ]}
          rules={[{ required: true, message: '请选择版本应用策略' }]}
          extra="仅新工单使用新版本：已创建的工单继续使用旧版本，新创建的工单使用新版本。所有工单使用新版本：系统会更新所有在制工单的工艺路线。"
        />
      </FormModalTemplate>

      {/* 版本历史 Modal */}
      <Modal
        title="版本历史"
        open={versionHistoryModalVisible}
        onCancel={() => {
          setVersionHistoryModalVisible(false);
          setVersionList([]);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setVersionHistoryModalVisible(false);
            setVersionList([]);
          }}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        <Spin spinning={versionLoading}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {versionList.length === 0 ? (
              <Empty description="暂无版本历史" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {versionList.map((version, index) => (
                  <div
                    key={version.uuid}
                    style={{
                      padding: '16px',
                      border: '1px solid #f0f0f0',
                      borderRadius: '6px',
                      backgroundColor: index === 0 ? '#f6ffed' : '#fff',
                    }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag color={index === 0 ? 'success' : 'default'}>
                            {version.version}
                            {index === 0 && '（当前版本）'}
                          </Tag>
                          <Typography.Text strong>{version.name}</Typography.Text>
                        </Space>
                        {index > 0 && (
                          <Space>
                            <Button
                              type="link"
                              size="small"
                              icon={<DiffOutlined />}
                              onClick={() => {
                                handleCompareVersions(versionList[0].version, version.version);
                              }}
                            >
                              对比
                            </Button>
                            <Popconfirm
                              title={`确认回退到版本 ${version.version}？`}
                              description="系统将创建新版本，内容与此版本相同。"
                              onConfirm={() => handleRollbackVersion(version.version)}
                              okText="确认"
                              cancelText="取消"
                            >
                              <Button
                                type="link"
                                size="small"
                                danger
                                icon={<BranchesOutlined />}
                              >
                                回退到此版本
                              </Button>
                            </Popconfirm>
                          </Space>
                        )}
                      </div>
                      {version.versionDescription && (
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                          {version.versionDescription}
                        </Typography.Text>
                      )}
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#8c8c8c' }}>
                        <span>创建时间：{new Date(version.created_at).toLocaleString()}</span>
                        {version.baseVersion && (
                          <span>基于版本：{version.baseVersion}</span>
                        )}
                      </div>
                    </Space>
                  </div>
                ))}
              </Space>
            )}
          </div>
        </Spin>
      </Modal>

      {/* 版本对比 Modal */}
      <Modal
        title="版本对比"
        open={versionCompareModalVisible}
        onCancel={() => {
          setVersionCompareModalVisible(false);
          setVersionCompareResult(null);
          setSelectedVersions(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setVersionCompareModalVisible(false);
            setVersionCompareResult(null);
            setSelectedVersions(null);
          }}>
            关闭
          </Button>,
        ]}
        width={1000}
      >
        <Spin spinning={versionLoading}>
          {versionCompareResult ? (
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* 版本信息 */}
                <div>
                  <Typography.Text strong>对比版本：</Typography.Text>
                  <Tag color="blue">{versionCompareResult.version1}</Tag>
                  <span style={{ margin: '0 8px' }}>vs</span>
                  <Tag color="green">{versionCompareResult.version2}</Tag>
                </div>

                {/* 新增工序 */}
                {versionCompareResult.added_operations.length > 0 && (
                  <div>
                    <Typography.Title level={5} style={{ color: '#52c41a', marginBottom: '8px' }}>
                      新增工序（{versionCompareResult.added_operations.length}个）
                    </Typography.Title>
                    <div style={{ backgroundColor: '#f6ffed', padding: '12px', borderRadius: '6px' }}>
                      {versionCompareResult.added_operations.map((item, idx) => (
                        <div key={idx} style={{ marginBottom: '8px' }}>
                          <Tag color="success">位置 {item.position}</Tag>
                          <Typography.Text>
                            {item.operation.code} - {item.operation.name}
                          </Typography.Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 删除工序 */}
                {versionCompareResult.removed_operations.length > 0 && (
                  <div>
                    <Typography.Title level={5} style={{ color: '#ff4d4f', marginBottom: '8px' }}>
                      删除工序（{versionCompareResult.removed_operations.length}个）
                    </Typography.Title>
                    <div style={{ backgroundColor: '#fff2f0', padding: '12px', borderRadius: '6px' }}>
                      {versionCompareResult.removed_operations.map((item, idx) => (
                        <div key={idx} style={{ marginBottom: '8px' }}>
                          <Tag color="error">原位置 {item.old_position}</Tag>
                          <Typography.Text delete>
                            {item.operation.code} - {item.operation.name}
                          </Typography.Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 修改工序 */}
                {versionCompareResult.modified_operations.length > 0 && (
                  <div>
                    <Typography.Title level={5} style={{ color: '#1890ff', marginBottom: '8px' }}>
                      修改工序（{versionCompareResult.modified_operations.length}个）
                    </Typography.Title>
                    <div style={{ backgroundColor: '#e6f7ff', padding: '12px', borderRadius: '6px' }}>
                      {versionCompareResult.modified_operations.map((item, idx) => (
                        <div key={idx} style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#fff', borderRadius: '4px' }}>
                          <Typography.Text strong>
                            {item.operation.code} - {item.operation.name}
                          </Typography.Text>
                          <div style={{ marginTop: '8px', fontSize: '12px' }}>
                            {Object.entries(item.changes).map(([key, change]) => (
                              <div key={key} style={{ marginBottom: '4px' }}>
                                <Typography.Text type="secondary">{key}：</Typography.Text>
                                <Tag color="red">旧：{JSON.stringify(change.old)}</Tag>
                                <Tag color="green">新：{JSON.stringify(change.new)}</Tag>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 顺序变化 */}
                {versionCompareResult.sequence_changes.length > 0 && (
                  <div>
                    <Typography.Title level={5} style={{ color: '#faad14', marginBottom: '8px' }}>
                      工序顺序变化（{versionCompareResult.sequence_changes.length}个）
                    </Typography.Title>
                    <div style={{ backgroundColor: '#fffbe6', padding: '12px', borderRadius: '6px' }}>
                      {versionCompareResult.sequence_changes.map((item, idx) => (
                        <div key={idx} style={{ marginBottom: '8px' }}>
                          <Typography.Text>
                            {item.operation.code} - {item.operation.name}
                          </Typography.Text>
                          <span style={{ margin: '0 8px', color: '#8c8c8c' }}>：</span>
                          <Tag color="orange">位置 {item.old_position}</Tag>
                          <span style={{ margin: '0 4px' }}>→</span>
                          <Tag color="blue">位置 {item.new_position}</Tag>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 无差异提示 */}
                {versionCompareResult.added_operations.length === 0 &&
                 versionCompareResult.removed_operations.length === 0 &&
                 versionCompareResult.modified_operations.length === 0 &&
                 versionCompareResult.sequence_changes.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Typography.Text type="secondary">两个版本无差异</Typography.Text>
                  </div>
                )}
              </Space>
            </div>
          ) : (
            <Empty description="暂无对比结果" />
          )}
        </Spin>
      </Modal>

      {/* 绑定管理 Modal */}
      <Modal
        title="绑定物料管理"
        open={bindModalVisible}
        onCancel={() => {
          setBindModalVisible(false);
          setCurrentBindProcessRouteUuid(null);
          setBoundMaterials({ materials: [], material_groups: [] });
        }}
        footer={[
          <Button key="close" onClick={() => {
            setBindModalVisible(false);
            setCurrentBindProcessRouteUuid(null);
            setBoundMaterials({ materials: [], material_groups: [] });
          }}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        <Spin spinning={bindLoading}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 绑定物料分组 */}
            <div>
              <Typography.Title level={5}>绑定物料分组（批量管理）</Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '12px' }}>
                绑定后，该物料分组下的所有物料（如果没有单独绑定工艺路线）将自动使用此工艺路线。
              </Typography.Text>
              
              {/* 已绑定的物料分组 */}
              {boundMaterials.material_groups.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <Typography.Text strong style={{ display: 'block', marginBottom: '8px' }}>
                    已绑定的物料分组：
                  </Typography.Text>
                  <Space wrap>
                    {boundMaterials.material_groups.map((mg) => (
                      <Tag
                        key={mg.uuid}
                        closable
                        onClose={() => handleUnbindMaterialGroup(mg.uuid)}
                        color="blue"
                      >
                        {mg.code} - {mg.name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
              
              {/* 选择物料分组 */}
              <Select
                placeholder="选择物料分组进行绑定"
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={allMaterialGroups
                  .filter(mg => !boundMaterials.material_groups.some(bm => bm.uuid === mg.uuid))
                  .map(mg => ({
                    label: `${mg.code} - ${mg.name}`,
                    value: mg.uuid,
                  }))}
                onSelect={(value) => handleBindMaterialGroup(value)}
              />
            </div>

            <Divider />

            {/* 绑定物料 */}
            <div>
              <Typography.Title level={5}>绑定物料（精确控制）</Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '12px' }}>
                物料绑定优先级高于物料分组绑定。绑定后，该物料将优先使用此工艺路线（即使物料所属分组也绑定了其他工艺路线）。
              </Typography.Text>
              
              {/* 已绑定的物料 */}
              {boundMaterials.materials.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <Typography.Text strong style={{ display: 'block', marginBottom: '8px' }}>
                    已绑定的物料：
                  </Typography.Text>
                  <Space wrap>
                    {boundMaterials.materials.map((m) => (
                      <Tag
                        key={m.uuid}
                        closable
                        onClose={() => handleUnbindMaterial(m.uuid)}
                        color="green"
                      >
                        {m.code} - {m.name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
              
              {/* 选择物料 */}
              <Select
                placeholder="选择物料进行绑定"
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={allMaterials
                  .filter(m => !boundMaterials.materials.some(bm => bm.uuid === m.uuid))
                  .map(m => ({
                    label: `${(m as any).mainCode || (m as any).code || m.uuid} - ${m.name}`,
                    value: m.uuid,
                  }))}
                onSelect={(value) => handleBindMaterial(value)}
              />
            </div>

            {/* 优先级说明 */}
            <div style={{
              marginTop: '24px',
              padding: '12px',
              backgroundColor: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '6px',
            }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: '8px' }}>
                优先级说明：
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                1. 物料主数据中的工艺路线关联（最高优先级）<br />
                2. 物料绑定工艺路线（第二优先级）<br />
                3. 物料分组绑定工艺路线（第三优先级）<br />
                4. 默认工艺路线（最低优先级，如果配置了）
              </Typography.Text>
            </div>
          </Space>
        </Spin>
      </Modal>

      {/* 保存为模板 Modal */}
      <FormModalTemplate
        title="保存为模板"
        open={templateModalVisible}
        onClose={() => {
          setTemplateModalVisible(false);
          setCurrentProcessRouteForTemplate(null);
        }}
        onFinish={handleTemplateSubmit}
        isEdit={false}
        loading={templateLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={templateFormRef}
      >
        <ProFormText
          name="code"
          label="模板编码"
          placeholder="请输入模板编码"
          rules={[
            { required: true, message: '请输入模板编码' },
            { max: 50, message: '模板编码不能超过50个字符' },
          ]}
        />
        <ProFormText
          name="name"
          label="模板名称"
          placeholder="请输入模板名称"
          rules={[
            { required: true, message: '请输入模板名称' },
            { max: 200, message: '模板名称不能超过200个字符' },
          ]}
        />
        <ProFormSelect
          name="category"
          label="模板分类"
          placeholder="请选择模板分类（可选）"
          options={[
            { label: '注塑类', value: 'injection' },
            { label: '组装类', value: 'assembly' },
            { label: '包装类', value: 'packaging' },
            { label: '检验类', value: 'inspection' },
            { label: '其他', value: 'other' },
          ]}
        />
        <ProFormTextArea
          name="description"
          label="模板描述"
          placeholder="请输入模板描述（可选）"
          fieldProps={{ rows: 3 }}
        />
        <ProFormSelect
          name="scope"
          label="适用范围"
          options={[
            { label: '所有物料', value: 'all_materials' },
            { label: '所有物料分组', value: 'all_groups' },
            { label: '特定物料分组', value: 'specific_groups' },
          ]}
          rules={[{ required: true, message: '请选择适用范围' }]}
        />
        <ProFormText
          name="version"
          label="版本号"
          placeholder="请输入版本号（如：v1.0）"
          rules={[
            { required: true, message: '请输入版本号' },
            { max: 20, message: '版本号不能超过20个字符' },
          ]}
        />
        <ProFormSwitch
          name="isActive"
          label="是否启用"
        />
      </FormModalTemplate>

      {/* 从模板创建 Modal */}
      <FormModalTemplate
        title="从模板创建工艺路线"
        open={createFromTemplateModalVisible}
        onClose={() => {
          setCreateFromTemplateModalVisible(false);
        }}
        onFinish={handleCreateFromTemplateSubmit}
        isEdit={false}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={createFromTemplateFormRef}
      >
        <ProFormSelect
          name="templateUuid"
          label="选择模板"
          placeholder="请选择模板"
          rules={[{ required: true, message: '请选择模板' }]}
          options={templateList.map(t => ({
            label: `${t.name} (${t.category || '未分类'}) - v${t.version}`,
            value: t.uuid,
          }))}
          fieldProps={{
            showSearch: true,
            filterOption: (input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormText
          name="code"
          label="工艺路线编码"
          placeholder="请输入工艺路线编码"
          rules={[
            { required: true, message: '请输入工艺路线编码' },
            { max: 50, message: '工艺路线编码不能超过50个字符' },
          ]}
          fieldProps={{
            style: { textTransform: 'uppercase' },
          }}
        />
        <ProFormText
          name="name"
          label="工艺路线名称"
          placeholder="请输入工艺路线名称"
          rules={[
            { required: true, message: '请输入工艺路线名称' },
            { max: 200, message: '工艺路线名称不能超过200个字符' },
          ]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述（可选）"
          fieldProps={{ rows: 3 }}
        />
        <ProFormSwitch
          name="isActive"
          label="是否启用"
        />
        <div style={{ marginTop: 16, padding: 12, background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
          <div style={{ color: '#1890ff', fontSize: 13 }}>
            <strong>提示：</strong>从模板创建后，系统会自动复制模板的所有配置（工序顺序、标准工时、SOP关联、跳转规则等），您可以根据需要进行调整。
          </div>
        </div>
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ProcessRoutesPage;

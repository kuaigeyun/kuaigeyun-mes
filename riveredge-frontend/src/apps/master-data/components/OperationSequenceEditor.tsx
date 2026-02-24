/**
 * 工序序列编辑器
 * 支持拖拽排序、添加工序、替换工序、删除工序
 */

import React, { useState, useEffect } from 'react';
import { Button, Tag, Space, Modal, message, Select, Table, Empty, Typography } from 'antd';
import { PlusOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, DragOverEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { operationApi } from '../services/process';
import type { Operation } from '../types/process';

export interface OperationItem {
  uuid: string;
  code: string;
  name: string;
  description?: string;
  reportingType?: 'quantity' | 'status';
  allowJump?: boolean;
}

export interface OperationSequenceEditorProps {
  value?: OperationItem[];
  onChange?: (operations: OperationItem[]) => void;
}

export const OperationSequenceEditor: React.FC<OperationSequenceEditorProps> = ({ value = [], onChange }) => {
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  useEffect(() => {
    setOperations(value);
  }, [value]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? (event.over.id as string) : null);
  };

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

  const handleAddOperation = () => {
    if (!selectedOperationUuids?.length) {
      message.warning('请选择要添加的工序');
      return;
    }
    const newOperations = selectedOperationUuids
      .map((uuid) => allOperations.find((op) => op.uuid === uuid))
      .filter((op): op is Operation => !!op && !operations.some((e) => e.uuid === op.uuid));
    if (newOperations.length === 0) {
      message.warning('所选工序均已添加或未找到');
      return;
    }
    const newItems: OperationItem[] = newOperations.map((op) => ({
      uuid: op.uuid,
      code: op.code,
      name: op.name,
      description: op.description,
      reportingType: op.reportingType,
      allowJump: op.allowJump,
    }));
    const updated = [...operations, ...newItems];
    setOperations(updated);
    onChange?.(updated);
    setAddModalVisible(false);
    setSelectedOperationUuids([]);
    message.success(`成功添加 ${newItems.length} 个工序`);
  };

  const handleDeleteOperation = (uuid: string) => {
    const newOperations = operations.filter((op) => op.uuid !== uuid);
    setOperations(newOperations);
    onChange?.(newOperations);
  };

  const handleOpenReplaceModal = (uuid: string) => {
    setReplacingOperationUuid(uuid);
    setReplacementOperationUuid(undefined);
    setReplaceModalVisible(true);
  };

  const handleReplaceOperation = () => {
    if (!replacingOperationUuid || !replacementOperationUuid) {
      message.warning('请选择要替换的工序');
      return;
    }
    if (replacingOperationUuid === replacementOperationUuid) {
      message.warning('不能替换为相同的工序');
      return;
    }
    if (operations.some((op) => op.uuid === replacementOperationUuid && op.uuid !== replacingOperationUuid)) {
      message.warning('该工序已在列表中');
      return;
    }
    const replacingIndex = operations.findIndex((op) => op.uuid === replacingOperationUuid);
    const replacement = allOperations.find((op) => op.uuid === replacementOperationUuid);
    if (replacingIndex === -1 || !replacement) {
      message.error('未找到要替换的工序');
      return;
    }
    const newOperations = [...operations];
    newOperations[replacingIndex] = {
      uuid: replacement.uuid,
      code: replacement.code,
      name: replacement.name,
      description: replacement.description,
      reportingType: replacement.reportingType,
      allowJump: replacement.allowJump,
    };
    setOperations(newOperations);
    onChange?.(newOperations);
    setReplaceModalVisible(false);
    setReplacingOperationUuid(null);
    setReplacementOperationUuid(undefined);
    message.success('工序替换成功');
  };

  const availableOperations = allOperations.filter((op) => !operations.some((a) => a.uuid === op.uuid));
  const getAvailableForReplace = (excludeUuid: string | null) => {
    if (!excludeUuid) return availableOperations;
    return allOperations.filter((op) => op.uuid === excludeUuid || !operations.some((a) => a.uuid === op.uuid));
  };

  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 100,
      render: (_: any, __: OperationItem, index: number) => (
        <Space>
          <span className="drag-handle" style={{ color: '#1890ff', cursor: 'move', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, padding: 4, minWidth: 24, minHeight: 24 }} title="拖拽排序">
            <HolderOutlined style={{ fontSize: 16 }} />
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, padding: '0 8px', backgroundColor: '#f0f9ff', border: '1px solid #91d5ff', borderRadius: 6, color: '#1890ff', fontWeight: 600, fontSize: 13 }}>
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
          {record.description && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{record.description}</div>}
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
        <Tag color={record.allowJump ? 'success' : 'default'}>{record.allowJump ? '允许' : '不允许'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: OperationItem) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleOpenReplaceModal(record.uuid); }}>替换</Button>
          <Button type="link" danger size="small" onClick={(e) => { e.stopPropagation(); handleDeleteOperation(record.uuid); }}>删除</Button>
        </Space>
      ),
    },
  ];

  const DraggableRow = ({ children, ...props }: any) => {
    const index = operations.findIndex((op) => op.uuid === props['data-row-key']);
    const operation = operations[index];
    if (!operation) return <tr {...props}>{children}</tr>;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: operation.uuid });
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
      <tr ref={setNodeRef} style={style} {...props}>
        {React.Children.map(children, (child: any, idx: number) => {
          if (idx === 0 && React.isValidElement(child)) {
            return React.cloneElement(child, {
              children: React.Children.map(child.props.children, (cellContent: any) => {
                if (React.isValidElement(cellContent) && cellContent.type === Space) {
                  return React.cloneElement(cellContent, {
                    children: React.Children.map(cellContent.props.children, (item: any) => {
                      if (React.isValidElement(item) && item.props?.className === 'drag-handle') {
                        return React.cloneElement(item, { ...attributes, ...listeners });
                      }
                      return item;
                    }),
                  });
                }
                return cellContent;
              }),
            });
          }
          if (idx === 4 && React.isValidElement(child)) {
            return React.cloneElement(child, { onClick: (e: React.MouseEvent) => e.stopPropagation() });
          }
          return child;
        })}
      </tr>
    );
  };

  const activeOperation = activeId ? operations.find((op) => op.uuid === activeId) : null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        {operations.length > 0 ? (
          <SortableContext items={operations.map((op) => op.uuid)} strategy={verticalListSortingStrategy}>
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
                                      <div style={{ height: 2, backgroundColor: '#1890ff', margin: 0, boxShadow: '0 0 4px rgba(24, 144, 255, 0.5)' }} />
                                    </td>
                                  </tr>
                                )}
                                <DraggableRow data-row-key={op.uuid}>
                                  <td>
                                    <Space>
                                      <span className="drag-handle" style={{ color: '#1890ff', cursor: 'move', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, padding: 4, minWidth: 24, minHeight: 24 }} title="拖拽排序">
                                        <HolderOutlined style={{ fontSize: 16 }} />
                                      </span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, padding: '0 8px', backgroundColor: '#f0f9ff', border: '1px solid #91d5ff', borderRadius: 6, color: '#1890ff', fontWeight: 600, fontSize: 13 }}>
                                        {idx + 1}
                                      </span>
                                    </Space>
                                  </td>
                                  <td>
                                    <div>
                                      <div style={{ fontWeight: 500 }}>{op.code} - {op.name}</div>
                                      {op.description && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{op.description}</div>}
                                    </div>
                                  </td>
                                  <td>
                                    <Tag color={op.reportingType === 'quantity' ? 'blue' : 'green'}>
                                      {op.reportingType === 'quantity' ? '按数量报工' : op.reportingType === 'status' ? '按状态报工' : '-'}
                                    </Tag>
                                  </td>
                                  <td>
                                    <Tag color={op.allowJump ? 'success' : 'default'}>{op.allowJump ? '允许' : '不允许'}</Tag>
                                  </td>
                                  <td onClick={(e) => e.stopPropagation()}>
                                    <Space>
                                      <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleOpenReplaceModal(op.uuid); }}>替换</Button>
                                      <Button type="link" danger size="small" onClick={(e) => { e.stopPropagation(); handleDeleteOperation(op.uuid); }}>删除</Button>
                                    </Space>
                                  </td>
                                </DraggableRow>
                                {isInsertAfter && (
                                  <tr>
                                    <td colSpan={5} style={{ padding: 0, height: 0, lineHeight: 0 }}>
                                      <div style={{ height: 2, backgroundColor: '#1890ff', margin: 0, boxShadow: '0 0 4px rgba(24, 144, 255, 0.5)' }} />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      );
                    },
                  },
                }}
                style={{ width: '100%' }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
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
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
          />
        )}
        <DragOverlay>
          {activeOperation ? (
            <div style={{ padding: '12px 16px', background: '#fff', border: '1px solid #1890ff', borderRadius: 4, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)', width: '100%', minWidth: 300 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <HolderOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#262626' }}>{activeOperation.code} - {activeOperation.name}</div>
                  {activeOperation.description && <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{activeOperation.description}</div>}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div
        onClick={() => setAddModalVisible(true)}
        style={{ marginTop: 16, padding: 12, border: '1px dashed #1890ff', borderRadius: 4, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', color: '#1890ff' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#40a9ff'; e.currentTarget.style.backgroundColor = '#f0f9ff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1890ff'; e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <PlusOutlined style={{ marginRight: 8 }} />
        <span>新增工序</span>
      </div>

      <Modal title="选择工序" open={addModalVisible} onOk={handleAddOperation} onCancel={() => { setAddModalVisible(false); setSelectedOperationUuids([]); }} okText="确定" cancelText="取消" okButtonProps={{ disabled: !selectedOperationUuids?.length || loading }}>
        <Select
          mode="multiple"
          placeholder="搜索并选择工序（可多选）..."
          options={availableOperations.map((op) => ({ label: `${op.code} - ${op.name}`, value: op.uuid, title: op.description || `${op.code} - ${op.name}` }))}
          value={selectedOperationUuids}
          onChange={setSelectedOperationUuids}
          style={{ width: '100%' }}
          loading={loading}
          showSearch
          allowClear
          maxTagCount="responsive"
          filterOption={(input: string, option: any) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
          notFoundContent={loading ? '加载中...' : '暂无可用工序'}
        />
        {availableOperations.length === 0 && !loading && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text type="danger" style={{ fontSize: 12 }}>没有可用的工序，请先在"工序管理"中创建工序</Typography.Text>
          </div>
        )}
      </Modal>

      <Modal title="替换工序" open={replaceModalVisible} onOk={handleReplaceOperation} onCancel={() => { setReplaceModalVisible(false); setReplacingOperationUuid(null); setReplacementOperationUuid(undefined); }} okText="确定" cancelText="取消" okButtonProps={{ disabled: !replacementOperationUuid || loading }}>
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>当前工序：</Typography.Text>
          <div style={{ marginTop: 4 }}>
            {replacingOperationUuid && (() => {
              const currentOp = operations.find((op) => op.uuid === replacingOperationUuid);
              return currentOp ? <Tag color="blue">{currentOp.code} - {currentOp.name}</Tag> : null;
            })()}
          </div>
        </div>
        <Select
          placeholder="搜索并选择要替换的工序..."
          options={getAvailableForReplace(replacingOperationUuid).map((op) => ({ label: `${op.code} - ${op.name}`, value: op.uuid, title: op.description || `${op.code} - ${op.name}` }))}
          value={replacementOperationUuid}
          onChange={setReplacementOperationUuid}
          style={{ width: '100%' }}
          loading={loading}
          showSearch
          allowClear
          filterOption={(input: string, option: any) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
          notFoundContent={loading ? '加载中...' : '暂无可用工序'}
        />
        {getAvailableForReplace(replacingOperationUuid).length === 0 && !loading && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text type="danger" style={{ fontSize: 12 }}>没有可用的工序，请先在"工序管理"中创建工序</Typography.Text>
          </div>
        )}
      </Modal>
    </>
  );
};

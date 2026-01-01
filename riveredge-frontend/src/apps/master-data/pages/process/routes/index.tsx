/**
 * 工艺路线管理页面
 * 
 * 提供工艺路线的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, message, Select, Divider, Typography, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { processRouteApi, operationApi } from '../../../services/process';
import type { ProcessRoute, ProcessRouteCreate, ProcessRouteUpdate, Operation } from '../../../types/process';
import { MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';

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
  const [selectedOperationUuid, setSelectedOperationUuid] = useState<string | undefined>(undefined);

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
   * 处理拖拽结束
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

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
    if (!selectedOperationUuid) {
      message.warning('请选择要添加的工序');
      return;
    }

    // 检查是否已添加
    if (operations.some((op) => op.uuid === selectedOperationUuid)) {
      message.warning('该工序已添加');
      return;
    }

    // 查找选中的工序
    const selectedOperation = allOperations.find((op) => op.uuid === selectedOperationUuid);
    if (!selectedOperation) {
      message.error('未找到选中的工序');
      return;
    }

    // 添加到列表
    const newOperation: OperationItem = {
      uuid: selectedOperation.uuid,
      code: selectedOperation.code,
      name: selectedOperation.name,
      description: selectedOperation.description,
    };

    const newOperations = [...operations, newOperation];
    setOperations(newOperations);
    onChange?.(newOperations);
    setSelectedOperationUuid(undefined);
  };

  /**
   * 删除工序
   */
  const handleDeleteOperation = (uuid: string) => {
    const newOperations = operations.filter((op) => op.uuid !== uuid);
    setOperations(newOperations);
    onChange?.(newOperations);
  };

  // 获取可选的工序列表（排除已添加的）
  const availableOperations = allOperations.filter(
    (op) => !operations.some((addedOp) => addedOp.uuid === op.uuid)
  );

  return (
    <div style={{ minHeight: 240 }}>
      {/* 工序选择器 */}
      <div style={{ marginBottom: 24 }}>
        <Typography.Text strong style={{ marginBottom: 12, display: 'block' }}>
          添加工序
        </Typography.Text>
        <Space.Compact style={{ width: '100%' }}>
          <Select
            placeholder="搜索并选择工序..."
            options={availableOperations.map((op) => ({
              label: `${op.code} - ${op.name}`,
              value: op.uuid,
              title: op.description || `${op.code} - ${op.name}`,
            }))}
            value={selectedOperationUuid}
            onChange={setSelectedOperationUuid}
            style={{ flex: 1, minWidth: 200 }}
            loading={loading}
            showSearch
            allowClear
            filterOption={(input: string, option: any) => {
              const label = option?.label || '';
              return label.toLowerCase().includes(input.toLowerCase());
            }}
            notFoundContent={loading ? '加载中...' : '暂无可用工序'}
          />
          <Button
            type="primary"
            onClick={handleAddOperation}
            disabled={!selectedOperationUuid || loading}
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
          >
            <PlusOutlined />
            添加
          </Button>
        </Space.Compact>
        {availableOperations.length === 0 && !loading && (
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="danger" style={{ fontSize: '12px' }}>
              没有可用的工序，请先在"工序管理"中创建工序
            </Typography.Text>
          </div>
        )}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* 工序列表 */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <Typography.Text strong>
            工序序列 ({operations.length} 个)
          </Typography.Text>
          {operations.length > 1 && (
            <Button
              size="small"
              danger
              onClick={() => {
                Modal.confirm({
                  title: '清空工序',
                  content: '确定要清空所有工序吗？此操作不可撤销。',
                  okText: '确定清空',
                  cancelText: '取消',
                  okButtonProps: { danger: true },
                  onOk: () => {
                    setOperations([]);
                    onChange?.([]);
                    setSelectedOperationUuid(undefined);
                  },
                });
              }}
            >
              清空全部
            </Button>
          )}
        </div>

        {operations.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={operations.map((op) => op.uuid)}
              strategy={verticalListSortingStrategy}
            >
              <div style={{
                border: '1px solid #d9d9d9',
                padding: '20px',
                background: '#fafafa',
                minHeight: 120
              }}>
                {operations.map((operation) => (
                  <SortableOperationItem
                    key={operation.uuid}
                    operation={operation}
                    onDelete={() => handleDeleteOperation(operation.uuid)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: '#fafafa',
            border: '1px dashed #d9d9d9'
          }}>
            <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
              暂无工序，请从上方选择工序并点击"添加"按钮
            </Typography.Text>
          </div>
        )}
      </div>
    </div>
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
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentProcessRouteUuid(null);
    setOperationSequence([]);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
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

      const submitData = {
        code: values.code.trim(),
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
      >
        {/* 快捷键提示 */}
        <div style={{
          marginBottom: 16,
          padding: '8px 12px',
          background: '#f6ffed',
          border: '1px solid #b7eb8f',
          textAlign: 'center',
          gridColumn: 'span 24',
        }}>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
            💡 快捷键：Ctrl+Enter 保存 • Esc 关闭
          </Typography.Text>
        </div>

        {/* 基本信息 */}
        <ProFormText
          name="code"
          label={<Typography.Text strong>工艺路线编码</Typography.Text>}
          placeholder="请输入工艺路线编码"
          colProps={{ span: 12 }}
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
          label={<Typography.Text strong>工艺路线名称</Typography.Text>}
          placeholder="请输入工艺路线名称"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入工艺路线名称' },
            { max: 200, message: '工艺路线名称不能超过200个字符' },
          ]}
        />

        {/* 工序序列配置 */}
        <div style={{ marginTop: 24, marginBottom: 24, gridColumn: 'span 24' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Typography.Text strong style={{ fontSize: '16px' }}>
              工序序列配置
            </Typography.Text>
            <Space>
              <Tag color={operationSequence.length > 0 ? 'processing' : 'default'} size="small">
                {operationSequence.length} 个工序
              </Tag>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                支持拖拽排序，点击删除移除工序
              </Typography.Text>
            </Space>
          </div>
          <OperationSequenceEditor
            value={operationSequence}
            onChange={setOperationSequence}
          />
        </div>

        {/* 描述 */}
        <ProFormTextArea
          name="description"
          label={<Typography.Text strong>描述</Typography.Text>}
          placeholder="请输入工艺路线的详细描述（可选）"
          colProps={{ span: 24 }}
          fieldProps={{
            rows: 3,
            maxLength: 500,
            showCount: true,
          }}
        />

        {/* 启用状态 */}
        <ProFormSwitch
          name="is_active"
          label={
            <Space direction="vertical" size={4}>
              <Typography.Text strong>是否启用</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                禁用后该工艺路线将不可用
              </Typography.Text>
            </Space>
          }
          checkedChildren="启用"
          unCheckedChildren="禁用"
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ProcessRoutesPage;

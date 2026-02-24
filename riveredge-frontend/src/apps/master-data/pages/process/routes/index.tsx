/**
 * 工艺路线管理页面
 * 
 * 提供工艺路线的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, List, Typography, Divider, Spin, Select } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, BranchesOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { RouteFormModal } from '../../../components/RouteFormModal';
import { processRouteApi } from '../../../services/process';
import { materialApi, materialGroupApi } from '../../../services/material';
import type { ProcessRoute } from '../../../types/process';
import type { Material, MaterialGroup } from '../../../types/material';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';

/**
 * 工艺路线管理列表页面组件
 */
const ProcessRoutesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [processRouteDetail, setProcessRouteDetail] = useState<ProcessRoute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [currentBindProcessRouteUuid, setCurrentBindProcessRouteUuid] = useState<string | null>(null);
  const [boundMaterials, setBoundMaterials] = useState<{
    materials: Array<{ uuid: string; code: string; name: string }>;
    material_groups: Array<{ uuid: string; code: string; name: string }>;
  }>({ materials: [], material_groups: [] });
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [allMaterialGroups, setAllMaterialGroups] = useState<MaterialGroup[]>([]);
  const [bindLoading, setBindLoading] = useState(false);

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

  const handleEdit = (record: ProcessRoute) => {
    setEditUuid(record.uuid);
    setModalVisible(true);
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditUuid(null);
    actionRef.current?.reload();
  };

  /**
   * 处理删除工艺路线
   */
  const handleDelete = async (record: ProcessRoute) => {
    try {
      await processRouteApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除工艺路线
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
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
              errors.push(error.message || t('common.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
          }
          if (failCount > 0) {
            messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
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
      messageApi.error(error.message || t('app.master-data.routes.loadBindFailed'));
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
      messageApi.success(t('app.master-data.routes.bindSuccess'));
      // 重新加载绑定信息
      const bound = await processRouteApi.getBoundMaterials(currentBindProcessRouteUuid);
      setBoundMaterials(bound);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.routes.bindFailed'));
    }
  };

  /**
   * 处理解绑物料分组
   */
  const handleUnbindMaterialGroup = async (materialGroupUuid: string) => {
    if (!currentBindProcessRouteUuid) return;
    
    try {
      await processRouteApi.unbindMaterialGroup(currentBindProcessRouteUuid, materialGroupUuid);
      messageApi.success(t('app.master-data.routes.unbindSuccess'));
      // 重新加载绑定信息
      const bound = await processRouteApi.getBoundMaterials(currentBindProcessRouteUuid);
      setBoundMaterials(bound);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.routes.unbindFailed'));
    }
  };

  /**
   * 处理绑定物料
   */
  const handleBindMaterial = async (materialUuid: string) => {
    if (!currentBindProcessRouteUuid) return;
    
    try {
      await processRouteApi.bindMaterial(currentBindProcessRouteUuid, materialUuid);
      messageApi.success(t('app.master-data.routes.bindSuccess'));
      // 重新加载绑定信息
      const bound = await processRouteApi.getBoundMaterials(currentBindProcessRouteUuid);
      setBoundMaterials(bound);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.routes.bindFailed'));
    }
  };

  /**
   * 处理解绑物料
   */
  const handleUnbindMaterial = async (materialUuid: string) => {
    if (!currentBindProcessRouteUuid) return;
    
    try {
      await processRouteApi.unbindMaterial(currentBindProcessRouteUuid, materialUuid);
      messageApi.success(t('app.master-data.routes.unbindSuccess'));
      // 重新加载绑定信息
      const bound = await processRouteApi.getBoundMaterials(currentBindProcessRouteUuid);
      setBoundMaterials(bound);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.routes.unbindFailed'));
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ProcessRoute) => {
    try {
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await processRouteApi.get(record.uuid);
      setProcessRouteDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.routes.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setProcessRouteDetail(null);
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
      render: (_, record) => {
        const isActive = record?.is_active ?? (record as any)?.isActive;
        return (
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? '启用' : '禁用'}
          </Tag>
        );
      },
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
            onClick={() => handleOpenBindModal(record)}
          >
            绑定物料
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
        request={async (params, _sort, _filter, searchFormValues) => {
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
            render: (_, record) => {
              const isActive = record?.is_active ?? (record as any)?.isActive;
              return (
                <Tag color={isActive ? 'success' : 'default'}>
                  {isActive ? '启用' : '禁用'}
                </Tag>
              );
            },
          },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
          {
            title: '工序序列',
            span: 2,
            render: (_, record) => {
              const seq = record?.operation_sequence ?? (record as any)?.operationSequence;
              if (!seq) {
                return <span style={{ color: '#999' }}>暂无工序</span>;
              }

              try {
                let operations: any[] = [];

                // 解析工序序列数据
                if (Array.isArray(seq)) {
                  operations = seq;
                } else if (typeof seq === 'object' && seq !== null) {
                  // 优先使用 operations 数组（包含完整信息）
                  const seqObj = seq as Record<string, any>;
                  if (seqObj.operations && Array.isArray(seqObj.operations)) {
                    operations = seqObj.operations;
                  } else if (seqObj.sequence && Array.isArray(seqObj.sequence)) {
                    operations = seqObj.sequence.map((uuid: string) => ({
                      uuid,
                      code: uuid.substring(0, 8),
                      name: '工序',
                    }));
                  } else {
                    // 尝试直接使用对象的值
                    const entries = Object.entries(seqObj);
                    for (const [key, value] of entries) {
                      if (Array.isArray(value)) {
                        operations = value;
                        break;
                      }
                    }

                    // 如果还没找到，尝试将所有值合并
                    if (operations.length === 0) {
                      const allValues = Object.values(seqObj).filter(v => v != null);
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
                console.error('解析工序序列失败:', error, seq);
                return <span style={{ color: '#ff4d4f' }}>工序数据解析失败: {error.message}</span>;
              }
            },
          },
        ]}
      />

      <RouteFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={handleModalSuccess}
      />

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

    </ListPageTemplate>
  );
};

export default ProcessRoutesPage;

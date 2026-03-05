/**
 * 标准操作SOP管理页面
 * 
 * 提供标准操作SOP的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Tabs, Modal, Collapse, Row, Col, Dropdown, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ApartmentOutlined, FormOutlined, DownOutlined } from '@ant-design/icons';
import SOPBatchCreateSteps from './SOPBatchCreateSteps';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { sopApi, operationApi, processRouteApi } from '../../../services/process';
import { materialApi, materialGroupApi } from '../../../services/material';
import type { SOP, SOPCreate, SOPUpdate, Operation } from '../../../types/process';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import FormSchemaEditor from './FormSchemaEditor';
import type { ISchema } from '@formily/core';

/**
 * 标准操作SOP管理列表页面组件
 */
const SOPPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSOPUuid, setCurrentSOPUuid] = useState<string | null>(null);
  const [sopDetail, setSopDetail] = useState<SOP | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑SOP）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formConfig, setFormConfig] = useState<ISchema | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('basic');

  // 新建 Modal 状态（仅批量创建时使用）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  
  // 工序列表（用于下拉选择）
  const [operations, setOperations] = useState<Operation[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);
  // 物料组/物料/工艺路线（绑定与载入用）
  const [materialGroups, setMaterialGroups] = useState<{ uuid: string; code: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<{ uuid: string; code: string; name: string }[]>([]);
  const [routes, setRoutes] = useState<{ uuid: string; code: string; name: string }[]>([]);

  /**
   * 从 URL 参数打开编辑弹窗（支持 editUuid + tab=formConfig）或新建弹窗（create=1）
   */
  useEffect(() => {
    const editUuid = searchParams.get('editUuid');
    const tab = searchParams.get('tab');
    const create = searchParams.get('create');
    if (editUuid) {
      const tabMap: Record<string, 'basic' | 'workflow' | 'formConfig' | 'scope'> = {
        basic: 'basic', formConfig: 'formConfig', workflow: 'workflow', scope: 'scope',
      };
      const initialTab = tab && tabMap[tab] ? tabMap[tab] : undefined;
      handleEdit({ uuid: editUuid } as SOP, initialTab).then(() => {
        setSearchParams({}, { replace: true });
      });
    } else if (create === '1') {
      setIsEdit(false);
      setCurrentSOPUuid(null);
      formRef.current?.resetFields();
      setFormConfig(undefined);
      setActiveTab('basic');
      setModalVisible(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams.get('editUuid'), searchParams.get('create')]);

  /**
   * 加载工序、物料组、物料、工艺路线列表
   */
  useEffect(() => {
    const load = async () => {
      try {
        setOperationsLoading(true);
        const [opRes, mgRes, matRes, routeRes] = await Promise.all([
          operationApi.list({ limit: 1000, isActive: true }),
          materialGroupApi.list({ limit: 1000 }).catch(() => []),
          materialApi.list({ limit: 2000, isActive: true }).catch(() => []),
          processRouteApi.list({ limit: 500, is_active: true }).catch(() => []),
        ]);
        setOperations(opRes);
        setMaterialGroups(Array.isArray(mgRes) ? mgRes : []);
        setMaterials(Array.isArray(matRes) ? matRes : []);
        setRoutes(Array.isArray(routeRes) ? routeRes : []);
      } catch (e) {
        console.error('加载基础数据失败:', e);
      } finally {
        setOperationsLoading(false);
      }
    };
    load();
  }, []);

  /**
   * 处理关闭新建 Modal
   */
  const handleCloseCreateModal = () => {
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  /**
   * 批量创建完成后，关闭新建 Modal 并打开编辑（可选）
   */
  const handleBatchCreateSuccess = () => {
    handleCloseCreateModal();
  };

  /**
   * 批量创建中点击某条 SOP 的编辑，关闭新建 Modal 并打开编辑 Modal
   */
  const handleBatchCreateEditSop = async (uuid: string, tab?: 'formConfig') => {
    handleCloseCreateModal();
    await handleEdit({ uuid } as SOP, tab);
  };

  /**
   * 处理编辑SOP
   * @param record SOP 记录
   * @param initialTab 初始激活的 Tab（'basic' | 'workflow' | 'formConfig' | 'scope'）
   */
  const handleEdit = async (record: SOP, initialTab?: 'basic' | 'workflow' | 'formConfig' | 'scope') => {
    try {
      setIsEdit(true);
      setCurrentSOPUuid(record.uuid);
      setModalVisible(true);
      
      // 获取SOP详情
      const detail = await sopApi.get(record.uuid);
      const d = detail as any;
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        operationId: detail.operationId,
        version: detail.version,
        content: detail.content,
        isActive: detail.isActive ?? (detail as any).is_active ?? true,
        material_group_uuids: d.material_group_uuids ?? d.materialGroupUuids ?? undefined,
        material_uuids: d.material_uuids ?? d.materialUuids ?? undefined,
        route_uuids: d.route_uuids ?? d.routeUuids ?? undefined,
        bom_load_mode: d.bom_load_mode ?? d.bomLoadMode ?? 'by_material',
        specific_bom_uuid: d.specific_bom_uuid ?? d.specificBomUuid ?? undefined,
      });
      // 加载报工数据采集项（form_config）
      setFormConfig(detail.formConfig || (d as any).form_config || undefined);
      setActiveTab(initialTab ?? 'basic');
      // 注意：attachments 是 JSON 字段，这里暂时不处理，后续可以扩展为文件上传组件
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.sop.getDetailFailed'));
    }
  };

  /**
   * 处理删除SOP
   */
  const handleDelete = async (record: SOP) => {
    try {
      await sopApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除SOP
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
              await sopApi.delete(key.toString());
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
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SOP) => {
    try {
      setCurrentSOPUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await sopApi.get(record.uuid);
      setSopDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.sop.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentSOPUuid(null);
    setSopDetail(null);
  };

  /**
   * 处理提交表单（创建/更新SOP）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      // 合并 form_config 与绑定/载入字段，按后端字段名提交
      const payload: Record<string, unknown> = {
        ...values,
        formConfig: formConfig || null,
        material_group_uuids: values.material_group_uuids ?? values.materialGroupUuids ?? null,
        material_uuids: values.material_uuids ?? values.materialUuids ?? null,
        route_uuids: values.route_uuids ?? values.routeUuids ?? null,
        bom_load_mode: values.bom_load_mode ?? values.bomLoadMode ?? 'by_material',
        specific_bom_uuid: values.specific_bom_uuid ?? values.specificBomUuid ?? null,
      };
      
      if (isEdit && currentSOPUuid) {
        // 更新SOP
        await sopApi.update(currentSOPUuid, payload as SOPUpdate);
        messageApi.success(t('common.updateSuccess'));
      } else {
        // 创建SOP
        await sopApi.create(payload as SOPCreate);
        messageApi.success(t('common.createSuccess'));
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
      setFormConfig(undefined);
      setActiveTab('basic');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal（编辑/单个新建）
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setIsEdit(false);
    setCurrentSOPUuid(null);
    formRef.current?.resetFields();
    setFormConfig(undefined);
    setActiveTab('basic');
  };

  /**
   * 选择单个新建：关闭新建 Modal，打开编辑 Modal 用于创建
   */
  const handleSelectSingleCreate = () => {
    setCreateModalVisible(false);
    setIsEdit(false);
    setCurrentSOPUuid(null);
    formRef.current?.resetFields();
    setFormConfig(undefined);
    setActiveTab('basic');
    setModalVisible(true);
  };

  /**
   * 获取工序名称
   */
  const getOperationName = (operationId?: number): string => {
    if (!operationId) return '-';
    const operation = operations.find(o => o.id === operationId);
    return operation ? `${operation.code} - ${operation.name}` : `工序ID: ${operationId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<SOP>[] = [
    {
      title: 'SOP编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: 'SOP名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '关联工序',
      dataIndex: 'operationId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getOperationName(record.operationId),
    },
    {
      title: '绑定/载入',
      dataIndex: '_binding',
      width: 140,
      hideInSearch: true,
      render: (_, record: any) => {
        const ma = record.material_uuids ?? record.materialUuids ?? [];
        const mg = record.material_group_uuids ?? record.materialGroupUuids ?? [];
        const rt = record.route_uuids ?? record.routeUuids ?? [];
        const parts = [];
        if (ma?.length) parts.push(`物料×${ma.length}`);
        if (mg?.length) parts.push(`物料组×${mg.length}`);
        if (rt?.length) parts.push(`路线×${rt.length}`);
        return parts.length ? parts.join(' ') : '-';
      },
    },
    {
      title: '按物料',
      dataIndex: 'material_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: '筛选绑定该物料的SOP',
        options: materials.map((m: any) => ({ label: `${m.mainCode ?? m.code ?? ''} - ${m.name ?? ''}`, value: m.uuid })),
        showSearch: true,
      },
    },
    {
      title: '按物料组',
      dataIndex: 'material_group_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: '筛选绑定该物料组的SOP',
        options: materialGroups.map((g: any) => ({ label: `${g.code ?? ''} - ${g.name ?? ''}`, value: g.uuid })),
        showSearch: true,
      },
    },
    {
      title: '按工艺路线',
      dataIndex: 'route_uuid',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        placeholder: '筛选载入该工艺路线的SOP',
        options: routes.map((r: any) => ({ label: `${r.code ?? ''} - ${r.name ?? ''}`, value: r.uuid })),
        showSearch: true,
      },
    },
    {
      title: '版本号',
      dataIndex: 'version',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.content ? `${record.content.substring(0, 50)}...` : '-',
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => {
        const isActive = record?.isActive ?? (record as any)?.is_active;
        return (
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? '启用' : '禁用'}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleOpenDetail(record)}>
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
            title="确定要删除这个SOP吗？"
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
      <UniTable<SOP>
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
            apiParams.isActive = searchFormValues.isActive;
          }
          
          // 工序筛选
          if (searchFormValues?.operationId !== undefined && searchFormValues.operationId !== '' && searchFormValues.operationId !== null) {
            apiParams.operationId = searchFormValues.operationId;
          }
          // 绑定/载入筛选（标准操作SOP 阶段一）
          if (searchFormValues?.material_uuid) apiParams.material_uuid = searchFormValues.material_uuid;
          if (searchFormValues?.material_group_uuid) apiParams.material_group_uuid = searchFormValues.material_group_uuid;
          if (searchFormValues?.route_uuid) apiParams.route_uuid = searchFormValues.route_uuid;

          try {
            const result = await sopApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取SOP列表失败:', error);
            messageApi.error(error?.message || '获取SOP列表失败');
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
          <Button.Group key="create">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleSelectSingleCreate}>
              新建SOP
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'batch',
                    label: '按工艺路线批量创建',
                  onClick: () => setCreateModalVisible(true),
                  },
                ],
              }}
            >
              <Button type="primary" icon={<DownOutlined />} />
            </Dropdown>
          </Button.Group>,
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

      <DetailDrawerTemplate<SOP>
        title="SOP详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={sopDetail || undefined}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        columns={[
          { title: 'SOP编码', dataIndex: 'code' },
          { title: 'SOP名称', dataIndex: 'name' },
          { title: '关联工序', dataIndex: 'operationId', render: (_, record) => getOperationName(record?.operationId ?? (record as any)?.operation_id) },
          { title: '版本号', dataIndex: 'version' },
          { title: 'SOP内容', dataIndex: 'content', span: 2 },
          {
            title: '启用状态',
            dataIndex: 'isActive',
            render: (_, record) => {
              const isActive = record?.isActive ?? (record as any)?.is_active;
              return (
                <Tag color={isActive ? 'success' : 'default'}>
                  {isActive ? '启用' : '禁用'}
                </Tag>
              );
            },
          },
          { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
        ]}
      />

      {/* 新建 SOP Modal：按工艺路线批量创建 */}
      <Modal
        className="modal-no-limit-height"
        title="按工艺路线批量创建 SOP"
        open={createModalVisible}
        onCancel={handleCloseCreateModal}
        footer={null}
        width={900}
        destroyOnClose
      >
        <SOPBatchCreateSteps
          onSuccess={handleBatchCreateSuccess}
          onCancel={handleCloseCreateModal}
          onEditSop={handleBatchCreateEditSop}
        />
      </Modal>

      <FormModalTemplate
        title={isEdit ? '编辑SOP' : '新建SOP'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={960}
        grid={false}
        formRef={formRef}
        initialValues={{ isActive: true }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <div style={{ padding: '16px 0', minWidth: 0 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={12} style={{ minWidth: 0 }}>
                      <ProFormText
                        name="code"
                        label="SOP编码"
                        placeholder="请输入SOP编码"
                        rules={[
                          { required: true, message: '请输入SOP编码' },
                          { max: 50, message: 'SOP编码不能超过50个字符' },
                        ]}
                        fieldProps={{ style: { textTransform: 'uppercase' } }}
                      />
                    </Col>
                    <Col span={12} style={{ minWidth: 0 }}>
                      <ProFormText
                        name="name"
                        label="SOP名称"
                        placeholder="请输入SOP名称"
                        rules={[
                          { required: true, message: '请输入SOP名称' },
                          { max: 200, message: 'SOP名称不能超过200个字符' },
                        ]}
                      />
                    </Col>
                    <Col span={12} style={{ minWidth: 0 }}>
                      <SafeProFormSelect
                        name="operationId"
                        label="关联工序"
                        placeholder="请选择关联工序（可选）"
                        options={operations.map(o => ({ label: `${o.code} - ${o.name}`, value: o.id }))}
                        fieldProps={{
                          loading: operationsLoading,
                          showSearch: true,
                          allowClear: true,
                          filterOption: (input: string, option: { label?: React.ReactNode }) =>
                            (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase()),
                        }}
                      />
                    </Col>
                    <Col span={12} style={{ minWidth: 0 }}>
                      <ProFormText
                        name="version"
                        label="版本号"
                        placeholder="请输入版本号（如：v1.0）"
                        rules={[{ max: 20, message: '版本号不能超过20个字符' }]}
                      />
                    </Col>
                    <Col span={12} style={{ minWidth: 0 }}>
                      <ProFormSwitch name="isActive" label="是否启用" />
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'workflow',
              label: (
                <span>
                  <ApartmentOutlined /> 作业指导
                </span>
              ),
              children: (
                <div style={{ padding: '16px 0', minWidth: 0 }}>
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<ApartmentOutlined />}
                      onClick={() => currentSOPUuid && navigate(`/apps/master-data/process/sop/designer?uuid=${currentSOPUuid}&from=edit`)}
                      disabled={!currentSOPUuid}
                    >
                      打开流程设计器
                    </Button>
                    <span style={{ marginLeft: 12, fontSize: 12, color: '#8c8c8c' }}>
                      流程定义步骤顺序，下方文字用于补充注意事项
                    </span>
                  </div>
                  <ProFormTextArea
                    name="content"
                    label="文字说明 / 注意事项"
                    placeholder="补充说明、注意事项、易错点等（流程步骤在流程设计器中配置）"
                    colProps={{ span: 24 }}
                    fieldProps={{ rows: 5, maxLength: 5000 }}
                  />
                </div>
              ),
            },
            {
              key: 'formConfig',
              label: (
                <span>
                  <FormOutlined /> 报工采集配置
                </span>
              ),
              children: (
                <div style={{ padding: '16px 0', minWidth: 0 }}>
                  <Tooltip title="配置报工需收集的数据项，开工单以 SOP 为依据时按此处配置渲染表单。支持数字、选择、文本、日期时间等类型。">
                    <div style={{ marginBottom: 12, fontSize: 12, color: '#8c8c8c' }}>
                      配置报工数据采集项，支持数字、选择、文本、日期时间及必填校验
                    </div>
                  </Tooltip>
                  <FormSchemaEditor
                    value={formConfig}
                    onChange={(schema) => setFormConfig(schema)}
                  />
                </div>
              ),
            },
            {
              key: 'scope',
              label: '适用范围',
              children: (
                <div style={{ padding: '16px 0', minWidth: 0 }}>
                  <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f', fontSize: 12, color: '#389e0d' }}>
                    物料绑定用于区分不同产品的 SOP；未绑定时按工序匹配。
                  </div>
                  <Row gutter={[16, 16]}>
                    <Col span={12} style={{ minWidth: 0 }}>
                      <SafeProFormSelect
                        name="material_group_uuids"
                        label="绑定物料组"
                        placeholder="请选择物料组（可选，可多选）"
                        mode="multiple"
                        options={materialGroups.map(g => ({ label: `${g.code} - ${g.name}`, value: g.uuid }))}
                        fieldProps={{ showSearch: true, filterOption: (i: string, o: any) => (o?.label ?? '').toLowerCase().includes((i || '').toLowerCase()) }}
                      />
                    </Col>
                    <Col span={12} style={{ minWidth: 0 }}>
                      <SafeProFormSelect
                        name="material_uuids"
                        label="绑定物料"
                        placeholder="请选择物料（可选，可多选；优先于物料组）"
                        mode="multiple"
                        options={materials.map(m => ({ label: `${(m as any).mainCode ?? (m as any).code ?? ''} - ${(m as any).name}`, value: m.uuid }))}
                        fieldProps={{ showSearch: true, filterOption: (i: string, o: any) => (o?.label ?? '').toLowerCase().includes((i || '').toLowerCase()) }}
                      />
                    </Col>
                  </Row>
                  <Collapse
                    ghost
                    style={{ marginTop: 16 }}
                    items={[
                      {
                        key: 'advanced',
                        label: '高级配置（预留）',
                        children: (
                          <div style={{ padding: '8px 0' }}>
                            <div style={{ marginBottom: 12, fontSize: 12, color: '#8c8c8c' }}>
                              当前版本仅作记录，融合逻辑后续实现。
                            </div>
                            <Row gutter={[16, 16]}>
                              <Col span={24} style={{ minWidth: 0 }}>
                                <SafeProFormSelect
                                  name="route_uuids"
                                  label="载入工艺路线"
                                  placeholder="请选择工艺路线（可选，可多选）"
                                  mode="multiple"
                                  options={routes.map(r => ({ label: `${(r as any).code ?? r.code} - ${(r as any).name ?? r.name}`, value: r.uuid }))}
                                  fieldProps={{ showSearch: true, filterOption: (i: string, o: any) => (o?.label ?? '').toLowerCase().includes((i || '').toLowerCase()) }}
                                />
                              </Col>
                              <Col span={12} style={{ minWidth: 0 }}>
                                <SafeProFormSelect
                                  name="bom_load_mode"
                                  label="BOM 载入方式"
                                  placeholder="按关联物料"
                                  options={[
                                    { label: '按关联物料', value: 'by_material' },
                                    { label: '按关联物料组', value: 'by_material_group' },
                                    { label: '指定 BOM', value: 'specific_bom' },
                                  ]}
                                />
                              </Col>
                              <Col span={12} style={{ minWidth: 0 }}>
                                <ProFormText
                                  name="specific_bom_uuid"
                                  label="指定 BOM UUID"
                                  placeholder="当 BOM 载入方式为「指定 BOM」时填写"
                                />
                              </Col>
                            </Row>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SOPPage;

/**
 * BOM（物料清单）管理页面
 * 
 * 提供BOM的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormInstance, ProDescriptionsItemType, ProFormList, ProFormDateTimePicker } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, Input } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined, CopyOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { bomApi, materialApi } from '../../../services/material';
import type { BOM, BOMCreate, BOMUpdate, Material, BOMBatchCreate, BOMItemCreate } from '../../../types/material';

/**
 * BOM管理列表页面组件
 */
const BOMPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentBOMUuid, setCurrentBOMUuid] = useState<string | null>(null);
  const [bomDetail, setBomDetail] = useState<BOM | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑BOM）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 审核Modal状态
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalBomUuid, setApprovalBomUuid] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  
  // 物料列表（用于下拉选择）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  /**
   * 加载物料列表
   */
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
      } finally {
        setMaterialsLoading(false);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 处理新建BOM
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentBOMUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      isAlternative: false,
      priority: 0,
    });
  };

  /**
   * 处理编辑BOM
   */
  const handleEdit = async (record: BOM) => {
    try {
      setIsEdit(true);
      setCurrentBOMUuid(record.uuid);
      setModalVisible(true);
      
      // 获取BOM详情
      const detail = await bomApi.get(record.uuid);
      // 编辑时使用单个BOM项格式
      formRef.current?.setFieldsValue({
        materialId: detail.materialId,
        version: detail.version,
        bomCode: detail.bomCode,
        effectiveDate: detail.effectiveDate,
        expiryDate: detail.expiryDate,
        approvalStatus: detail.approvalStatus,
        items: [{
          componentId: detail.componentId,
          quantity: detail.quantity,
          unit: detail.unit,
          isAlternative: detail.isAlternative,
          alternativeGroupId: detail.alternativeGroupId,
          priority: detail.priority,
          description: detail.description,
          remark: detail.remark,
        }],
        description: detail.description,
        remark: detail.remark,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取BOM详情失败');
    }
  };
  
  /**
   * 处理复制BOM
   */
  const handleCopy = async (record: BOM) => {
    try {
      const newBom = await bomApi.copy(record.uuid);
      messageApi.success('BOM复制成功，已创建新版本');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '复制BOM失败');
    }
  };
  
  /**
   * 处理打开审核Modal
   */
  const handleOpenApproval = (record: BOM) => {
    setApprovalBomUuid(record.uuid);
    setApprovalComment('');
    setApprovalModalVisible(true);
  };
  
  /**
   * 处理审核BOM
   */
  const handleApprove = async (approved: boolean) => {
    if (!approvalBomUuid) return;
    
    try {
      setApprovalLoading(true);
      await bomApi.approve(approvalBomUuid, approved, approvalComment || undefined);
      messageApi.success(approved ? 'BOM审核通过' : 'BOM审核已拒绝');
      setApprovalModalVisible(false);
      setApprovalComment('');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '审核失败');
    } finally {
      setApprovalLoading(false);
    }
  };
  
  /**
   * 获取审核状态标签
   */
  const getApprovalStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      draft: { color: 'default', text: '草稿', icon: <ClockCircleOutlined /> },
      pending: { color: 'processing', text: '待审核', icon: <ClockCircleOutlined /> },
      approved: { color: 'success', text: '已审核', icon: <CheckCircleOutlined /> },
      rejected: { color: 'error', text: '已拒绝', icon: <CloseCircleOutlined /> },
    };
    
    const statusInfo = statusMap[status] || statusMap.draft;
    return (
      <Tag color={statusInfo.color} icon={statusInfo.icon}>
        {statusInfo.text}
      </Tag>
    );
  };

  /**
   * 处理删除BOM
   */
  const handleDelete = async (record: BOM) => {
    try {
      await bomApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: BOM) => {
    try {
      setCurrentBOMUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await bomApi.get(record.uuid);
      setBomDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取BOM详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentBOMUuid(null);
    setBomDetail(null);
  };

  /**
   * 处理提交表单（创建/更新BOM）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentBOMUuid) {
        // 更新BOM（单个）- 从items中取第一个
        if (!values.items || values.items.length === 0) {
          messageApi.error('请至少添加一个子物料');
          return;
        }
        
        const firstItem = values.items[0];
        const updateData: BOMUpdate = {
          materialId: values.materialId,
          componentId: firstItem.componentId,
          quantity: firstItem.quantity,
          unit: firstItem.unit,
          version: values.version,
          bomCode: values.bomCode,
          effectiveDate: values.effectiveDate,
          expiryDate: values.expiryDate,
          approvalStatus: values.approvalStatus,
          isAlternative: firstItem.isAlternative,
          alternativeGroupId: firstItem.alternativeGroupId,
          priority: firstItem.priority,
          description: values.description || firstItem.description,
          remark: values.remark || firstItem.remark,
          isActive: values.isActive,
        };
        
        await bomApi.update(currentBOMUuid, updateData);
        messageApi.success('更新成功');
      } else {
        // 批量创建BOM
        if (!values.materialId) {
          messageApi.error('请选择主物料');
          return;
        }
        
        if (!values.items || values.items.length === 0) {
          messageApi.error('请至少添加一个子物料');
          return;
        }
        
        const batchData: BOMBatchCreate = {
          materialId: values.materialId,
          items: values.items.map((item: any) => ({
            componentId: item.componentId,
            quantity: item.quantity,
            unit: item.unit,
            isAlternative: item.isAlternative || false,
            alternativeGroupId: item.alternativeGroupId,
            priority: item.priority || 0,
            description: item.description,
            remark: item.remark,
          })),
          version: values.version || '1.0',
          bomCode: values.bomCode,
          effectiveDate: values.effectiveDate,
          expiryDate: values.expiryDate,
          approvalStatus: values.approvalStatus || 'draft',
          description: values.description,
          remark: values.remark,
          isActive: values.isActive !== false,
        };
        
        await bomApi.create(batchData);
        messageApi.success(`成功创建 ${batchData.items.length} 个BOM项`);
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    formRef.current?.resetFields();
  };

  /**
   * 获取物料名称
   */
  const getMaterialName = (materialId: number): string => {
    const material = materials.find(m => m.id === materialId);
    return material ? `${material.code} - ${material.name}` : `物料ID: ${materialId}`;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<BOM>[] = [
    {
      title: 'BOM编码',
      dataIndex: 'bomCode',
      width: 150,
      hideInSearch: true,
      render: (_, record) => record.bomCode || '-',
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
      hideInSearch: true,
      render: (_, record) => <Tag>{record.version}</Tag>,
    },
    {
      title: '审核状态',
      dataIndex: 'approvalStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        draft: { text: '草稿', status: 'Default' },
        pending: { text: '待审核', status: 'Processing' },
        approved: { text: '已审核', status: 'Success' },
        rejected: { text: '已拒绝', status: 'Error' },
      },
      render: (_, record) => getApprovalStatusTag(record.approvalStatus),
    },
    {
      title: '主物料',
      dataIndex: 'materialId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getMaterialName(record.materialId),
    },
    {
      title: '子物料',
      dataIndex: 'componentId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getMaterialName(record.componentId),
    },
    {
      title: '用量',
      dataIndex: 'quantity',
      width: 100,
      hideInSearch: true,
      render: (_, record) => `${record.quantity} ${record.unit}`,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '替代料',
      dataIndex: 'isAlternative',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Warning' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.isAlternative ? 'orange' : 'default'}>
          {record.isAlternative ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
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
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
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
      width: 250,
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
            icon={<CopyOutlined />}
            onClick={() => handleCopy(record)}
          >
            复制
          </Button>
          {record.approvalStatus !== 'approved' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleOpenApproval(record)}
            >
              审核
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个BOM项吗？"
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

  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemType<BOM>[] = [
    {
      title: 'BOM编码',
      dataIndex: 'bomCode',
      render: (_, record) => record.bomCode || '-',
    },
    {
      title: '版本',
      dataIndex: 'version',
      render: (_, record) => <Tag>{record.version}</Tag>,
    },
    {
      title: '审核状态',
      dataIndex: 'approvalStatus',
      render: (_, record) => getApprovalStatusTag(record.approvalStatus),
    },
    {
      title: '主物料',
      dataIndex: 'materialId',
      render: (_, record) => getMaterialName(record.materialId),
    },
    {
      title: '子物料',
      dataIndex: 'componentId',
      render: (_, record) => getMaterialName(record.componentId),
    },
    {
      title: '用量',
      dataIndex: 'quantity',
    },
    {
      title: '单位',
      dataIndex: 'unit',
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      valueType: 'dateTime',
      render: (_, record) => record.effectiveDate || '-',
    },
    {
      title: '失效日期',
      dataIndex: 'expiryDate',
      valueType: 'dateTime',
      render: (_, record) => record.expiryDate || '-',
    },
    {
      title: '替代料',
      dataIndex: 'isAlternative',
      render: (_, record) => (
        <Tag color={record.isAlternative ? 'orange' : 'default'}>
          {record.isAlternative ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
    },
    {
      title: '描述',
      dataIndex: 'description',
      span: 2,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      span: 2,
    },
    {
      title: '审核人',
      dataIndex: 'approvedBy',
      render: (_, record) => record.approvedBy ? `用户ID: ${record.approvedBy}` : '-',
    },
    {
      title: '审核时间',
      dataIndex: 'approvedAt',
      valueType: 'dateTime',
      render: (_, record) => record.approvedAt || '-',
    },
    {
      title: '审核意见',
      dataIndex: 'approvalComment',
      span: 2,
      render: (_, record) => record.approvalComment || '-',
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<BOM>
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
          
          // 替代料筛选
          if (searchFormValues?.isAlternative !== undefined && searchFormValues.isAlternative !== '' && searchFormValues.isAlternative !== null) {
            apiParams.isAlternative = searchFormValues.isAlternative;
          }
          
          // 审核状态筛选
          if (searchFormValues?.approvalStatus !== undefined && searchFormValues.approvalStatus !== '' && searchFormValues.approvalStatus !== null) {
            apiParams.approvalStatus = searchFormValues.approvalStatus;
          }
          
          // 主物料筛选
          if (searchFormValues?.materialId !== undefined && searchFormValues.materialId !== '' && searchFormValues.materialId !== null) {
            apiParams.materialId = searchFormValues.materialId;
          }
          
          try {
            const result = await bomApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取BOM列表失败:', error);
            messageApi.error(error?.message || '获取BOM列表失败');
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
            新建BOM
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<BOM>
        title="BOM详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={bomDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
      />

      {/* 创建/编辑BOM Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑BOM' : '新建BOM（支持批量添加子物料）'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={{
          isActive: true,
          version: '1.0',
          approvalStatus: 'draft',
          items: [{ isAlternative: false, priority: 0 }],
        }}
      >
          <SafeProFormSelect
            name="materialId"
            label="主物料"
            placeholder="请选择主物料"
            colProps={{ span: 12 }}
            options={materials.map(m => ({
              label: `${m.code} - ${m.name}`,
              value: m.id,
            }))}
            rules={[
              { required: true, message: '请选择主物料' },
            ]}
            fieldProps={{
              loading: materialsLoading,
              showSearch: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
            }}
          />
          <ProFormText
            name="bomCode"
            label="BOM编码"
            placeholder="留空则自动生成"
            colProps={{ span: 12 }}
            fieldProps={{
              maxLength: 100,
            }}
          />
          <ProFormText
            name="version"
            label="版本号"
            placeholder="请输入版本号"
            colProps={{ span: 6 }}
            rules={[
              { required: true, message: '请输入版本号' },
              { max: 50, message: '版本号不能超过50个字符' },
            ]}
            initialValue="1.0"
          />
          <ProFormSelect
            name="approvalStatus"
            label="审核状态"
            colProps={{ span: 6 }}
            options={[
              { label: '草稿', value: 'draft' },
              { label: '待审核', value: 'pending' },
              { label: '已审核', value: 'approved' },
              { label: '已拒绝', value: 'rejected' },
            ]}
            initialValue="draft"
          />
          <ProFormDateTimePicker
            name="effectiveDate"
            label="生效日期"
            colProps={{ span: 6 }}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          <ProFormDateTimePicker
            name="expiryDate"
            label="失效日期"
            colProps={{ span: 6 }}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          <ProFormTextArea
            name="description"
            label="BOM描述"
            placeholder="请输入BOM描述（可选）"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 2,
              maxLength: 500,
            }}
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注（可选）"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 2,
              maxLength: 500,
            }}
          />
          
          <ProFormList
            name="items"
            label="子物料列表"
            min={1}
            copyIconProps={false}
            deleteIconProps={{
              Icon: MinusCircleOutlined,
            }}
            creatorButtonProps={{
              creatorButtonText: '添加子物料',
              icon: <PlusOutlined />,
              type: 'dashed',
              style: { width: '100%' },
            }}
            itemRender={({ listDom, action }, { index }) => (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  marginBottom: 16,
                  padding: 16,
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  backgroundColor: '#fafafa',
                }}
              >
                <div style={{ flex: 1 }}>{listDom}</div>
                <div style={{ marginLeft: 8 }}>{action}</div>
              </div>
            )}
            rules={[
              { required: true, message: '请至少添加一个子物料' },
            ]}
          >
            {(f, index, action) => {
              return (
                <div style={{ width: '100%' }}>
                  <SafeProFormSelect
                    {...f}
                    name={[f.name, 'componentId']}
                    label="子物料"
                    placeholder="请选择子物料"
                    colProps={{ span: 24 }}
                    options={materials.map(m => ({
                      label: `${m.code} - ${m.name}`,
                      value: m.id,
                    }))}
                    rules={[
                      { required: true, message: '请选择子物料' },
                    ]}
                    fieldProps={{
                      loading: materialsLoading,
                      showSearch: true,
                      filterOption: (input, option) => {
                        const label = option?.label as string || '';
                        return label.toLowerCase().includes(input.toLowerCase());
                      },
                    }}
                  />
                  <ProFormDigit
                    {...f}
                    name={[f.name, 'quantity']}
                    label="用量"
                    placeholder="请输入用量"
                    colProps={{ span: 12 }}
                    rules={[
                      { required: true, message: '请输入用量' },
                      { type: 'number', min: 0.0001, message: '用量必须大于0' },
                    ]}
                    fieldProps={{
                      precision: 4,
                      style: { width: '100%' },
                    }}
                  />
                  <ProFormText
                    {...f}
                    name={[f.name, 'unit']}
                    label="单位"
                    placeholder="请输入单位"
                    colProps={{ span: 12 }}
                    rules={[
                      { required: true, message: '请输入单位' },
                      { max: 20, message: '单位不能超过20个字符' },
                    ]}
                  />
                  <ProFormSwitch
                    {...f}
                    name={[f.name, 'isAlternative']}
                    label="是否为替代料"
                    colProps={{ span: 12 }}
                  />
                  <ProFormDigit
                    {...f}
                    name={[f.name, 'priority']}
                    label="优先级"
                    placeholder="请输入优先级（数字越小优先级越高）"
                    colProps={{ span: 12 }}
                    rules={[
                      { type: 'number', min: 0, message: '优先级必须大于等于0' },
                    ]}
                    fieldProps={{
                      precision: 0,
                      style: { width: '100%' },
                    }}
                  />
                  <ProFormTextArea
                    {...f}
                    name={[f.name, 'description']}
                    label="描述"
                    placeholder="请输入描述（可选）"
                    colProps={{ span: 12 }}
                    fieldProps={{
                      rows: 2,
                      maxLength: 500,
                    }}
                  />
                  <ProFormTextArea
                    {...f}
                    name={[f.name, 'remark']}
                    label="备注"
                    placeholder="请输入备注（可选）"
                    colProps={{ span: 12 }}
                    fieldProps={{
                      rows: 2,
                      maxLength: 500,
                    }}
                  />
                </div>
              );
            }}
          </ProFormList>
          
          <ProFormSwitch
            name="isActive"
            label="是否启用"
          />
      </FormModalTemplate>

      {/* 审核Modal */}
      <Modal
        title="审核BOM"
        open={approvalModalVisible}
        onCancel={() => {
          setApprovalModalVisible(false);
          setApprovalComment('');
        }}
        footer={[
          <Button
            key="reject"
            danger
            loading={approvalLoading}
            onClick={() => handleApprove(false)}
          >
            拒绝
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={approvalLoading}
            onClick={() => handleApprove(true)}
          >
            通过
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>审核意见（可选）：</div>
          <Input.TextArea
            rows={4}
            value={approvalComment}
            onChange={(e) => setApprovalComment(e.target.value)}
            placeholder="请输入审核意见"
            maxLength={500}
          />
        </div>
      </Modal>
    </>
  );
};

export default BOMPage;

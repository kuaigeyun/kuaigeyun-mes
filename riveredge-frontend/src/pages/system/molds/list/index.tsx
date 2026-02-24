/**
 * 模具管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的模具。
 * 支持模具的 CRUD 操作和模具使用记录管理。
 * 
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, message, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getMoldList,
  getMoldByUuid,
  createMold,
  updateMold,
  deleteMold,
  Mold,
  CreateMoldData,
  UpdateMoldData,
} from '../../../../services/mold';

/**
 * 模具管理列表页面组件
 */
const MoldListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMoldUuid, setCurrentMoldUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Mold | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建模具
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMoldUuid(null);
    setFormInitialValues({
      status: '正常',
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑模具
   */
  const handleEdit = async (record: Mold) => {
    try {
      setIsEdit(true);
      setCurrentMoldUuid(record.uuid);
      
      const detail = await getMoldByUuid(record.uuid);
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        type: detail.type,
        category: detail.category,
        brand: detail.brand,
        model: detail.model,
        serial_number: detail.serial_number,
        manufacturer: detail.manufacturer,
        supplier: detail.supplier,
        purchase_date: detail.purchase_date,
        installation_date: detail.installation_date,
        warranty_period: detail.warranty_period,
        status: detail.status,
        is_active: detail.is_active,
        description: detail.description,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.molds.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Mold) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getMoldByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.molds.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除模具
   */
  const handleDelete = async (record: Mold) => {
    try {
      await deleteMold(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 批量删除模具
   */
  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('pages.system.molds.selectToDelete'));
      return;
    }
    Modal.confirm({
      title: t('pages.system.molds.confirmDeleteContent', { count: keys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let done = 0;
          let fail = 0;
          for (const uuid of keys) {
            try {
              await deleteMold(String(uuid));
              done++;
            } catch {
              fail++;
            }
          }
          if (fail > 0) {
            messageApi.warning(t('pages.system.molds.batchDeletePartial', { done, fail }));
          } else {
            messageApi.success(t('pages.system.molds.batchDeleteSuccess', { count: done }));
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentMoldUuid) {
        await updateMold(currentMoldUuid, values as UpdateMoldData);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await createMold(values as CreateMoldData);
        messageApi.success(t('common.createSuccess'));
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error; // 重新抛出错误，让 FormModalTemplate 处理
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Mold>[] = [
    {
      title: '模具编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '模具名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '模具类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '注塑模具': { text: '注塑模具' },
        '压铸模具': { text: '压铸模具' },
        '冲压模具': { text: '冲压模具' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '模具分类',
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 120,
      hideInSearch: true,
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '累计使用次数',
      dataIndex: 'total_usage_count',
      width: 120,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '模具状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '正常': { text: '正常', status: 'Success' },
        '维修中': { text: '维修中', status: 'Warning' },
        '停用': { text: '停用', status: 'Default' },
        '报废': { text: '报废', status: 'Error' },
      },
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '正常': { color: 'success', text: '正常' },
          '维修中': { color: 'warning', text: '维修中' },
          '停用': { color: 'default', text: '停用' },
          '报废': { color: 'error', text: '报废' },
        };
        const statusInfo = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '是否启用',
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
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
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
            title={t('pages.system.molds.confirmDeleteOne')}
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
    <>
      <ListPageTemplate>
        <UniTable<Mold>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, filter, searchFormValues) => {
            const response = await getMoldList({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              type: searchFormValues?.type,
              status: searchFormValues?.status,
              is_active: searchFormValues?.is_active,
              search: searchFormValues?.keyword,
            });
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建模具"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getMoldList({ skip: 0, limit: 10000 });
              let items = res.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `molds-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑模具' : '新建模具'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText
          name="code"
          label="模具编码"
          placeholder="模具编码（可选，不填则自动生成）"
          disabled={isEdit}
        />
        <ProFormText
          name="name"
          label="模具名称"
          rules={[{ required: true, message: '请输入模具名称' }]}
          placeholder="请输入模具名称"
        />
        <ProFormSelect
          name="type"
          label="模具类型"
          placeholder="请选择模具类型（可选）"
          options={[
            { label: '注塑模具', value: '注塑模具' },
            { label: '压铸模具', value: '压铸模具' },
            { label: '冲压模具', value: '冲压模具' },
            { label: '其他', value: '其他' },
          ]}
          allowClear
        />
        <ProFormText
          name="category"
          label="模具分类"
          placeholder="请输入模具分类"
        />
        <ProFormText
          name="brand"
          label="品牌"
          placeholder="请输入品牌"
        />
        <ProFormText
          name="model"
          label="型号"
          placeholder="请输入型号"
        />
        <ProFormText
          name="serial_number"
          label="序列号"
          placeholder="请输入序列号"
        />
        <ProFormText
          name="manufacturer"
          label="制造商"
          placeholder="请输入制造商"
        />
        <ProFormText
          name="supplier"
          label="供应商"
          placeholder="请输入供应商"
        />
        <ProFormDatePicker
          name="purchase_date"
          label="采购日期"
          placeholder="请选择采购日期"
        />
        <ProFormDatePicker
          name="installation_date"
          label="安装日期"
          placeholder="请选择安装日期"
        />
        <ProFormDigit
          name="warranty_period"
          label="保修期（月）"
          placeholder="请输入保修期（月）"
          fieldProps={{ min: 0 }}
        />
        <ProFormSelect
          name="status"
          label="模具状态"
          rules={[{ required: true, message: '请选择模具状态' }]}
          options={[
            { label: '正常', value: '正常' },
            { label: '维修中', value: '维修中' },
            { label: '停用', value: '停用' },
            { label: '报废', value: '报废' },
          ]}
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          initialValue={true}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入模具描述"
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="模具详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
        columns={[
          { title: '模具编码', dataIndex: 'code' },
          { title: '模具名称', dataIndex: 'name' },
          { title: '模具类型', dataIndex: 'type' },
          { title: '模具分类', dataIndex: 'category' },
          { title: '品牌', dataIndex: 'brand' },
          { title: '型号', dataIndex: 'model' },
          { title: '序列号', dataIndex: 'serial_number' },
          { title: '制造商', dataIndex: 'manufacturer' },
          { title: '供应商', dataIndex: 'supplier' },
          { title: '采购日期', dataIndex: 'purchase_date' },
          { title: '安装日期', dataIndex: 'installation_date' },
          { title: '保修期（月）', dataIndex: 'warranty_period' },
          { title: '累计使用次数', dataIndex: 'total_usage_count' },
          {
            title: '模具状态',
            dataIndex: 'status',
            render: (value: string) => {
              const statusMap: Record<string, string> = {
                '正常': '正常',
                '维修中': '维修中',
                '停用': '停用',
                '报废': '报废',
              };
              return statusMap[value] || value;
            },
          },
          {
            title: '是否启用',
            dataIndex: 'is_active',
            render: (value: boolean) => (value ? '启用' : '禁用'),
          },
          { title: '描述', dataIndex: 'description', span: 2 },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />
    </>
  );
};

export default MoldListPage;


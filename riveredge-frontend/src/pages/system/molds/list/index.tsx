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

  const statusTextKey: Record<string, string> = {
    '正常': 'statusNormal',
    '维修中': 'statusMaintenance',
    '停用': 'statusStopped',
    '报废': 'statusScrapped',
  };

  const columns: ProColumns<Mold>[] = [
    {
      title: t('pages.system.molds.columnCode'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: t('pages.system.molds.columnName'),
      dataIndex: 'name',
      width: 200,
    },
    {
      title: t('pages.system.molds.columnType'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '注塑模具': { text: t('pages.system.molds.typeInjection') },
        '压铸模具': { text: t('pages.system.molds.typeDieCasting') },
        '冲压模具': { text: t('pages.system.molds.typeStamping') },
        '其他': { text: t('pages.system.molds.typeOther') },
      },
    },
    {
      title: t('pages.system.molds.columnCategory'),
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('pages.system.molds.columnBrand'),
      dataIndex: 'brand',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('pages.system.molds.columnModel'),
      dataIndex: 'model',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('pages.system.molds.columnSerialNumber'),
      dataIndex: 'serial_number',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('pages.system.molds.columnTotalUsage'),
      dataIndex: 'total_usage_count',
      width: 120,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.molds.columnStatus'),
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '正常': { text: t('pages.system.molds.statusNormal'), status: 'Success' },
        '维修中': { text: t('pages.system.molds.statusMaintenance'), status: 'Warning' },
        '停用': { text: t('pages.system.molds.statusStopped'), status: 'Default' },
        '报废': { text: t('pages.system.molds.statusScrapped'), status: 'Error' },
      },
      render: (_, record) => {
        const key = statusTextKey[record.status];
        const text = key ? t(`pages.system.molds.${key}`) : record.status;
        const colorMap: Record<string, string> = {
          '正常': 'success',
          '维修中': 'warning',
          '停用': 'default',
          '报废': 'error',
        };
        return <Tag color={colorMap[record.status] || 'default'}>{text}</Tag>;
      },
    },
    {
      title: t('pages.system.molds.columnActive'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.molds.enabled'), status: 'Success' },
        false: { text: t('pages.system.molds.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.molds.enabled') : t('pages.system.molds.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.molds.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.molds.columnActions'),
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
            {t('pages.system.molds.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('pages.system.molds.edit')}
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
              {t('pages.system.molds.delete')}
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
          createButtonText={t('pages.system.molds.createButton')}
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.molds.batchDelete')}
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
        title={isEdit ? t('pages.system.molds.modalEdit') : t('pages.system.molds.modalCreate')}
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
          label={t('pages.system.molds.labelCode')}
          placeholder={t('pages.system.molds.codePlaceholder')}
          disabled={isEdit}
        />
        <ProFormText
          name="name"
          label={t('pages.system.molds.labelName')}
          rules={[{ required: true, message: t('pages.system.molds.nameRequired') }]}
          placeholder={t('pages.system.molds.namePlaceholder')}
        />
        <ProFormSelect
          name="type"
          label={t('pages.system.molds.columnType')}
          placeholder={t('pages.system.molds.typePlaceholder')}
          options={[
            { label: t('pages.system.molds.typeInjection'), value: '注塑模具' },
            { label: t('pages.system.molds.typeDieCasting'), value: '压铸模具' },
            { label: t('pages.system.molds.typeStamping'), value: '冲压模具' },
            { label: t('pages.system.molds.typeOther'), value: '其他' },
          ]}
          allowClear
        />
        <ProFormText
          name="category"
          label={t('pages.system.molds.columnCategory')}
          placeholder={t('pages.system.molds.categoryPlaceholder')}
        />
        <ProFormText
          name="brand"
          label={t('pages.system.molds.columnBrand')}
          placeholder={t('pages.system.molds.brandPlaceholder')}
        />
        <ProFormText
          name="model"
          label={t('pages.system.molds.columnModel')}
          placeholder={t('pages.system.molds.modelPlaceholder')}
        />
        <ProFormText
          name="serial_number"
          label={t('pages.system.molds.columnSerialNumber')}
          placeholder={t('pages.system.molds.serialPlaceholder')}
        />
        <ProFormText
          name="manufacturer"
          label={t('pages.system.molds.labelManufacturer')}
          placeholder={t('pages.system.molds.manufacturerPlaceholder')}
        />
        <ProFormText
          name="supplier"
          label={t('pages.system.molds.labelSupplier')}
          placeholder={t('pages.system.molds.supplierPlaceholder')}
        />
        <ProFormDatePicker
          name="purchase_date"
          label={t('pages.system.molds.labelPurchaseDate')}
          placeholder={t('pages.system.molds.purchaseDatePlaceholder')}
        />
        <ProFormDatePicker
          name="installation_date"
          label={t('pages.system.molds.labelInstallDate')}
          placeholder={t('pages.system.molds.installDatePlaceholder')}
        />
        <ProFormDigit
          name="warranty_period"
          label={t('pages.system.molds.labelWarranty')}
          placeholder={t('pages.system.molds.warrantyPlaceholder')}
          fieldProps={{ min: 0 }}
        />
        <ProFormSelect
          name="status"
          label={t('pages.system.molds.columnStatus')}
          rules={[{ required: true, message: t('pages.system.molds.statusRequired') }]}
          options={[
            { label: t('pages.system.molds.statusNormal'), value: '正常' },
            { label: t('pages.system.molds.statusMaintenance'), value: '维修中' },
            { label: t('pages.system.molds.statusStopped'), value: '停用' },
            { label: t('pages.system.molds.statusScrapped'), value: '报废' },
          ]}
        />
        <ProFormSwitch
          name="is_active"
          label={t('pages.system.molds.columnActive')}
          initialValue={true}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.molds.labelDescription')}
          placeholder={t('pages.system.molds.descPlaceholder')}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('pages.system.molds.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData}
          columns={[
                { title: t('pages.system.molds.columnCode'), dataIndex: 'code' },
                { title: t('pages.system.molds.columnName'), dataIndex: 'name' },
                { title: t('pages.system.molds.columnType'), dataIndex: 'type' },
                { title: t('pages.system.molds.columnCategory'), dataIndex: 'category' },
                { title: t('pages.system.molds.columnBrand'), dataIndex: 'brand' },
                { title: t('pages.system.molds.columnModel'), dataIndex: 'model' },
                { title: t('pages.system.molds.columnSerialNumber'), dataIndex: 'serial_number' },
                { title: t('pages.system.molds.labelManufacturer'), dataIndex: 'manufacturer' },
                { title: t('pages.system.molds.labelSupplier'), dataIndex: 'supplier' },
                { title: t('pages.system.molds.labelPurchaseDate'), dataIndex: 'purchase_date' },
                { title: t('pages.system.molds.labelInstallDate'), dataIndex: 'installation_date' },
                { title: t('pages.system.molds.labelWarranty'), dataIndex: 'warranty_period' },
                { title: t('pages.system.molds.columnTotalUsage'), dataIndex: 'total_usage_count' },
                {
                  title: t('pages.system.molds.columnStatus'),
                  dataIndex: 'status',
                  render: (value: string) => {
                    const key = statusTextKey[value];
                    return key ? t(`pages.system.molds.${key}`) : value;
                  },
                },
                {
                  title: t('pages.system.molds.columnActive'),
                  dataIndex: 'is_active',
                  render: (value: boolean) => (value ? t('pages.system.molds.enabled') : t('pages.system.molds.disabled')),
                },
                { title: t('pages.system.molds.labelDescription'), dataIndex: 'description', span: 2 },
                { title: t('pages.system.molds.columnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
                { title: t('pages.system.molds.labelUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
              ]}
      />
    </>
  );
};

export default MoldListPage;


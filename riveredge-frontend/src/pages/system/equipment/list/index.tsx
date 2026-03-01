/**
 * 设备管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的设备。
 * 支持设备的 CRUD 操作。
 * 
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormJsonSchema } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, message, Card, Modal } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { EditOutlined, DeleteOutlined, EyeOutlined, HistoryOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getEquipmentList,
  getEquipmentByUuid,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  Equipment,
  CreateEquipmentData,
  UpdateEquipmentData,
} from '../../../../services/equipment';
import { QRCodeGenerator } from '../../../../components/qrcode';
import { qrcodeApi } from '../../../../services/qrcode';

/**
 * 设备管理列表页面组件
 */
const EquipmentListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentEquipmentUuid, setCurrentEquipmentUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Equipment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * 处理URL参数（从二维码扫描跳转过来时自动打开详情）
   */
  useEffect(() => {
    const equipmentUuid = searchParams.get('uuid');
    const action = searchParams.get('action');
    
    if (equipmentUuid && action === 'detail') {
      // 自动打开设备详情
      handleView({ uuid: equipmentUuid } as Equipment);
      // 清除URL参数
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.equipment.selectEquipmentForQrcode'));
      return;
    }

    try {
      // 通过API获取选中的设备数据
      const equipments = await Promise.all(
        selectedRowKeys.map(async (key) => {
          try {
            return await getEquipmentByUuid(key as string);
          } catch (error) {
            console.error(`获取设备失败: ${key}`, error);
            return null;
          }
        })
      );
      
      const validEquipments = equipments.filter((eq) => eq !== null) as Equipment[];

      if (validEquipments.length === 0) {
        messageApi.error(t('pages.system.equipment.getSelectedFailed'));
        return;
      }

      // 生成二维码
      const qrcodePromises = validEquipments.map((equipment) =>
        qrcodeApi.generateEquipment({
          equipment_uuid: equipment.uuid,
          equipment_code: equipment.code || '',
          equipment_name: equipment.name || '',
        })
      );

      const qrcodes = await Promise.all(qrcodePromises);
      messageApi.success(t('pages.system.equipment.qrcodeSuccess', { count: qrcodes.length }));
      
      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`${t('pages.system.equipment.qrcodeFailed')}: ${error.message || t('common.unknownError')}`);
    }
  };

  /**
   * 处理新建设备
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentEquipmentUuid(null);
    setFormInitialValues({
      status: '正常',
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑设备
   */
  const handleEdit = async (record: Equipment) => {
    try {
      setIsEdit(true);
      setCurrentEquipmentUuid(record.uuid);
      
      const detail = await getEquipmentByUuid(record.uuid);
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
        technical_parameters: detail.technical_parameters,
        workstation_id: detail.workstation_id,
        workstation_code: detail.workstation_code,
        workstation_name: detail.workstation_name,
        status: detail.status,
        is_active: detail.is_active,
        description: detail.description,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.equipment.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Equipment) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getEquipmentByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.equipment.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除设备
   */
  const handleDelete = async (record: Equipment) => {
    try {
      await deleteEquipment(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 批量删除设备
   */
  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('pages.system.equipment.selectToDelete'));
      return;
    }
    Modal.confirm({
      title: t('pages.system.equipment.confirmDeleteContent', { count: keys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let done = 0;
          let fail = 0;
          for (const uuid of keys) {
            try {
              await deleteEquipment(String(uuid));
              done++;
            } catch {
              fail++;
            }
          }
          if (fail > 0) {
            messageApi.warning(t('pages.system.equipment.batchDeletePartial', { done, fail }));
          } else {
            messageApi.success(t('pages.system.equipment.batchDeleteSuccess', { count: done }));
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
      
      if (isEdit && currentEquipmentUuid) {
        await updateEquipment(currentEquipmentUuid, values as UpdateEquipmentData);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await createEquipment(values as CreateEquipmentData);
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
  const statusTextKey: Record<string, string> = {
    '正常': 'statusNormal',
    '维修中': 'statusMaintenance',
    '停用': 'statusStopped',
    '报废': 'statusScrapped',
  };

  const columns: ProColumns<Equipment>[] = [
    {
      title: t('pages.system.equipment.columnCode'),
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: t('pages.system.equipment.columnName'),
      dataIndex: 'name',
      width: 200,
    },
    {
      title: t('pages.system.equipment.columnType'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '加工设备': { text: t('pages.system.equipment.typeProcessing') },
        '检测设备': { text: t('pages.system.equipment.typeInspection') },
        '包装设备': { text: t('pages.system.equipment.typePackaging') },
        '其他': { text: t('pages.system.equipment.typeOther') },
      },
    },
    {
      title: t('pages.system.equipment.columnCategory'),
      dataIndex: 'category',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('pages.system.equipment.columnBrand'),
      dataIndex: 'brand',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('pages.system.equipment.columnModel'),
      dataIndex: 'model',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('pages.system.equipment.columnSerialNumber'),
      dataIndex: 'serial_number',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('pages.system.equipment.columnWorkstation'),
      dataIndex: 'workstation_name',
      width: 150,
      hideInSearch: true,
      render: (_, record) => record.workstation_name || '-',
    },
    {
      title: t('pages.system.equipment.columnStatus'),
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '正常': { text: t('pages.system.equipment.statusNormal'), status: 'Success' },
        '维修中': { text: t('pages.system.equipment.statusMaintenance'), status: 'Warning' },
        '停用': { text: t('pages.system.equipment.statusStopped'), status: 'Default' },
        '报废': { text: t('pages.system.equipment.statusScrapped'), status: 'Error' },
      },
      render: (_, record) => {
        const key = statusTextKey[record.status];
        const text = key ? t(`pages.system.equipment.${key}`) : record.status;
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
      title: t('pages.system.equipment.columnActive'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.equipment.enabled'), status: 'Success' },
        false: { text: t('pages.system.equipment.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.equipment.enabled') : t('pages.system.equipment.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.equipment.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.equipment.columnActions'),
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
            {t('pages.system.equipment.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('pages.system.equipment.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => navigate(`/system/equipment/${record.uuid}/trace`)}
          >
            {t('pages.system.equipment.trace')}
          </Button>
          <Popconfirm
            title={t('pages.system.equipment.confirmDeleteOne')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('pages.system.equipment.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Equipment>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, filter, searchFormValues) => {
            const response = await getEquipmentList({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              type: searchFormValues?.type,
              category: searchFormValues?.category,
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
          createButtonText={t('pages.system.equipment.createButton')}
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.equipment.batchDelete')}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              const res = await getEquipmentList({ skip: 0, limit: 10000 });
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
              a.download = `equipment-${new Date().toISOString().slice(0, 10)}.json`;
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
          toolBarRender={() => [
            <Button
              key="batch-qrcode"
              icon={<QrcodeOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBatchGenerateQRCode}
            >
              {t('pages.system.equipment.batchQrcode')}
            </Button>,
          ]}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.equipment.modalEdit') : t('pages.system.equipment.modalCreate')}
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
          label={t('pages.system.equipment.labelCode')}
          placeholder={t('pages.system.equipment.codePlaceholder')}
          disabled={isEdit}
        />
        <ProFormText
          name="name"
          label={t('pages.system.equipment.labelName')}
          rules={[{ required: true, message: t('pages.system.equipment.nameRequired') }]}
          placeholder={t('pages.system.equipment.namePlaceholder')}
        />
        <ProFormSelect
          name="type"
          label={t('pages.system.equipment.columnType')}
          placeholder={t('pages.system.equipment.typePlaceholder')}
          options={[
            { label: t('pages.system.equipment.typeProcessing'), value: '加工设备' },
            { label: t('pages.system.equipment.typeInspection'), value: '检测设备' },
            { label: t('pages.system.equipment.typePackaging'), value: '包装设备' },
            { label: t('pages.system.equipment.typeOther'), value: '其他' },
          ]}
          allowClear
        />
        <ProFormText
          name="category"
          label={t('pages.system.equipment.columnCategory')}
          placeholder={t('pages.system.equipment.categoryPlaceholder')}
        />
        <ProFormText
          name="brand"
          label={t('pages.system.equipment.columnBrand')}
          placeholder={t('pages.system.equipment.brandPlaceholder')}
        />
        <ProFormText
          name="model"
          label={t('pages.system.equipment.columnModel')}
          placeholder={t('pages.system.equipment.modelPlaceholder')}
        />
        <ProFormText
          name="serial_number"
          label={t('pages.system.equipment.columnSerialNumber')}
          placeholder={t('pages.system.equipment.serialPlaceholder')}
        />
        <ProFormText
          name="manufacturer"
          label={t('pages.system.equipment.labelManufacturer')}
          placeholder={t('pages.system.equipment.manufacturerPlaceholder')}
        />
        <ProFormText
          name="supplier"
          label={t('pages.system.equipment.labelSupplier')}
          placeholder={t('pages.system.equipment.supplierPlaceholder')}
        />
        <ProFormDatePicker
          name="purchase_date"
          label={t('pages.system.equipment.labelPurchaseDate')}
          placeholder={t('pages.system.equipment.purchaseDatePlaceholder')}
        />
        <ProFormDatePicker
          name="installation_date"
          label={t('pages.system.equipment.labelInstallDate')}
          placeholder={t('pages.system.equipment.installDatePlaceholder')}
        />
        <ProFormDigit
          name="warranty_period"
          label={t('pages.system.equipment.labelWarranty')}
          placeholder={t('pages.system.equipment.warrantyPlaceholder')}
          fieldProps={{ min: 0 }}
        />
        <ProFormText
          name="workstation_code"
          label={t('pages.system.equipment.labelWorkstationCode')}
          placeholder={t('pages.system.equipment.workstationCodePlaceholder')}
        />
        <ProFormText
          name="workstation_name"
          label={t('pages.system.equipment.labelWorkstationName')}
          placeholder={t('pages.system.equipment.workstationNamePlaceholder')}
        />
        <ProFormSelect
          name="status"
          label={t('pages.system.equipment.columnStatus')}
          rules={[{ required: true, message: t('pages.system.equipment.statusRequired') }]}
          options={[
            { label: t('pages.system.equipment.statusNormal'), value: '正常' },
            { label: t('pages.system.equipment.statusMaintenance'), value: '维修中' },
            { label: t('pages.system.equipment.statusStopped'), value: '停用' },
            { label: t('pages.system.equipment.statusScrapped'), value: '报废' },
          ]}
        />
        <ProFormSwitch
          name="is_active"
          label={t('pages.system.equipment.columnActive')}
          initialValue={true}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.equipment.labelDescription')}
          placeholder={t('pages.system.equipment.descPlaceholder')}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('pages.system.equipment.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        customContent={
          <>
            <ProDescriptions<Equipment>
              dataSource={detailData || undefined}
              column={2}
              columns={[
                { title: t('pages.system.equipment.columnCode'), dataIndex: 'code' },
                { title: t('pages.system.equipment.columnName'), dataIndex: 'name' },
                { title: t('pages.system.equipment.columnType'), dataIndex: 'type' },
                { title: t('pages.system.equipment.columnCategory'), dataIndex: 'category' },
                { title: t('pages.system.equipment.columnBrand'), dataIndex: 'brand' },
                { title: t('pages.system.equipment.columnModel'), dataIndex: 'model' },
                { title: t('pages.system.equipment.columnSerialNumber'), dataIndex: 'serial_number' },
                { title: t('pages.system.equipment.labelManufacturer'), dataIndex: 'manufacturer' },
                { title: t('pages.system.equipment.labelSupplier'), dataIndex: 'supplier' },
                { title: t('pages.system.equipment.labelPurchaseDate'), dataIndex: 'purchase_date' },
                { title: t('pages.system.equipment.labelInstallDate'), dataIndex: 'installation_date' },
                { title: t('pages.system.equipment.labelWarranty'), dataIndex: 'warranty_period' },
                { title: t('pages.system.equipment.columnWorkstation'), dataIndex: 'workstation_name' },
                {
                  title: t('pages.system.equipment.columnStatus'),
                  dataIndex: 'status',
                  render: (value: string) => {
                    const key = statusTextKey[value];
                    return key ? t(`pages.system.equipment.${key}`) : value;
                  },
                },
                {
                  title: t('pages.system.equipment.columnActive'),
                  dataIndex: 'is_active',
                  render: (value: boolean) => (value ? t('pages.system.equipment.enabled') : t('pages.system.equipment.disabled')),
                },
                { title: t('pages.system.equipment.labelDescription'), dataIndex: 'description', span: 2 },
                { title: t('pages.system.equipment.columnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
                { title: t('pages.system.equipment.labelUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
              ]}
            />
            
            {detailData && (
              <div style={{ marginTop: 24 }}>
                <Card title={t('pages.system.equipment.qrcodeCardTitle')}>
                  <QRCodeGenerator
                    qrcodeType="EQ"
                    data={{
                      equipment_uuid: detailData.uuid,
                      equipment_code: detailData.code || '',
                      equipment_name: detailData.name || '',
                    }}
                    autoGenerate={true}
                  />
                </Card>
              </div>
            )}
          </>
        }
      />
    </>
  );
};

export default EquipmentListPage;


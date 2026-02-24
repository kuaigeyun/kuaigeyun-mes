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
  const columns: ProColumns<Equipment>[] = [
    {
      title: '设备编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '设备类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '加工设备': { text: '加工设备' },
        '检测设备': { text: '检测设备' },
        '包装设备': { text: '包装设备' },
        '其他': { text: '其他' },
      },
    },
    {
      title: '设备分类',
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
      title: '关联工位',
      dataIndex: 'workstation_name',
      width: 150,
      hideInSearch: true,
      render: (_, record) => record.workstation_name || '-',
    },
    {
      title: '设备状态',
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
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => navigate(`/system/equipment/${record.uuid}/trace`)}
          >
            追溯
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
          createButtonText="新建设备"
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
              批量生成二维码
            </Button>,
          ]}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑设备' : '新建设备'}
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
          label="设备编码"
          placeholder="设备编码（可选，不填则自动生成）"
          disabled={isEdit}
        />
        <ProFormText
          name="name"
          label="设备名称"
          rules={[{ required: true, message: '请输入设备名称' }]}
          placeholder="请输入设备名称"
        />
        <ProFormSelect
          name="type"
          label="设备类型"
          placeholder="请选择设备类型（可选）"
          options={[
            { label: '加工设备', value: '加工设备' },
            { label: '检测设备', value: '检测设备' },
            { label: '包装设备', value: '包装设备' },
            { label: '其他', value: '其他' },
          ]}
          allowClear
        />
        <ProFormText
          name="category"
          label="设备分类"
          placeholder="请输入设备分类（如：CNC、注塑机、冲压机等）"
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
        <ProFormText
          name="workstation_code"
          label="工位编码"
          placeholder="请输入工位编码（可选）"
        />
        <ProFormText
          name="workstation_name"
          label="工位名称"
          placeholder="请输入工位名称（可选）"
        />
        <ProFormSelect
          name="status"
          label="设备状态"
          rules={[{ required: true, message: '请选择设备状态' }]}
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
          placeholder="请输入设备描述"
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="设备详情"
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
                { title: '设备编码', dataIndex: 'code' },
                { title: '设备名称', dataIndex: 'name' },
                { title: '设备类型', dataIndex: 'type' },
                { title: '设备分类', dataIndex: 'category' },
                { title: '品牌', dataIndex: 'brand' },
                { title: '型号', dataIndex: 'model' },
                { title: '序列号', dataIndex: 'serial_number' },
                { title: '制造商', dataIndex: 'manufacturer' },
                { title: '供应商', dataIndex: 'supplier' },
                { title: '采购日期', dataIndex: 'purchase_date' },
                { title: '安装日期', dataIndex: 'installation_date' },
                { title: '保修期（月）', dataIndex: 'warranty_period' },
                { title: '关联工位', dataIndex: 'workstation_name' },
                {
                  title: '设备状态',
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
            
            {/* 设备二维码 */}
            {detailData && (
              <div style={{ marginTop: 24 }}>
                <Card title="设备二维码">
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


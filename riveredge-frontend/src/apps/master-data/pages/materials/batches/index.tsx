/**
 * 物料批号管理页面
 * 
 * 提供物料批号的 CRUD 功能，支持批号生成、追溯等功能。
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormSelect, ProFormInstance, ProDescriptionsItemType } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, Input, Card } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { EditOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { materialBatchApi, materialApi } from '../../../services/material';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import { qrcodeApi } from '../../../../../services/qrcode';
import type { 
  MaterialBatch, 
  MaterialBatchCreate, 
  MaterialBatchUpdate,
  Material 
} from '../../../types/material';

/**
 * 批号状态选项
 */
const BATCH_STATUS_OPTIONS = [
  { label: '在库', value: 'in_stock' },
  { label: '已出库', value: 'out_stock' },
  { label: '已过期', value: 'expired' },
  { label: '已报废', value: 'scrapped' },
];

/**
 * 物料批号管理列表页面组件
 */
const MaterialBatchPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentBatchUuid, setCurrentBatchUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<MaterialBatch | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 物料列表（用于下拉选择）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  
  // 批号生成相关状态
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [selectedMaterialUuid, setSelectedMaterialUuid] = useState<string | null>(null);
  const [generatedBatchNo, setGeneratedBatchNo] = useState<string>('');

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
   * 处理新建批号
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentBatchUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: 'in_stock',
      quantity: 0,
    });
  };

  /**
   * 处理编辑批号
   */
  const handleEdit = async (record: MaterialBatch) => {
    try {
      setIsEdit(true);
      setCurrentBatchUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await materialBatchApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        materialUuid: detail.materialUuid,
        batchNo: detail.batchNo,
        productionDate: detail.productionDate,
        expiryDate: detail.expiryDate,
        supplierBatchNo: detail.supplierBatchNo,
        quantity: detail.quantity,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.batches.getDetailFailed'));
    }
  };

  /**
   * 处理URL参数（从二维码扫描跳转过来时自动打开详情）
   */
  useEffect(() => {
    const traceUuid = searchParams.get('uuid');
    const action = searchParams.get('action');
    
    if (traceUuid && action === 'detail') {
      // 通过traceUuid查找对应的批号记录
      materialBatchApi.get(traceUuid)
        .then((detail) => {
          setCurrentBatch(detail);
          setDrawerVisible(true);
          setSearchParams({}, { replace: true });
        })
        .catch((error) => {
          messageApi.error(t('app.master-data.batches.getRecordFailed'));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.batches.selectForQRCode'));
      return;
    }

    try {
      // 通过API获取选中的批号记录数据
      const batches = await Promise.all(
        selectedRowKeys.map(async (key) => {
          try {
            return await materialBatchApi.get(key.toString());
          } catch (error) {
            console.error(`获取批号记录失败: ${key}`, error);
            return null;
          }
        })
      );
      
      const validBatches = batches.filter((batch) => batch !== null) as MaterialBatch[];

      if (validBatches.length === 0) {
        messageApi.error(t('app.master-data.batches.getSelectedFailed'));
        return;
      }

      // 生成二维码
      const qrcodePromises = validBatches.map((batch) =>
        materialBatchApi.generateTraceQRCode(
          batch.uuid,
          batch.batchNo,
          batch.materialName
        )
      );

      const qrcodes = await Promise.all(qrcodePromises);
      messageApi.success(t('app.master-data.batches.qrCodeGenerated', { count: qrcodes.length }));
      
      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`${t('app.master-data.batches.batchGenerateQrCodeFailed')}: ${error.message || t('common.unknownError')}`);
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (record: MaterialBatch) => {
    try {
      setDetailLoading(true);
      const detail = await materialBatchApi.get(record.uuid);
      setCurrentBatch(detail);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.batches.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除批号
   */
  const handleDelete = async (record: MaterialBatch) => {
    try {
      await materialBatchApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 处理批量删除批号
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
              await materialBatchApi.delete(key.toString());
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
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentBatchUuid) {
        await materialBatchApi.update(currentBatchUuid, values as MaterialBatchUpdate);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await materialBatchApi.create(values as MaterialBatchCreate);
        messageApi.success(t('common.createSuccess'));
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理生成批号
   */
  const handleGenerateBatchNo = async () => {
    if (!selectedMaterialUuid) {
      messageApi.warning(t('app.master-data.batches.selectMaterial'));
      return;
    }
    
    try {
      const result = await materialBatchApi.generate(selectedMaterialUuid);
      setGeneratedBatchNo(result.batch_no);
      // 自动填充到表单
      formRef.current?.setFieldsValue({
        batchNo: result.batch_no,
        materialUuid: selectedMaterialUuid,
      });
      messageApi.success(t('app.master-data.batches.generateSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.batches.generateFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaterialBatch>[] = [
    {
      title: '批号',
      dataIndex: 'batchNo',
      width: 150,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '物料',
      dataIndex: ['material', 'name'],
      width: 150,
      ellipsis: true,
      render: (_: any, record: MaterialBatch) => record.materialName || '-',
    },
    {
      title: '生产日期',
      dataIndex: 'productionDate',
      width: 120,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: '有效期',
      dataIndex: 'expiryDate',
      width: 120,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 100,
      hideInSearch: true,
      render: (text: number) => text?.toFixed(4) || '0',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        in_stock: { text: '在库', status: 'Success' },
        out_stock: { text: '已出库', status: 'Warning' },
        expired: { text: '已过期', status: 'Error' },
        scrapped: { text: '已报废', status: 'Default' },
      },
    },
    {
      title: '供应商批号',
      dataIndex: 'supplierBatchNo',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_: any, record: MaterialBatch) => (
        <Space>
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
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Popconfirm
            title="确定要删除这个批号吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
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
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<MaterialBatch>[] = [
    {
      title: '批号',
      dataIndex: 'batchNo',
    },
    {
      title: '物料',
      dataIndex: 'materialName',
    },
    {
      title: '生产日期',
      dataIndex: 'productionDate',
      valueType: 'date',
    },
    {
      title: '有效期',
      dataIndex: 'expiryDate',
      valueType: 'date',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      render: (text: number) => text?.toFixed(4) || '0',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          in_stock: { text: '在库', color: 'green' },
          out_stock: { text: '已出库', color: 'orange' },
          expired: { text: '已过期', color: 'red' },
          scrapped: { text: '已报废', color: 'default' },
        };
        const status = statusMap[value] || { text: value, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '供应商批号',
      dataIndex: 'supplierBatchNo',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      span: 2,
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
        <UniTable<MaterialBatch>
          headerTitle="物料批号管理"
          actionRef={actionRef}
          columns={columns}
          showAdvancedSearch={true}
          request={async (params, sort, _filter, searchFormValues) => {
            const { current = 1, pageSize = 20, ...rest } = params;
            
            const listParams: any = {
              page: current,
              pageSize: pageSize,
              ...searchFormValues,
            };
            
            try {
              const response = await materialBatchApi.list(listParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('获取批号列表失败:', error);
              messageApi.error(error?.message || '获取批号列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          headerActions={
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                新建批号
              </Button>
              <Button
                icon={<QrcodeOutlined />}
                disabled={selectedRowKeys.length === 0}
                onClick={handleBatchGenerateQRCode}
              >
                批量生成二维码
              </Button>
              <Button
                danger
                disabled={selectedRowKeys.length === 0}
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
              >
                批量删除
              </Button>
            </Space>
          }
          search={{
            labelWidth: 'auto',
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑物料批号' : '新建物料批号'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={MODAL_CONFIG.width}
        formRef={formRef}
        loading={formLoading}
        onFinish={handleSubmit}
      >
        <SafeProFormSelect
          name="materialUuid"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materials.map(m => ({
            label: `${m.mainCode || m.code} - ${m.name}`,
            value: m.uuid,
          }))}
          fieldProps={{
            loading: materialsLoading,
            showSearch: true,
            filterOption: (input, option) => {
              const label = option?.label as string || '';
              return label.toLowerCase().includes(input.toLowerCase());
            },
            onChange: (value) => {
              setSelectedMaterialUuid(value as string);
            },
          }}
        />
        <ProFormText
          name="batchNo"
          label="批号"
          placeholder="请输入批号或点击生成"
          rules={[
            { required: true, message: '请输入批号' },
            { max: 100, message: '批号不能超过100个字符' },
          ]}
          extra={
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleGenerateBatchNo}
              disabled={!selectedMaterialUuid}
            >
              自动生成批号
            </Button>
          }
        />
        <ProFormDatePicker
          name="productionDate"
          label="生产日期"
          placeholder="请选择生产日期"
        />
        <ProFormDatePicker
          name="expiryDate"
          label="有效期"
          placeholder="请选择有效期"
        />
        <ProFormText
          name="supplierBatchNo"
          label="供应商批号"
          placeholder="请输入供应商批号"
          fieldProps={{
            maxLength: 100,
          }}
        />
        <ProFormText
          name="quantity"
          label="数量"
          placeholder="请输入数量"
          rules={[
            { required: true, message: '请输入数量' },
            { type: 'number', min: 0, message: '数量不能小于0' },
          ]}
          fieldProps={{
            type: 'number',
            step: 0.0001,
          }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          placeholder="请选择状态"
          options={BATCH_STATUS_OPTIONS}
          rules={[{ required: true, message: '请选择状态' }]}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          placeholder="请输入备注（可选）"
          fieldProps={{
            rows: 3,
            maxLength: 500,
          }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="物料批号详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        customContent={
          <>
            <ProDescriptions<MaterialBatch>
              dataSource={currentBatch || undefined}
              column={2}
              columns={detailColumns}
            />
            
            {/* 追溯二维码 */}
            {currentBatch && (
              <div style={{ marginTop: 24 }}>
                <Card title="追溯二维码">
                  <QRCodeGenerator
                    qrcodeType="TRACE"
                    data={{
                      trace_uuid: currentBatch.uuid,
                      trace_type: 'batch',
                      trace_code: currentBatch.batchNo,
                      trace_name: currentBatch.materialName || currentBatch.batchNo,
                    }}
                    autoGenerate={true}
                  />
                </Card>
              </div>
            )}
          </>
        }
        width={DRAWER_CONFIG.width}
      />
    </>
  );
};

export default MaterialBatchPage;

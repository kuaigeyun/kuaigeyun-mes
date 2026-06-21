/**
 * 条码映射规则管理页面
 *
 * 提供条码映射规则的CRUD功能，用于配置客户来料条码到内部物料的映射规则。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormSwitch, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Popconfirm, Modal, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { customerApi, unwrapSupplyPagedList } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

/**
 * 条码映射规则接口定义
 */
interface BarcodeMappingRule {
  id?: number;
  code?: string;
  name?: string;
  customer_id?: number;
  customer_name?: string;
  barcode_pattern?: string;
  barcode_type?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  is_enabled?: boolean;
  priority?: number;
  created_at?: string;
}

/**
 * 条码映射规则管理页面组件
 */
const BarcodeMappingRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const formRef = useRef<any>(null);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<Record<string, any> | null>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<BarcodeMappingRule | null>(null);

  /**
   * 处理新建
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentId(null);
    setPendingFormValues(null);
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.barcodeMapping.createButton')),
    [t],
  );

  /**
   * 处理编辑
   */
  const handleEdit = async (record: BarcodeMappingRule) => {
    if (record.id) {
      setIsEdit(true);
      setCurrentId(record.id);
      setModalVisible(true);
      // 加载数据到表单
      try {
        const detailData = await warehouseApi.barcodeMappingRule.get(record.id.toString());
        setPendingFormValues({
          name: detailData.name,
          customer_id: detailData.customer_id,
          barcode_pattern: detailData.barcode_pattern,
          barcode_type: detailData.barcode_type,
          material_id: detailData.material_id,
          is_enabled: detailData.is_enabled,
          priority: detailData.priority,
          remarks: detailData.remarks,
          attachments: mapAttachmentsToUploadList(detailData.attachments),
        });
      } catch (error) {
        messageApi.error(t('app.kuaizhizao.barcodeMapping.loadDetailFailed'));
      }
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: BarcodeMappingRule) => {
    if (record.id) {
      try {
        await warehouseApi.barcodeMappingRule.delete(record.id.toString());
        messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: 1 }));
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();
      } catch (error) {
        messageApi.error(t('app.kuaizhizao.warehouseCommon.deleteFailed'));
      }
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: BarcodeMappingRule) => {
    if (record.id) {
      try {
        const detailData = await warehouseApi.barcodeMappingRule.get(record.id.toString());
        setCurrentRecord(detailData);
        setDetailDrawerVisible(true);
      } catch (error) {
        messageApi.error(t('app.kuaizhizao.barcodeMapping.loadDetailFailed'));
      }
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<BarcodeMappingRule>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.barcodeMapping.colRuleCode'),
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.barcodeMapping.colRuleName'),
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colCustomer'),
      dataIndex: 'customer_name',
      width: 120,
      ellipsis: true,
      render: (_, record) => record.customer_name || t('app.kuaizhizao.barcodeMapping.allCustomers'),
    },
    {
      title: t('app.kuaizhizao.barcodeMapping.colBarcodePattern'),
      dataIndex: 'barcode_pattern',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.barcodeMapping.colBarcodeType'),
      dataIndex: 'barcode_type',
      width: 100,
      render: (_, record) => (
        <Tag color={record.barcode_type === '2d' ? 'blue' : 'default'}>
          {record.barcode_type === '2d'
            ? t('app.kuaizhizao.warehouseCommon.barcodeType2d')
            : t('app.kuaizhizao.warehouseCommon.barcodeType1d')}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.barcodeMapping.colMappedMaterialCode'),
      dataIndex: 'material_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.barcodeMapping.colMappedMaterialName'),
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.barcodeMapping.colEnabledStatus'),
      dataIndex: 'is_enabled',
      width: 100,
      render: (_, record) => (
        <Tag color={record.is_enabled ? 'success' : 'default'}>
          {record.is_enabled
            ? t('app.kuaizhizao.warehouseCommon.enabled')
            : t('app.kuaizhizao.warehouseCommon.disabled')}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.barcodeMapping.colPriority'),
      dataIndex: 'priority',
      width: 80,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colCreatedAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          <Button {...rowActionKind('update')} onClick={() => handleEdit(record)} />
          <Popconfirm
            title={t('app.kuaizhizao.barcodeMapping.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
            okText={t('app.kuaizhizao.warehouseCommon.confirm')}
            cancelText={t('app.kuaizhizao.warehouseCommon.cancel')}
          >
            <Button {...rowActionKind('delete')} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [t]);

  /**
   * 处理表单提交
   */
  const handleFormFinish = async (values: any) => {
    try {
      setFormLoading(true);
      const payload = {
        ...values,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      if (isEdit && currentId) {
        await warehouseApi.barcodeMappingRule.update(currentId.toString(), payload);
        messageApi.success(t('app.kuaizhizao.warehouseCommon.updateSuccessGeneric'));
      } else {
        await warehouseApi.barcodeMappingRule.create(payload);
        messageApi.success(t('app.kuaizhizao.warehouseCommon.createSuccessGeneric'));
      }
      setModalVisible(false);
      setPendingFormValues(null);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.warehouseCommon.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaizhizao.barcodeMapping.headerTitle')}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.barcode-mapping-rules"
        showCreateButton={true}
        createButtonText={createButtonLabel}
        onCreate={handleCreate}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            for (const id of keys) {
              await warehouseApi.barcodeMappingRule.delete(String(id));
            }
            messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: keys.length }));
            invalidateMenuBadgeCounts();
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || t('app.kuaizhizao.warehouseCommon.deleteFailed'));
          }
        }}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.barcodeMapping.deleteBatchConfirm', { count })}
        request={async (params) => {
          try {
            const pageSize = params.pageSize || 20;
            const skip = (params.current! - 1) * pageSize;
            const result = await warehouseApi.barcodeMappingRule.list({
              skip,
              limit: pageSize,
            });
            const rows = Array.isArray(result) ? result : [];
            const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
            return {
              data: rows,
              success: true,
              total,
            };
          } catch (error) {
            messageApi.error(t('app.kuaizhizao.barcodeMapping.loadListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        scroll={{ x: 1400 }}
      />

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.barcodeMapping.editModalTitle') : t('app.kuaizhizao.barcodeMapping.createModalTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setPendingFormValues(null);
          formRef.current?.resetFields();
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingFormValues) {
              formRef.current?.setFieldsValue(pendingFormValues);
            }
            return;
          }
          formRef.current?.resetFields?.();
          setPendingFormValues(null);
        }}
        onFinish={handleFormFinish}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        layout="vertical"
        grid={true}
        initialValues={{
          barcode_type: '1d',
          is_enabled: true,
          priority: 0,
        }}
      >
        <ProFormText
          name="name"
          label={t('app.kuaizhizao.barcodeMapping.colRuleName')}
          placeholder={t('app.kuaizhizao.barcodeMapping.enterRuleName')}
          rules={[{ required: true, message: t('app.kuaizhizao.barcodeMapping.enterRuleName') }]}
          colProps={{ span: 24 }}
        />
        <ProFormSelect
          name="customer_id"
          label={t('app.kuaizhizao.warehouseCommon.colCustomer')}
          placeholder={t('app.kuaizhizao.barcodeMapping.selectCustomerOptional')}
          request={async () => {
            try {
              const customers = unwrapSupplyPagedList(await customerApi.list());
              return customers.map((c) => ({ label: c.name, value: c.id }));
            } catch {
              return [];
            }
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="barcode_type"
          label={t('app.kuaizhizao.barcodeMapping.colBarcodeType')}
          placeholder={t('app.kuaizhizao.barcodeMapping.selectBarcodeType')}
          rules={[{ required: true, message: t('app.kuaizhizao.barcodeMapping.selectBarcodeType') }]}
          options={[
            { label: t('app.kuaizhizao.warehouseCommon.barcodeType1d'), value: '1d' },
            { label: t('app.kuaizhizao.warehouseCommon.barcodeType2d'), value: '2d' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="barcode_pattern"
          label={t('app.kuaizhizao.barcodeMapping.barcodePatternLabel')}
          placeholder={t('app.kuaizhizao.barcodeMapping.barcodePatternPlaceholder')}
          rules={[{ required: true, message: t('app.kuaizhizao.barcodeMapping.enterBarcodePattern') }]}
          colProps={{ span: 24 }}
          extra={t('app.kuaizhizao.barcodeMapping.barcodePatternExtra')}
        />
        <ProFormSelect
          name="material_id"
          label={t('app.kuaizhizao.barcodeMapping.mappedMaterial')}
          placeholder={t('app.kuaizhizao.barcodeMapping.selectMappedMaterial')}
          rules={[{ required: true, message: t('app.kuaizhizao.barcodeMapping.selectMappedMaterial') }]}
          request={async (params) => {
            try {
              const materials = await materialApi.list({
                skip: 0,
                limit: 100,
                isActive: true,
                keyword: params.keyWords,
              });
              return materials.map(m => ({
                label: `${m.code} - ${m.name}`,
                value: m.id,
              }));
            } catch {
              return [];
            }
          }}
          fieldProps={{
            showSearch: true,
            filterOption: false,
          }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch
          name="is_enabled"
          label={t('app.kuaizhizao.barcodeMapping.colEnabledStatus')}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="priority"
          label={t('app.kuaizhizao.barcodeMapping.colPriority')}
          placeholder={t('app.kuaizhizao.barcodeMapping.priorityPlaceholder')}
          fieldProps={{ min: 0 }}
          colProps={{ span: 12 }}
        />
        <DocumentAttachmentsField category="barcode_mapping_rule_attachments" />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.warehouseCommon.colRemarks')}
          placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.barcodeMapping.detailTitle')}${currentRecord?.code ? ` - ${currentRecord.code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>{t('app.kuaizhizao.barcodeMapping.colRuleCode')}：</strong>{currentRecord.code}</p>
              <p><strong>{t('app.kuaizhizao.barcodeMapping.colRuleName')}：</strong>{currentRecord.name}</p>
              <p><strong>{t('app.kuaizhizao.warehouseCommon.colCustomer')}：</strong>{currentRecord.customer_name || t('app.kuaizhizao.barcodeMapping.allCustomers')}</p>
              <p><strong>{t('app.kuaizhizao.barcodeMapping.colBarcodePattern')}：</strong>{currentRecord.barcode_pattern}</p>
              <p><strong>{t('app.kuaizhizao.barcodeMapping.colBarcodeType')}：</strong>
                <Tag color={currentRecord.barcode_type === '2d' ? 'blue' : 'default'}>
                  {currentRecord.barcode_type === '2d'
                    ? t('app.kuaizhizao.warehouseCommon.barcodeType2d')
                    : t('app.kuaizhizao.warehouseCommon.barcodeType1d')}
                </Tag>
              </p>
              <p><strong>{t('app.kuaizhizao.barcodeMapping.colMappedMaterialCode')}：</strong>{currentRecord.material_code}</p>
              <p><strong>{t('app.kuaizhizao.barcodeMapping.colMappedMaterialName')}：</strong>{currentRecord.material_name}</p>
              <p><strong>{t('app.kuaizhizao.barcodeMapping.colEnabledStatus')}：</strong>
                <Tag color={currentRecord.is_enabled ? 'success' : 'default'}>
                  {currentRecord.is_enabled
                    ? t('app.kuaizhizao.warehouseCommon.enabled')
                    : t('app.kuaizhizao.warehouseCommon.disabled')}
                </Tag>
              </p>
              <p><strong>{t('app.kuaizhizao.barcodeMapping.colPriority')}：</strong>{currentRecord.priority}</p>
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default BarcodeMappingRulesPage;

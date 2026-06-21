import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Card, Col, Form as AntForm, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined, SnippetsOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import {
  DRAWER_CONFIG,
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';
import { assemblyTemplateApi } from '../../../services/assembly-template';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../../../utils/format';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

type OrderLike = {
  id?: number;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  product_material_name?: string;
  total_quantity?: number;
  total_items?: number;
  status?: string;
  remarks?: string;
  updated_at?: string;
  executed_by_name?: string;
  executed_at?: string;
  items?: ItemLike[];
  [key: string]: any;
};

type ItemLike = {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  status?: string;
  remarks?: string;
  [key: string]: any;
};

type OrderApi = {
  list: (params?: any) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  get: (id: string) => Promise<any>;
  createItem: (orderId: string, data: any) => Promise<any>;
  updateItem: (orderId: string, itemId: string, data: any) => Promise<any>;
  deleteItem: (orderId: string, itemId: string) => Promise<any>;
  execute: (orderId: string) => Promise<any>;
  applyTemplate?: (
    orderId: string,
    data: { template_id: number; replace_existing: boolean }
  ) => Promise<any>;
};

type PageConfig = {
  headerTitle: string;
  persistenceId: string;
  createButtonText: string;
  createModalTitle: string;
  detailTitlePrefix: string;
  dateField: string;
  dateLabel: string;
  actionNoun: string;
  executeActionLabel: string;
  createSuccessText: string;
  updateSuccessText?: string;
  addItemSuccessText: string;
  updateItemSuccessText?: string;
  executeSuccessText: string;
  deleteSuccessNoun: string;
  quantityLabel: string;
  listEmptyText: string;
  orderCodeLabel: string;
  itemDoneStatus: string;
  attachmentCategory: string;
  getLifecycle: (record: Record<string, unknown>) => {
    percent: number;
    stageName: string;
    status: 'normal' | 'warning' | 'exception' | 'success' | 'active';
    subStages?: string[];
  };
  enableTemplateApply?: boolean;
};

const orderStatusKeys: Record<string, { key: string; color: string }> = {
  draft: { key: 'app.kuaizhizao.warehouseCommon.statusDraft', color: 'default' },
  in_progress: { key: 'app.kuaizhizao.warehouseCommon.statusInProgress', color: 'processing' },
  completed: { key: 'app.kuaizhizao.warehouseCommon.statusCompleted', color: 'success' },
  cancelled: { key: 'app.kuaizhizao.warehouseCommon.statusCancelled', color: 'error' },
};

const itemStatusKeys: Record<string, { key: string; color: string }> = {
  pending: { key: 'app.kuaizhizao.warehouseCommon.statusPending', color: 'default' },
  consumed: { key: 'app.kuaizhizao.warehouseCommon.itemStatusConsumed', color: 'success' },
  produced: { key: 'app.kuaizhizao.warehouseCommon.itemStatusProduced', color: 'success' },
};

export const AssemblyDisassemblyOrdersPage: React.FC<{
  api: OrderApi;
  config: PageConfig;
}> = ({ api, config }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const { canUpdate: canUpdateAssemblyOrder } = useResourcePermissions(
    'kuaizhizao:warehouse-management-assembly-orders'
  );
  const canApplyTemplate = config.enableTemplateApply ? canUpdateAssemblyOrder : false;

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderLike | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderLike | null>(null);
  const [editingItem, setEditingItem] = useState<ItemLike | null>(null);
  const [templateOptions, setTemplateOptions] = useState<
    { label: string; value: number; productMaterialId?: number }[]
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();

  const loadTemplateOptions = async (productMaterialId?: number) => {
    if (!config.enableTemplateApply) return;
    try {
      const result = await assemblyTemplateApi.list({
        limit: 200,
        is_active: true,
        product_material_id: productMaterialId,
      });
      const items = result.items || [];
      setTemplateOptions(
        items.map((item: any) => ({
          label: `${item.template_code} - ${item.template_name}`,
          value: item.id,
          productMaterialId: item.product_material_id,
        }))
      );
    } catch {
      setTemplateOptions([]);
    }
  };

  useEffect(() => {
    if (config.enableTemplateApply) {
      void loadTemplateOptions();
    }
  }, [config.enableTemplateApply]);

  const reloadList = () => actionRef.current?.reload();

  const refreshCurrentOrder = async (orderId?: number) => {
    const targetId = orderId ?? currentOrder?.id;
    if (!targetId) return;
    try {
      const fresh = await api.get(String(targetId));
      setCurrentOrder(fresh as OrderLike);
    } catch {
      // keep current drawer content unchanged when refresh fails
    }
  };

  const openCreateModal = () => {
    setEditingOrder(null);
    setCreateModalVisible(true);
    setTimeout(() => {
      createFormRef.current?.resetFields();
      createFormRef.current?.setFieldsValue({
        [config.dateField]: dayjs(),
        total_quantity: 1,
      });
      if (config.enableTemplateApply) {
        void loadTemplateOptions();
      }
    }, 0);
  };
  useNewShortcut(openCreateModal);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(config.createButtonText),
    [config.createButtonText],
  );

  const openEditOrderModal = (order: OrderLike) => {
    setEditingOrder(order);
    setCreateModalVisible(true);
    setTimeout(() => {
      createFormRef.current?.resetFields();
      createFormRef.current?.setFieldsValue({
        warehouse_id: order.warehouse_id,
        warehouse_name: order.warehouse_name,
        _warehouse_name: order.warehouse_name,
        [config.dateField]: order[config.dateField] ? dayjs(order[config.dateField]) : dayjs(),
        product_material_id: order.product_material_id,
        product_material_code: order.product_material_code,
        product_material_name: order.product_material_name,
        total_quantity: order.total_quantity ?? 1,
        assembly_template_id: order.assembly_template_id,
        remarks: order.remarks,
        attachments: mapAttachmentsToUploadList(order.attachments),
      });
      if (config.enableTemplateApply) {
        void loadTemplateOptions(order.product_material_id);
      }
    }, 0);
  };

  const submitCreateOrder = async (values: any) => {
    try {
      const orderDate = dayjs(values[config.dateField]);
      const payload = {
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name || values._warehouse_name || '',
        [config.dateField]: orderDate.isValid() ? orderDate.toISOString() : new Date().toISOString(),
        product_material_id: values.product_material_id,
        product_material_code: values.product_material_code || '',
        product_material_name: values.product_material_name || '',
        total_quantity: Number(values.total_quantity || 0),
        assembly_template_id: values.assembly_template_id || undefined,
        remarks: values.remarks,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      if (editingOrder?.id) {
        await api.update(String(editingOrder.id), payload);
        messageApi.success(config.updateSuccessText || t('app.kuaizhizao.warehouseCommon.updateSuccess', { noun: config.actionNoun }));
      } else {
        await api.create(payload);
        messageApi.success(config.createSuccessText);
      }
      setCreateModalVisible(false);
      setEditingOrder(null);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      reloadList();
      if (currentOrder?.id && editingOrder?.id === currentOrder.id) {
        await refreshCurrentOrder(currentOrder.id);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.createFailed', { noun: config.actionNoun }));
      throw error;
    }
  };

  const openDetailDrawer = async (record: OrderLike) => {
    try {
      const detail = await api.get(String(record.id));
      setCurrentOrder(detail as OrderLike);
      setSelectedTemplateId(detail.assembly_template_id ?? undefined);
      if (config.enableTemplateApply && detail.product_material_id) {
        await loadTemplateOptions(detail.product_material_id);
      }
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.detailLoadFailed', { noun: config.actionNoun }));
    }
  };

  const applyTemplateToOrder = async (order: OrderLike, templateId: number, replaceExisting: boolean) => {
    if (!order.id || !api.applyTemplate) return;
    try {
      const updated = await api.applyTemplate(String(order.id), {
        template_id: templateId,
        replace_existing: replaceExisting,
      });
      messageApi.success(t('app.kuaizhizao.assemblyOrder.applyTemplateSuccess'));
      setCurrentOrder(updated as OrderLike);
      setSelectedTemplateId(templateId);
      invalidateMenuBadgeCounts();
      reloadList();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.assemblyOrder.applyTemplateFailed'));
    }
  };

  const confirmApplyTemplate = (order: OrderLike) => {
    if (!selectedTemplateId) {
      messageApi.warning(t('app.kuaizhizao.assemblyOrder.selectTemplateFirst'));
      return;
    }
    if (!order.total_quantity || Number(order.total_quantity) <= 0) {
      messageApi.warning(t('app.kuaizhizao.assemblyOrder.enterQuantityBeforeTemplate', { label: config.quantityLabel }));
      return;
    }
    const pendingCount = Array.isArray(order.items)
      ? order.items.filter((item) => item.status === 'pending').length
      : Number(order.total_items || 0);
    const runApply = (replaceExisting: boolean) => {
      void applyTemplateToOrder(order, selectedTemplateId, replaceExisting);
    };
    if (pendingCount > 0) {
      Modal.confirm({
        title: t('app.kuaizhizao.assemblyOrder.applyTemplateTitle'),
        content: t('app.kuaizhizao.assemblyOrder.applyTemplateConfirm'),
        onOk: () => runApply(true),
      });
      return;
    }
    runApply(false);
  };

  const confirmDeleteOrder = async (record: OrderLike) => {
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseCommon.deleteOrderTitle', { noun: config.actionNoun }),
      content: t('app.kuaizhizao.warehouseCommon.deleteOrderConfirm', { noun: config.actionNoun, code: record.code }),
      onOk: async () => {
        try {
          await api.delete(String(record.id));
          messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteOrderSuccess', { noun: config.deleteSuccessNoun }));
          invalidateMenuBadgeCounts();
          if (currentOrder?.id === record.id) {
            setDetailDrawerVisible(false);
            setCurrentOrder(null);
          }
          reloadList();
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.deleteFailed'));
        }
      },
    });
  };

  const openItemModal = (record: OrderLike, item?: ItemLike) => {
    setCurrentOrderId(record.id ?? null);
    setEditingItem(item ?? null);
    setItemModalVisible(true);
    setTimeout(() => {
      itemFormRef.current?.resetFields();
      if (item) {
        itemFormRef.current?.setFieldsValue({
          material_id: item.material_id,
          material_code: item.material_code,
          material_name: item.material_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          remarks: item.remarks,
        });
      }
    }, 0);
  };

  const submitCreateItem = async (values: any) => {
    try {
      if (!currentOrderId) {
        messageApi.error(t('app.kuaizhizao.warehouseCommon.orderIdMissing', { noun: config.actionNoun }));
        return;
      }
      if (editingItem?.id) {
        await api.updateItem(String(currentOrderId), String(editingItem.id), {
          quantity: Number(values.quantity || 0),
          unit_price: Number(values.unit_price || 0),
          remarks: values.remarks,
        });
        messageApi.success(config.updateItemSuccessText || t('app.kuaizhizao.warehouseCommon.updateItemSuccess', { noun: config.actionNoun }));
      } else {
        await api.createItem(String(currentOrderId), {
          material_id: values.material_id,
          material_code: values.material_code || '',
          material_name: values.material_name || '',
          quantity: Number(values.quantity || 0),
          unit_price: Number(values.unit_price || 0),
          remarks: values.remarks,
        });
        messageApi.success(config.addItemSuccessText);
      }
      setItemModalVisible(false);
      setCurrentOrderId(null);
      setEditingItem(null);
      itemFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      reloadList();
      await refreshCurrentOrder(currentOrderId);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.addItemFailed'));
      throw error;
    }
  };

  const confirmDeleteItem = (order: OrderLike, item: ItemLike) => {
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseCommon.deleteItemTitle'),
      content: t('app.kuaizhizao.warehouseCommon.deleteItemConfirm', {
        name: item.material_code || item.material_name || item.id,
      }),
      onOk: async () => {
        try {
          if (!order.id || !item.id) return;
          await api.deleteItem(String(order.id), String(item.id));
          messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteItemSuccess'));
          invalidateMenuBadgeCounts();
          reloadList();
          await refreshCurrentOrder(order.id);
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.deleteItemFailed'));
        }
      },
    });
  };

  const confirmExecuteOrder = (record: OrderLike) => {
    const itemCount = Array.isArray(record.items) ? record.items.length : Number(record.total_items || 0);
    if (itemCount <= 0) {
      messageApi.warning(t('app.kuaizhizao.warehouseCommon.addItemBeforeExecute', { noun: config.actionNoun }));
      return;
    }
    Modal.confirm({
      title: config.executeActionLabel,
      content: t('app.kuaizhizao.warehouseCommon.executeConfirmContent', {
        action: config.executeActionLabel,
        code: record.code,
      }),
      onOk: async () => {
        try {
          await api.execute(String(record.id));
          messageApi.success(config.executeSuccessText);
          invalidateMenuBadgeCounts();
          reloadList();
          await refreshCurrentOrder(record.id);
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.executeFailed', { action: config.executeActionLabel }));
        }
      },
    });
  };

  const columns: ProColumns<OrderLike>[] = useMemo(
    () => [
    {
      title: config.orderCodeLabel,
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    { title: config.dateLabel, dataIndex: config.dateField, valueType: 'date', width: 120 },
    { title: t('app.kuaizhizao.warehouseCommon.colProductMaterial'), dataIndex: 'product_material_name', width: 160, ellipsis: true },
    { title: config.quantityLabel, dataIndex: 'total_quantity', width: 110, align: 'right' },
    { title: t('app.kuaizhizao.warehouseCommon.colComponentCount'), dataIndex: 'total_items', width: 90, align: 'right' },
    {
      title: t('app.kuaizhizao.warehouseCommon.colUpdatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = config.getLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => openDetailDrawer(record)} />
          {record.status === 'draft' && (
            <>
              <Button {...rowActionKind('update')} onClick={() => openEditOrderModal(record)} />
              <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => openItemModal(record)}>
                {t('app.kuaizhizao.warehouseCommon.addItem')}
              </Button>
              <Button
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                onClick={() => confirmExecuteOrder(record)}
              >
                {config.executeActionLabel}
              </Button>
              <Button {...rowActionKind('delete')} onClick={() => confirmDeleteOrder(record)} />
            </>
          )}
        </Space>
      ),
    },
  ],
    [config, t],
  );

  const detailColumns: ProDescriptionsItemProps<OrderLike>[] = useMemo(
    () => [
    { title: config.orderCodeLabel, dataIndex: 'code' },
    { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name' },
    { title: config.dateLabel, dataIndex: config.dateField, valueType: 'date' },
    { title: t('app.kuaizhizao.warehouseCommon.colProductMaterial'), dataIndex: 'product_material_name' },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      render: (status) => {
        const mapped = orderStatusKeys[String(status ?? '')];
        if (mapped) {
          return <Tag color={mapped.color}>{t(mapped.key)}</Tag>;
        }
        return <Tag>{String(status ?? '-')}</Tag>;
      },
    },
    { title: config.quantityLabel, dataIndex: 'total_quantity' },
    { title: t('app.kuaizhizao.warehouseCommon.colComponentCount'), dataIndex: 'total_items' },
    ...(config.enableTemplateApply
      ? [{ title: t('app.kuaizhizao.assemblyOrder.assemblyTemplate'), dataIndex: 'assembly_template_code' as const }]
      : []),
    { title: t('app.kuaizhizao.warehouseCommon.colExecutor'), dataIndex: 'executed_by_name' },
    { title: t('app.kuaizhizao.warehouseCommon.colExecutedAt'), dataIndex: 'executed_at', valueType: 'dateTime' },
    { title: t('app.kuaizhizao.warehouseCommon.colRemarks'), dataIndex: 'remarks', span: 2 },
  ],
    [config, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<OrderLike>
        headerTitle={config.headerTitle}
        columnPersistenceId={config.persistenceId}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch
        showCreateButton
        createButtonText={createButtonLabel}
        onCreate={openCreateModal}
        enableRowSelection
        showDeleteButton
        onDelete={async (keys) => {
          Modal.confirm({
            title: t('app.kuaizhizao.warehouseCommon.batchDeleteTitle', { noun: config.actionNoun }),
            content: t('app.kuaizhizao.warehouseCommon.batchDeleteConfirm', { count: keys.length, noun: config.actionNoun }),
            onOk: async () => {
              try {
                for (const key of keys) {
                  await api.delete(String(key));
                }
                messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: keys.length }));
                invalidateMenuBadgeCounts();
                reloadList();
              } catch (error: any) {
                messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.deleteFailed'));
              }
            },
          });
        }}
        request={async (params, _sort, _filter, searchFormValues) => {
          const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
          const result = await api.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
            code: params.code,
            warehouse_id: params.warehouse_id,
            status: lifecycleStage ?? params.status,
            keyword: (params as any).keyword,
          });
          return {
            data: result.items || result.data || [],
            success: true,
            total: result.total || 0,
          };
        }}
        locale={{ emptyText: config.listEmptyText }}
        scroll={{ x: 1800 }}
      />

      <FormModalTemplate
        title={editingOrder ? t('app.kuaizhizao.warehouseCommon.editOrderTitle', { noun: config.actionNoun }) : config.createModalTitle}
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingOrder(null);
          createFormRef.current?.resetFields();
        }}
        onFinish={submitCreateOrder}
        formRef={createFormRef}
        grid={false}
        {...MODAL_CONFIG}
      >
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.warehouseCommon.colWarehouse')}
              placeholder={t('app.kuaizhizao.warehouseCommon.selectWarehouse')}
              required
              onChange={(_, option) => {
                createFormRef.current?.setFieldsValue({
                  _warehouse_name: option?.name ?? '',
                  warehouse_name: option?.name ?? '',
                });
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name={config.dateField}
              label={config.dateLabel}
              rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.selectDate', { label: config.dateLabel }) }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <UniMaterialSelect
          name="product_material_id"
          label={t('app.kuaizhizao.warehouseCommon.colProductMaterial')}
          placeholder={t('app.kuaizhizao.warehouseCommon.selectMaterial')}
          required
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            product_material_code: 'mainCode',
            product_material_name: 'name',
          }}
          fieldProps={{
            onChange: (value: number) => {
              if (config.enableTemplateApply) {
                void loadTemplateOptions(value);
                createFormRef.current?.setFieldsValue({ assembly_template_id: undefined });
              }
            },
          }}
        />
        {config.enableTemplateApply && (
          <AntForm.Item name="assembly_template_id" label={t('app.kuaizhizao.assemblyOrder.assemblyTemplate')}>
            <Select
              allowClear
              placeholder={t('app.kuaizhizao.assemblyOrder.selectTemplateOptional')}
              options={templateOptions}
            />
          </AntForm.Item>
        )}
        <ProFormDigit
          name="total_quantity"
          label={config.quantityLabel}
          rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.enterField', { label: config.quantityLabel }) }]}
          min={0.01}
          fieldProps={{ precision: 2 }}
        />
        <DocumentAttachmentsField category={config.attachmentCategory} />
        <ProFormTextArea name="remarks" label={t('app.kuaizhizao.warehouseCommon.colRemarks')} placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')} fieldProps={{ rows: 3 }} />
        <AntForm.Item name="_warehouse_name" hidden />
        <AntForm.Item name="warehouse_name" hidden />
        <AntForm.Item name="product_material_code" hidden />
        <AntForm.Item name="product_material_name" hidden />
      </FormModalTemplate>

      <FormModalTemplate
        title={editingItem ? t('app.kuaizhizao.warehouseCommon.editItemTitle', { noun: config.actionNoun }) : t('app.kuaizhizao.warehouseCommon.addItemTitle', { noun: config.actionNoun })}
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setCurrentOrderId(null);
          setEditingItem(null);
          itemFormRef.current?.resetFields();
        }}
        onFinish={submitCreateItem}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <UniMaterialSelect
          name="material_id"
          label={t('app.kuaizhizao.warehouseCommon.componentMaterial')}
          placeholder={t('app.kuaizhizao.warehouseCommon.selectComponentMaterial')}
          required
          disabled={!!editingItem}
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
          }}
        />
        <ProFormDigit
          name="quantity"
          label={t('app.kuaizhizao.warehouseCommon.colQuantity')}
          rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.enterQuantity') }]}
          min={0.01}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit name="unit_price" label={t('app.kuaizhizao.warehouseCommon.colUnitPrice')} min={0} fieldProps={{ precision: 2 }} />
        <ProFormTextArea name="remarks" label={t('app.kuaizhizao.warehouseCommon.colRemarks')} placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')} fieldProps={{ rows: 3 }} />
        <AntForm.Item name="material_code" hidden />
        <AntForm.Item name="material_name" hidden />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${config.detailTitlePrefix}${currentOrder?.code ? ` - ${currentOrder.code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={currentOrder || {}}
        columns={detailColumns}
        customContent={
          <>
            {config.enableTemplateApply && currentOrder?.status === 'draft' && canApplyTemplate && api.applyTemplate && (
              <Card title={t('app.kuaizhizao.assemblyOrder.applyTemplate')} style={{ marginBottom: 16 }}>
                <Space wrap>
                  <Select
                    style={{ minWidth: 280 }}
                    placeholder={t('app.kuaizhizao.assemblyOrder.selectTemplatePlaceholder')}
                    value={selectedTemplateId}
                    onChange={setSelectedTemplateId}
                    options={templateOptions.filter(
                      (opt) =>
                        !currentOrder.product_material_id ||
                        !opt.productMaterialId ||
                        opt.productMaterialId === currentOrder.product_material_id
                    )}
                    allowClear
                  />
                  <Button icon={<SnippetsOutlined />} onClick={() => confirmApplyTemplate(currentOrder)}>
                    {t('app.kuaizhizao.assemblyOrder.applyTemplate')}
                  </Button>
                </Space>
              </Card>
            )}
            <Card
              title={t('app.kuaizhizao.warehouseCommon.colDetail')}
              extra={
                currentOrder?.status === 'draft' ? (
                  <Space>
                    <Button size="small" onClick={() => openEditOrderModal(currentOrder)}>
                      {t('app.kuaizhizao.warehouseCommon.editMainOrder')}
                    </Button>
                    <Button size="small" onClick={() => openItemModal(currentOrder)}>
                      {t('app.kuaizhizao.warehouseCommon.addItem')}
                    </Button>
                    <Button size="small" type="primary" onClick={() => confirmExecuteOrder(currentOrder)}>
                      {config.executeActionLabel}
                    </Button>
                  </Space>
                ) : undefined
              }
            >
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              {currentOrder?.items && currentOrder.items.length > 0 ? (
                <Table<ItemLike>
                  className="warehouse-detail-table"
                  size="small"
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: t('app.kuaizhizao.warehouseCommon.colComponentCode'), dataIndex: 'material_code', width: 120 },
                    { title: t('app.kuaizhizao.warehouseCommon.colComponentName'), dataIndex: 'material_name', width: 150 },
                    { title: t('app.kuaizhizao.warehouseCommon.colQuantity'), dataIndex: 'quantity', width: 90, align: 'right' },
                    {
                      title: t('app.kuaizhizao.warehouseCommon.colUnitPrice'),
                      dataIndex: 'unit_price',
                      width: 90,
                      align: 'right',
                      render: (value) => Number(value || 0).toFixed(2),
                    },
                    {
                      title: t('app.kuaizhizao.warehouseCommon.colAmount'),
                      dataIndex: 'amount',
                      width: 90,
                      align: 'right',
                      render: (value) => Number(value || 0).toFixed(2),
                    },
                    {
                      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
                      dataIndex: 'status',
                      width: 90,
                      render: (status) => {
                        const mapped = itemStatusKeys[String(status ?? '')];
                        if (mapped) {
                          return <Tag color={mapped.color}>{t(mapped.key)}</Tag>;
                        }
                        if (String(status ?? '') === config.itemDoneStatus) {
                          return (
                            <Tag color="success">
                              {config.itemDoneStatus === 'consumed'
                                ? t('app.kuaizhizao.warehouseCommon.itemStatusConsumed')
                                : t('app.kuaizhizao.warehouseCommon.itemStatusProduced')}
                            </Tag>
                          );
                        }
                        return <Tag>{String(status ?? '-')}</Tag>;
                      },
                    },
                    { title: t('app.kuaizhizao.warehouseCommon.colRemarks'), dataIndex: 'remarks' },
                    {
                      title: t('app.kuaizhizao.warehouseCommon.colActions'),
                      width: 150,
                      render: (_, item) =>
                        currentOrder.status === 'draft' ? (
                          <Space size={0}>
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openItemModal(currentOrder, item)}>
                              {t('app.kuaizhizao.warehouseCommon.edit')}
                            </Button>
                            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDeleteItem(currentOrder, item)}>
                              {t('app.kuaizhizao.warehouseCommon.delete')}
                            </Button>
                          </Space>
                        ) : null,
                    },
                  ]}
                  dataSource={currentOrder.items}
                />
              ) : (
                <Typography.Text type="secondary">{t('app.kuaizhizao.warehouseCommon.noDetailHint')}</Typography.Text>
              )}
            </Card>
          </>
        }
      />
    </ListPageTemplate>
  );
};


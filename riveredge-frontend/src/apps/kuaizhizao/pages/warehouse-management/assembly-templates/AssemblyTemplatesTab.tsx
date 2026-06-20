import React, { useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Card, Form as AntForm, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import {
  DRAWER_CONFIG,
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { assemblyTemplateApi } from '../../../services/assembly-template';
import { formatDateTime } from '../../../../../utils/format';

const ASSEMBLY_ORDERS_RESOURCE = 'kuaizhizao:warehouse-management-assembly-orders';

type TemplateItem = {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity_per_base?: number;
  unit_price?: number;
  sequence?: number;
  remarks?: string;
};

type AssemblyTemplate = {
  id?: number;
  template_code?: string;
  template_name?: string;
  product_material_id?: number;
  product_material_code?: string;
  product_material_name?: string;
  base_quantity?: number;
  source_type?: string;
  is_active?: boolean;
  total_items?: number;
  remarks?: string;
  updated_at?: string;
  items?: TemplateItem[];
};

export const AssemblyTemplatesTab: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { canCreate, canUpdate, canDelete } = useResourcePermissions(ASSEMBLY_ORDERS_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AssemblyTemplate | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<AssemblyTemplate | null>(null);
  const [editingItem, setEditingItem] = useState<TemplateItem | null>(null);
  const [bomPreviewLines, setBomPreviewLines] = useState<TemplateItem[]>([]);
  const [bomPreviewVisible, setBomPreviewVisible] = useState(false);

  const sourceTypeMap = useMemo(
    () => ({
      manual: t('app.kuaizhizao.assemblyTemplate.sourceManual'),
      bom: t('app.kuaizhizao.assemblyTemplate.sourceBom'),
    }),
    [t],
  );

  const reloadList = () => actionRef.current?.reload();

  const refreshCurrentTemplate = async (templateId?: number) => {
    const targetId = templateId ?? currentTemplate?.id;
    if (!targetId) return;
    try {
      const detail = await assemblyTemplateApi.get(String(targetId));
      setCurrentTemplate(detail as AssemblyTemplate);
    } catch {
      // keep drawer content
    }
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ base_quantity: 1, is_active: true });
    }, 0);
  };

  const openEditModal = async (record: AssemblyTemplate) => {
    try {
      const detail = await assemblyTemplateApi.get(String(record.id));
      setEditingTemplate(detail as AssemblyTemplate);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          template_name: detail.template_name,
          product_material_id: detail.product_material_id,
          product_material_code: detail.product_material_code,
          product_material_name: detail.product_material_name,
          base_quantity: detail.base_quantity ?? 1,
          is_active: detail.is_active ?? true,
          remarks: detail.remarks,
        });
      }, 0);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.assemblyTemplate.loadFailed'));
    }
  };

  const openDetailDrawer = async (record: AssemblyTemplate) => {
    try {
      const detail = await assemblyTemplateApi.get(String(record.id));
      setCurrentTemplate(detail as AssemblyTemplate);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.assemblyTemplate.loadDetailFailed'));
    }
  };

  const submitTemplate = async (values: any) => {
    try {
      const payload = {
        template_name: values.template_name,
        product_material_id: values.product_material_id,
        product_material_code: values.product_material_code || '',
        product_material_name: values.product_material_name || '',
        base_quantity: Number(values.base_quantity || 1),
        is_active: values.is_active ?? true,
        remarks: values.remarks,
      };
      if (editingTemplate?.id) {
        await assemblyTemplateApi.update(String(editingTemplate.id), payload);
        messageApi.success(t('app.kuaizhizao.assemblyTemplate.updateSuccess'));
      } else {
        await assemblyTemplateApi.create(payload);
        messageApi.success(t('app.kuaizhizao.assemblyTemplate.createSuccess'));
      }
      setModalVisible(false);
      setEditingTemplate(null);
      formRef.current?.resetFields();
      reloadList();
      if (currentTemplate?.id && editingTemplate?.id === currentTemplate.id) {
        await refreshCurrentTemplate(currentTemplate.id);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.assemblyTemplate.saveFailed'));
      throw error;
    }
  };

  const confirmDeleteTemplate = (record: AssemblyTemplate) => {
    Modal.confirm({
      title: t('app.kuaizhizao.assemblyTemplate.deleteTitle'),
      content: t('app.kuaizhizao.assemblyTemplate.deleteConfirm', { code: record.template_code }),
      onOk: async () => {
        try {
          await assemblyTemplateApi.delete(String(record.id));
          messageApi.success(t('app.kuaizhizao.assemblyTemplate.deleteSuccess'));
          if (currentTemplate?.id === record.id) {
            setDrawerVisible(false);
            setCurrentTemplate(null);
          }
          reloadList();
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.assemblyTemplate.deleteFailed'));
        }
      },
    });
  };

  const openItemModal = (template: AssemblyTemplate, item?: TemplateItem) => {
    setCurrentTemplate(template);
    setEditingItem(item ?? null);
    setItemModalVisible(true);
    setTimeout(() => {
      itemFormRef.current?.resetFields();
      if (item) {
        itemFormRef.current?.setFieldsValue({
          material_id: item.material_id,
          material_code: item.material_code,
          material_name: item.material_name,
          quantity_per_base: item.quantity_per_base,
          unit_price: item.unit_price,
          remarks: item.remarks,
        });
      }
    }, 0);
  };

  const submitItem = async (values: any) => {
    if (!currentTemplate?.id) return;
    try {
      if (editingItem?.id) {
        await assemblyTemplateApi.updateItem(String(currentTemplate.id), String(editingItem.id), {
          quantity_per_base: Number(values.quantity_per_base || 0),
          unit_price: Number(values.unit_price || 0),
          remarks: values.remarks,
        });
        messageApi.success(t('app.kuaizhizao.assemblyTemplate.updateItemSuccess'));
      } else {
        await assemblyTemplateApi.createItem(String(currentTemplate.id), {
          material_id: values.material_id,
          material_code: values.material_code || '',
          material_name: values.material_name || '',
          quantity_per_base: Number(values.quantity_per_base || 0),
          unit_price: Number(values.unit_price || 0),
          remarks: values.remarks,
        });
        messageApi.success(t('app.kuaizhizao.assemblyTemplate.addItemSuccess'));
      }
      setItemModalVisible(false);
      setEditingItem(null);
      itemFormRef.current?.resetFields();
      reloadList();
      await refreshCurrentTemplate(currentTemplate.id);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.assemblyTemplate.saveItemFailed'));
      throw error;
    }
  };

  const confirmDeleteItem = (template: AssemblyTemplate, item: TemplateItem) => {
    Modal.confirm({
      title: t('app.kuaizhizao.assemblyTemplate.deleteItemTitle'),
      content: t('app.kuaizhizao.assemblyTemplate.deleteItemConfirm', {
        name: item.material_code || item.material_name,
      }),
      onOk: async () => {
        try {
          if (!template.id || !item.id) return;
          await assemblyTemplateApi.deleteItem(String(template.id), String(item.id));
          messageApi.success(t('app.kuaizhizao.assemblyTemplate.deleteItemSuccess'));
          reloadList();
          await refreshCurrentTemplate(template.id);
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.assemblyTemplate.deleteItemFailed'));
        }
      },
    });
  };

  const previewBom = async (template: AssemblyTemplate) => {
    if (!template.product_material_id) {
      messageApi.warning(t('app.kuaizhizao.assemblyTemplate.setProductFirst'));
      return;
    }
    try {
      const preview = await assemblyTemplateApi.bomPreview({
        product_material_id: template.product_material_id,
        base_quantity: template.base_quantity ?? 1,
        product_material_code: template.product_material_code,
        product_material_name: template.product_material_name,
      });
      setBomPreviewLines((preview.lines || []) as TemplateItem[]);
      setCurrentTemplate(template);
      setBomPreviewVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.assemblyTemplate.bomPreviewFailed'));
    }
  };

  const confirmImportFromBom = (template: AssemblyTemplate) => {
    Modal.confirm({
      title: t('app.kuaizhizao.assemblyTemplate.importFromBomTitle'),
      content: t('app.kuaizhizao.assemblyTemplate.importFromBomConfirm'),
      onOk: async () => {
        try {
          const updated = await assemblyTemplateApi.importFromBom(String(template.id));
          messageApi.success(t('app.kuaizhizao.assemblyTemplate.importFromBomSuccess'));
          setCurrentTemplate(updated as AssemblyTemplate);
          reloadList();
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.assemblyTemplate.importFromBomFailed'));
        }
      },
    });
  };

  const columns: ProColumns<AssemblyTemplate>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.assemblyTemplate.colTemplateCode'),
        dataIndex: 'template_code',
        width: 140,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.template_code ?? '') }} ellipsis>
            {r.template_code ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.assemblyTemplate.colTemplateName'),
        dataIndex: 'template_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colProductMaterial'),
        dataIndex: 'product_material_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.assemblyTemplate.colBaseQuantity'),
        dataIndex: 'base_quantity',
        width: 100,
        align: 'right',
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.assemblyTemplate.colLineCount'),
        dataIndex: 'total_items',
        width: 80,
        align: 'right',
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.assemblyTemplate.colSource'),
        dataIndex: 'source_type',
        width: 100,
        hideInSearch: true,
        render: (_, r) => sourceTypeMap[String(r.source_type ?? 'manual') as keyof typeof sourceTypeMap] || r.source_type,
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colStatus'),
        dataIndex: 'is_active',
        width: 90,
        valueType: 'select',
        valueEnum: {
          true: { text: t('app.kuaizhizao.warehouseCommon.enabled'), status: 'Success' },
          false: { text: t('app.kuaizhizao.warehouseCommon.disabled'), status: 'Default' },
        },
        render: (_, r) => (
          <Tag color={r.is_active ? 'success' : 'default'}>
            {r.is_active ? t('app.kuaizhizao.warehouseCommon.enabled') : t('app.kuaizhizao.warehouseCommon.disabled')}
          </Tag>
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colUpdatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colActions'),
        width: 260,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button {...rowActionKind('read')} onClick={() => openDetailDrawer(record)} />
            {canUpdate && <Button {...rowActionKind('update')} onClick={() => openEditModal(record)} />}
            {canUpdate && (
              <Button {...rowActionKind('import')} {...rowActionLabelKeep()} onClick={() => previewBom(record)}>
                {t('app.kuaizhizao.assemblyTemplate.previewBom')}
              </Button>
            )}
            {canDelete && <Button {...rowActionKind('delete')} onClick={() => confirmDeleteTemplate(record)} />}
          </Space>
        ),
      },
    ],
    [t, sourceTypeMap, canUpdate, canDelete],
  );

  const detailColumns: ProDescriptionsItemProps<AssemblyTemplate>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.assemblyTemplate.colTemplateCode'), dataIndex: 'template_code' },
      { title: t('app.kuaizhizao.assemblyTemplate.colTemplateName'), dataIndex: 'template_name' },
      { title: t('app.kuaizhizao.warehouseCommon.colProductMaterial'), dataIndex: 'product_material_name' },
      { title: t('app.kuaizhizao.assemblyTemplate.colBaseQuantity'), dataIndex: 'base_quantity' },
      {
        title: t('app.kuaizhizao.assemblyTemplate.colSource'),
        dataIndex: 'source_type',
        render: (value) =>
          sourceTypeMap[String(value ?? 'manual') as keyof typeof sourceTypeMap] || String(value ?? '-'),
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colStatus'),
        dataIndex: 'is_active',
        render: (value) =>
          value ? (
            <Tag color="success">{t('app.kuaizhizao.warehouseCommon.enabled')}</Tag>
          ) : (
            <Tag>{t('app.kuaizhizao.warehouseCommon.disabled')}</Tag>
          ),
      },
      { title: t('app.kuaizhizao.assemblyTemplate.colLineCount'), dataIndex: 'total_items' },
      { title: t('app.kuaizhizao.warehouseCommon.colRemarks'), dataIndex: 'remarks', span: 2 },
    ],
    [t, sourceTypeMap],
  );

  const itemTableColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseCommon.colComponentCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseCommon.colComponentName'), dataIndex: 'material_name', width: 150 },
      {
        title: t('app.kuaizhizao.assemblyTemplate.colQtyPerBase'),
        dataIndex: 'quantity_per_base',
        width: 100,
        align: 'right' as const,
        render: (v: number) => Number(v || 0).toFixed(4),
      },
      {
        title: t('app.kuaizhizao.assemblyTemplate.colDefaultUnitPrice'),
        dataIndex: 'unit_price',
        width: 90,
        align: 'right' as const,
        render: (v: number) => Number(v || 0).toFixed(2),
      },
      { title: t('app.kuaizhizao.warehouseCommon.colRemarks'), dataIndex: 'remarks' },
      {
        title: t('app.kuaizhizao.warehouseCommon.colActions'),
        width: 140,
        render: (_: unknown, item: TemplateItem) =>
          canUpdate || canDelete ? (
            <Space size={0}>
              {canUpdate && (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openItemModal(currentTemplate!, item)}
                >
                  {t('app.kuaizhizao.warehouseCommon.edit')}
                </Button>
              )}
              {canDelete && (
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => confirmDeleteItem(currentTemplate!, item)}
                >
                  {t('app.kuaizhizao.warehouseCommon.delete')}
                </Button>
              )}
            </Space>
          ) : null,
      },
    ],
    [t, canUpdate, canDelete, currentTemplate],
  );

  const bomPreviewColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseCommon.colComponentCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseCommon.colComponentName'), dataIndex: 'material_name' },
      {
        title: t('app.kuaizhizao.assemblyTemplate.colQtyPerBase'),
        dataIndex: 'quantity_per_base',
        width: 100,
        align: 'right' as const,
        render: (v: number) => Number(v || 0).toFixed(4),
      },
    ],
    [t],
  );

  const draftActions = currentTemplate ? (
    <Space>
      {canUpdate && (
        <Button size="small" onClick={() => openEditModal(currentTemplate)}>
          {t('app.kuaizhizao.warehouseCommon.editMainOrder')}
        </Button>
      )}
      {canCreate && (
        <Button size="small" icon={<PlusOutlined />} onClick={() => openItemModal(currentTemplate)}>
          {t('app.kuaizhizao.warehouseCommon.addItem')}
        </Button>
      )}
      {canUpdate && (
        <>
          <Button size="small" icon={<ImportOutlined />} onClick={() => previewBom(currentTemplate)}>
            {t('app.kuaizhizao.assemblyTemplate.previewBom')}
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<ImportOutlined />}
            onClick={() => confirmImportFromBom(currentTemplate)}
          >
            {t('app.kuaizhizao.assemblyTemplate.importFromBom')}
          </Button>
        </>
      )}
    </Space>
  ) : undefined;

  return (
    <ListPageTemplate>
      <UniTable<AssemblyTemplate>
        headerTitle={t('app.kuaizhizao.assemblyTemplate.headerTitle')}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.assembly-templates"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch
        showCreateButton={canCreate}
        createButtonText={t('app.kuaizhizao.assemblyTemplate.createButton')}
        onCreate={openCreateModal}
        request={async (params) => {
          const result = await assemblyTemplateApi.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
            keyword: (params as any).keyword,
            is_active:
              params.is_active === 'true' ? true : params.is_active === 'false' ? false : undefined,
          });
          return {
            data: result.items || [],
            success: true,
            total: result.total || 0,
          };
        }}
        locale={{ emptyText: t('app.kuaizhizao.assemblyTemplate.listEmpty') }}
        scroll={{ x: 1400 }}
      />

      <FormModalTemplate
        title={
          editingTemplate
            ? t('app.kuaizhizao.assemblyTemplate.editModalTitle')
            : t('app.kuaizhizao.assemblyTemplate.createModalTitle')
        }
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingTemplate(null);
          formRef.current?.resetFields();
        }}
        onFinish={submitTemplate}
        formRef={formRef}
        grid={false}
        {...MODAL_CONFIG}
      >
        <ProFormText
          name="template_name"
          label={t('app.kuaizhizao.assemblyTemplate.colTemplateName')}
          rules={[{ required: true, message: t('app.kuaizhizao.assemblyTemplate.enterTemplateName') }]}
        />
        <UniMaterialSelect
          name="product_material_id"
          label={t('app.kuaizhizao.assemblyTemplate.productMaterial')}
          placeholder={t('app.kuaizhizao.assemblyTemplate.selectProductMaterial')}
          required
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            product_material_code: 'mainCode',
            product_material_name: 'name',
          }}
        />
        <ProFormDigit
          name="base_quantity"
          label={t('app.kuaizhizao.assemblyTemplate.colBaseQuantity')}
          rules={[{ required: true, message: t('app.kuaizhizao.assemblyTemplate.enterBaseQuantity') }]}
          min={0.01}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSwitch name="is_active" label={t('app.kuaizhizao.warehouseCommon.enabled')} />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.warehouseCommon.colRemarks')}
          fieldProps={{ rows: 3 }}
        />
        <AntForm.Item name="product_material_code" hidden />
        <AntForm.Item name="product_material_name" hidden />
      </FormModalTemplate>

      <FormModalTemplate
        title={
          editingItem
            ? t('app.kuaizhizao.assemblyTemplate.editItemModalTitle')
            : t('app.kuaizhizao.assemblyTemplate.addItemModalTitle')
        }
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setEditingItem(null);
          itemFormRef.current?.resetFields();
        }}
        onFinish={submitItem}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <UniMaterialSelect
          name="material_id"
          label={t('app.kuaizhizao.warehouseCommon.componentMaterial')}
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
          name="quantity_per_base"
          label={t('app.kuaizhizao.assemblyTemplate.colQtyPerBase')}
          rules={[{ required: true, message: t('app.kuaizhizao.assemblyTemplate.enterQtyPerBase') }]}
          min={0.0001}
          fieldProps={{ precision: 4 }}
        />
        <ProFormDigit
          name="unit_price"
          label={t('app.kuaizhizao.assemblyTemplate.colDefaultUnitPrice')}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.warehouseCommon.colRemarks')}
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.assemblyTemplate.detailTitle')}${currentTemplate?.template_code ? ` - ${currentTemplate.template_code}` : ''}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setCurrentTemplate(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={currentTemplate || {}}
        columns={detailColumns}
        customContent={
          <Card title={t('app.kuaizhizao.assemblyTemplate.componentItems')} extra={draftActions}>
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            {currentTemplate?.items && currentTemplate.items.length > 0 ? (
              <Table<TemplateItem>
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={currentTemplate.items}
                columns={itemTableColumns}
              />
            ) : (
              <Typography.Text type="secondary">{t('app.kuaizhizao.assemblyTemplate.noItemsHint')}</Typography.Text>
            )}
          </Card>
        }
      />

      <Modal
        title={t('app.kuaizhizao.assemblyTemplate.bomPreviewTitle')}
        open={bomPreviewVisible}
        onCancel={() => setBomPreviewVisible(false)}
        footer={
          currentTemplate && canUpdate
            ? [
                <Button key="cancel" onClick={() => setBomPreviewVisible(false)}>
                  {t('app.kuaizhizao.warehouseCommon.close')}
                </Button>,
                <Button
                  key="import"
                  type="primary"
                  onClick={() => {
                    setBomPreviewVisible(false);
                    confirmImportFromBom(currentTemplate);
                  }}
                >
                  {t('app.kuaizhizao.assemblyTemplate.confirmImport')}
                </Button>,
              ]
            : [
                <Button key="close" onClick={() => setBomPreviewVisible(false)}>
                  {t('app.kuaizhizao.warehouseCommon.close')}
                </Button>,
              ]
        }
        width={720}
      >
        <Table<TemplateItem>
          size="small"
          rowKey={(row, idx) => `${row.material_id}-${idx}`}
          pagination={false}
          dataSource={bomPreviewLines}
          columns={bomPreviewColumns}
        />
      </Modal>
    </ListPageTemplate>
  );
};

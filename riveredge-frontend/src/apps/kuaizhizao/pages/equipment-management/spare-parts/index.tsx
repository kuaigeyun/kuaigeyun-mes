/**
 * 备品备件管理：主数据 CRUD、库存列表、低库存预警
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProDescriptionsItemProps,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Badge, Button, Modal, Row, Col } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, MODAL_CONFIG, MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { sparePartApi } from '../../../services/equipment';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { getSparePartInventoryLifecycle } from '../../../utils/equipmentLifecycle';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  MASTER_DATA_PINNED_ACTIVE_FIELD,
  buildActiveStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveMasterDataListParams,
} from '../../../utils/equipmentListCore';
import {
  buildIsActiveDescriptionColumn,
  EquipmentMasterDetailDrawer,
  renderIsActiveTag,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';

const P = 'app.kuaizhizao.sparePart';
const RESOURCE = 'kuaizhizao:spare-part';

interface SparePart {
  id?: number;
  part_no?: string;
  part_name?: string;
  spec?: string;
  category?: string;
  unit?: string;
  brand?: string;
  supplier?: string;
  safety_stock?: number;
  price?: number;
  is_active?: boolean;
  updated_at?: string;
}

interface SpareInventoryRow {
  id?: number;
  part_no?: string;
  part_name?: string;
  stock_quantity?: number;
  warehouse_location?: string;
  safety_stock?: number;
  updated_at?: string;
}

interface SpareAlertRow {
  part_no?: string;
  part_name?: string;
  stock_quantity?: number;
  safety_stock?: number;
  warehouse_location?: string;
}

const SparePartsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const masterActionRef = useRef<ActionType>(null);
  const inventoryActionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const adjustFormRef = useRef<any>(null);
  const [activeTabKey, setActiveTabKey] = useState('master');
  const [modalVisible, setModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<SparePart | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<SparePart | null>(null);
  const {
    open: detailVisible,
    loading: detailLoading,
    detail,
    openDetail,
    closeDetail,
  } = useEquipmentDetailDrawer<SparePart>();

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ unit: '个', is_active: true, safety_stock: 0 });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: SparePart) => {
    if (!record.id) return;
    try {
      const loaded = await sparePartApi.get(record.id);
      setIsEdit(true);
      setCurrent(loaded);
      setModalVisible(true);
      formRef.current?.setFieldsValue(loaded);
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : t('common.loadFailed'));
    }
  };

  const handleDetail = useCallback(
    async (record: SparePart) => {
      if (!record.id) return;
      await openDetail(() => sparePartApi.get(record.id));
    },
    [openDetail],
  );

  const handleDelete = async (keys: React.Key[]) => {
    for (const id of keys) {
          await sparePartApi.delete(Number(id));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        masterActionRef.current?.reload();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (isEdit && current?.id) {
      await sparePartApi.update(current.id, values);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await sparePartApi.create(values);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    masterActionRef.current?.reload();
  };

  const handleStockAdjust = async (values: Record<string, unknown>) => {
    if (!adjustTarget?.id) return;
    await sparePartApi.stockAdjust({
      spare_part_id: adjustTarget.id,
      quantity: Number(values.quantity),
      operation_type: values.operation_type as string,
      warehouse_location: (values.warehouse_location as string) || '默认库位',
      remark: values.remark as string | undefined,
    });
    messageApi.success(t(`${P}.adjustSuccess`));
    setAdjustModalVisible(false);
    inventoryActionRef.current?.reload();
  };

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<SparePart>[]>(
    () => [
      { title: t(`${P}.col.partNo`), dataIndex: 'part_no' },
      { title: t(`${P}.col.partName`), dataIndex: 'part_name' },
      { title: t(`${P}.col.spec`), dataIndex: 'spec' },
      { title: t(`${P}.col.category`), dataIndex: 'category' },
      { title: t('common.unit'), dataIndex: 'unit' },
      { title: t(`${P}.col.brand`), dataIndex: 'brand' },
      { title: t(`${P}.col.supplier`), dataIndex: 'supplier' },
      { title: t(`${P}.col.safetyStock`), dataIndex: 'safety_stock' },
      { title: t(`${P}.col.price`), dataIndex: 'price' },
      { title: t('common.remark'), dataIndex: 'description', span: 2 },
      buildIsActiveDescriptionColumn<SparePart>(t),
    ],
    [t],
  );

  const masterColumns: ProColumns<SparePart>[] = useMemo(
    () => alignProColumns<SparePart>([
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        valueType: 'select',
        valueEnum: activeStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.partNameCode`),
        dataIndex: 'part_no',
        minWidth: 200,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: false,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.part_name ?? '') || '-'}
            secondary={String(r.part_no ?? '') || '-'}
          />
        ),
      },
      {
        title: t(`${P}.col.spec`),
        dataIndex: 'spec',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.spec != null && r.spec !== '' ? String(r.spec) : '-'),
      },
      {
        title: t(`${P}.col.category`),
        dataIndex: 'category',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.category != null && r.category !== '' ? String(r.category) : '-'),
      },
      {
        title: t('common.unit'),
        dataIndex: 'unit',
        width: 60,
        minWidth: 60,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => {
          const unit = r.unit;
          if (unit == null || unit === '') return '-';
          return typeof unit === 'string' || typeof unit === 'number' ? String(unit) : '-';
        },
      },
      {
        title: t(`${P}.col.safetyStock`),
        dataIndex: 'safety_stock',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => (r.safety_stock != null ? String(r.safety_stock) : '-'),
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => renderIsActiveTag(t, r.is_active),
      },
      ...buildDocumentAuditColumns<SparePart>(t),
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => [
          perms.canRead ? (
            <Button key="detail" {...rowActionKind('read')} onClick={() => void handleDetail(record)}>
              {t('common.detail')}
            </Button>
          ) : null,
          perms.canUpdate ? (
            <Button key="edit" {...rowActionKind('update')} onClick={() => void handleEdit(record)}>
              {t('common.edit')}
            </Button>
          ) : null,
          perms.canUpdate ? (
            <Button
              key="adjust"
              {...rowActionKind('update')}
              onClick={() => {
                setAdjustTarget(record);
                setAdjustModalVisible(true);
                adjustFormRef.current?.resetFields();
                adjustFormRef.current?.setFieldsValue({
                  operation_type: 'in',
                  warehouse_location: '默认库位',
                });
              }}
            >
              {t(`${P}.action.adjustStock`)}
            </Button>
          ) : null,
          perms.canDelete ? (
            <ActionConfirmPopconfirm
              title={t('common.deleteTitle')}
              onConfirm={() => {
                if (record.id != null) void handleDelete([record.id]);
              }}
            >
              <Button key="delete" {...rowActionKind('delete')} onClick={(e) => e.stopPropagation()}>
                {t('common.delete')}
              </Button>
            </ActionConfirmPopconfirm>
          ) : null,
        ],
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, activeStatusValueEnum, handleDetail],
  );

  const inventoryColumns: ProColumns<SpareInventoryRow>[] = useMemo(
    () => alignProColumns<SpareInventoryRow>([
      {
        title: t(`${P}.col.partNo`),
        dataIndex: 'part_no',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        render: (_, r) => (r.part_no != null && r.part_no !== '' ? String(r.part_no) : '-'),
      },
      {
        title: t(`${P}.col.partName`),
        dataIndex: 'part_name',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => (r.part_name != null && r.part_name !== '' ? String(r.part_name) : '-'),
      },
      {
        title: t(`${P}.col.stockQuantity`),
        dataIndex: 'stock_quantity',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        render: (_, r) => (r.stock_quantity != null ? String(r.stock_quantity) : '-'),
      },
      {
        title: t(`${P}.col.warehouseLocation`),
        dataIndex: 'warehouse_location',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) =>
          r.warehouse_location != null && r.warehouse_location !== '' ? String(r.warehouse_location) : '-',
      },
      {
        title: t(`${P}.col.stockSnapshot`),
        key: 'stock_snapshot',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, record) =>
          (record.stock_quantity ?? 0) < (record.safety_stock ?? 5) ? (
            <Badge status="error" text={t(`${P}.stockLow`)} />
          ) : (
            <Badge status="success" text={t(`${P}.stockSufficient`)} />
          ),
      },
      {
        title: t(`${P}.col.lifecycle`),
        key: 'lifecycle',
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <ListUniLifecycleCell lifecycle={getSparePartInventoryLifecycle(record as Record<string, unknown>, t)} />
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t],
  );

  const alertColumns: ProColumns<SpareAlertRow>[] = useMemo(
    () => alignProColumns<SpareAlertRow>([
      {
        title: t(`${P}.col.partNo`),
        dataIndex: 'part_no',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => (r.part_no != null && r.part_no !== '' ? String(r.part_no) : '-'),
      },
      {
        title: t(`${P}.col.partName`),
        dataIndex: 'part_name',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => (r.part_name != null && r.part_name !== '' ? String(r.part_name) : '-'),
      },
      {
        title: t(`${P}.col.stockQuantity`),
        dataIndex: 'stock_quantity',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        render: (_, r) => (r.stock_quantity != null ? String(r.stock_quantity) : '-'),
      },
      {
        title: t(`${P}.col.safetyStock`),
        dataIndex: 'safety_stock',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        render: (_, r) => (r.safety_stock != null ? String(r.safety_stock) : '-'),
      },
      {
        title: t(`${P}.col.warehouseLocation`),
        dataIndex: 'warehouse_location',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) =>
          r.warehouse_location != null && r.warehouse_location !== '' ? String(r.warehouse_location) : '-',
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t],
  );

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
        preserveMounted
        tabs={[
          {
            key: 'master',
            label: t(`${P}.tab.master`),
            children: (
              <UniTable<SparePart>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.spareParts)}
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-parts.master-width-v2"
                actionRef={masterActionRef}
                rowKey="id"
                columns={masterColumns}
                showAdvancedSearch={true}
                pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
                skipFuzzyPinyinClientFilter
                request={async (params, sort, _filter, searchFormValues) => {
                  try {
                    const listParams = resolveMasterDataListParams(searchFormValues, sort);
                    const res = await sparePartApi.list({
                      skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                      limit: params.pageSize,
                      ...listParams,
                    });
                    const { data, total } = normalizeEquipmentListResponse(res);
                    return { data: data as SparePart[], success: true, total };
                  } catch {
                    messageApi.error(t(`${P}.listFailed`));
                    return { data: [], success: false, total: 0 };
                  }
                }}
                showCreateButton={perms.canCreate}
                createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
                onCreate={handleCreate}
                showDeleteButton={perms.canDelete}
          deleteConfirmTitle={t('common.batchDeleteTitle')}
          deleteConfirmDescription={(count) => t('common.batchDeleteContent', { count: count })}
          
                onDelete={handleDelete}
                enableRowSelection={perms.canDelete}
              />
            ),
          },
          {
            key: 'inventory',
            label: t(`${P}.tab.inventory`),
            children: (
              <UniTable<SpareInventoryRow>
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-parts.inventory-width-v2"
                actionRef={inventoryActionRef}
                rowKey={(r) => String(r.id ?? r.part_no)}
                columns={inventoryColumns}
                search={false}
                request={async () => {
                  try {
                    const data = await sparePartApi.listInventory();
                    const list = Array.isArray(data) ? data : [];
                    return { data: list, success: true, total: list.length };
                  } catch {
                    messageApi.error(t(`${P}.listFailed`));
                    return { data: [], success: false, total: 0 };
                  }
                }}
              />
            ),
          },
          {
            key: 'alerts',
            label: t(`${P}.tab.alerts`),
            children: (
              <UniTable<SpareAlertRow>
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-parts.alerts-width-v2"
                rowKey={(r) => String(r.part_no)}
                columns={alertColumns}
                search={false}
                request={async () => {
                  try {
                    const data = await sparePartApi.getAlerts();
                    const list = Array.isArray(data) ? data : [];
                    return { data: list, success: true, total: list.length };
                  } catch {
                    messageApi.error(t(`${P}.listFailed`));
                    return { data: [], success: false, total: 0 };
                  }
                }}
              />
            ),
          },
        ]}
      />

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t(`${P}.detailTitle`)}${detail?.part_no ? ` - ${detail.part_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailBasicColumns}
      />

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText name="part_no" label={t(`${P}.col.partNo`)} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormText name="part_name" label={t(`${P}.col.partName`)} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormText name="spec" label={t(`${P}.col.spec`)} />
          </Col>
          <Col span={12}>
            <ProFormText name="category" label={t(`${P}.col.category`)} />
          </Col>
          <Col span={12}>
            <ProFormText name="unit" label={t('common.unit')} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormDigit name="safety_stock" label={t(`${P}.col.safetyStock`)} min={0} />
          </Col>
          <Col span={12}>
            <ProFormText name="brand" label={t(`${P}.col.brand`)} />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label={t(`${P}.col.supplier`)} />
          </Col>
          <Col span={12}>
            <ProFormDigit name="price" label={t(`${P}.col.price`)} min={0} />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="description" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t('common.enabled')} />
          </Col>
        </Row>
      </FormModalTemplate>

      <FormModalTemplate
        title={t(`${P}.adjustModal`, { name: adjustTarget?.part_name ?? '' })}
        open={adjustModalVisible}
        onClose={() => setAdjustModalVisible(false)}
        onFinish={handleStockAdjust}
        isEdit={false}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={adjustFormRef}
        grid={false}
      >
        <ProFormSelect
          name="operation_type"
          label={t(`${P}.form.operationType`)}
          options={[
            { label: t(`${P}.operation.in`), value: 'in' },
            { label: t(`${P}.operation.out`), value: 'out' },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormDigit name="quantity" label={t('common.quantity')} min={1} rules={[{ required: true }]} />
        <ProFormText name="warehouse_location" label={t(`${P}.col.warehouseLocation`)} rules={[{ required: true }]} />
        <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>
    </>
  );
};

export default SparePartsPage;

/**
 * 备品备件管理：主数据 CRUD、库存列表、低库存预警
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Badge, Button, Modal, Row, Col, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, MODAL_CONFIG, MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { sparePartApi } from '../../../services/equipment';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { getSparePartInventoryLifecycle } from '../../../utils/equipmentLifecycle';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  MASTER_DATA_PINNED_ACTIVE_FIELD,
  buildActiveStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveMasterDataListParams,
} from '../../../utils/equipmentListCore';

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
    const detail = await sparePartApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    formRef.current?.setFieldsValue(detail);
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await sparePartApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        masterActionRef.current?.reload();
      },
    });
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

  const masterColumns: ProColumns<SparePart>[] = useMemo(
    () => [
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.isActive`),
        dataIndex: 'is_active',
        valueType: 'select',
        valueEnum: activeStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.partNo`),
        dataIndex: 'part_no',
        width: 120,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.part_no ?? '') }} ellipsis>
            {r.part_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t(`${P}.col.partName`),
        dataIndex: 'part_name',
        width: 160,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      { title: t(`${P}.col.spec`), dataIndex: 'spec', width: 120, ellipsis: true, hideInSearch: true },
      {
        title: t(`${P}.col.category`),
        dataIndex: 'category',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      { title: t(`${P}.col.unit`), dataIndex: 'unit', width: 60, hideInSearch: true },
      {
        title: t(`${P}.col.safetyStock`),
        dataIndex: 'safety_stock',
        width: 90,
        align: 'right',
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.isActive`),
        dataIndex: 'is_active',
        width: 80,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (
          <Tag color={r.is_active ? 'success' : 'default'}>
            {r.is_active ? t('common.enabled') : t('common.disabled')}
          </Tag>
        ),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        defaultSortOrder: 'descend',
        sorter: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at) : '-'),
      },
      {
        title: t('common.actions'),
        key: 'action',
        width: 200,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <>
            {perms.canUpdate && (
              <Button
                {...rowActionKind('update')}
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleEdit(record);
                }}
              >
                {t('common.edit')}
              </Button>
            )}
            {perms.canUpdate && (
              <Button
                {...rowActionKind('update')}
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setAdjustTarget(record);
                  setAdjustModalVisible(true);
                  adjustFormRef.current?.resetFields();
                  adjustFormRef.current?.setFieldsValue({ operation_type: 'in', warehouse_location: '默认库位' });
                }}
              >
                {t(`${P}.action.adjustStock`)}
              </Button>
            )}
            {perms.canDelete && (
              <Button
                {...rowActionKind('delete')}
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  Modal.confirm({
                    title: t('common.deleteTitle'),
                    onOk: () => record.id && handleDelete([record.id]),
                  });
                }}
              >
                {t('common.delete')}
              </Button>
            )}
          </>
        ),
      },
    ],
    [t, perms, activeStatusValueEnum],
  );

  const inventoryColumns: ProColumns<SpareInventoryRow>[] = useMemo(
    () => [
      { title: t(`${P}.col.partNo`), dataIndex: 'part_no', width: 120, fixed: 'left' },
      { title: t(`${P}.col.partName`), dataIndex: 'part_name', width: 180, ellipsis: true },
      { title: t(`${P}.col.stockQuantity`), dataIndex: 'stock_quantity', width: 100, align: 'right' },
      { title: t(`${P}.col.warehouseLocation`), dataIndex: 'warehouse_location', width: 140 },
      {
        title: t(`${P}.col.stockSnapshot`),
        width: 120,
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
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <ListUniLifecycleCell lifecycle={getSparePartInventoryLifecycle(record as Record<string, unknown>, t)} />
        ),
      },
    ],
    [t],
  );

  const alertColumns: ProColumns<SpareAlertRow>[] = useMemo(
    () => [
      { title: t(`${P}.col.partNo`), dataIndex: 'part_no', width: 120 },
      { title: t(`${P}.col.partName`), dataIndex: 'part_name', width: 180, ellipsis: true },
      { title: t(`${P}.col.stockQuantity`), dataIndex: 'stock_quantity', width: 100, align: 'right' },
      { title: t(`${P}.col.safetyStock`), dataIndex: 'safety_stock', width: 100, align: 'right' },
      { title: t(`${P}.col.warehouseLocation`), dataIndex: 'warehouse_location', width: 140 },
    ],
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
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-parts.master"
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
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-parts.inventory"
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
                columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-parts.alerts"
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
            <ProFormText name="unit" label={t(`${P}.col.unit`)} rules={[{ required: true }]} />
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
            <ProFormTextArea name="description" label={t(`${P}.col.description`)} fieldProps={{ rows: 2 }} />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t(`${P}.col.isActive`)} />
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
        <ProFormDigit name="quantity" label={t(`${P}.form.quantity`)} min={1} rules={[{ required: true }]} />
        <ProFormText name="warehouse_location" label={t(`${P}.col.warehouseLocation`)} rules={[{ required: true }]} />
        <ProFormTextArea name="remark" label={t(`${P}.form.remark`)} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>
    </>
  );
};

export default SparePartsPage;

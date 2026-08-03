import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Modal, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { FormListDetailTable } from '../../../../../components/form-list-detail-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { inspectionItemsApi, inspectionSchemesApi } from '../../../services/equipmentOps';
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
  buildDetailDrawerEditExtra,
  buildIsActiveDescriptionColumn,
  EquipmentMasterDetailDrawer,
  MasterDataLinesTable,
  renderEquipmentMasterRowActions,
  renderIsActiveTag,
} from '../shared/equipmentMasterDataDetail';

const P = 'app.kuaizhizao.equipmentOps.inspectionScheme';
const RESOURCE = 'kuaizhizao:equipment-inspection-scheme';

interface SchemeLine {
  item_id?: number;
  sort_order?: number;
  item_code?: string;
  item_name?: string;
  is_critical?: boolean;
}

interface InspectionScheme {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
  cycle_type?: string;
  is_active?: boolean;
  lines?: SchemeLine[];
  updated_at?: string;
}

const InspectionSchemesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<InspectionScheme | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [itemOptions, setItemOptions] = useState<{ label: string; value: number }[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<InspectionScheme | null>(null);

  const loadItemOptions = async () => {
    const res = await inspectionItemsApi.list({ limit: 1000, is_active: true });
    setItemOptions(
      (res.items ?? []).map((it: { id: number; code: string; name: string }) => ({
        label: `${it.code} - ${it.name}`,
        value: it.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    // FormModal destroyOnHidden：须用 initialValues，打开瞬间 setFieldsValue 无效
    setFormInitialValues({ is_active: true, cycle_type: '每班', lines: [{ sort_order: 0 }] });
    setModalVisible(true);
    void loadItemOptions();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: InspectionScheme) => {
    if (!record.id) return;
    try {
      const loaded = await inspectionSchemesApi.get(record.id);
      setIsEdit(true);
      setCurrent(loaded);
      setFormInitialValues({
        ...loaded,
        lines: (loaded.lines ?? []).map((l: SchemeLine, i: number) => ({
          item_id: l.item_id,
          sort_order: l.sort_order ?? i,
          is_critical: l.is_critical ?? false,
        })),
      });
      setModalVisible(true);
      void loadItemOptions();
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : t('common.loadFailed'));
    }
  };

  const handleDetail = useCallback(async (record: InspectionScheme) => {
    if (!record.id) return;
    setDetailVisible(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const loaded = await inspectionSchemesApi.get(record.id);
      setDetail(loaded);
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : t('common.loadFailed'));
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, [messageApi, t]);

  const closeDetail = () => {
    setDetailVisible(false);
    setDetail(null);
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await inspectionSchemesApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      lines: ((values.lines as SchemeLine[]) ?? []).map((l, i) => ({
        item_id: l.item_id,
        sort_order: l.sort_order ?? i,
        is_critical: Boolean(l.is_critical),
      })),
    };
    if (isEdit && current?.id) {
      await inspectionSchemesApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await inspectionSchemesApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
    if (detailVisible && detail?.id === current?.id && current?.id) {
      void handleDetail({ id: current.id });
    }
  };

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<InspectionScheme>[]>(
    () => [
      { title: t(`${P}.col.code`), dataIndex: 'code' },
      { title: t(`${P}.col.name`), dataIndex: 'name' },
      { title: t(`${P}.col.cycleType`), dataIndex: 'cycle_type' },
      { title: t(`${P}.col.description`), dataIndex: 'description', span: 2 },
      buildIsActiveDescriptionColumn<InspectionScheme>(t, `${P}.col.isActive`),
    ],
    [t],
  );

  const detailLineColumns = useMemo<ColumnsType<SchemeLine>>(
    () => [
      { title: t(`${P}.form.item`), key: 'item', render: (_, row) => `${row.item_code ?? '-'} - ${row.item_name ?? '-'}` },
      {
        title: t(`${P}.form.isCritical`),
        dataIndex: 'is_critical',
        width: 90,
        render: (v) => (v ? '是' : '否'),
      },
      { title: t(`${P}.form.sortOrder`), dataIndex: 'sort_order', width: 80, align: 'right' },
    ],
    [t],
  );

  const columns: ProColumns<InspectionScheme>[] = useMemo(() => alignProColumns<InspectionScheme>([
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
        title: t(`${P}.col.code`),
        dataIndex: 'code',
        width: 120,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.name`),
        dataIndex: 'name',
        width: 180,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.cycleType`),
        dataIndex: 'cycle_type',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.lineCount`),
        dataIndex: 'lines',
        width: 90,
        hideInSearch: true,
        render: (_, r) => r.lines?.length ?? 0,
      },
      { title: t(`${P}.col.description`), dataIndex: 'description', ellipsis: true, hideInSearch: true },
      {
        title: t(`${P}.col.isActive`),
        dataIndex: 'is_active',
        width: 80,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => renderIsActiveTag(t, r.is_active),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<InspectionScheme>(t),
      {
        title: t('common.actions'),
        key: 'action',
        width: 200,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          renderEquipmentMasterRowActions({
            record,
            keyPrefix: `inspection-scheme-actions-${record.id ?? 'row'}`,
            t,
            canRead: perms.canRead,
            canUpdate: perms.canUpdate,
            canDelete: perms.canDelete,
            onDetail: (row) => {
              void handleDetail(row);
            },
            onEdit: (row) => {
              void handleEdit(row);
            },
            onDelete: (row) => {
              if (row.id != null) {
                void handleDelete([row.id]);
              }
            },
          }),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, activeStatusValueEnum, handleDetail],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<InspectionScheme>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.inspection-schemes"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveMasterDataListParams(searchFormValues, sort);
              const res = await inspectionSchemesApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as InspectionScheme[], success: true, total };
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
      </ListPageTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t(`${P}.detailTitle`)}${detail?.code ? ` - ${detail.code}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailBasicColumns}
        linesTitle={t(`${P}.form.lines`)}
        lines={
          <MasterDataLinesTable
            rows={detail?.lines ?? []}
            columns={detailLineColumns}
            rowKey={(row) => String(row.item_id ?? row.sort_order ?? '')}
            emptyDescription={t('common.noData')}
          />
        }
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (!detail) return;
          closeDetail();
          void handleEdit(detail);
        })}
      />

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={8}>
            <ProFormText name="code" label={t(`${P}.col.code`)} rules={[{ required: true }]} />
          </Col>
          <Col span={8}>
            <ProFormText name="name" label={t(`${P}.col.name`)} rules={[{ required: true }]} />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="cycle_type"
              label={t(`${P}.col.cycleType`)}
              options={[
                { label: t(`${P}.cycle.shift`), value: '每班' },
                { label: t(`${P}.cycle.daily`), value: '每天' },
                { label: t(`${P}.cycle.weekly`), value: '每周' },
                { label: t(`${P}.cycle.monthly`), value: '每月' },
                { label: t(`${P}.cycle.quarterly`), value: '每季度' },
              ]}
            />
          </Col>
        </Row>
        <FormListDetailTable
          name="lines"
          label={t(`${P}.form.lines`)}
          addButtonText={t(`${P}.form.addLine`)}
          defaultRow={{ sort_order: 0, is_critical: false }}
          bulkAdd={{
            title: t('common.bulkAddPickTitle', { item: t(`${P}.form.item`) }),
            options: itemOptions,
            valueField: 'item_id',
          }}
          columns={[
            {
              title: t(`${P}.form.item`),
              key: 'item_id',
              render: (field) => (
                <ProFormSelect
                  name={[field.name, 'item_id']}
                  options={itemOptions}
                  rules={[{ required: true }]}
                  showSearch
                  formItemProps={{ noStyle: true }}
                  fieldProps={{ style: { width: '100%' }, placeholder: t('common.select') }}
                />
              ),
            },
            {
              title: t(`${P}.form.isCritical`),
              key: 'is_critical',
              width: 100,
              render: (field) => (
                <ProFormSwitch
                  name={[field.name, 'is_critical']}
                  formItemProps={{ noStyle: true }}
                />
              ),
            },
            {
              title: t(`${P}.form.sortOrder`),
              key: 'sort_order',
              width: 100,
              align: 'right',
              render: (field) => (
                <ProFormDigit
                  name={[field.name, 'sort_order']}
                  min={0}
                  formItemProps={{ noStyle: true }}
                  fieldProps={{ style: { width: '100%' } }}
                />
              ),
            },
          ]}
        />
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <ProFormTextArea name="description" label={t(`${P}.col.description`)} fieldProps={{ rows: 2 }} />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t(`${P}.col.isActive`)} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default InspectionSchemesPage;

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
import { maintenanceItemsApi, maintenanceSchemesApi } from '../../../services/equipmentOps';
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
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';

const P = 'app.kuaizhizao.equipmentOps.maintenanceScheme';
const RESOURCE = 'kuaizhizao:equipment-maintenance-scheme';

interface SchemeLine {
  item_id?: number;
  sort_order?: number;
  item_code?: string;
  item_name?: string;
}

interface MaintenanceScheme {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  lines?: SchemeLine[];
  updated_at?: string;
}

const MaintenanceSchemesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<MaintenanceScheme | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [itemOptions, setItemOptions] = useState<{ label: string; value: number }[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<MaintenanceScheme | null>(null);

  const loadItemOptions = async () => {
    const res = await maintenanceItemsApi.list({ limit: 1000, is_active: true });
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
    setFormInitialValues({ is_active: true, lines: [{ sort_order: 0 }] });
    setModalVisible(true);
    void loadItemOptions();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: MaintenanceScheme) => {
    if (!record.id) return;
    try {
      const loaded = await maintenanceSchemesApi.get(record.id);
      setIsEdit(true);
      setCurrent(loaded);
      setFormInitialValues({
        ...loaded,
        lines: (loaded.lines ?? []).map((l: SchemeLine, i: number) => ({
          item_id: l.item_id,
          sort_order: l.sort_order ?? i,
        })),
      });
      setModalVisible(true);
      void loadItemOptions();
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : t('common.loadFailed'));
    }
  };

  const handleDetail = useCallback(async (record: MaintenanceScheme) => {
    if (!record.id) return;
    setDetailVisible(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const loaded = await maintenanceSchemesApi.get(record.id);
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
    getAntdModal().confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await maintenanceSchemesApi.delete(Number(id));
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
      })),
    };
    if (isEdit && current?.id) {
      await maintenanceSchemesApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await maintenanceSchemesApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
    if (detailVisible && detail?.id === current?.id && current?.id) {
      void handleDetail({ id: current.id });
    }
  };

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<MaintenanceScheme>[]>(
    () => [
      { title: t('common.code'), dataIndex: 'code' },
      { title: t('common.name'), dataIndex: 'name' },
      { title: t('common.remark'), dataIndex: 'description', span: 2 },
      buildIsActiveDescriptionColumn<MaintenanceScheme>(t),
    ],
    [t],
  );

  const detailLineColumns = useMemo<ColumnsType<SchemeLine>>(
    () => [
      { title: t(`${P}.form.item`), key: 'item', render: (_, row) => `${row.item_code ?? '-'} - ${row.item_name ?? '-'}` },
      { title: t(`${P}.form.sortOrder`), dataIndex: 'sort_order', width: 80, align: 'right' },
    ],
    [t],
  );

  const columns: ProColumns<MaintenanceScheme>[] = useMemo(() => alignProColumns<MaintenanceScheme>([
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
        title: t('common.code'),
        dataIndex: 'code',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('common.name'),
        dataIndex: 'name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.lineCount`),
        key: 'line_count',
        dataIndex: 'lines',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => r.lines?.length ?? 0,
      },
      {
        title: t('common.remark'),
        dataIndex: 'description',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.description != null && r.description !== '' ? String(r.description) : '-'),
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => renderIsActiveTag(t, r.is_active),
      },
      ...buildDocumentAuditColumns<MaintenanceScheme>(t),
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          renderEquipmentMasterRowActions({
            record,
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
        <UniTable<MaintenanceScheme>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.maintenanceSchemes)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-schemes-width-v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveMasterDataListParams(searchFormValues, sort);
              const res = await maintenanceSchemesApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as MaintenanceScheme[], success: true, total };
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
          <Col span={12}>
            <ProFormText name="code" label={t('common.code')} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormText name="name" label={t('common.name')} rules={[{ required: true }]} />
          </Col>
        </Row>
        <FormListDetailTable
          name="lines"
          label={t(`${P}.form.lines`)}
          addButtonText={t(`${P}.form.addLine`)}
          defaultRow={{ sort_order: 0 }}
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
            <ProFormTextArea name="description" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t('common.enabled')} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default MaintenanceSchemesPage;

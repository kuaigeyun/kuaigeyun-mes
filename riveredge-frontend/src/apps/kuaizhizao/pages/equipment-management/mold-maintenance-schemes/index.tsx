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

import { maintenanceItemsApi, maintenanceSchemesApi } from '../../../services/moldOps';

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

  useEquipmentDetailDrawer,

} from '../shared/equipmentMasterDataDetail';
import { getAntdModal } from '../../../../../utils/antdAppApis';



const P = 'app.kuaizhizao.moldOps.maintenanceScheme';



function resolveMaintenanceTriggerTypeLabel(
  t: (key: string) => string,
  triggerType?: string | null,
): string {
  const raw = String(triggerType ?? '').trim();
  if (raw === 'days') return t(`${P}.triggerType.days`);
  if (raw === 'count' || raw === 'usage_count') return t(`${P}.triggerType.count`);
  return raw || '-';
}
const RESOURCE = 'kuaizhizao:mold-maintenance-scheme';



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

  trigger_type?: string;

  interval_value?: number;

  is_active?: boolean;

  lines?: SchemeLine[];

  line_count?: number;

  updated_at?: string;

}



const MoldMaintenanceSchemesPage: React.FC = () => {

  const { t } = useTranslation();

  const { message: messageApi } = App.useApp();

  const perms = useResourcePermissions(RESOURCE);

  const actionRef = useRef<ActionType>(null);

  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);

  const [isEdit, setIsEdit] = useState(false);

  const [current, setCurrent] = useState<MaintenanceScheme | null>(null);

  const [itemOptions, setItemOptions] = useState<{ label: string; value: number }[]>([]);

  const {

    open: detailVisible,

    loading: detailLoading,

    detail,

    openDetail,

    closeDetail,

  } = useEquipmentDetailDrawer<MaintenanceScheme>();



  const triggerTypeOptions = useMemo(

    () => [

      { label: t(`${P}.triggerType.count`), value: 'usage_count' },

      { label: t(`${P}.triggerType.days`), value: 'days' },

    ],

    [t],

  );



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

    setModalVisible(true);

    void loadItemOptions();

    formRef.current?.resetFields();

    formRef.current?.setFieldsValue({ is_active: true, trigger_type: 'usage_count', lines: [{ sort_order: 0 }] });

  };

  useNewShortcut(handleCreate);



  const handleEdit = async (record: MaintenanceScheme) => {

    if (!record.id) return;

    try {

      const loaded = await maintenanceSchemesApi.get(record.id);

      setIsEdit(true);

      setCurrent(loaded);

      setModalVisible(true);

      void loadItemOptions();

      formRef.current?.setFieldsValue({

        ...loaded,

        trigger_type:
          loaded.trigger_type === 'count' ? 'usage_count' : loaded.trigger_type,

        lines: (loaded.lines ?? []).map((l: SchemeLine, i: number) => ({

          item_id: l.item_id,

          sort_order: l.sort_order ?? i,

        })),

      });

    } catch (error: unknown) {

      messageApi.error(error instanceof Error ? error.message : t('common.loadFailed'));

    }

  };



  const handleDetail = useCallback(

    async (record: MaintenanceScheme) => {

      if (!record.id) return;

      await openDetail(() => maintenanceSchemesApi.get(record.id));

    },

    [openDetail],

  );



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

      code: values.code,

      name: values.name,

      description: values.description,

      trigger_type:

        values.trigger_type === 'count' ? 'usage_count' : values.trigger_type,

      interval_value: values.interval_value,

      is_active: values.is_active,

      lines: (values.lines as SchemeLine[] | undefined)?.map((l, i) => ({

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

      void openDetail(() => maintenanceSchemesApi.get(current.id));

    }

  };



  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);



  const detailBasicColumns = useMemo<ProDescriptionsItemProps<MaintenanceScheme>[]>(

    () => [

      { title: t(`${P}.col.code`), dataIndex: 'code' },

      { title: t(`${P}.col.name`), dataIndex: 'name' },

      {

        title: t(`${P}.col.triggerType`),

        dataIndex: 'trigger_type',

        render: (_, record) => resolveMaintenanceTriggerTypeLabel(t, record.trigger_type),

      },

      { title: t(`${P}.col.intervalValue`), dataIndex: 'interval_value' },

      { title: t(`${P}.col.description`), dataIndex: 'description', span: 2 },

      buildIsActiveDescriptionColumn<MaintenanceScheme>(t, `${P}.col.isActive`),

    ],

    [t],

  );



  const detailLineColumns = useMemo<ColumnsType<SchemeLine>>(

    () => [

      {

        title: t(`${P}.form.item`),

        key: 'item',

        render: (_, row) => `${row.item_code ?? '-'} - ${row.item_name ?? '-'}`,

      },

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

        title: t(`${P}.col.triggerType`),

        dataIndex: 'trigger_type',

        width: 100,

        hideInSearch: true,

        render: (_, r) => resolveMaintenanceTriggerTypeLabel(t, r.trigger_type),

      },

      { title: t(`${P}.col.intervalValue`), dataIndex: 'interval_value', width: 90, hideInSearch: true },

      { title: t(`${P}.col.lineCount`), dataIndex: 'line_count', width: 80, hideInSearch: true },

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

      ...buildDocumentAuditColumns<MaintenanceScheme>(t),

      {

        title: t('common.actions'),

        key: 'action',
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

          headerTitle={t(`${P}.title`)}

          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-maintenance-schemes-equip-rank-v1"

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

        onClose={() => setModalVisible(false)}

        onFinish={handleSubmit}

        isEdit={isEdit}

        width={MODAL_CONFIG.LARGE_WIDTH}

        formRef={formRef}

        grid={false}

      >

        <Row gutter={16}>

          <Col span={12}>

            <ProFormText name="code" label={t(`${P}.col.code`)} rules={[{ required: true }]} />

          </Col>

          <Col span={12}>

            <ProFormText name="name" label={t(`${P}.col.name`)} rules={[{ required: true }]} />

          </Col>

          <Col span={12}>

            <ProFormSelect name="trigger_type" label={t(`${P}.col.triggerType`)} options={triggerTypeOptions} />

          </Col>

          <Col span={12}>

            <ProFormDigit name="interval_value" label={t(`${P}.col.intervalValue`)} min={1} />

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



export default MoldMaintenanceSchemesPage;



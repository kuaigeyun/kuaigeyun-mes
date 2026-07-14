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
import { App, Button, Modal, Row, Col, Tag } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { FormListDetailTable } from '../../../../../components/form-list-detail-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { equipmentApi } from '../../../services/equipment';
import { inspectionSchemesApi, patrolRoutesApi } from '../../../services/equipmentOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  MASTER_DATA_PINNED_ACTIVE_FIELD,
  buildActiveStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveMasterDataListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.equipmentOps.patrolRoute';
const RESOURCE = 'kuaizhizao:equipment-patrol-route';

interface RouteStep {
  sort_order?: number;
  equipment_id?: number;
  scheme_id?: number;
}

interface PatrolRoute {
  id?: number;
  code?: string;
  name?: string;
  workshop_name?: string;
  description?: string;
  is_active?: boolean;
  steps?: RouteStep[];
  updated_at?: string;
}

const PatrolRoutesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<PatrolRoute | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [schemeOptions, setSchemeOptions] = useState<{ label: string; value: number }[]>([]);

  const loadOptions = async () => {
    const [eqRes, schRes] = await Promise.all([
      equipmentApi.list({ limit: 1000 }),
      inspectionSchemesApi.list({ limit: 1000, is_active: true }),
    ]);
    setEquipmentOptions(
      (eqRes.items ?? []).map((eq: { id: number; code: string; name: string }) => ({
        label: `${eq.code} - ${eq.name}`,
        value: eq.id,
      })),
    );
    setSchemeOptions(
      (schRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
        label: `${s.code} - ${s.name}`,
        value: s.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setFormInitialValues({ is_active: true, steps: [{ sort_order: 0 }] });
    setModalVisible(true);
    void loadOptions();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: PatrolRoute) => {
    if (!record.id) return;
    const detail = await patrolRoutesApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setFormInitialValues({
      ...detail,
      steps: (detail.steps ?? []).map((s: RouteStep, i: number) => ({
        equipment_id: s.equipment_id,
        scheme_id: s.scheme_id,
        sort_order: s.sort_order ?? i,
      })),
    });
    setModalVisible(true);
    void loadOptions();
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await patrolRoutesApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      steps: ((values.steps as RouteStep[]) ?? []).map((s, i) => ({
        equipment_id: s.equipment_id,
        scheme_id: s.scheme_id,
        sort_order: s.sort_order ?? i,
      })),
    };
    if (isEdit && current?.id) {
      await patrolRoutesApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await patrolRoutesApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const columns: ProColumns<PatrolRoute>[] = useMemo(() => alignProColumns<PatrolRoute>([
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
      { title: t(`${P}.col.workshop`), dataIndex: 'workshop_name', width: 120, hideInSearch: true },
      {
        title: t(`${P}.col.stepCount`),
        dataIndex: 'steps',
        width: 90,
        hideInSearch: true,
        render: (_, r) => r.steps?.length ?? 0,
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
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<PatrolRoute>(t),
      {
        title: t('common.actions'),
        key: 'action',
        width: 140,
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
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, activeStatusValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<PatrolRoute>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.patrol-routes"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveMasterDataListParams(searchFormValues, sort);
              const res = await patrolRoutesApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as PatrolRoute[], success: true, total };
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

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
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
            <ProFormText name="workshop_name" label={t(`${P}.col.workshop`)} />
          </Col>
        </Row>
        <FormListDetailTable
          name="steps"
          label={t(`${P}.form.steps`)}
          addButtonText={t(`${P}.form.addStep`)}
          defaultRow={{ sort_order: 0 }}
          bulkAdd={{
            title: t('common.bulkAddPickTitle', { item: t(`${P}.form.equipment`) }),
            options: equipmentOptions,
            valueField: 'equipment_id',
          }}
          columns={[
            {
              title: t(`${P}.form.equipment`),
              key: 'equipment_id',
              render: (field) => (
                <ProFormSelect
                  name={[field.name, 'equipment_id']}
                  options={equipmentOptions}
                  rules={[{ required: true }]}
                  showSearch
                  formItemProps={{ noStyle: true }}
                  fieldProps={{ style: { width: '100%' }, placeholder: t('common.select') }}
                />
              ),
            },
            {
              title: t(`${P}.form.scheme`),
              key: 'scheme_id',
              render: (field) => (
                <ProFormSelect
                  name={[field.name, 'scheme_id']}
                  options={schemeOptions}
                  showSearch
                  allowClear
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

export default PatrolRoutesPage;

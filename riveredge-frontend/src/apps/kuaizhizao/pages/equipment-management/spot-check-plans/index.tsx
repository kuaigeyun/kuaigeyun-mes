/**
 * 设备点检计划：方案为真源（设备取方案绑定，周期取点检方案）。
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Row } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { formDateFormItemProps, coerceFormDate } from '../../../../../utils/formDate';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { normalizeEquipmentListResponse } from '../../../utils/equipmentListCore';
import { spotCheckPlanApi } from '../../../services/equipment';
import { inspectionSchemesApi } from '../../../services/equipmentOps';
import { rowActionKind } from '../../../../../components/uni-action';
import { StatusTag } from '../../../../../constants/statusBadges';
import { resolveDocumentStatusTagColor } from '../../../../../constants/documentStatusColors';

const P = 'app.kuaizhizao.spotCheckPlan';
const RESOURCE = 'kuaizhizao:equipment-spot-check-plan';
const SPOT_RESOURCE = 'kuaizhizao:equipment-spot-check';

type EquipmentItem = { id?: number; uuid?: string; code?: string; name?: string };

interface SpotCheckPlan {
  id?: number;
  uuid?: string;
  plan_no?: string;
  plan_name?: string;
  scheme_id?: number;
  scheme_code?: string;
  scheme_name?: string;
  equipment_uuid?: string;
  equipment_uuids?: string[];
  equipment_items?: EquipmentItem[];
  equipment_name?: string;
  bound_equipment_count?: number;
  cycle_type?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  responsible_person_id?: number;
  responsible_person_name?: string;
  status?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

function formatBoundEquipmentText(plan: SpotCheckPlan, boundLabel: (n: number) => string): string {
  if (typeof plan.bound_equipment_count === 'number') {
    return boundLabel(plan.bound_equipment_count);
  }
  const items = plan.equipment_items;
  if (items?.length) {
    return items
      .map((item) => {
        const code = item.code?.trim();
        const name = item.name?.trim() || '-';
        return code ? `${code} - ${name}` : name;
      })
      .join('、');
  }
  return plan.equipment_name || '-';
}

function toApiDateTimeString(value: unknown): string | undefined {
  const d = coerceFormDate(value);
  return d ? d.format('YYYY-MM-DD HH:mm:ss') : undefined;
}

const SpotCheckPlansPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const { canCreate, canUpdate, canDelete } = useResourcePermissions(RESOURCE);
  const spotPerms = useResourcePermissions(SPOT_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<SpotCheckPlan | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown>>();
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<SpotCheckPlan | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [schemeCyclePreview, setSchemeCyclePreview] = useState<string | undefined>();

  const statusEnum = useMemo(
    () => ({
      草稿: { text: t(`${P}.status.draft`) },
      已发布: { text: t(`${P}.status.published`) },
      执行中: { text: t(`${P}.status.running`) },
      已完成: { text: t(`${P}.status.completed`) },
      已取消: { text: t(`${P}.status.cancelled`) },
    }),
    [t],
  );

  const boundLabel = useCallback(
    (n: number) => t(`${P}.col.boundEquipmentCount`, { count: n }),
    [t],
  );

  const handleCreate = useCallback(() => {
    setIsEdit(false);
    setCurrentPlan(null);
    setSchemeCyclePreview(undefined);
    setFormInitialValues({
      status: '草稿',
      planned_start_date: dayjs(),
    });
    setModalVisible(true);
  }, []);

  useNewShortcut(handleCreate, canCreate);

  const handleEdit = async (record: SpotCheckPlan) => {
    if (!record.uuid) return;
    try {
      const data = (await spotCheckPlanApi.get(record.uuid)) as SpotCheckPlan;
      setIsEdit(true);
      setCurrentPlan(data);
      setSchemeCyclePreview(data.cycle_type);
      setFormInitialValues({
        ...data,
        planned_start_date: data.planned_start_date ? dayjs(data.planned_start_date) : undefined,
        planned_end_date: data.planned_end_date ? dayjs(data.planned_end_date) : undefined,
      });
      setModalVisible(true);
    } catch {
      messageApi.error(t(`${P}.loadFailed`));
    }
  };

  const handleDetail = async (record: SpotCheckPlan) => {
    if (!record.uuid) return;
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const data = (await spotCheckPlanApi.get(record.uuid)) as SpotCheckPlan;
      setDetail(data);
    } catch {
      messageApi.error(t(`${P}.loadFailed`));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const payload = {
        plan_name: values.plan_name,
        scheme_id: values.scheme_id,
        planned_start_date: toApiDateTimeString(values.planned_start_date) ?? null,
        planned_end_date: toApiDateTimeString(values.planned_end_date) ?? null,
        responsible_person_id: values.responsible_person_id,
        responsible_person_name: values.responsible_person_name,
        status: values.status,
        remark: values.remark,
      };
      if (isEdit && currentPlan?.uuid) {
        await spotCheckPlanApi.update(currentPlan.uuid, payload);
        messageApi.success(t(`${P}.updateSuccess`));
      } else {
        await spotCheckPlanApi.create(payload);
        messageApi.success(t(`${P}.createSuccess`));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t(`${P}.saveFailed`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    try {
      await Promise.all(keys.map((k) => spotCheckPlanApi.delete(String(k))));
      messageApi.success(t(`${P}.deleteSuccess`));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch {
      messageApi.error(t(`${P}.deleteFailed`));
    }
  };

  const handleGenerate = async (record: SpotCheckPlan) => {
    if (!record.uuid) return;
    try {
      const res = (await spotCheckPlanApi.generateSpotChecks(record.uuid, {})) as {
        total?: number;
      };
      messageApi.success(t(`${P}.generateSuccess`, { count: res.total ?? 0 }));
      actionRef.current?.reload();
      navigate('/apps/kuaizhizao/equipment-management/spot-checks');
    } catch (e: any) {
      messageApi.error(e?.message || t(`${P}.generateFailed`));
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<SpotCheckPlan>[] = useMemo(
    () => [
      { title: t(`${P}.col.planNo`), dataIndex: 'plan_no' },
      { title: t(`${P}.col.planName`), dataIndex: 'plan_name' },
      {
        title: t(`${P}.col.scheme`),
        dataIndex: 'scheme_name',
        render: (_, r) =>
          r.scheme_code ? `${r.scheme_code} - ${r.scheme_name || ''}` : r.scheme_name || '-',
      },
      {
        title: t(`${P}.col.boundEquipment`),
        dataIndex: 'bound_equipment_count',
        render: (_, r) => formatBoundEquipmentText(r, boundLabel),
      },
      { title: t(`${P}.col.cycleType`), dataIndex: 'cycle_type' },
      {
        title: t(`${P}.col.plannedStartDate`),
        dataIndex: 'planned_start_date',
        render: (_, r) =>
          r.planned_start_date ? formatDateTimeBySiteSetting(r.planned_start_date) : '-',
      },
      {
        title: t(`${P}.col.plannedEndDate`),
        dataIndex: 'planned_end_date',
        render: (_, r) =>
          r.planned_end_date ? formatDateTimeBySiteSetting(r.planned_end_date) : '-',
      },
      { title: t(`${P}.col.responsible`), dataIndex: 'responsible_person_name' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) =>
          r.status ? (
            <StatusTag color={resolveDocumentStatusTagColor(r.status)}>{r.status}</StatusTag>
          ) : (
            '-'
          ),
      },
      { title: t('common.remark'), dataIndex: 'remark' },
    ],
    [t, boundLabel],
  );
  const detailItems = useDetailDrawerDescriptionItems(detailBaseColumns, detail);

  const columns: ProColumns<SpotCheckPlan>[] = useMemo(
    () =>
      alignProColumns<SpotCheckPlan>(
        [
          {
            title: t(`${P}.col.planNo`),
            dataIndex: 'plan_no',
            key: 'plan_no',
            copyable: true,
            uniTableKeepWidth: true,
          },
          {
            title: t(`${P}.col.planName`),
            dataIndex: 'plan_name',
            key: 'plan_name',
            ellipsis: true,
          },
          {
            title: t(`${P}.col.scheme`),
            dataIndex: 'scheme_name',
            key: 'scheme_name',
            render: (_, r) => r.scheme_name || r.scheme_code || '-',
          },
          {
            title: t(`${P}.col.boundEquipment`),
            dataIndex: 'bound_equipment_count',
            key: 'bound_equipment_count',
            uniTableKeepWidth: true,
            search: false,
            render: (_, r) => formatBoundEquipmentText(r, boundLabel),
          },
          {
            title: t(`${P}.col.cycleType`),
            dataIndex: 'cycle_type',
            key: 'cycle_type',
            uniTableKeepWidth: true,
            search: false,
          },
          {
            title: t(`${P}.col.plannedStartDate`),
            dataIndex: 'planned_start_date',
            key: 'planned_start_date',
            valueType: 'dateRange',
            search: { transform: (v) => ({ planned_start_date: v?.[0], planned_end_date: v?.[1] }) },
            render: (_, r) =>
              r.planned_start_date ? formatDateTimeBySiteSetting(r.planned_start_date) : '-',
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'lifecycle',
            valueType: 'select',
            valueEnum: statusEnum,
            fixed: 'right',
            uniTableKeepWidth: true,
            render: (_, r) =>
              r.status ? (
                <StatusTag color={resolveDocumentStatusTagColor(r.status)}>{r.status}</StatusTag>
              ) : (
                '-'
              ),
          },
          ...buildDocumentAuditColumns<SpotCheckPlan>(t),
          {
            title: t('common.action'),
            valueType: 'option',
            key: 'option',
            fixed: 'right',
            render: (_, record) => {
              const nodes: React.ReactNode[] = [];
              nodes.push(
                <a key="view" {...rowActionKind('read')} onClick={() => void handleDetail(record)}>
                  {t('common.view')}
                </a>,
              );
              if (canUpdate) {
                nodes.push(
                  <a key="edit" {...rowActionKind('update')} onClick={() => void handleEdit(record)}>
                    {t('common.edit')}
                  </a>,
                );
              }
              if (
                spotPerms.canCreate &&
                canUpdate &&
                record.status &&
                !['已取消', '已完成'].includes(record.status)
              ) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="generate"
                    title={t(`${P}.generateConfirm`)}
                    onConfirm={() => void handleGenerate(record)}
                  >
                    <a {...rowActionKind('execute')}>{t(`${P}.generate`)}</a>
                  </ActionConfirmPopconfirm>,
                );
              }
              if (canDelete && record.uuid) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="delete"
                    title={t(`${P}.deleteConfirm`)}
                    onConfirm={() => void handleDelete([record.uuid!])}
                  >
                    <a {...rowActionKind('delete')}>{t('common.delete')}</a>
                  </ActionConfirmPopconfirm>,
                );
              }
              return nodes;
            },
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [t, statusEnum, canUpdate, canDelete, spotPerms.canCreate, boundLabel],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<SpotCheckPlan>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spot-check-plans-v2"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          request={async (params, _sort, _filter, search) => {
            try {
              const response = await spotCheckPlanApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword: params.keyword || search?.keyword,
                status: params.status,
                scheme_id: params.scheme_id,
                planned_start_date: params.planned_start_date,
                planned_end_date: params.planned_end_date,
              });
              const { data, total } = normalizeEquipmentListResponse(response);
              return { data: data as SpotCheckPlan[], success: true, total };
            } catch {
              messageApi.error(t(`${P}.listFailed`));
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={canDelete}
          onRowSelectionChange={setSelectedRowKeys}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          showDeleteButton={canDelete}
          deleteConfirmTitle={t(`${P}.batchDeleteTitle`)}
          deleteConfirmDescription={(count) => t(`${P}.batchDeleteContent`, { count })}
          onDelete={handleDelete}
          showCreateButton={canCreate}
          createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentPlan(null);
          setFormInitialValues(undefined);
          setSchemeCyclePreview(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={submitting}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="plan_name"
              label={t(`${P}.form.planName`)}
              rules={[{ required: true, message: t(`${P}.form.planNameRequired`) }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="scheme_id"
              label={t(`${P}.form.scheme`)}
              showSearch
              rules={[{ required: true, message: t(`${P}.form.schemeRequired`) }]}
              request={async () => {
                try {
                  const res = await inspectionSchemesApi.list({
                    limit: 500,
                    domain: 'equipment',
                    is_active: true,
                  });
                  const items = (res as any)?.items || (res as any)?.data || [];
                  return items.map((s: any) => ({
                    label: `${s.code} - ${s.name}`,
                    value: s.id,
                    cycle_type: s.cycle_type,
                  }));
                } catch {
                  return [];
                }
              }}
              fieldProps={{
                onChange: (_val: number, option: any) => {
                  setSchemeCyclePreview(option?.cycle_type || undefined);
                },
              }}
              extra={
                schemeCyclePreview
                  ? t(`${P}.form.cycleFromScheme`, { cycle: schemeCyclePreview })
                  : t(`${P}.form.cycleFromSchemeHint`)
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label={t('common.status')}
              options={[
                { label: t(`${P}.status.draft`), value: '草稿' },
                { label: t(`${P}.status.published`), value: '已发布' },
                { label: t(`${P}.status.running`), value: '执行中' },
                { label: t(`${P}.status.completed`), value: '已完成' },
                { label: t(`${P}.status.cancelled`), value: '已取消' },
              ]}
              rules={[{ required: true, message: t(`${P}.form.statusRequired`) }]}
            />
          </Col>
          <Col span={12}>
            <UniUserSelect
              name="responsible_person_uuid"
              label={t(`${P}.col.responsible`)}
              onChange={(_value, user) => {
                const picked = Array.isArray(user) ? user[0] : user;
                formRef.current?.setFieldsValue({
                  responsible_person_id: picked?.id ?? undefined,
                  responsible_person_name: picked?.full_name || picked?.username || undefined,
                });
              }}
            />
            <ProFormText name="responsible_person_id" hidden />
            <ProFormText name="responsible_person_name" hidden />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_start_date"
              label={t(`${P}.col.plannedStartDate`)}
              fieldProps={{ ...formDateFormItemProps, showTime: true, format: 'YYYY-MM-DD HH:mm:ss' }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_end_date"
              label={t(`${P}.col.plannedEndDate`)}
              fieldProps={{ ...formDateFormItemProps, showTime: true, format: 'YYYY-MM-DD HH:mm:ss' }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 3 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t(`${P}.detailTitle`)}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        loading={detailLoading}
        basic={detailItems}
      />
    </>
  );
};

export default SpotCheckPlansPage;

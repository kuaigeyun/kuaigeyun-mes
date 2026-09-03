import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import type { ColumnsType } from 'antd/es/table';
import { EquipmentPersonSelect, resolveUserUuidById } from '../../../components/EquipmentPersonSelect';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { App, Button, Modal, Row, Col, Table, Switch, Input, Typography } from 'antd';
import { MarkerTag } from '../../../../../constants/statusBadges';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  MasterDataLinesTable,
  renderEquipmentMasterRowActions,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { patrolRoutesApi, routePatrolsApi } from '../../../services/equipmentOps';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { ROUTES } from '../../../constants/routes';
import {
  buildAbnormalityValueEnum,
  buildSpotCheckStatusValueEnum,
  EQUIPMENT_OPS_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveRoutePatrolListParams,
} from '../../../utils/equipmentListCore';
import LineAttachmentsUpload from '../../../components/LineAttachmentsUpload';
import type { DocumentAttachmentFile } from '../../../utils/documentAttachments';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
const P = 'app.kuaizhizao.equipmentOps.routePatrol';
const RESOURCE = 'kuaizhizao:equipment-route-patrol';

function formatRoutePatrolFormDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');
  const parsed = dayjs(value as string | number | Date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

interface RoutePatrolLine {
  step_no?: number;
  equipment_id?: number;
  equipment_code?: string;
  equipment_name?: string;
  item_id?: number;
  item_code?: string;
  item_name?: string;
  measured_value?: string;
  is_pass?: boolean;
  remark?: string;
  fault_report_uuid?: string;
  attachments?: DocumentAttachmentFile[];
}

interface RoutePatrol {
  id?: number;
  uuid?: string;
  document_no?: string;
  route_id?: number;
  route_code?: string;
  route_name?: string;
  patrol_date?: string;
  inspector_name?: string;
  inspector_id?: number;
  status?: string;
  has_abnormality?: boolean;
  updated_at?: string;
  lines?: RoutePatrolLine[];
}

const RoutePatrolsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const urlUuidRef = useRef<string | undefined>(undefined);
  const deepLinkOpenedRef = useRef(false);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<RoutePatrol | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [previewLines, setPreviewLines] = useState<RoutePatrolLine[]>([]);
  const [routeOptions, setRouteOptions] = useState<{ label: string; value: number }[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<RoutePatrol>();

  const handleDetail = useCallback(
    (record: RoutePatrol) => {
      if (!record.id) return;
      void openDetail(() => routePatrolsApi.get(record.id!) as Promise<RoutePatrol>);
    },
    [openDetail],
  );

  useEffect(() => {
    const uuidFromUrl = searchParams.get('uuid')?.trim() || undefined;
    urlUuidRef.current = uuidFromUrl;
    if (!uuidFromUrl) {
      deepLinkOpenedRef.current = false;
      actionRef.current?.reload();
      return;
    }
    if (deepLinkOpenedRef.current) {
      actionRef.current?.reload();
      return;
    }
    deepLinkOpenedRef.current = true;
    void (async () => {
      try {
        const res = await routePatrolsApi.list({ uuid: uuidFromUrl, skip: 0, limit: 1 });
        const { data } = normalizeEquipmentListResponse(res);
        if (data.length > 0) {
          handleDetail(data[0] as RoutePatrol);
        }
      } catch {
        messageApi.error(t(`${P}.listFailed`));
      }
      actionRef.current?.reload();
    })();
  }, [searchParams, handleDetail, messageApi, t]);

  const loadRouteOptions = async () => {
    const res = await patrolRoutesApi.list({ limit: 1000, is_active: true });
    setRouteOptions(
      (res.items ?? []).map((r: { id: number; code: string; name: string }) => ({
        label: `${r.code} - ${r.name}`,
        value: r.id,
      })),
    );
  };

  const handlePreview = async (routeId?: number) => {
    if (!routeId) {
      setPreviewLines([]);
      return;
    }
    try {
      const res = await routePatrolsApi.previewLines({ route_id: routeId });
      setPreviewLines(res.lines ?? []);
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.previewFailed`)));
      setPreviewLines([]);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setPreviewLines([]);
    setFormInitialValues({ patrol_date: dayjs() });
    setModalVisible(true);
    void loadRouteOptions();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: RoutePatrol) => {
    if (!record.id) return;
    try {
      const detail = await routePatrolsApi.get(record.id);
      const inspectorUuid = await resolveUserUuidById(detail.inspector_id);
      setIsEdit(true);
      setCurrent(detail);
      setPreviewLines(detail.lines ?? []);
      setFormInitialValues({
        route_id: detail.route_id,
        patrol_date: detail.patrol_date ? dayjs(detail.patrol_date) : dayjs(),
        inspector_uuid: inspectorUuid,
        inspector_id: detail.inspector_id,
        inspector_name: detail.inspector_name,
        remark: detail.remark,
      });
      setModalVisible(true);
      void loadRouteOptions();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.listFailed`)));
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    for (const id of keys) {
          await routePatrolsApi.delete(Number(id));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!previewLines.length) {
      messageApi.warning(t(`${P}.noPreviewLines`));
      return;
    }
    const payload = {
      route_id: values.route_id,
      patrol_date: formatRoutePatrolFormDate(values.patrol_date),
      inspector_id: values.inspector_id,
      inspector_name: values.inspector_name,
      remark: values.remark,
      lines: previewLines.map((l) => ({
        step_no: l.step_no,
        equipment_id: l.equipment_id,
        item_id: l.item_id,
        item_code: l.item_code,
        item_name: l.item_name,
        measured_value: l.measured_value,
        is_pass: l.is_pass ?? true,
        remark: l.remark,
        attachments: l.attachments?.length ? l.attachments : undefined,
      })),
    };
    setSubmitting(true);
    try {
      let saved: RoutePatrol | null = null;
      if (isEdit && current?.id) {
        saved = (await routePatrolsApi.update(current.id, payload)) as RoutePatrol;
        messageApi.success(t('common.updateSuccess'));
      } else {
        saved = (await routePatrolsApi.create(payload)) as RoutePatrol;
        messageApi.success(t('common.createSuccess'));
      }
      const abnormal =
        Boolean(saved?.has_abnormality) ||
        previewLines.some((l) => l.is_pass === false);
      if (abnormal) {
        messageApi.info(t(`${P}.faultAutoCreated`));
      }
      setModalVisible(false);
      setFormInitialValues(undefined);
      setPreviewLines([]);
      actionRef.current?.reload();
      if (detailVisible && detail?.id === current?.id && current?.id) {
        void handleDetail({ id: current.id });
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.submitFailed`)));
    } finally {
      setSubmitting(false);
    }
  };

  const lineColumns = [
    { title: t(`${P}.line.step`), dataIndex: 'step_no', width: 60 },
    { title: t(`${P}.line.equipment`), dataIndex: 'equipment_name', width: 140 },
    { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 120 },
    {
      title: t(`${P}.line.measuredValue`),
      dataIndex: 'measured_value',
      width: 120,
      render: (_: unknown, row: RoutePatrolLine, index: number) => (
        <Input
          size="small"
          value={row.measured_value}
          onChange={(e) => {
            const next = [...previewLines];
            next[index] = { ...next[index], measured_value: e.target.value };
            setPreviewLines(next);
          }}
        />
      ),
    },
    {
      title: t(`${P}.line.isPass`),
      dataIndex: 'is_pass',
      width: 80,
      render: (_: unknown, row: RoutePatrolLine, index: number) => (
        <Switch
          size="small"
          checked={row.is_pass ?? true}
          onChange={(checked) => {
            const next = [...previewLines];
            next[index] = { ...next[index], is_pass: checked };
            setPreviewLines(next);
          }}
        />
      ),
    },
    {
      title: t(`${P}.line.photos`, { defaultValue: '照片' }),
      dataIndex: 'attachments',
      width: 180,
      render: (_: unknown, row: RoutePatrolLine, index: number) => (
        <LineAttachmentsUpload
          category="equipment_route_patrol_line"
          value={row.attachments}
          onChange={(next) => {
            const copy = [...previewLines];
            copy[index] = { ...copy[index], attachments: next };
            setPreviewLines(copy);
          }}
        />
      ),
    },
    {
      title: t(`${P}.line.fault`),
      dataIndex: 'fault_report_uuid',
      width: 100,
      render: (_: unknown, row: RoutePatrolLine) =>
        row.fault_report_uuid ? (
          <Typography.Link
            onClick={() => {
              navigate(
                `${ROUTES.EQUIPMENT_FAULTS}?uuid=${encodeURIComponent(row.fault_report_uuid!)}`,
              );
            }}
          >
            {t(`${P}.viewFault`)}
          </Typography.Link>
        ) : (
          '-'
        ),
    },
  ];

  const routePatrolStatusValueEnum = useMemo(() => buildSpotCheckStatusValueEnum(t), [t]);
  const abnormalityValueEnum = useMemo(() => buildAbnormalityValueEnum(t, P), [t]);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<RoutePatrol>[]>(
    () => [
      { title: t(`${P}.col.documentNo`), dataIndex: 'document_no' },
      { title: t(`${P}.col.route`), dataIndex: 'route_name' },
      { title: t(`${P}.col.patrolDate`), dataIndex: 'patrol_date', valueType: 'date' },
      { title: t(`${P}.col.inspector`), dataIndex: 'inspector_name' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status),
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        render: (_, r) =>
          r.has_abnormality ? (
            <MarkerTag color="error">{t(`${P}.abnormal`)}</MarkerTag>
          ) : (
            <MarkerTag color="success">{t(`${P}.normal`)}</MarkerTag>
          ),
      },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const detailLineColumns = useMemo<ColumnsType<RoutePatrolLine>>(
    () => [
      { title: t(`${P}.line.step`), dataIndex: 'step_no', width: 60 },
      { title: t(`${P}.line.equipment`), dataIndex: 'equipment_name', width: 140 },
      { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 120 },
      { title: t(`${P}.line.measuredValue`), dataIndex: 'measured_value', width: 120 },
      {
        title: t(`${P}.line.isPass`),
        dataIndex: 'is_pass',
        width: 80,
        render: (_, row) =>
          row.is_pass === false ? (
            <MarkerTag color="error">{t(`${P}.abnormal`)}</MarkerTag>
          ) : (
            <MarkerTag color="success">{t(`${P}.normal`)}</MarkerTag>
          ),
      },
      {
        title: t(`${P}.line.photos`, { defaultValue: '照片' }),
        dataIndex: 'attachments',
        width: 180,
        render: (_, row) => (
          <LineAttachmentsUpload
            category="equipment_route_patrol_line"
            value={row.attachments}
            readOnly
          />
        ),
      },
      {
        title: t(`${P}.line.fault`),
        dataIndex: 'fault_report_uuid',
        width: 100,
        render: (_, row) =>
          row.fault_report_uuid ? (
            <Typography.Link
              onClick={() =>
                navigate(
                  `${ROUTES.EQUIPMENT_FAULTS}?uuid=${encodeURIComponent(row.fault_report_uuid!)}`,
                )
              }
            >
              {t(`${P}.viewFault`)}
            </Typography.Link>
          ) : (
            '-'
          ),
      },
      { title: t(`${P}.line.remark`, { defaultValue: '备注' }), dataIndex: 'remark', ellipsis: true },
    ],
    [t, navigate],
  );

  const columns: ProColumns<RoutePatrol>[] = useMemo(() => alignProColumns<RoutePatrol>([
      {
        title: t(`${P}.col.patrolDate`),
        dataIndex: 'patrol_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: routePatrolStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        valueType: 'select',
        valueEnum: abnormalityValueEnum,
        hideInTable: true,
        search: { order: 21 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.documentNo`),
        dataIndex: 'document_no',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (r.document_no != null && r.document_no !== '' ? String(r.document_no) : '-'),
      },
      {
        title: t(`${P}.col.route`),
        dataIndex: 'route_name',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.route_name != null && r.route_name !== '' ? String(r.route_name) : '-'),
      },
      {
        title: t(`${P}.col.patrolDate`),
        dataIndex: 'patrol_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.inspector`),
        dataIndex: 'inspector_name',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.inspector_name != null && r.inspector_name !== '' ? String(r.inspector_name) : '-',
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.has_abnormality ? (
            <MarkerTag color="error">{t(`${P}.abnormal`)}</MarkerTag>
          ) : (
            <MarkerTag color="success">{t(`${P}.normal`)}</MarkerTag>
          ),
      },
      {
        title: t(`${P}.col.linkedFault`),
        key: 'linked_fault',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) =>
          r.has_abnormality ? (
            <Typography.Link
              onClick={(e) => {
                e.stopPropagation();
                void handleDetail(r);
              }}
            >
              {t(`${P}.viewFault`)}
            </Typography.Link>
          ) : (
            '-'
          ),
      },
      ...buildDocumentAuditColumns<RoutePatrol>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        hideInSearch: true,
        fixed: 'right',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status),
      },
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
    [t, perms, routePatrolStatusValueEnum, abnormalityValueEnum, handleDetail],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<RoutePatrol>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.routePatrols)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.route-patrols-width-v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          pinnedTabsField={EQUIPMENT_OPS_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          onRow={(record) => ({
            onClick: () => perms.canRead && handleDetail(record),
            style: { cursor: perms.canRead ? 'pointer' : undefined },
          })}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveRoutePatrolListParams(searchFormValues, sort);
              const res = await routePatrolsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
                ...(urlUuidRef.current ? { uuid: urlUuidRef.current } : {}),
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as RoutePatrol[], success: true, total };
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
      </ListPageTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t(`${P}.detailTitle`, { defaultValue: t('common.detail') })}${detail?.document_no ? ` - ${detail.document_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailBasicColumns}
        linesTitle={t(`${P}.form.lines`, { defaultValue: '巡检项' })}
        lines={
          <MasterDataLinesTable
            rows={detail?.lines ?? []}
            columns={detailLineColumns}
            rowKey={(row) => String(row.step_no ?? row.equipment_id ?? '')}
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
          setPreviewLines([]);
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
            <ProFormSelect
              name="route_id"
              label={t(`${P}.form.route`)}
              options={routeOptions}
              rules={[{ required: true }]}
              showSearch
              fieldProps={{
                onChange: (val: number) => void handlePreview(val),
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="patrol_date"
              label={t(`${P}.col.patrolDate`)}
              rules={[{ required: true }]}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <EquipmentPersonSelect
              uuidFieldName="inspector_uuid"
              idFieldName="inspector_id"
              nameFieldName="inspector_name"
              label={t(`${P}.col.inspector`)}
              formRef={formRef}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
        {previewLines.length > 0 && (
          <Table
            size="small"
            rowKey={(r) => String(r.step_no ?? r.equipment_id)}
            columns={lineColumns}
            dataSource={previewLines}
            pagination={false}
            style={{ marginTop: 16 }}
          />
        )}
      </FormModalTemplate>
    </>
  );
};

export default RoutePatrolsPage;

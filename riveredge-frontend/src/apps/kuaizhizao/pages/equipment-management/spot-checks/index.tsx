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
import { equipmentApi } from '../../../services/equipment';
import { inspectionSchemesApi, spotChecksApi } from '../../../services/equipmentOps';
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
  resolveSpotCheckListParams,
} from '../../../utils/equipmentListCore';
import LineAttachmentsUpload from '../../../components/LineAttachmentsUpload';
import type { DocumentAttachmentFile } from '../../../utils/documentAttachments';
import { fetchKuaiiotFillContext } from '../../../../../utils/kuaiiotFillContext';
import { getAntdModal } from '../../../../../utils/antdAppApis';
const P = 'app.kuaizhizao.equipmentOps.spotCheck';
const RESOURCE = 'kuaizhizao:equipment-spot-check';

function formatSpotCheckFormDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');
  const parsed = dayjs(value as string | number | Date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

interface SpotCheckLine {
  line_no?: number;
  item_id?: number;
  item_code?: string;
  item_name?: string;
  requirement?: string;
  value_type?: string;
  unit?: string;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
  measured_value?: string;
  is_pass?: boolean;
  remark?: string;
  attachments?: DocumentAttachmentFile[];
}

interface SpotCheck {
  id?: number;
  uuid?: string;
  document_no?: string;
  equipment_id?: number;
  equipment_code?: string;
  equipment_name?: string;
  scheme_id?: number;
  check_date?: string;
  inspector_name?: string;
  status?: string;
  has_abnormality?: boolean;
  fault_report_uuid?: string;
  abnormality_description?: string;
  updated_at?: string;
  lines?: SpotCheckLine[];
}

const SpotChecksPage: React.FC = () => {
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
  const [current, setCurrent] = useState<SpotCheck | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [previewLines, setPreviewLines] = useState<SpotCheckLine[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [equipmentUuidById, setEquipmentUuidById] = useState<Record<number, string>>({});
  const [schemeOptions, setSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<SpotCheck>();

  const handleDetail = useCallback(
    (record: SpotCheck) => {
      if (!record.id) return;
      void openDetail(() => spotChecksApi.get(record.id!) as Promise<SpotCheck>);
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
        const res = await spotChecksApi.list({ uuid: uuidFromUrl, skip: 0, limit: 1 });
        const { data } = normalizeEquipmentListResponse(res);
        if (data.length > 0) {
          handleDetail(data[0] as SpotCheck);
        }
      } catch {
        messageApi.error(t(`${P}.listFailed`));
      }
      actionRef.current?.reload();
    })();
  }, [searchParams, handleDetail, messageApi, t]);

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
    setEquipmentUuidById(
      Object.fromEntries(
        (eqRes.items ?? [])
          .filter((eq: { id: number; uuid?: string }) => eq.id && eq.uuid)
          .map((eq: { id: number; uuid: string }) => [eq.id, eq.uuid]),
      ),
    );
    setSchemeOptions(
      (schRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
        label: `${s.code} - ${s.name}`,
        value: s.id,
      })),
    );
  };

  const handlePreview = async (equipmentId?: number, schemeId?: number) => {
    if (!equipmentId) {
      setPreviewLines([]);
      return;
    }
    if (!schemeId) {
      setPreviewLines([]);
      return;
    }
    try {
      const res = await spotChecksApi.previewLines({
        equipment_id: equipmentId,
        scheme_id: schemeId,
      });
      setPreviewLines(
        (res.lines ?? []).map((l) => {
          const valueType = String(l.value_type || 'boolean').toLowerCase();
          const isBoolean =
            valueType === 'boolean' || valueType === 'bool' || valueType === '是/否';
          const isPass = l.is_pass ?? true;
          return {
            ...l,
            is_pass: isPass,
            measured_value: isBoolean
              ? l.measured_value?.trim()
                ? l.measured_value
                : isPass
                  ? '是'
                  : '否'
              : l.measured_value,
          };
        }),
      );
      const equipmentUuid = equipmentUuidById[equipmentId];
      if (equipmentUuid) {
        const fillContext = await fetchKuaiiotFillContext({
          context: 'spot_check',
          equipment_uuid: equipmentUuid,
        });
        if (fillContext?.values && Object.keys(fillContext.values).length > 0) {
          setPreviewLines((prev) =>
            prev.map((line) => {
              const key = line.item_code || String(line.item_id || '');
              const filled = fillContext.values[key];
              if (filled == null || filled === '') return line;
              if (line.measured_value && String(line.measured_value).trim()) return line;
              return {
                ...line,
                measured_value: String(filled),
              };
            }),
          );
        }
      }
      if (res.scheme_id) {
        formRef.current?.setFieldsValue({ scheme_id: res.scheme_id });
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.previewFailed`)));
      setPreviewLines([]);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setPreviewLines([]);
    setFormInitialValues({ check_date: dayjs() });
    setModalVisible(true);
    void loadOptions();
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: SpotCheck) => {
    if (!record.id) return;
    try {
      const detail = await spotChecksApi.get(record.id);
      const inspectorUuid = await resolveUserUuidById(detail.inspector_id);
      setIsEdit(true);
      setCurrent(detail);
      setPreviewLines(detail.lines ?? []);
      setFormInitialValues({
        equipment_id: detail.equipment_id,
        scheme_id: detail.scheme_id,
        check_date: detail.check_date ? dayjs(detail.check_date) : dayjs(),
        inspector_uuid: inspectorUuid,
        inspector_id: detail.inspector_id,
        inspector_name: detail.inspector_name,
        remark: detail.remark,
      });
      setModalVisible(true);
      void loadOptions();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.listFailed`)));
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    getAntdModal().confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await spotChecksApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!previewLines.length) {
      messageApi.warning(t(`${P}.noPreviewLines`));
      return;
    }
    const payload = {
      equipment_id: values.equipment_id,
      scheme_id: values.scheme_id,
      check_date: formatSpotCheckFormDate(values.check_date),
      inspector_id: values.inspector_id,
      inspector_name: values.inspector_name,
      remark: values.remark,
      lines: previewLines.map((l) => ({
        line_no: l.line_no,
        item_id: l.item_id,
        item_code: l.item_code,
        item_name: l.item_name,
        requirement: l.requirement,
        value_type: l.value_type,
        unit: l.unit,
        numeric_min: l.numeric_min,
        numeric_max: l.numeric_max,
        measured_value: l.measured_value,
        is_pass: l.is_pass,
        remark: l.remark,
        attachments: l.attachments?.length ? l.attachments : undefined,
      })),
    };
    setSubmitting(true);
    try {
      let saved: SpotCheck | null = null;
      if (isEdit && current?.id) {
        saved = (await spotChecksApi.update(current.id, payload)) as SpotCheck;
        messageApi.success(t('common.updateSuccess'));
      } else {
        saved = (await spotChecksApi.create(payload)) as SpotCheck;
        messageApi.success(t('common.createSuccess'));
      }
      const abnormal =
        Boolean(saved?.has_abnormality) ||
        previewLines.some((l) => l.is_pass === false);
      if (abnormal || saved?.fault_report_uuid) {
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
    { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 140 },
    { title: t(`${P}.line.requirement`), dataIndex: 'requirement', ellipsis: true },
    { title: t(`${P}.line.unit`), dataIndex: 'unit', width: 60 },
    {
      title: t(`${P}.line.measuredValue`),
      dataIndex: 'measured_value',
      width: 120,
      render: (_: unknown, row: SpotCheckLine, index: number) => {
        const valueType = String(row.value_type || 'boolean').toLowerCase();
        // 是/否项只需合格开关，不展示实测值录入
        if (valueType === 'boolean' || valueType === 'bool' || valueType === '是/否') {
          return <span>—</span>;
        }
        return (
          <Input
            size="small"
            value={row.measured_value}
            onChange={(e) => {
              const next = [...previewLines];
              next[index] = { ...next[index], measured_value: e.target.value };
              setPreviewLines(next);
            }}
          />
        );
      },
    },
    {
      title: t(`${P}.line.isPass`),
      dataIndex: 'is_pass',
      width: 80,
      render: (_: unknown, row: SpotCheckLine, index: number) => (
        <Switch
          size="small"
          checked={row.is_pass ?? true}
          onChange={(checked) => {
            const next = [...previewLines];
            const valueType = String(row.value_type || 'boolean').toLowerCase();
            const isBoolean =
              valueType === 'boolean' || valueType === 'bool' || valueType === '是/否';
            next[index] = {
              ...next[index],
              is_pass: checked,
              ...(isBoolean ? { measured_value: checked ? '是' : '否' } : {}),
            };
            setPreviewLines(next);
          }}
        />
      ),
    },
    {
      title: t(`${P}.line.photos`, { defaultValue: '照片' }),
      dataIndex: 'attachments',
      width: 180,
      render: (_: unknown, row: SpotCheckLine, index: number) => (
        <LineAttachmentsUpload
          category="equipment_spot_check_line"
          value={row.attachments}
          onChange={(next) => {
            const copy = [...previewLines];
            copy[index] = { ...copy[index], attachments: next };
            setPreviewLines(copy);
          }}
        />
      ),
    },
  ];

  const spotCheckStatusValueEnum = useMemo(() => buildSpotCheckStatusValueEnum(t), [t]);
  const abnormalityValueEnum = useMemo(() => buildAbnormalityValueEnum(t, P), [t]);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<SpotCheck>[]>(
    () => [
      { title: t(`${P}.col.documentNo`), dataIndex: 'document_no' },
      { title: t(`${P}.col.equipment`), dataIndex: 'equipment_name' },
      { title: t(`${P}.col.checkDate`), dataIndex: 'check_date', valueType: 'date' },
      { title: t(`${P}.col.inspector`), dataIndex: 'inspector_name' },
      {
        title: t(`${P}.col.status`),
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
      {
        title: t(`${P}.col.linkedFault`),
        key: 'fault_report_uuid',
        render: (_, r) =>
          r.fault_report_uuid ? (
            <Typography.Link
              onClick={() =>
                navigate(
                  `${ROUTES.EQUIPMENT_FAULTS}?uuid=${encodeURIComponent(r.fault_report_uuid!)}`,
                )
              }
            >
              {t(`${P}.viewFault`)}
            </Typography.Link>
          ) : (
            '-'
          ),
      },
      { title: t(`${P}.form.remark`), dataIndex: 'remark', span: 2 },
    ],
    [t, navigate],
  );

  const detailLineColumns = useMemo<ColumnsType<SpotCheckLine>>(
    () => [
      { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 140 },
      { title: t(`${P}.line.requirement`), dataIndex: 'requirement', ellipsis: true },
      { title: t(`${P}.line.unit`), dataIndex: 'unit', width: 60 },
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
            category="equipment_spot_check_line"
            value={row.attachments}
            readOnly
          />
        ),
      },
      { title: t(`${P}.line.remark`, { defaultValue: '备注' }), dataIndex: 'remark', ellipsis: true },
    ],
    [t],
  );

  const columns: ProColumns<SpotCheck>[] = useMemo(() => alignProColumns<SpotCheck>([
      {
        title: t(`${P}.col.checkDate`),
        dataIndex: 'check_date_range',
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
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: spotCheckStatusValueEnum,
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
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.equipment`),
        dataIndex: 'equipment_name',
        width: 160,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.checkDate`),
        dataIndex: 'check_date',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.inspector`),
        dataIndex: 'inspector_name',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        width: 80,
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
        dataIndex: 'fault_report_uuid',
        width: 120,
        hideInSearch: true,
        render: (_, r) =>
          r.fault_report_uuid ? (
            <Typography.Link
              onClick={(e) => {
                e.stopPropagation();
                navigate(
                  `${ROUTES.EQUIPMENT_FAULTS}?uuid=${encodeURIComponent(r.fault_report_uuid!)}`,
                );
              }}
            >
              {t(`${P}.viewFault`)}
            </Typography.Link>
          ) : (
            '-'
          ),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<SpotCheck>(t),
      {
        title: t(`${P}.col.status`),
        key: 'lifecycle',
        dataIndex: 'status',
        hideInSearch: true,
        fixed: 'right',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status),
      },
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
    [t, perms, spotCheckStatusValueEnum, abnormalityValueEnum, navigate, handleDetail],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<SpotCheck>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spot-checks-equip-rank-v1"
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
              const listParams = resolveSpotCheckListParams(searchFormValues, sort);
              const res = await spotChecksApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
                ...(urlUuidRef.current ? { uuid: urlUuidRef.current } : {}),
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as SpotCheck[], success: true, total };
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
        title={`${t(`${P}.detailTitle`, { defaultValue: t('common.detail') })}${detail?.document_no ? ` - ${detail.document_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailBasicColumns}
        linesTitle={t(`${P}.form.lines`, { defaultValue: '点检项' })}
        lines={
          <MasterDataLinesTable
            rows={detail?.lines ?? []}
            columns={detailLineColumns}
            rowKey={(row) => String(row.line_no ?? row.item_id ?? '')}
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
              name="equipment_id"
              label={t(`${P}.form.equipment`)}
              options={equipmentOptions}
              rules={[{ required: true }]}
              showSearch
              fieldProps={{
                onChange: (val: number) => {
                  const schemeId = formRef.current?.getFieldValue('scheme_id');
                  void handlePreview(val, schemeId);
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="scheme_id"
              label={t(`${P}.form.scheme`)}
              options={schemeOptions}
              rules={[{ required: true, message: t(`${P}.schemeRequired`) }]}
              showSearch
              allowClear
              fieldProps={{
                onChange: (val: number) => {
                  const equipmentId = formRef.current?.getFieldValue('equipment_id');
                  void handlePreview(equipmentId, val);
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="check_date"
              label={t(`${P}.col.checkDate`)}
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
            <ProFormTextArea name="remark" label={t(`${P}.form.remark`)} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
        {previewLines.length > 0 && (
          <Table
            size="small"
            rowKey={(r) => String(r.line_no ?? r.item_id)}
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

export default SpotChecksPage;

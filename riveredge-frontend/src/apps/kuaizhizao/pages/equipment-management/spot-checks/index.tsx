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
import { App, Button, Grid, Modal, Row, Col, Table, Switch, Input, Typography, Select } from 'antd';
import { MarkerTag } from '../../../../../constants/statusBadges';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalGridBlock, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  MasterDataLinesTable,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { equipmentApi } from '../../../services/equipment';
import { inspectionSchemesApi, schemeBindingsApi, spotChecksApi } from '../../../services/equipmentOps';
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
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  buildSpotCheckImportTemplate,
  runSpotCheckExcelImport,
} from './spotCheckExcelImport';
const P = 'app.kuaizhizao.equipmentOps.spotCheck';
const RESOURCE = 'kuaizhizao:equipment-spot-check';

function formatSpotCheckFormDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');
  const parsed = dayjs(value as string | number | Date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

interface SpotCheckLine extends Record<string, unknown> {
  line_no?: number;
  item_id?: number;
  item_code?: string;
  item_name?: string;
  requirement?: string;
  method?: string;
  judgment_standard?: string;
  value_type?: string;
  unit?: string;
  numeric_min?: number | string | null;
  numeric_max?: number | string | null;
  measured_value?: string;
  is_pass?: boolean | null;
  photo_required?: boolean;
  remark?: string;
  attachments?: DocumentAttachmentFile[];
}

interface SpotCheck extends Record<string, unknown> {
  id?: number;
  uuid?: string;
  document_no?: string;
  equipment_id?: number;
  equipment_code?: string;
  equipment_name?: string;
  scheme_id?: number;
  capture_mode?: string;
  check_date?: string;
  inspector_id?: number;
  inspector_name?: string;
  reviewer_user_id?: number;
  reviewer_user_name?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  reject_reason?: string;
  status?: string;
  has_abnormality?: boolean;
  fault_report_uuid?: string;
  abnormality_description?: string;
  attachments?: DocumentAttachmentFile[];
  remark?: string;
  updated_at?: string;
  lines?: SpotCheckLine[];
}

const SpotChecksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const screens = Grid.useBreakpoint();
  const perms = useResourcePermissions(RESOURCE);
  const canApprove = perms.canAction?.('approve') ?? false;
  const canReject = perms.canAction?.('reject') ?? false;
  const actionRef = useRef<ActionType>(null);
  const urlUuidRef = useRef<string | undefined>(undefined);
  const deepLinkOpenedRef = useRef(false);
  const createDeepLinkHandledRef = useRef(false);
  const schemeDomain = (searchParams.get('domain') || '').trim().toLowerCase() || undefined;
  const urlSchemeId = Number(searchParams.get('scheme_id') || 0) || undefined;
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<SpotCheck | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [previewLines, setPreviewLines] = useState<SpotCheckLine[]>([]);
  const [captureMode, setCaptureMode] = useState<string>('A');
  const [headerAttachments, setHeaderAttachments] = useState<DocumentAttachmentFile[]>([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<SpotCheck | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [equipmentOptions, setEquipmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [equipmentUuidById, setEquipmentUuidById] = useState<Record<number, string>>({});
  const [equipmentById, setEquipmentById] = useState<
    Record<
      number,
      {
        spot_check_person_id?: number;
        spot_check_person_name?: string;
      }
    >
  >({});
  const [schemeOptions, setSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<SpotCheck>();

  const spotCheckImportTemplate = useMemo(() => buildSpotCheckImportTemplate(t), [t]);

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
      inspectionSchemesApi.list({
        limit: 1000,
        is_active: true,
        ...(schemeDomain ? { domain: schemeDomain } : { domain: 'equipment' }),
      }),
    ]);
    const equipmentItems = eqRes.items ?? [];
    setEquipmentOptions(
      equipmentItems.map((eq: { id: number; code: string; name: string }) => ({
        label: `${eq.code} - ${eq.name}`,
        value: eq.id,
      })),
    );
    setEquipmentUuidById(
      Object.fromEntries(
        equipmentItems
          .filter((eq: { id: number; uuid?: string }) => eq.id && eq.uuid)
          .map((eq: { id: number; uuid: string }) => [eq.id, eq.uuid]),
      ),
    );
    setEquipmentById(
      Object.fromEntries(
        equipmentItems
          .filter((eq: { id: number }) => eq.id)
          .map(
            (eq: {
              id: number;
              spot_check_person_id?: number;
              spot_check_person_name?: string;
            }) => [
              eq.id,
              {
                spot_check_person_id: eq.spot_check_person_id,
                spot_check_person_name: eq.spot_check_person_name,
              },
            ],
          ),
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
      setCaptureMode('A');
      setHeaderAttachments([]);
      return;
    }
    if (!schemeId) {
      setPreviewLines([]);
      setCaptureMode('A');
      setHeaderAttachments([]);
      return;
    }
    try {
      const res = await spotChecksApi.previewLines({
        equipment_id: equipmentId,
        scheme_id: schemeId,
      });
      const mode = String(res.capture_mode || 'A').toUpperCase();
      setCaptureMode(mode);
      setHeaderAttachments([]);
      setPreviewLines(
        (res.lines ?? []).map((l) => {
          const valueType = String(l.value_type || 'boolean').toLowerCase();
          const isBoolean =
            valueType === 'boolean' || valueType === 'bool' || valueType === '是/否';
          const isPass = l.is_pass ?? true;
          return {
            ...l,
            photo_required: Boolean(l.photo_required),
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
      setCaptureMode('A');
      setHeaderAttachments([]);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setPreviewLines([]);
    setCaptureMode('A');
    setHeaderAttachments([]);
    setFormInitialValues({
      check_date: dayjs(),
      ...(urlSchemeId ? { scheme_id: urlSchemeId } : {}),
    });
    setModalVisible(true);
    void loadOptions();
  };
  useNewShortcut(handleCreate);

  useEffect(() => {
    if (searchParams.get('create') !== '1') {
      createDeepLinkHandledRef.current = false;
      return;
    }
    if (createDeepLinkHandledRef.current || !perms.canCreate) return;
    createDeepLinkHandledRef.current = true;
    handleCreate();
  }, [searchParams, perms.canCreate]);

  const handleEdit = async (record: SpotCheck) => {
    if (!record.id) return;
    try {
      const detail = await spotChecksApi.get(record.id);
      const inspectorUuid = await resolveUserUuidById(detail.inspector_id);
      setIsEdit(true);
      setCurrent(detail);
      setPreviewLines(detail.lines ?? []);
      setCaptureMode(String(detail.capture_mode || 'A').toUpperCase());
      setHeaderAttachments(detail.attachments ?? []);
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
    for (const id of keys) {
          await spotChecksApi.delete(Number(id));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
  };

  const handleApprove = async (record: SpotCheck) => {
    if (!record.id) return;
    try {
      await spotChecksApi.approve(record.id);
      messageApi.success(t(`${P}.approveSuccess`));
      actionRef.current?.reload();
      if (detail?.id === record.id) {
        void handleDetail(record);
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.approveFailed`)));
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget?.id || !rejectReason.trim()) return;
    try {
      await spotChecksApi.reject(rejectTarget.id, { reject_reason: rejectReason.trim() });
      messageApi.success(t(`${P}.rejectSuccess`));
      setRejectModalVisible(false);
      setRejectTarget(null);
      setRejectReason('');
      actionRef.current?.reload();
      if (detail?.id === rejectTarget.id) {
        void handleDetail(rejectTarget);
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.rejectFailed`)));
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const mode = String(captureMode || 'A').toUpperCase();
    if (mode === 'B') {
      if (!headerAttachments.length) {
        messageApi.warning(t(`${P}.headerPhotosRequired`));
        return;
      }
    } else if (!previewLines.length) {
      messageApi.warning(t(`${P}.noPreviewLines`));
      return;
    } else if (mode === 'C') {
      const missing = previewLines.find(
        (l) => l.photo_required && !(l.attachments && l.attachments.length),
      );
      if (missing) {
        messageApi.warning(
          t(`${P}.linePhotoRequired`, {
            name: missing.item_name || missing.item_code || missing.line_no,
          }),
        );
        return;
      }
    }
    const payload = {
      equipment_id: values.equipment_id,
      scheme_id: values.scheme_id,
      check_date: formatSpotCheckFormDate(values.check_date),
      inspector_id: values.inspector_id,
      inspector_name: values.inspector_name,
      remark: values.remark,
      attachments: mode === 'B' ? headerAttachments : undefined,
      lines:
        mode === 'B'
          ? []
          : previewLines.map((l) => ({
              line_no: l.line_no,
              item_id: l.item_id,
              item_code: l.item_code,
              item_name: l.item_name,
              requirement: l.requirement,
              method: l.method,
              judgment_standard: l.judgment_standard,
              value_type: l.value_type,
              unit: l.unit,
              numeric_min: l.numeric_min,
              numeric_max: l.numeric_max,
              measured_value: l.measured_value,
              is_pass: l.is_pass,
              photo_required: Boolean(l.photo_required),
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
      setHeaderAttachments([]);
      setCaptureMode('A');
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
    { title: t(`${P}.line.method`), dataIndex: 'method', ellipsis: true, width: 120 },
    {
      title: t(`${P}.line.judgmentStandard`),
      dataIndex: 'judgment_standard',
      ellipsis: true,
      width: 120,
    },
    { title: t(`${P}.line.requirement`), dataIndex: 'requirement', ellipsis: true },
    { title: t('common.unit'), dataIndex: 'unit', width: 60 },
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
      width: 120,
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
      {
        title: t(`${P}.col.captureMode`),
        dataIndex: 'capture_mode',
        render: (_, r) =>
          r.capture_mode
            ? t(
                `app.kuaizhizao.equipmentOps.inspectionScheme.captureMode.${String(r.capture_mode).toUpperCase()}`,
                String(r.capture_mode),
              )
            : '-',
      },
      { title: t(`${P}.col.checkDate`), dataIndex: 'check_date', valueType: 'date' },
      { title: t(`${P}.col.inspector`), dataIndex: 'inspector_name' },
      { title: t(`${P}.col.reviewer`), dataIndex: 'reviewer_user_name' },
      { title: t(`${P}.col.reviewedBy`), dataIndex: 'reviewed_by_name' },
      { title: t(`${P}.col.reviewedAt`), dataIndex: 'reviewed_at', valueType: 'dateTime' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status),
      },
      { title: t(`${P}.form.rejectReason`), dataIndex: 'reject_reason', span: 2 },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        render: (_, r) =>
          r.status === '待执行' || r.status === '已取消' ? '-' : r.has_abnormality ? (
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
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t, navigate],
  );

  const detailLineColumns = useMemo<ColumnsType<SpotCheckLine>>(
    () => [
      { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 140 },
      { title: t(`${P}.line.requirement`), dataIndex: 'requirement', ellipsis: true },
      { title: t('common.unit'), dataIndex: 'unit', width: 60 },
      { title: t(`${P}.line.measuredValue`), dataIndex: 'measured_value', width: 120 },
      {
        title: t(`${P}.line.isPass`),
        dataIndex: 'is_pass',
        width: 80,
        render: (_, row) =>
          row.is_pass == null ? '-' : row.is_pass === false ? (
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
        title: '执行班次', dataIndex: 'shift_name', search: false, width: 100,
      },
      {
        title: '执行截止', dataIndex: 'due_at', search: false, valueType: 'dateTime', width: 165,
      },
      {
        title: t(`${P}.col.checkDate`),
        dataIndex: 'check_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as unknown as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as unknown as ProColumns['search'],
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: spotCheckStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as unknown as ProColumns['search'],
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        valueType: 'select',
        valueEnum: abnormalityValueEnum,
        hideInTable: true,
        search: { order: 21 } as unknown as ProColumns['search'],
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
        search: { order: 30 } as unknown as ProColumns['search'],
        render: (_, r) => (r.document_no != null && r.document_no !== '' ? String(r.document_no) : '-'),
      },
      {
        title: t(`${P}.col.equipment`),
        dataIndex: 'equipment_name',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.equipment_name != null && r.equipment_name !== '' ? String(r.equipment_name) : '-'),
      },
      {
        title: t(`${P}.col.checkDate`),
        dataIndex: 'check_date',
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
        title: t(`${P}.col.reviewer`),
        dataIndex: 'reviewer_user_name',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) =>
          r.reviewer_user_name != null && r.reviewer_user_name !== ''
            ? String(r.reviewer_user_name)
            : '-',
      },
      {
        title: t(`${P}.col.abnormality`),
        dataIndex: 'has_abnormality',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.status === '待执行' || r.status === '已取消' ? '-' : r.has_abnormality ? (
            <MarkerTag color="error">{t(`${P}.abnormal`)}</MarkerTag>
          ) : (
            <MarkerTag color="success">{t(`${P}.normal`)}</MarkerTag>
          ),
      },
      {
        title: t(`${P}.col.linkedFault`),
        dataIndex: 'fault_report_uuid',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
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
      ...buildDocumentAuditColumns<SpotCheck>(t),
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
        render: (_, record) => {
          const editable = ['待执行', '待审核', '已驳回'].includes(record.status || '');
          return (
            <>
              {perms.canRead ? (
                <Button
                  {...rowActionKind('read')}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDetail(record);
                  }}
                >
                  {t('common.detail')}
                </Button>
              ) : null}
              {perms.canUpdate && editable ? (
                <Button
                  {...rowActionKind('update')}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleEdit(record);
                  }}
                >
                  {t('common.edit')}
                </Button>
              ) : null}
              {canApprove && record.status === '待审核' ? (
                <Button
                  {...rowActionKind('approve')}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleApprove(record);
                  }}
                >
                  {t(`${P}.action.approve`)}
                </Button>
              ) : null}
              {canReject && record.status === '待审核' ? (
                <Button
                  {...rowActionKind('reject')}
                  danger
                  onClick={(e) => {
                    e.stopPropagation();
                    setRejectTarget(record);
                    setRejectReason('');
                    setRejectModalVisible(true);
                  }}
                >
                  {t(`${P}.action.reject`)}
                </Button>
              ) : null}
              {perms.canDelete && editable ? (
                <ActionConfirmPopconfirm
                  title={t('common.deleteTitle')}
                  onConfirm={() => {
                    if (record.id != null) void handleDelete([record.id]);
                  }}
                >
                  <Button {...rowActionKind('delete')} danger onClick={(e) => e.stopPropagation()}>
                    {t('common.delete')}
                  </Button>
                </ActionConfirmPopconfirm>
              ) : null}
            </>
          );
        },
      },
    ] as ProColumns<SpotCheck>[], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, canApprove, canReject, spotCheckStatusValueEnum, abnormalityValueEnum, navigate, handleDetail],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<SpotCheck>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.spotChecks)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spot-checks-review-r10-v1"
          permissionResource={RESOURCE}
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
                scheme_domain: schemeDomain || 'equipment',
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
          showImportButton={perms.canImport}
          importHeaders={spotCheckImportTemplate.importHeaders}
          importExampleRow={spotCheckImportTemplate.importExampleRow}
          importColumnOptions={spotCheckImportTemplate.importColumnOptions}
          importFieldMap={spotCheckImportTemplate.importHeaderMap}
          onImport={async (data) => {
            const { success } = await runSpotCheckExcelImport({
              data,
              t,
              messageApi,
              schemeDomain,
            });
            if (success > 0) {
              actionRef.current?.reload();
            }
          }}
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
        linesTitle={t(`${P}.form.lines`, { defaultValue: '点检项' })}
        lines={
          <MasterDataLinesTable
            rows={detail?.lines ?? []}
            columns={detailLineColumns}
            rowKey={(row) => String(row.line_no ?? row.item_id ?? '')}
            emptyDescription={t('common.noData')}
          />
        }
        extra={buildDetailDrawerEditExtra(
          t,
          Boolean(
            detail &&
              perms.canUpdate &&
              ['待执行', '待审核', '已驳回'].includes(detail.status || ''),
          ),
          () => {
            if (!detail) return;
            closeDetail();
            void handleEdit(detail);
          },
        )}
      />

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
          setPreviewLines([]);
          setHeaderAttachments([]);
          setCaptureMode('A');
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={submitting}
        width={screens.md ? MODAL_CONFIG.LARGE_WIDTH : Math.min(360, window.innerWidth - 24)}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <FormModalGridBlock>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <ProFormSelect
              name="equipment_id"
              label={t(`${P}.form.equipment`)}
              options={equipmentOptions}
              rules={[{ required: true }]}
              showSearch
              fieldProps={{
                onChange: (val: number) => {
                  void (async () => {
                    let schemeId = formRef.current?.getFieldValue('scheme_id') as number | undefined;
                    if (!isEdit && val) {
                      try {
                        const bindings = await schemeBindingsApi.list({
                          equipment_id: val,
                          scheme_type: 'spot_check',
                        });
                        if (bindings.length === 1) {
                          schemeId = bindings[0].scheme_id;
                          formRef.current?.setFieldsValue({ scheme_id: schemeId });
                        }
                      } catch (error: unknown) {
                        messageApi.error(getApiErrorMessage(error, t(`${P}.previewFailed`)));
                      }
                    }
                    void handlePreview(val, schemeId);
                    if (!isEdit && val) {
                      const equipment = equipmentById[val];
                      if (equipment?.spot_check_person_id) {
                        formRef.current?.setFieldsValue({
                          inspector_id: equipment.spot_check_person_id,
                          inspector_name: equipment.spot_check_person_name,
                        });
                        void resolveUserUuidById(equipment.spot_check_person_id).then((uuid) => {
                          formRef.current?.setFieldsValue({ inspector_uuid: uuid });
                        });
                      }
                    }
                  })();
                },
              }}
            />
          </Col>
          <Col xs={24} md={12}>
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
          <Col xs={24} md={12}>
            <ProFormDatePicker
              name="check_date"
              label={t(`${P}.col.checkDate`)}
              rules={[{ required: true }]}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col xs={24} md={12}>
            <EquipmentPersonSelect
              uuidFieldName="inspector_uuid"
              idFieldName="inspector_id"
              nameFieldName="inspector_name"
              label={t(`${P}.col.inspector`)}
              formRef={formRef}
            />
          </Col>
          <Col span={24}>
            <Typography.Text type="secondary">
              {t(`${P}.col.captureMode`)}：
              {t(
                `app.kuaizhizao.equipmentOps.inspectionScheme.captureMode.${String(captureMode || 'A').toUpperCase()}`,
                String(captureMode || 'A'),
              )}
            </Typography.Text>
          </Col>
        </Row>
        {String(captureMode).toUpperCase() === 'B' ? (
          <div style={{ marginTop: 16 }}>
            <Typography.Text>{t(`${P}.form.headerPhotos`)}</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <LineAttachmentsUpload
                category="equipment_spot_check"
                value={headerAttachments}
                onChange={setHeaderAttachments}
              />
            </div>
          </div>
        ) : (
          previewLines.length > 0 && (
            <Table
              size="small"
              rowKey={(r) => String(r.line_no ?? r.item_id)}
              columns={lineColumns}
              dataSource={previewLines}
              pagination={false}
              style={{ marginTop: 16 }}
              scroll={{ x: 1100 }}
            />
          )
        )}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
        </FormModalGridBlock>
      </FormModalTemplate>

      <Modal
        title={t(`${P}.rejectModal`)}
        open={rejectModalVisible}
        onOk={() => void handleRejectConfirm()}
        onCancel={() => setRejectModalVisible(false)}
        destroyOnHidden
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t(`${P}.form.rejectReason`)}
        />
      </Modal>
    </>
  );
};

export default SpotChecksPage;

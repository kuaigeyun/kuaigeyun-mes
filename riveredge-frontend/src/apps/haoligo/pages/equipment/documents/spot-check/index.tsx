/**
 * 好力 GO — 设备点检单（选设备自动带出点检项；卡片式明细；分项异常描述）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDateTimePicker,
  ProFormDependency,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Space,
  Spin,
  Switch,
  Select,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PrinterOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import HaoligoDocumentPrintModal from '../../../../components/HaoligoDocumentPrintModal';
import { HAOLIGO_RESOURCE_EQUIPMENT_SPOT_CHECK } from '../../../../constants/documentPermissionResources';
import { canPrintHaoligoDocument } from '../../../../utils/documentPrintPermission';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import {
  createEquipmentSpotCheck,
  deleteEquipmentSpotCheck,
  getEquipment,
  listHaoligoNotifyUserOptions,
  getEquipmentSpotCheck,
  listEquipmentSpotChecks,
  listEquipments,
  listInspectionParamSets,
  previewEquipmentSpotCheckLines,
  updateEquipmentSpotCheck,
  type EquipmentSpotCheckLineRow,
  type EquipmentSpotCheckPreviewLine,
  type EquipmentSpotCheckRow,
} from '../../../../services/haoligo';
import { uploadFile, type FileUploadResponse } from '../../../../../../services/file';
import { useGlobalStore } from '../../../../../../stores';
import { MoldAttachmentImagePreview } from '../../../../components/MoldAttachmentImagePreview';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';
import { SecurePictureCardUpload } from '../../../../components/SecurePictureCardUpload';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { useEquipmentOperationalStatusLabels } from '../../../../utils/equipmentOperationalStatus';
import {
  formatMultiselectMeasuredValue,
  normalizeInspectionValueType,
  parseMultiselectMeasuredValue,
} from '../../../../utils/inspectionParamValueType';
import {
  applyNumericRangeToSpotCheckLine,
  formatNumericRangeLabel,
  isNumericMeasuredOutOfRange,
} from '../../../../utils/inspectionNumericRange';
import { formatDateTime } from '../../../../../../utils/format';

function normalizeLine(ln: EquipmentSpotCheckLineRow): EquipmentSpotCheckLineRow {
  const ids = ln.attachment_file_ids;
  return {
    ...ln,
    sort_order: ln.sort_order ?? 0,
    value_type: ln.value_type || 'numeric',
    is_required: ln.is_required ?? true,
    attachment_file_ids: Array.isArray(ids) ? ids : ids == null ? null : [],
  };
}

function previewLineToDraft(pl: EquipmentSpotCheckPreviewLine): EquipmentSpotCheckLineRow {
  const base = normalizeLine({
    id: 0,
    inspection_param_id: pl.inspection_param_id,
    param_code: pl.param_code,
    param_name: pl.param_name,
    param_requirement: pl.param_requirement ?? null,
    sort_order: pl.sort_order,
    value_type: pl.value_type,
    unit: pl.unit,
    is_required: pl.is_required,
    numeric_min: pl.numeric_min ?? null,
    numeric_max: pl.numeric_max ?? null,
    result: 'normal',
    measured_value: pl.default_value ?? null,
    remark: null,
    attachment_file_ids: null,
  });
  return applyNumericRangeToSpotCheckLine(base);
}

function lineMatchKey(ln: { param_code: string; sort_order: number }) {
  return `${ln.param_code}::${ln.sort_order}`;
}

type EditSelectSeed = {
  equipmentId: number;
  equipmentLabel: string;
  inspectionParamSetId?: number | null;
  inspectionParamSetLabel?: string;
};

function mergeSelectOption(
  opts: { label: string; value: number }[],
  value: number | undefined | null,
  label: string | undefined,
): { label: string; value: number }[] {
  if (value == null || !Number.isFinite(Number(value))) return opts;
  const v = Number(value);
  if (opts.some((o) => o.value === v)) return opts;
  const lb = (label || '').trim() || `ID ${v}`;
  return [{ label: lb, value: v }, ...opts];
}

const SpotCheckDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const loadLinesSeqRef = useRef(0);
  const reportUserLabelRef = useRef<Map<number, string>>(new Map());
  const { formatStatus, statusOptions } = useEquipmentOperationalStatusLabels();

  const [modalOpen, setModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [lines, setLines] = useState<EquipmentSpotCheckLineRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [planHint, setPlanHint] = useState<{ code: string; name: string } | null>(null);
  const [editSelectSeed, setEditSelectSeed] = useState<EditSelectSeed | null>(null);
  const [editFormInitialValues, setEditFormInitialValues] = useState<Record<string, unknown> | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printRowId, setPrintRowId] = useState<number | null>(null);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [planPickerOptions, setPlanPickerOptions] = useState<{ id: number; label: string }[]>([]);
  const [planPickerSelectedId, setPlanPickerSelectedId] = useState<number | null>(null);
  const [planPickerPendingEquipmentId, setPlanPickerPendingEquipmentId] = useState<number | null>(null);

  const title = t('app.haoligo.menu.equipment.documents.spot-check');
  const reload = useCallback(() => actionRef.current?.reload(), []);

  const currentUser = useGlobalStore((s) => s.currentUser);
  const canPrintSpotCheck = canPrintHaoligoDocument(currentUser, HAOLIGO_RESOURCE_EQUIPMENT_SPOT_CHECK);

  const searchReportNotifyUsers = useCallback(
    async (keyword?: string) => {
      const selIds = (formRef.current?.getFieldValue('report_notify_user_ids') as number[] | undefined) || [];
      const users = await listHaoligoNotifyUserOptions({
        keyword,
        limit: 80,
        selected_user_ids: selIds,
      });
      const opts = users.map((u) => ({ label: u.label, value: u.id }));
      for (const o of opts) {
        reportUserLabelRef.current.set(o.value, o.label);
      }
      return opts;
    },
    [],
  );

  const parseReportNotifyUserIds = (v: Record<string, unknown>): number[] => {
    const raw = v.report_notify_user_ids;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => Number(x)).filter((id) => Number.isFinite(id) && id > 0);
  };

  const loadInspectionLines = useCallback(
    async (opts?: { equipmentId?: number; setId?: number | null }) => {
      if (editId != null) return;
      const eqId = opts?.equipmentId ?? (formRef.current?.getFieldValue('equipment_id') as number | undefined);
      if (!eqId) {
        setLines([]);
        setPlanHint(null);
        return;
      }
      const setIdRaw =
        opts?.setId !== undefined
          ? opts.setId
          : (formRef.current?.getFieldValue('inspection_param_set_id') as number | string | undefined | null);
      const seq = ++loadLinesSeqRef.current;
      setLinesLoading(true);
      try {
        const res = await previewEquipmentSpotCheckLines({
          equipment_id: Number(eqId),
          inspection_param_set_id:
            setIdRaw != null && setIdRaw !== '' && Number.isFinite(Number(setIdRaw)) ? Number(setIdRaw) : undefined,
        });
        if (seq !== loadLinesSeqRef.current) return;
        formRef.current?.setFieldsValue({ inspection_param_set_id: res.inspection_param_set_id });
        setPlanHint({ code: res.inspection_param_set_code, name: res.inspection_param_set_name });
        setLines((res.lines || []).map(previewLineToDraft));
      } catch (e) {
        if (seq !== loadLinesSeqRef.current) return;
        setLines([]);
        setPlanHint(null);
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      } finally {
        if (seq === loadLinesSeqRef.current) setLinesLoading(false);
      }
    },
    [editId, messageApi, t],
  );

  const resolveEquipmentPlanIds = useCallback((eq: { inspection_param_set_ids?: number[] }) => {
    return eq.inspection_param_set_ids?.length ? eq.inspection_param_set_ids : [];
  }, []);

  const openPlanPicker = useCallback(
    async (equipmentId: number, setIds: number[]) => {
      const allSets = await listInspectionParamSets();
      const opts = setIds.map((id) => {
        const s = allSets.find((x) => x.id === id);
        return { id, label: s ? `${s.code} ${s.name}` : `ID ${id}` };
      });
      setPlanPickerOptions(opts);
      setPlanPickerSelectedId(opts[0]?.id ?? null);
      setPlanPickerPendingEquipmentId(equipmentId);
      setPlanPickerOpen(true);
    },
    [],
  );

  const applyEquipmentForSpotCheck = useCallback(
    async (equipmentId: number, presetSetId?: number | null) => {
      try {
        const eq = await getEquipment(equipmentId);
        const boundIds = resolveEquipmentPlanIds(eq);
        if (presetSetId != null && Number.isFinite(presetSetId)) {
          formRef.current?.setFieldsValue({ inspection_param_set_id: presetSetId });
          await loadInspectionLines({ equipmentId, setId: presetSetId });
          return;
        }
        if (boundIds.length > 1) {
          setLines([]);
          setPlanHint(null);
          formRef.current?.setFieldsValue({ inspection_param_set_id: undefined });
          await openPlanPicker(equipmentId, boundIds);
          return;
        }
        if (boundIds.length === 0) {
          setLines([]);
          setPlanHint(null);
          formRef.current?.setFieldsValue({ inspection_param_set_id: undefined });
          return;
        }
        const setId = boundIds[0];
        formRef.current?.setFieldsValue({ inspection_param_set_id: setId });
        await loadInspectionLines({ equipmentId, setId });
      } catch {
        await loadInspectionLines({ equipmentId, setId: presetSetId ?? null });
      }
    },
    [loadInspectionLines, openPlanPicker, resolveEquipmentPlanIds],
  );

  const openNew = () => {
    setDetailMode(false);
    setEditId(null);
    setEditSelectSeed(null);
    setEditFormInitialValues(null);
    setLines([]);
    setPlanHint(null);
    setPlanPickerOpen(false);
    setPlanPickerPendingEquipmentId(null);
    loadLinesSeqRef.current += 1;
    setModalOpen(true);
  };

  const getNewFormDefaults = useCallback(
    () => ({
      recorded_at: dayjs(),
      report_enabled: false,
      report_notify_user_ids: [] as number[],
    }),
    [],
  );

  const openEdit = async (id: number, view: boolean) => {
    setFormLoading(true);
    setDetailMode(view);
    loadLinesSeqRef.current += 1;
    try {
      const row = await getEquipmentSpotCheck(id);
      setEditId(id);
      setLines((row.lines || []).map(normalizeLine));
      setPlanHint(
        row.inspection_param_set_code || row.inspection_param_set_name
          ? {
              code: row.inspection_param_set_code || '',
              name: row.inspection_param_set_name || '',
            }
          : null,
      );
      const equipmentLabel =
        `${row.equipment_asset_code || ''} ${row.equipment_name || ''}`.trim() || `ID ${row.equipment_id}`;
      const planLabel = `${row.inspection_param_set_code || ''} ${row.inspection_param_set_name || ''}`.trim();
      setEditSelectSeed({
        equipmentId: row.equipment_id,
        equipmentLabel,
        inspectionParamSetId: row.inspection_param_set_id,
        inspectionParamSetLabel:
          planLabel || (row.inspection_param_set_id ? `ID ${row.inspection_param_set_id}` : undefined),
      });
      const notifyIds = row.report_notify_user_ids || [];
      setEditFormInitialValues({
        equipment_id: row.equipment_id,
        inspection_param_set_id: row.inspection_param_set_id ?? undefined,
        recorded_at: row.recorded_at ? dayjs(row.recorded_at) : undefined,
        applied_operational_status: row.applied_operational_status ?? undefined,
        report_enabled: row.report_enabled,
        report_notify_user_ids: notifyIds,
      });
      setModalOpen(true);
      if (notifyIds.length) {
        void listHaoligoNotifyUserOptions({ selected_user_ids: notifyIds, limit: 80 }).then((users) => {
          for (const u of users) reportUserLabelRef.current.set(u.id, u.label);
        });
      }
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const columns = useMemo<ProColumns<EquipmentSpotCheckRow>[]>(
    () => [
      { title: t('app.haoligo.equipment.documents.colSheetNo'), dataIndex: 'sheet_no', width: 140, ellipsis: true },
      {
        title: t('app.haoligo.equipment.documents.colRecordedAt'),
        dataIndex: 'recorded_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.recorded_at ? formatDateTime(r.recorded_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.searchRecordedFrom'),
        dataIndex: 'recorded_from',
        valueType: 'dateTime',
        hideInTable: true,
      },
      {
        title: t('app.haoligo.equipment.documents.searchRecordedTo'),
        dataIndex: 'recorded_to',
        valueType: 'dateTime',
        hideInTable: true,
      },
      {
        title: t('app.haoligo.equipment.documents.formEquipment'),
        dataIndex: 'equipment_id',
        hideInTable: true,
        valueType: 'select',
        fieldProps: { showSearch: true, allowClear: true },
        request: async ({ keyWords }) => {
          const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
          return (res.items || []).map((e) => ({ label: `${e.asset_code} ${e.name}`, value: e.id }));
        },
      },
      {
        title: t('app.haoligo.equipment.documents.formInspectionPlan'),
        dataIndex: 'inspection_param_set_id',
        hideInTable: true,
        valueType: 'select',
        fieldProps: { showSearch: true, allowClear: true },
        request: async () => {
          const rows = await listInspectionParamSets();
          return (rows || []).map((s) => ({ label: `${s.code} ${s.name}`, value: s.id }));
        },
      },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        dataIndex: 'equipment_asset_code',
        width: 200,
        ellipsis: true,
        render: (_, r) =>
          r.equipment_asset_code || r.equipment_name
            ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim()
            : `ID ${r.equipment_id}`,
      },
      {
        title: t('app.haoligo.equipment.documents.colInspectionPlan'),
        dataIndex: 'inspection_param_set_name',
        width: 160,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) =>
          r.inspection_param_set_name || r.inspection_param_set_code
            ? `${r.inspection_param_set_code || ''} ${r.inspection_param_set_name || ''}`.trim()
            : '—',
      },
      {
        title: t('app.haoligo.equipment.documents.colAppliedOperationalStatus'),
        dataIndex: 'applied_operational_status',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatStatus(r.applied_operational_status),
      },
      {
        title: t('app.haoligo.equipment.documents.colReportEnabled'),
        dataIndex: 'report_enabled',
        width: 88,
        hideInSearch: true,
        render: (_, r) => (r.report_enabled ? t('app.haoligo.equipment.documents.yes') : t('app.haoligo.equipment.documents.no')),
      },
      moldDocumentCreatedAtColumn<EquipmentSpotCheckRow>(),
      {
        title: t('app.haoligo.equipment.documents.colActions'),
        valueType: 'option',
        width: 220,
        fixed: 'right',
        render: (_, row) => [
          <Button {...rowActionKind('read')} key="v" onClick={() => openEdit(row.id, true)}>
            {t('app.haoligo.equipment.documents.actionView')}
          </Button>,
          ...(canPrintSpotCheck
            ? [
                <Button {...rowActionKind('print')}
                  key="p"
                  type="link"
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    setPrintRowId(row.id);
                    setPrintOpen(true);
                  }}
                >
                  {t('app.haoligo.print.printButton')}
                </Button>,
              ]
            : []),
          <Button {...rowActionKind('update')} key="e" onClick={() => openEdit(row.id, false)}>
            {t('app.haoligo.equipment.documents.actionEdit')}
          </Button>,
          <Button {...rowActionKind('delete')} key="delete" onClick={() => {
              modal.confirm({
                title: t('app.haoligo.equipment.documents.deleteConfirm'),
                onOk: async () => {
                  await deleteEquipmentSpotCheck(row.id);
                  messageApi.success(t('app.haoligo.equipment.updateSuccess'));
                  reload();
                },
              });
            }}
          />,
        ],
      },
    ],
    [formatStatus, messageApi, modal, reload, t],
  );

  const validateLines = (): boolean => {
    if (!lines.length) {
      messageApi.warning(t('app.haoligo.equipment.documents.spotCheckNoLines'));
      return false;
    }
    for (const ln of lines) {
      if (ln.is_required && !ln.result) {
        messageApi.warning(t('app.haoligo.equipment.documents.spotCheckRequiredResult', { name: ln.param_name }));
        return false;
      }
      if (ln.result === 'abnormal' && !(ln.remark || '').trim()) {
        messageApi.warning(t('app.haoligo.equipment.documents.spotCheckAbnormalDescRequired', { name: ln.param_name }));
        return false;
      }
    }
    return true;
  };

  const buildLinePatches = (serverLines: EquipmentSpotCheckLineRow[]) => {
    const draftByKey = new Map(lines.map((d) => [lineMatchKey(d), d]));
    return serverLines.map((serverLn) => {
      const draft = draftByKey.get(lineMatchKey(serverLn));
      return {
        id: serverLn.id,
        result: draft?.result ?? serverLn.result,
        remark: draft?.remark ?? null,
        measured_value: draft?.measured_value ?? null,
        attachment_file_ids: draft?.attachment_file_ids?.length ? draft.attachment_file_ids : null,
      };
    });
  };

  const submitSave = async () => {
    try {
      await formRef.current?.validateFields();
    } catch {
      return;
    }
    if (!validateLines()) return;

    const v = formRef.current?.getFieldsValue() as Record<string, unknown>;
    const reportNotifyIds = parseReportNotifyUserIds(v);
    if (Boolean(v.report_enabled) && !reportNotifyIds.length) {
      messageApi.warning(t('app.haoligo.equipment.documents.selectReportToUser'));
      return;
    }
    const appliedRaw = v.applied_operational_status;
    const headerPayload = {
      recorded_at: v.recorded_at ? dayjs(v.recorded_at as string).toISOString() : undefined,
      applied_operational_status:
        appliedRaw != null && appliedRaw !== '' ? String(appliedRaw) : null,
      report_enabled: Boolean(v.report_enabled),
      report_notify_user_ids: reportNotifyIds,
    };

    setFormLoading(true);
    try {
      if (editId != null) {
        await updateEquipmentSpotCheck(editId, {
          ...headerPayload,
          lines: lines.map((ln) => ({
            id: ln.id,
            result: ln.result,
            remark: ln.remark ?? null,
            measured_value: ln.measured_value ?? null,
            attachment_file_ids: ln.attachment_file_ids?.length ? ln.attachment_file_ids : null,
          })),
        });
      } else {
        const setIdRaw = v.inspection_param_set_id;
        const created = await createEquipmentSpotCheck({
          equipment_id: Number(v.equipment_id),
          inspection_param_set_id:
            setIdRaw != null && setIdRaw !== '' && Number.isFinite(Number(setIdRaw)) ? Number(setIdRaw) : undefined,
          ...headerPayload,
        });
        const patches = buildLinePatches((created.lines || []).map(normalizeLine));
        await updateEquipmentSpotCheck(created.id, { ...headerPayload, lines: patches });
      }
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      reload();
      setModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const valueTypeLabel = (vt: string) => {
    const key = normalizeInspectionValueType(vt);
    if (key === 'boolean') return t('app.haoligo.equipment.inspectionParams.valueTypeBoolean');
    if (key === 'text') return t('app.haoligo.equipment.inspectionParams.valueTypeText');
    if (key === 'multiselect') return t('app.haoligo.equipment.inspectionParams.valueTypeMultiselect');
    return t('app.haoligo.equipment.inspectionParams.valueTypeNumeric');
  };

  const renderMeasuredField = (row: EquipmentSpotCheckLineRow, idx: number, readOnly: boolean) => {
    const vt = normalizeInspectionValueType(row.value_type);
    if (readOnly) {
      if (vt === 'boolean') {
        return row.measured_value === 'true'
          ? t('app.haoligo.equipment.documents.boolYes')
          : row.measured_value === 'false'
            ? t('app.haoligo.equipment.documents.boolNo')
            : '—';
      }
      if (vt === 'multiselect') {
        const parts = parseMultiselectMeasuredValue(row.measured_value);
        return parts.length ? parts.join('、') : '—';
      }
      return row.measured_value || '—';
    }
    if (vt === 'boolean') {
      return (
        <Switch
          checked={row.measured_value === 'true'}
          checkedChildren={t('app.haoligo.equipment.documents.boolYes')}
          unCheckedChildren={t('app.haoligo.equipment.documents.boolNo')}
          onChange={(checked) => {
            const val = checked ? 'true' : 'false';
            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, measured_value: val } : x)));
          }}
        />
      );
    }
    if (vt === 'numeric') {
      const n = row.measured_value != null && row.measured_value !== '' ? Number(row.measured_value) : undefined;
      const outOfRange = isNumericMeasuredOutOfRange(row.measured_value, row.numeric_min, row.numeric_max);
      return (
        <div>
          <InputNumber
            style={{ width: '100%' }}
            status={outOfRange === true ? 'error' : undefined}
            value={Number.isFinite(n as number) ? (n as number) : undefined}
            onChange={(val) => {
              const s = val == null ? '' : String(val);
              setLines((prev) =>
                prev.map((x, i) =>
                  i === idx ? applyNumericRangeToSpotCheckLine({ ...x, measured_value: s || null }) : x,
                ),
              );
            }}
          />
          {outOfRange === true ? (
            <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {t('app.haoligo.equipment.documents.spotCheckOutOfRangeHint')}
            </Typography.Text>
          ) : null}
        </div>
      );
    }
    if (vt === 'multiselect') {
      const selected = parseMultiselectMeasuredValue(row.measured_value);
      return (
        <Select
          mode="tags"
          style={{ width: '100%' }}
          value={selected}
          tokenSeparators={[',', '，']}
          placeholder={t('app.haoligo.equipment.documents.spotCheckMultiselectPh')}
          onChange={(vals) => {
            const s = formatMultiselectMeasuredValue(vals.map(String));
            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, measured_value: s } : x)));
          }}
        />
      );
    }
    return (
      <Input
        style={{ width: '100%' }}
        value={row.measured_value || ''}
        onChange={(e) => {
          const val = e.target.value;
          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, measured_value: val || null } : x)));
        }}
      />
    );
  };

  const renderLineCard = (row: EquipmentSpotCheckLineRow, idx: number) => {
    const readOnly = detailMode;
    const rangeLabel =
      normalizeInspectionValueType(row.value_type) === 'numeric'
        ? formatNumericRangeLabel(row.numeric_min, row.numeric_max)
        : '';
    const meta = [valueTypeLabel(row.value_type), row.unit ? row.unit : null, rangeLabel || null]
      .filter(Boolean)
      .join(' · ');

    return (
      <Card
        key={row.id ? row.id : lineMatchKey(row)}
        size="small"
        style={{ marginBottom: 8 }}
        styles={{ body: { padding: '10px 14px' } }}
      >
        <Flex align="center" gap={8} wrap="wrap">
          <Typography.Text strong style={{ fontSize: 14 }}>
            {idx + 1}. {row.param_name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.param_code}
          </Typography.Text>
          {row.is_required ? (
            <Tag color="red" variant="filled" style={{ margin: 0 }}>
              {t('app.haoligo.equipment.documents.colRequiredShort')}
            </Tag>
          ) : null}
          {meta ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {meta}
            </Typography.Text>
          ) : null}
        </Flex>
        {row.param_requirement?.trim() ? (
          <div
            className="haoligo-spot-check-line-instruction"
            style={{
              marginTop: 8,
              padding: '8px 10px',
              background: 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.02))',
              borderRadius: 6,
              border: '1px solid var(--ant-color-border-secondary, rgba(0,0,0,0.06))',
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
              {t('app.haoligo.equipment.documents.colParamRequirement')}
            </Typography.Text>
            <Typography.Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {row.param_requirement.trim()}
            </Typography.Text>
          </div>
        ) : null}

        <Row gutter={[12, 8]} style={{ marginTop: 10 }}>
          <Col span={12}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('app.haoligo.equipment.documents.colMeasuredValue')}
            </Typography.Text>
            <div className="haoligo-spot-check-line-field">{renderMeasuredField(row, idx, readOnly)}</div>
          </Col>
          <Col span={12}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('app.haoligo.equipment.documents.colResult')}
            </Typography.Text>
            <div className="haoligo-spot-check-line-field">
              {readOnly ? (
                <Tag color={row.result === 'abnormal' ? 'error' : 'success'}>
                  {row.result === 'normal'
                    ? t('app.haoligo.equipment.documents.resultNormal')
                    : t('app.haoligo.equipment.documents.resultAbnormal')}
                </Tag>
              ) : (
                <Radio.Group
                  className="haoligo-spot-check-result-radio"
                  optionType="button"
                  buttonStyle="solid"
                  value={row.result}
                  onChange={(e) => {
                    const val = e.target.value as 'normal' | 'abnormal';
                    setLines((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, result: val, remark: val === 'normal' ? null : x.remark } : x,
                      ),
                    );
                  }}
                >
                  <Radio.Button
                    value="normal"
                    disabled={
                      isNumericMeasuredOutOfRange(row.measured_value, row.numeric_min, row.numeric_max) === true
                    }
                  >
                    {t('app.haoligo.equipment.documents.resultNormal')}
                  </Radio.Button>
                  <Radio.Button value="abnormal">{t('app.haoligo.equipment.documents.resultAbnormal')}</Radio.Button>
                </Radio.Group>
              )}
            </div>
          </Col>
          {row.result === 'abnormal' ? (
            <Col span={24}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {t('app.haoligo.equipment.documents.formLineAbnormalDesc')}
              </Typography.Text>
              {readOnly ? (
                <Typography.Text>{row.remark?.trim() ? row.remark : '—'}</Typography.Text>
              ) : (
                <Input.TextArea
                  rows={2}
                  value={row.remark || ''}
                  placeholder={t('app.haoligo.equipment.documents.formLineAbnormalDescPh')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, remark: val } : x)));
                  }}
                />
              )}
            </Col>
          ) : null}
          <Col span={24}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('app.haoligo.equipment.documents.colLinePhotos')}
            </Typography.Text>
            {readOnly ? (
              <MoldAttachmentImagePreview uuids={row.attachment_file_ids ?? undefined} />
            ) : (
              <SecurePictureCardUpload
                className="haoligo-spot-check-line-upload"
                uuids={row.attachment_file_ids ?? undefined}
                accept=".jpg,.jpeg,.png,.gif,.webp"
                onUuidsChange={(uuids) => {
                  setLines((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, attachment_file_ids: uuids.length ? uuids : null } : x,
                    ),
                  );
                }}
                customRequest={async (options) => {
                  try {
                    const file = options.file as File;
                    const res: FileUploadResponse = await uploadFile(file, {
                      category: 'haoligo_equipment_spot_check',
                    });
                    options.onSuccess?.(res, options.file);
                  } catch (e) {
                    options.onError?.(e instanceof Error ? e : new Error(String(e)));
                  }
                }}
              />
            )}
          </Col>
        </Row>
      </Card>
    );
  };

  const planSummaryText =
    planHint && lines.length > 0
      ? t('app.haoligo.equipment.documents.spotCheckAutoLoadedHint', {
          count: lines.length,
          plan: `${planHint.code} ${planHint.name}`.trim(),
        })
      : null;

  return (
    <>
    <ListPageTemplate>
      <UniTable<EquipmentSpotCheckRow>
        columnPersistenceId="apps.haoligo.pages.equipment.documents.spot-check"
        headerTitle={title}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch
        search={{ labelWidth: 'auto' }}
        showCreateButton
        createButtonText={t('app.haoligo.equipment.documents.btnNew')}
        onCreate={openNew}
        request={async (params, _sort, _filter, searchFormValues) => {
          const toIso = (v: unknown): string | undefined => {
            if (v == null || v === '') return undefined;
            if (dayjs.isDayjs(v)) return v.toISOString();
            const d = dayjs(v as string);
            return d.isValid() ? d.toISOString() : undefined;
          };
          const eqId = searchFormValues?.equipment_id;
          const setId = searchFormValues?.inspection_param_set_id;
          const res = await listEquipmentSpotChecks({
            skip: ((params.current || 1) - 1) * (params.pageSize || 50),
            limit: params.pageSize || 50,
            keyword: (params.keyword as string) || undefined,
            sheet_no: (params.sheet_no as string) || undefined,
            equipment_id:
              eqId != null && eqId !== '' && Number.isFinite(Number(eqId)) ? Number(eqId) : undefined,
            inspection_param_set_id:
              setId != null && setId !== '' && Number.isFinite(Number(setId)) ? Number(setId) : undefined,
            recorded_from: toIso(searchFormValues?.recorded_from),
            recorded_to: toIso(searchFormValues?.recorded_to),
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <Modal
        className="haoligo-spot-check-modal"
        title={
          detailMode
            ? `${title} — ${t('app.haoligo.equipment.documents.actionView')}`
            : editId != null
              ? `${title} — ${t('app.haoligo.equipment.documents.actionEdit')}`
              : `${title} — ${t('app.haoligo.equipment.documents.btnNew')}`
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditSelectSeed(null);
          setEditFormInitialValues(null);
        }}
        afterOpenChange={(open) => {
          if (!open) {
            setEditSelectSeed(null);
            setEditFormInitialValues(null);
            return;
          }
          if (editFormInitialValues) {
            formRef.current?.setFieldsValue(editFormInitialValues);
            return;
          }
          if (editId == null && !detailMode) {
            formRef.current?.setFieldsValue(getNewFormDefaults());
          }
        }}
        width={720}
        centered
        destroyOnHidden
        styles={{ body: { paddingTop: 8 } }}
        footer={
          detailMode ? (
            <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnClose')}</Button>
          ) : (
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
              <Button type="primary" loading={formLoading} onClick={() => void submitSave()}>
                {t('common.save')}
              </Button>
            </Space>
          )
        }
      >
        <Spin spinning={formLoading} wrapperClassName="haoligo-spot-check-modal-spin">
          <ProForm
            key={editId ?? 'new'}
            formRef={formRef}
            submitter={false}
            layout="vertical"
            disabled={detailMode}
            size="middle"
            initialValues={editFormInitialValues ?? (editId == null && !detailMode ? getNewFormDefaults() : undefined)}
          >
            <Row gutter={[16, 8]}>
              <Col xs={24} sm={12}>
                <ProFormSelect
                  name="equipment_id"
                  label={t('app.haoligo.equipment.documents.formEquipment')}
                  rules={[{ required: true }]}
                  disabled={detailMode || editId != null}
                  fieldProps={{
                    showSearch: true,
                    filterOption: false,
                    style: { width: '100%' },
                    onChange: async (val: number | null) => {
                      if (!val) {
                        setLines([]);
                        setPlanHint(null);
                        setPlanPickerOpen(false);
                        setPlanPickerPendingEquipmentId(null);
                        formRef.current?.setFieldsValue({ inspection_param_set_id: undefined });
                        return;
                      }
                      await applyEquipmentForSpotCheck(val);
                    },
                  }}
                  params={{ editId, seedEquipmentId: editSelectSeed?.equipmentId }}
                  request={async ({ keyWords }) => {
                    const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
                    const opts = (res.items || []).map((e) => ({
                      label: `${e.asset_code} ${e.name}`,
                      value: e.id,
                    }));
                    return editSelectSeed
                      ? mergeSelectOption(opts, editSelectSeed.equipmentId, editSelectSeed.equipmentLabel)
                      : opts;
                  }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <ProFormSelect
                  name="inspection_param_set_id"
                  label={
                    <Space size={4}>
                      <span>{t('app.haoligo.equipment.documents.formInspectionPlanShort')}</span>
                      <Tooltip title={t('app.haoligo.equipment.documents.formInspectionPlanTooltip')}>
                        <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }} />
                      </Tooltip>
                    </Space>
                  }
                  rules={
                    editId == null && !detailMode
                      ? [{ required: true, message: t('app.haoligo.equipment.documents.spotCheckPlanPickerRequired') }]
                      : undefined
                  }
                  allowClear
                  disabled={detailMode || editId != null}
                  fieldProps={{
                    style: { width: '100%' },
                    onChange: (val: number | null) => {
                      void loadInspectionLines({ setId: val ?? null });
                    },
                  }}
                  params={{ editId, seedPlanId: editSelectSeed?.inspectionParamSetId, equipmentId: formRef.current?.getFieldValue('equipment_id') }}
                  request={async () => {
                    const eqId = formRef.current?.getFieldValue('equipment_id') as number | undefined;
                    let boundIds: number[] = [];
                    if (eqId) {
                      try {
                        const eq = await getEquipment(Number(eqId));
                        boundIds = resolveEquipmentPlanIds(eq);
                      } catch {
                        boundIds = [];
                      }
                    }
                    const rows = await listInspectionParamSets();
                    const allOpts = (rows || []).map((s) => ({ label: `${s.code} ${s.name}`, value: s.id }));
                    const opts = boundIds.length ? allOpts.filter((o) => boundIds.includes(o.value)) : allOpts;
                    return editSelectSeed
                      ? mergeSelectOption(
                          opts,
                          editSelectSeed.inspectionParamSetId,
                          editSelectSeed.inspectionParamSetLabel,
                        )
                      : opts;
                  }}
                />
              </Col>
            </Row>

            <div className="haoligo-spot-check-lines-panel" style={{ marginTop: 4 }}>
              <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 8 }}>
                <Typography.Text strong>{t('app.haoligo.equipment.documents.spotCheckLinesTitle')}</Typography.Text>
                {lines.length > 0 ? <Tag color="processing">{lines.length}</Tag> : null}
              </Flex>
              {planSummaryText ? (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  {planSummaryText}
                </Typography.Text>
              ) : null}
              <Spin spinning={linesLoading}>
                {!lines.length && !linesLoading ? (
                  <Empty description={t('app.haoligo.equipment.documents.spotCheckNoLines')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  lines.map((row, idx) => renderLineCard(row, idx))
                )}
              </Spin>
            </div>

            <Row gutter={[16, 8]} style={{ marginTop: 12 }}>
              <Col xs={24} md={12}>
                <ProFormDateTimePicker
                  name="recorded_at"
                  label={t('app.haoligo.equipment.documents.formRecordedAt')}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
              <Col xs={24} md={12}>
                <ProFormSelect
                  name="applied_operational_status"
                  label={t('app.haoligo.equipment.documents.formAppliedOperationalStatus')}
                  allowClear
                  options={statusOptions}
                  fieldProps={{
                    style: { width: '100%' },
                    placeholder: t('app.haoligo.equipment.documents.formAppliedOperationalStatusPh'),
                  }}
                />
              </Col>
              <Col span={24}>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  {t('app.haoligo.equipment.documents.spotCheckReportGroup')}
                </Typography.Text>
                <ProFormSwitch
                  name="report_enabled"
                  label={t('app.haoligo.equipment.documents.formReportRequired')}
                  fieldProps={{
                    onChange: (checked: boolean) => {
                      if (!checked) {
                        formRef.current?.setFieldsValue({ report_notify_user_ids: [] });
                      }
                    },
                  }}
                />
                <ProFormDependency name={['report_enabled']}>
                  {({ report_enabled: reportOn }) =>
                    reportOn ? (
                      <FormNotifyUsersSelect
                        readonly={detailMode}
                        searchUsers={searchReportNotifyUsers}
                      />
                    ) : null
                  }
                </ProFormDependency>
              </Col>
            </Row>
          </ProForm>
        </Spin>
      </Modal>
      <style>{`
        .haoligo-spot-check-modal {
          max-height: calc(100vh - 48px) !important;
          padding-bottom: 0 !important;
        }
        .haoligo-spot-check-modal .ant-modal-content {
          max-height: calc(100vh - 48px) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
        .haoligo-spot-check-modal .ant-modal-header,
        .haoligo-spot-check-modal .ant-modal-footer {
          flex-shrink: 0 !important;
        }
        .haoligo-spot-check-modal .ant-modal-body {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }
        .haoligo-spot-check-modal-spin,
        .haoligo-spot-check-modal-spin > .ant-spin-container {
          min-height: 0;
        }
        .haoligo-spot-check-lines-panel {
          background: #fafafa;
          border: 1px solid #f0f0f0;
          border-radius: 8px;
          padding: 12px 14px;
        }
        .haoligo-spot-check-line-field {
          width: 100%;
        }
        .haoligo-spot-check-line-field .ant-input,
        .haoligo-spot-check-line-field .ant-input-number {
          width: 100%;
        }
        .haoligo-spot-check-result-radio {
          display: flex;
          width: 100%;
        }
        .haoligo-spot-check-result-radio .ant-radio-button-wrapper {
          flex: 1;
          text-align: center;
        }
        .haoligo-spot-check-line-upload .ant-upload.ant-upload-select,
        .haoligo-spot-check-line-upload .ant-upload-list-item-container {
          width: 72px !important;
          height: 72px !important;
        }
      `}</style>

      <Modal
        title={t('app.haoligo.equipment.documents.spotCheckPlanPickerTitle')}
        open={planPickerOpen}
        destroyOnHidden
        onCancel={() => {
          setPlanPickerOpen(false);
          setPlanPickerPendingEquipmentId(null);
        }}
        onOk={() => {
          if (planPickerSelectedId == null || planPickerPendingEquipmentId == null) {
            messageApi.warning(t('app.haoligo.equipment.documents.spotCheckPlanPickerRequired'));
            return;
          }
          const eqId = planPickerPendingEquipmentId;
          const setId = planPickerSelectedId;
          setPlanPickerOpen(false);
          setPlanPickerPendingEquipmentId(null);
          void applyEquipmentForSpotCheck(eqId, setId);
        }}
        okText={t('common.confirm')}
        cancelText={t('app.haoligo.equipment.documents.btnCancel')}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('app.haoligo.equipment.documents.spotCheckPlanPickerHint')}
        </Typography.Paragraph>
        <Radio.Group
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          value={planPickerSelectedId ?? undefined}
          onChange={(e) => setPlanPickerSelectedId(e.target.value as number)}
          options={planPickerOptions.map((o) => ({ label: o.label, value: o.id }))}
        />
      </Modal>
    </ListPageTemplate>

      <HaoligoDocumentPrintModal
        open={printOpen}
        onClose={() => {
          setPrintOpen(false);
          setPrintRowId(null);
        }}
        documentType="equipment_spot_check"
        documentId={printRowId}
        title={t('app.haoligo.print.equipmentSpotCheckTitle')}
      />
    </>
  );
};

export default SpotCheckDocumentsPage;

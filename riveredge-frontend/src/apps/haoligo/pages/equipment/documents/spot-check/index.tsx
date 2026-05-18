/**
 * 好力 GO — 设备点检单（选设备自动带出点检项；卡片式明细；分项异常描述）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { UploadProps } from 'antd/es/upload';
import { DeleteOutlined, EditOutlined, EyeOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import {
  createEquipmentSpotCheck,
  deleteEquipmentSpotCheck,
  getEquipment,
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
import { getUserList } from '../../../../../../services/user';
import { normUploadUuids, uuidsToUploadFileList } from '../../../patrol/shared/uploadHelpers';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { useEquipmentOperationalStatusLabels } from '../../../../utils/equipmentOperationalStatus';

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
  return normalizeLine({
    id: 0,
    inspection_param_id: pl.inspection_param_id,
    param_code: pl.param_code,
    param_name: pl.param_name,
    sort_order: pl.sort_order,
    value_type: pl.value_type,
    unit: pl.unit,
    is_required: pl.is_required,
    result: 'normal',
    measured_value: pl.default_value ?? null,
    remark: null,
    attachment_file_ids: null,
  });
}

function lineMatchKey(ln: { param_code: string; sort_order: number }) {
  return `${ln.param_code}::${ln.sort_order}`;
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

  const title = t('app.haoligo.menu.equipment.documents.spot-check');
  const reload = useCallback(() => actionRef.current?.reload(), []);

  const searchReportNotifyUsers = useCallback(async (keyword?: string) => {
    const res = await getUserList({
      page: 1,
      page_size: 50,
      is_active: true,
      keyword: keyword?.trim() || undefined,
    });
    const opts = (res.items || []).map((u) => {
      const label = (u.full_name || '').trim() || u.username;
      reportUserLabelRef.current.set(u.id, label);
      return { label, value: u.id };
    });
    const selIds = (formRef.current?.getFieldValue('report_notify_user_ids') as number[] | undefined) || [];
    for (const id of selIds) {
      if (Number.isFinite(id) && !opts.some((o) => o.value === id)) {
        opts.unshift({ value: id, label: reportUserLabelRef.current.get(id) || `用户#${id}` });
      }
    }
    return opts;
  }, []);

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

  const openNew = () => {
    setDetailMode(false);
    setEditId(null);
    setLines([]);
    setPlanHint(null);
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
      setModalOpen(true);
      setTimeout(async () => {
        const notifyIds = row.report_notify_user_ids || [];
        if (notifyIds.length) {
          try {
            const res = await getUserList({ page: 1, page_size: 50, is_active: true });
            for (const uid of notifyIds) {
              const hit = (res.items || []).find((u) => u.id === uid);
              if (hit) {
                reportUserLabelRef.current.set(hit.id, (hit.full_name || '').trim() || hit.username);
              }
            }
          } catch {
            /* ignore */
          }
        }
        formRef.current?.setFieldsValue({
          equipment_id: row.equipment_id,
          inspection_param_set_id: row.inspection_param_set_id ?? undefined,
          recorded_at: row.recorded_at ? dayjs(row.recorded_at) : undefined,
          applied_operational_status: row.applied_operational_status ?? undefined,
          report_enabled: row.report_enabled,
          report_notify_user_ids: notifyIds,
        });
      }, 0);
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
        render: (_, r) => (r.recorded_at ? dayjs(r.recorded_at).format('YYYY-MM-DD HH:mm') : '—'),
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
        width: 168,
        fixed: 'right',
        render: (_, row) => [
          <Button key="v" type="link" size="small" icon={<EyeOutlined />} onClick={() => openEdit(row.id, true)}>
            {t('app.haoligo.equipment.documents.actionView')}
          </Button>,
          <Button key="e" type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row.id, false)}>
            {t('app.haoligo.equipment.documents.actionEdit')}
          </Button>,
          <Button
            key="d"
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              modal.confirm({
                title: t('app.haoligo.equipment.documents.deleteConfirm'),
                onOk: async () => {
                  await deleteEquipmentSpotCheck(row.id);
                  messageApi.success(t('app.haoligo.equipment.updateSuccess'));
                  reload();
                },
              });
            }}
          >
            {t('app.haoligo.equipment.documents.actionDelete')}
          </Button>,
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

  const linePhotoUploadProps = (idx: number): UploadProps => ({
    listType: 'picture-card',
    accept: '.jpg,.jpeg,.png,.gif,.webp',
    disabled: detailMode,
    fileList: uuidsToUploadFileList(lines[idx]?.attachment_file_ids || []),
    onChange: ({ fileList }) => {
      const uuids = normUploadUuids(fileList);
      setLines((prev) =>
        prev.map((x, i) => (i === idx ? { ...x, attachment_file_ids: uuids.length ? uuids : null } : x)),
      );
    },
    customRequest: async (options) => {
      try {
        const file = options.file as File;
        const res: FileUploadResponse = await uploadFile(file, { category: 'haoligo_equipment_spot_check' });
        options.onSuccess?.(res, options.file);
      } catch (e) {
        options.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    },
  });

  const valueTypeLabel = (vt: string) => {
    const key = (vt || 'numeric').toLowerCase();
    if (key === 'boolean') return t('app.haoligo.equipment.inspectionParams.valueTypeBoolean');
    if (key === 'text') return t('app.haoligo.equipment.inspectionParams.valueTypeText');
    return t('app.haoligo.equipment.inspectionParams.valueTypeNumeric');
  };

  const renderMeasuredField = (row: EquipmentSpotCheckLineRow, idx: number, readOnly: boolean) => {
    const vt = (row.value_type || 'numeric').toLowerCase();
    if (readOnly) {
      if (vt === 'boolean') {
        return row.measured_value === 'true'
          ? t('app.haoligo.equipment.documents.boolYes')
          : row.measured_value === 'false'
            ? t('app.haoligo.equipment.documents.boolNo')
            : '—';
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
      return (
        <InputNumber
          style={{ width: '100%' }}
          value={Number.isFinite(n as number) ? (n as number) : undefined}
          onChange={(val) => {
            const s = val == null ? '' : String(val);
            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, measured_value: s || null } : x)));
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
    const meta = [valueTypeLabel(row.value_type), row.unit ? row.unit : null].filter(Boolean).join(' · ');

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
            <Tag color="red" bordered={false} style={{ margin: 0 }}>
              {t('app.haoligo.equipment.documents.colRequiredShort')}
            </Tag>
          ) : null}
          {meta ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {meta}
            </Typography.Text>
          ) : null}
        </Flex>

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
                  <Radio.Button value="normal">{t('app.haoligo.equipment.documents.resultNormal')}</Radio.Button>
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
            <Upload {...linePhotoUploadProps(idx)} className="haoligo-spot-check-line-upload">
              {readOnly ? null : '+'}
            </Upload>
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
    <ListPageTemplate>
      <UniTable<EquipmentSpotCheckRow>
        columnPersistenceId="haoligo-equipment-spot-checks"
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
        onCancel={() => setModalOpen(false)}
        afterOpenChange={(open) => {
          if (open && editId == null && !detailMode) {
            formRef.current?.setFieldsValue(getNewFormDefaults());
          }
        }}
        width={720}
        centered
        destroyOnClose
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
            formRef={formRef}
            submitter={false}
            layout="vertical"
            disabled={detailMode}
            size="middle"
            initialValues={editId == null && !detailMode ? getNewFormDefaults() : undefined}
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
                        formRef.current?.setFieldsValue({ inspection_param_set_id: undefined });
                        return;
                      }
                      try {
                        const eq = await getEquipment(val);
                        const setId = eq.inspection_param_set_id ?? undefined;
                        formRef.current?.setFieldsValue({ inspection_param_set_id: setId });
                        await loadInspectionLines({ equipmentId: val, setId: setId ?? null });
                      } catch {
                        await loadInspectionLines({ equipmentId: val });
                      }
                    },
                  }}
                  request={async ({ keyWords }) => {
                    const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
                    return (res.items || []).map((e) => ({
                      label: `${e.asset_code} ${e.name}`,
                      value: e.id,
                    }));
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
                  allowClear
                  disabled={detailMode || editId != null}
                  fieldProps={{
                    style: { width: '100%' },
                    onChange: (val: number | null) => {
                      void loadInspectionLines({ setId: val ?? null });
                    },
                  }}
                  request={async () => {
                    const rows = await listInspectionParamSets();
                    return (rows || []).map((s) => ({ label: `${s.code} ${s.name}`, value: s.id }));
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
                      <ProFormSelect
                        name="report_notify_user_ids"
                        label={t('app.haoligo.equipment.documents.formReportNotifyUsers')}
                        mode="multiple"
                        showSearch
                        debounceTime={300}
                        rules={[{ required: true, message: t('app.haoligo.equipment.documents.selectReportToUser') }]}
                        request={async ({ keyWords }) => searchReportNotifyUsers(keyWords)}
                        fieldProps={{
                          style: { width: '100%', maxWidth: 480 },
                          placeholder: t('app.haoligo.equipment.documents.formReportNotifyUsersPh'),
                          filterOption: false,
                        }}
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
    </ListPageTemplate>
  );
};

export default SpotCheckDocumentsPage;

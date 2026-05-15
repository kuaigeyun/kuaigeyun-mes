/**
 * 好力 GO — 设备点检单（选设备 + 点检方案、预览行、按项录入结果与实测值）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormCheckbox,
  ProFormDateTimePicker,
  ProFormInstance,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Input, InputNumber, Modal, Radio, Row, Space, Switch, Table, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd/es/upload';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
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
  type EquipmentSpotCheckPreviewResult,
  type EquipmentSpotCheckRow,
} from '../../../../services/haoligo';
import { uploadFile, type FileUploadResponse } from '../../../../../../services/file';
import { normUploadUuids, uuidsToUploadFileList } from '../../../patrol/shared/uploadHelpers';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';

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

const SpotCheckDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [phase, setPhase] = useState<'header' | 'lines'>('header');
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [lines, setLines] = useState<EquipmentSpotCheckLineRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<EquipmentSpotCheckPreviewResult | null>(null);

  const title = t('app.haoligo.menu.equipment.documents.spot-check');

  const reload = useCallback(() => actionRef.current?.reload(), []);

  const openNew = () => {
    setDetailMode(false);
    setPhase('header');
    setEditId(null);
    setLines([]);
    setPreviewData(null);
    setModalOpen(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        recorded_at: dayjs(),
        handling_shutdown: false,
        handling_report: false,
        handling_supervised: false,
      });
    }, 0);
  };

  useNewShortcut(openNew);

  const runPreview = async () => {
    const eqId = formRef.current?.getFieldValue('equipment_id') as number | undefined;
    if (!eqId) {
      messageApi.warning(t('app.haoligo.equipment.documents.spotCheckSelectEquipmentFirst'));
      return;
    }
    const setIdRaw = formRef.current?.getFieldValue('inspection_param_set_id') as number | string | undefined | null;
    setPreviewLoading(true);
    try {
      const res = await previewEquipmentSpotCheckLines({
        equipment_id: Number(eqId),
        inspection_param_set_id:
          setIdRaw != null && setIdRaw !== '' && Number.isFinite(Number(setIdRaw)) ? Number(setIdRaw) : undefined,
      });
      setPreviewData(res);
      messageApi.success(t('app.haoligo.equipment.documents.spotCheckPreviewOk'));
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openEdit = async (id: number, view: boolean) => {
    setFormLoading(true);
    setDetailMode(view);
    try {
      const row = await getEquipmentSpotCheck(id);
      setEditId(id);
      setLines((row.lines || []).map(normalizeLine));
      setPreviewData(null);
      setPhase('lines');
      setModalOpen(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          equipment_id: row.equipment_id,
          inspection_param_set_id: row.inspection_param_set_id ?? undefined,
          recorded_at: row.recorded_at ? dayjs(row.recorded_at) : undefined,
          abnormal_description: row.abnormal_description,
          handling_shutdown: row.handling_shutdown,
          handling_report: row.handling_report,
          handling_supervised: row.handling_supervised,
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
        title: t('app.haoligo.equipment.documents.colAbnormal'),
        dataIndex: 'abnormal_description',
        ellipsis: true,
        hideInSearch: true,
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
    [messageApi, modal, reload, t],
  );

  const submitHeader = async () => {
    try {
      await formRef.current?.validateFields();
    } catch {
      return;
    }
    const v = formRef.current?.getFieldsValue() as Record<string, unknown>;
    const setIdRaw = v.inspection_param_set_id;
    const setId =
      setIdRaw != null && setIdRaw !== '' && Number.isFinite(Number(setIdRaw)) ? Number(setIdRaw) : undefined;
    setFormLoading(true);
    try {
      const row = await createEquipmentSpotCheck({
        equipment_id: Number(v.equipment_id),
        inspection_param_set_id: setId,
        recorded_at: v.recorded_at ? dayjs(v.recorded_at as string).toISOString() : undefined,
        abnormal_description: (v.abnormal_description as string) || undefined,
        handling_shutdown: Boolean(v.handling_shutdown),
        handling_report: Boolean(v.handling_report),
        handling_supervised: Boolean(v.handling_supervised),
      });
      setEditId(row.id);
      setLines((row.lines || []).map(normalizeLine));
      setPhase('lines');
      setPreviewData(null);
      messageApi.success(t('app.haoligo.equipment.documents.spotCheckCreatedFillLines'));
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const submitLines = async () => {
    if (editId == null) return;
    try {
      await formRef.current?.validateFields();
    } catch {
      return;
    }
    for (const ln of lines) {
      if (ln.is_required && !ln.result) {
        messageApi.warning(t('app.haoligo.equipment.documents.spotCheckRequiredResult', { name: ln.param_name }));
        return;
      }
      if (ln.result === 'abnormal' && !(ln.remark || '').trim()) {
        messageApi.warning(t('app.haoligo.equipment.documents.spotCheckAbnormalRemark', { name: ln.param_name }));
        return;
      }
    }
    const v = formRef.current?.getFieldsValue() as Record<string, unknown>;
    setFormLoading(true);
    try {
      await updateEquipmentSpotCheck(editId, {
        recorded_at: v.recorded_at ? dayjs(v.recorded_at as string).toISOString() : undefined,
        abnormal_description: (v.abnormal_description as string) || undefined,
        handling_shutdown: Boolean(v.handling_shutdown),
        handling_report: Boolean(v.handling_report),
        handling_supervised: Boolean(v.handling_supervised),
        lines: lines.map((ln) => ({
          id: ln.id,
          result: ln.result,
          remark: ln.remark ?? null,
          measured_value: ln.measured_value ?? null,
          attachment_file_ids: ln.attachment_file_ids?.length ? ln.attachment_file_ids : null,
        })),
      });
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

  const renderMeasuredCell = (row: EquipmentSpotCheckLineRow, idx: number, readOnly: boolean) => {
    const vt = (row.value_type || 'numeric').toLowerCase();
    if (readOnly) {
      if (vt === 'boolean') {
        return row.measured_value === 'true' ? t('app.haoligo.equipment.documents.boolYes') : row.measured_value === 'false' ? t('app.haoligo.equipment.documents.boolNo') : '—';
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
          size="small"
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
        size="small"
        value={row.measured_value || ''}
        onChange={(e) => {
          const val = e.target.value;
          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, measured_value: val || null } : x)));
        }}
      />
    );
  };

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
        toolBarRender={() => [
          <Button type="primary" key="new" onClick={openNew}>
            {t('app.haoligo.equipment.documents.btnNew')}
          </Button>,
        ]}
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
        {...MODAL_CONFIG}
        title={
          detailMode
            ? `${title} — ${t('app.haoligo.equipment.documents.actionView')}`
            : phase === 'header'
              ? `${title} — ${t('app.haoligo.equipment.documents.phaseNew')}`
              : `${title} — ${t('app.haoligo.equipment.documents.phaseLines')}`
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={960}
        destroyOnClose
        footer={
          detailMode ? (
            <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnClose')}</Button>
          ) : phase === 'header' ? (
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
              <Button loading={previewLoading} onClick={() => void runPreview()}>
                {t('app.haoligo.equipment.documents.spotCheckPreviewBtn')}
              </Button>
              <Button type="primary" loading={formLoading} onClick={() => void submitHeader()}>
                {t('app.haoligo.equipment.documents.btnCreate')}
              </Button>
            </Space>
          ) : (
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
              <Button type="primary" loading={formLoading} onClick={() => void submitLines()}>
                {t('app.haoligo.equipment.documents.btnSaveLines')}
              </Button>
            </Space>
          )
        }
      >
        <ProForm formRef={formRef} submitter={false} layout="vertical" disabled={detailMode}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormSelect
                name="equipment_id"
                label={t('app.haoligo.equipment.documents.formEquipment')}
                rules={[{ required: true }]}
                disabled={detailMode || phase === 'lines' || editId != null}
                fieldProps={{
                  showSearch: true,
                  filterOption: false,
                  style: { width: '100%' },
                  onChange: async (val: number) => {
                    setPreviewData(null);
                    if (!val) return;
                    try {
                      const eq = await getEquipment(val);
                      formRef.current?.setFieldsValue({
                        inspection_param_set_id: eq.inspection_param_set_id ?? undefined,
                      });
                    } catch {
                      /* ignore */
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
            <Col xs={24} md={12}>
              <ProFormSelect
                name="inspection_param_set_id"
                label={t('app.haoligo.equipment.documents.formInspectionPlan')}
                allowClear
                disabled={detailMode || phase === 'lines' || editId != null}
                fieldProps={{
                  style: { width: '100%' },
                  onChange: () => setPreviewData(null),
                }}
                request={async () => {
                  const rows = await listInspectionParamSets();
                  return (rows || []).map((s) => ({ label: `${s.code} ${s.name}`, value: s.id }));
                }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormDateTimePicker
                name="recorded_at"
                label={t('app.haoligo.equipment.documents.formRecordedAt')}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <ProFormTextArea name="abnormal_description" label={t('app.haoligo.equipment.documents.formAbnormalDesc')} />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormCheckbox name="handling_shutdown" label={t('app.haoligo.equipment.documents.formShutdown')} />
            </Col>
            <Col xs={24} md={12}>
              <ProFormCheckbox name="handling_report" label={t('app.haoligo.equipment.documents.formReport')} />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormCheckbox name="handling_supervised" label={t('app.haoligo.equipment.documents.formSupervised')} />
            </Col>
          </Row>
        </ProForm>

        {phase === 'header' && !detailMode && previewData && previewData.lines.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text type="secondary">
              {t('app.haoligo.equipment.documents.spotCheckPreviewHint', {
                code: previewData.inspection_param_set_code,
                name: previewData.inspection_param_set_name,
              })}
            </Typography.Text>
            <Table
              style={{ marginTop: 8 }}
              size="small"
              pagination={false}
              rowKey={(r) => `${r.param_code}-${r.sort_order}`}
              dataSource={previewData.lines}
              columns={[
                { title: t('app.haoligo.equipment.documents.colSequence'), dataIndex: 'sort_order', width: 56 },
                { title: t('app.haoligo.equipment.documents.colParamCode'), dataIndex: 'param_code', width: 100 },
                { title: t('app.haoligo.equipment.documents.colParamName'), dataIndex: 'param_name' },
                {
                  title: t('app.haoligo.equipment.documents.colValueType'),
                  dataIndex: 'value_type',
                  width: 88,
                },
                { title: t('app.haoligo.equipment.documents.colUnit'), dataIndex: 'unit', width: 72, render: (u) => u || '—' },
                {
                  title: t('app.haoligo.equipment.documents.colRequiredShort'),
                  dataIndex: 'is_required',
                  width: 72,
                  render: (req: boolean) => (req ? <Tag color="red">{t('app.haoligo.equipment.documents.yes')}</Tag> : <Tag>{t('app.haoligo.equipment.documents.no')}</Tag>),
                },
              ]}
            />
          </div>
        )}

        {phase === 'lines' && lines.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text strong>{t('app.haoligo.equipment.documents.spotCheckLinesTitle')}</Typography.Text>
            <Table<EquipmentSpotCheckLineRow>
              style={{ marginTop: 8 }}
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={lines}
              columns={[
                { title: t('app.haoligo.equipment.documents.colSequence'), dataIndex: 'sort_order', width: 48 },
                { title: t('app.haoligo.equipment.documents.colParamCode'), dataIndex: 'param_code', width: 100 },
                { title: t('app.haoligo.equipment.documents.colParamName'), dataIndex: 'param_name', width: 140, ellipsis: true },
                {
                  title: t('app.haoligo.equipment.documents.colRequiredShort'),
                  dataIndex: 'is_required',
                  width: 56,
                  render: (req: boolean) => (req ? '✓' : ''),
                },
                {
                  title: t('app.haoligo.equipment.documents.colMeasuredValue'),
                  dataIndex: 'measured_value',
                  width: 140,
                  render: (_, row, idx) => renderMeasuredCell(row, idx, detailMode),
                },
                {
                  title: t('app.haoligo.equipment.documents.colResult'),
                  dataIndex: 'result',
                  width: 200,
                  render: (_, row, idx) =>
                    detailMode ? (
                      row.result === 'normal'
                        ? t('app.haoligo.equipment.documents.resultNormal')
                        : t('app.haoligo.equipment.documents.resultAbnormal')
                    ) : (
                      <Radio.Group
                        value={row.result}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, result: val } : x)));
                        }}
                      >
                        <Radio value="normal">{t('app.haoligo.equipment.documents.resultNormal')}</Radio>
                        <Radio value="abnormal">{t('app.haoligo.equipment.documents.resultAbnormal')}</Radio>
                      </Radio.Group>
                    ),
                },
                {
                  title: t('app.haoligo.equipment.documents.colRemark'),
                  dataIndex: 'remark',
                  render: (_, row, idx) =>
                    detailMode ? (
                      row.remark || '—'
                    ) : (
                      <Input
                        size="small"
                        value={row.remark || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, remark: val } : x)));
                        }}
                      />
                    ),
                },
                {
                  title: t('app.haoligo.equipment.documents.colLinePhotos'),
                  width: 220,
                  render: (_, _row, idx) => (
                    <Upload {...linePhotoUploadProps(idx)}>{detailMode ? null : '+'}</Upload>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </ListPageTemplate>
  );
};

export default SpotCheckDocumentsPage;

/**
 * 好力 GO — 设备路线巡检单（填报逻辑对齐设备点检单）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDateTimePicker,
  ProFormDependency,
  ProFormInstance,
  ProFormItem,
  ProFormSelect,
  ProFormSwitch,
} from '@ant-design/pro-components';
import { App, Button, Card, Col, Empty, Flex, Input, Modal, Row, Space, Spin, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { FormNotifyUsersSelect } from '../../../../components/FormNotifyUsersSelect';
import {
  createEquipmentRoutePatrol,
  deleteEquipmentRoutePatrol,
  getEquipmentRoutePatrol,
  listHaoligoNotifyUserOptions,
  listEquipmentRoutePatrols,
  listPatrolRoutes,
  listWorkshops,
  previewEquipmentRoutePatrolLines,
  updateEquipmentRoutePatrol,
  type EquipmentRoutePatrolLineRow,
  type EquipmentRoutePatrolPreviewLine,
  type EquipmentRoutePatrolRow,
  type PatrolRouteRow,
  type WorkshopRow,
} from '../../../../services/haoligo';
import { formatDateTime } from '../../../../../../utils/format';
import { uploadFile, type FileUploadResponse } from '../../../../../../services/file';
import { MoldAttachmentImagePreview } from '../../../../components/MoldAttachmentImagePreview';
import { SecurePictureCardUpload } from '../../../../components/SecurePictureCardUpload';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { useEquipmentOperationalStatusLabels } from '../../../../utils/equipmentOperationalStatus';
import { ThemedSegmented } from '../../../../../../components/themed-segmented';
import {
  isRoutePatrolLineAbnormal,
  normalizeRoutePatrolLineStatus,
  patchRoutePatrolLineStatus,
  ROUTE_PATROL_LINE_STATUS_NORMAL,
  ROUTE_PATROL_LINE_STATUS_OPTIONS,
  type RoutePatrolLineStatus,
} from '../../../../constants/routePatrolLineStatus';

type DraftLine = EquipmentRoutePatrolLineRow & { _draftKey: string };

function previewToDraft(pl: EquipmentRoutePatrolPreviewLine): DraftLine {
  return {
    _draftKey: `${pl.equipment_id}::${pl.sequence}`,
    id: 0,
    equipment_id: pl.equipment_id,
    asset_code: pl.asset_code,
    equipment_name: pl.equipment_name,
    sequence: pl.sequence,
    line_status: ROUTE_PATROL_LINE_STATUS_NORMAL,
    abnormal_description: null,
    applied_operational_status: null,
    attachment_file_ids: null,
  };
}

function normalizeLine(ln: EquipmentRoutePatrolLineRow): DraftLine {
  const ids = ln.attachment_file_ids;
  return {
    ...ln,
    line_status: normalizeRoutePatrolLineStatus(ln.line_status),
    _draftKey: `${ln.equipment_id}::${ln.sequence}`,
    attachment_file_ids: Array.isArray(ids) ? ids : ids == null ? null : [],
  };
}

const RoutePatrolDocumentsPage: React.FC = () => {
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
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [routeHint, setRouteHint] = useState<{ code: string; name: string; workshopLabel: string } | null>(null);
  const [patrolRoutes, setPatrolRoutes] = useState<PatrolRouteRow[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);

  const title = t('app.haoligo.menu.equipment.documents.route-patrol');
  const reload = useCallback(() => actionRef.current?.reload(), []);

  const workshopLabelById = useMemo(() => {
    const m = new Map<number, string>();
    for (const w of workshops) {
      const label = `${(w.code || '').trim()} ${(w.name || '').trim()}`.trim();
      if (label) m.set(w.id, label);
    }
    return m;
  }, [workshops]);

  const resolveRouteMeta = useCallback(
    (routeId: number, fallbackWorkshopName?: string | null) => {
      const hit = patrolRoutes.find((r) => r.id === routeId);
      if (!hit) {
        return fallbackWorkshopName
          ? { code: '', name: '', workshopLabel: fallbackWorkshopName }
          : null;
      }
      const workshopLabel =
        (hit.workshop_id != null ? workshopLabelById.get(hit.workshop_id) : undefined) ||
        fallbackWorkshopName ||
        '—';
      return { code: hit.code, name: hit.name, workshopLabel };
    },
    [patrolRoutes, workshopLabelById],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [routes, ws] = await Promise.all([listPatrolRoutes(), listWorkshops()]);
        setPatrolRoutes(routes || []);
        setWorkshops(ws || []);
      } catch {
        /* 下拉仍可 request 拉取 */
      }
    })();
  }, []);

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

  const loadRouteLines = useCallback(
    async (routeId?: number | null) => {
      if (editId != null) return;
      const rid = routeId ?? (formRef.current?.getFieldValue('patrol_route_id') as number | undefined);
      if (!rid) {
        setLines([]);
        setRouteHint(null);
        return;
      }
      const seq = ++loadLinesSeqRef.current;
      setLinesLoading(true);
      try {
        const rows = await previewEquipmentRoutePatrolLines({ patrol_route_id: Number(rid) });
        if (seq !== loadLinesSeqRef.current) return;
        if (!rows.length) {
          setLines([]);
          messageApi.warning(t('app.haoligo.equipment.documents.routePatrolNoSteps'));
        } else {
          setLines(rows.map(previewToDraft));
        }
        setRouteHint(resolveRouteMeta(Number(rid)));
      } catch (e) {
        if (seq !== loadLinesSeqRef.current) return;
        setLines([]);
        setRouteHint(null);
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      } finally {
        if (seq === loadLinesSeqRef.current) setLinesLoading(false);
      }
    },
    [editId, messageApi, resolveRouteMeta, t],
  );

  const openNew = () => {
    setDetailMode(false);
    setEditId(null);
    setLines([]);
    setRouteHint(null);
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
      const row = await getEquipmentRoutePatrol(id);
      setEditId(id);
      setLines((row.lines || []).map(normalizeLine));
      setRouteHint(
        resolveRouteMeta(row.patrol_route_id, row.patrol_route_workshop_name) ||
          (row.patrol_route_code || row.patrol_route_name
            ? {
                code: row.patrol_route_code || '',
                name: row.patrol_route_name || '',
                workshopLabel: row.patrol_route_workshop_name || '—',
              }
            : null),
      );
      setModalOpen(true);
      setTimeout(async () => {
        const notifyIds = row.report_notify_user_ids || [];
        if (notifyIds.length) {
          const users = await listHaoligoNotifyUserOptions({ selected_user_ids: notifyIds, limit: 80 });
          for (const u of users) reportUserLabelRef.current.set(u.id, u.label);
        }
        formRef.current?.setFieldsValue({
          patrol_route_id: row.patrol_route_id,
          recorded_at: row.recorded_at ? dayjs(row.recorded_at) : undefined,
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

  const columns = useMemo<ProColumns<EquipmentRoutePatrolRow>[]>(
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
        title: t('app.haoligo.equipment.documents.colPatrolRoute'),
        dataIndex: 'patrol_route_name',
        ellipsis: true,
        render: (_, r) =>
          r.patrol_route_code || r.patrol_route_name
            ? `${r.patrol_route_code || ''} ${r.patrol_route_name || ''}`.trim()
            : `ID ${r.patrol_route_id}`,
      },
      {
        title: t('app.haoligo.equipment.patrolRoutes.colWorkshop'),
        dataIndex: 'patrol_route_workshop_name',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => r.patrol_route_workshop_name || '—',
      },
      {
        title: t('app.haoligo.equipment.documents.colReportEnabled'),
        dataIndex: 'report_enabled',
        width: 88,
        hideInSearch: true,
        render: (_, r) => (r.report_enabled ? t('app.haoligo.equipment.documents.yes') : t('app.haoligo.equipment.documents.no')),
      },
      moldDocumentCreatedAtColumn<EquipmentRoutePatrolRow>(),
      {
        title: t('app.haoligo.equipment.documents.colActions'),
        valueType: 'option',
        width: 168,
        fixed: 'right',
        render: (_, row) => [
          <Button {...rowActionKind('read')} key="v" onClick={() => openEdit(row.id, true)}>
            {t('app.haoligo.equipment.documents.actionView')}
          </Button>,
          <Button {...rowActionKind('update')} key="e" onClick={() => openEdit(row.id, false)}>
            {t('app.haoligo.equipment.documents.actionEdit')}
          </Button>,
          <Button {...rowActionKind('delete')} key="delete" onClick={() => {
              modal.confirm({
                title: t('app.haoligo.equipment.documents.deleteConfirm'),
                onOk: async () => {
                  await deleteEquipmentRoutePatrol(row.id);
                  messageApi.success(t('app.haoligo.equipment.updateSuccess'));
                  reload();
                },
              });
            }}
          />,
        ],
      },
    ],
    [messageApi, modal, reload, t],
  );

  const validateLines = (): boolean => {
    if (!lines.length) {
      messageApi.warning(t('app.haoligo.equipment.documents.routePatrolNoSteps'));
      return false;
    }
    for (const ln of lines) {
      if (isRoutePatrolLineAbnormal(ln.line_status) && !(ln.abnormal_description || '').trim()) {
        messageApi.warning(
          t('app.haoligo.equipment.documents.routePatrolAbnormalDescRequired', {
            name: `${ln.asset_code} ${ln.equipment_name}`.trim(),
          }),
        );
        return false;
      }
    }
    return true;
  };

  const buildLinePatches = (serverLines: EquipmentRoutePatrolLineRow[]) =>
    serverLines.map((serverLn) => {
      const draft = lines.find((d) => d._draftKey === `${serverLn.equipment_id}::${serverLn.sequence}`);
      return {
        id: serverLn.id,
        line_status: draft?.line_status ?? normalizeRoutePatrolLineStatus(serverLn.line_status),
        abnormal_description: draft?.abnormal_description ?? null,
        applied_operational_status: draft?.applied_operational_status ?? null,
        attachment_file_ids: draft?.attachment_file_ids?.length ? draft.attachment_file_ids : null,
      };
    });

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
    const headerPayload = {
      recorded_at: v.recorded_at ? dayjs(v.recorded_at as string).toISOString() : undefined,
      report_enabled: Boolean(v.report_enabled),
      report_notify_user_ids: reportNotifyIds,
    };

    setFormLoading(true);
    try {
      if (editId != null) {
        await updateEquipmentRoutePatrol(editId, {
          ...headerPayload,
          lines: lines.map((ln) => ({
            id: ln.id,
            line_status: ln.line_status,
            abnormal_description: ln.abnormal_description ?? null,
            applied_operational_status: ln.applied_operational_status ?? null,
            attachment_file_ids: ln.attachment_file_ids?.length ? ln.attachment_file_ids : null,
          })),
        });
      } else {
        const created = await createEquipmentRoutePatrol({
          patrol_route_id: Number(v.patrol_route_id),
          ...headerPayload,
        });
        const patches = buildLinePatches((created.lines || []).map(normalizeLine));
        await updateEquipmentRoutePatrol(created.id, { ...headerPayload, lines: patches });
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

  const patrolStatusSegmentOptions = useMemo(
    () =>
      ROUTE_PATROL_LINE_STATUS_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey, { defaultValue: opt.fallback }),
      })),
    [t],
  );

  const formatPatrolLineStatus = useCallback(
    (status: unknown) => {
      const normalized = normalizeRoutePatrolLineStatus(status);
      const hit = ROUTE_PATROL_LINE_STATUS_OPTIONS.find((opt) => opt.value === normalized);
      return hit ? t(hit.labelKey, { defaultValue: hit.fallback }) : '—';
    },
    [t],
  );

  const routeSummaryText =
    routeHint && lines.length > 0
      ? t('app.haoligo.equipment.documents.routePatrolAutoLoadedHint', {
          count: lines.length,
          route: `${routeHint.code} ${routeHint.name}`.trim(),
          workshop: routeHint.workshopLabel,
        })
      : null;

  return (
    <ListPageTemplate>
      <UniTable<EquipmentRoutePatrolRow>
        columnPersistenceId="apps.haoligo.pages.equipment.documents.route-patrol"
        headerTitle={title}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        showCreateButton
        createButtonText={t('app.haoligo.equipment.documents.btnNew')}
        onCreate={openNew}
        request={async (params) => {
          const res = await listEquipmentRoutePatrols({
            skip: ((params.current || 1) - 1) * (params.pageSize || 50),
            limit: params.pageSize || 50,
            keyword: (params.keyword as string) || undefined,
            sheet_no: (params.sheet_no as string) || undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <Modal
        className="haoligo-route-patrol-modal"
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
        width={920}
        centered
        destroyOnHidden
        styles={{ body: { paddingTop: 8, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
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
        <Spin spinning={formLoading}>
          <ProForm
            formRef={formRef}
            submitter={false}
            layout="vertical"
            disabled={detailMode}
            initialValues={editId == null && !detailMode ? getNewFormDefaults() : undefined}
          >
            <Row gutter={[16, 8]}>
              <Col xs={24} md={12}>
                <ProFormSelect
                  name="patrol_route_id"
                  label={t('app.haoligo.equipment.documents.formPatrolRoute')}
                  rules={[{ required: true }]}
                  disabled={detailMode || editId != null}
                  fieldProps={{
                    style: { width: '100%' },
                    onChange: (val: number | null) => {
                      setRouteHint(val != null ? resolveRouteMeta(Number(val)) : null);
                      void loadRouteLines(val);
                    },
                  }}
                  request={async () => {
                    const rows = patrolRoutes.length ? patrolRoutes : await listPatrolRoutes();
                    return (rows || []).map((r) => ({
                      label: `${r.code} ${r.name}`.trim(),
                      value: r.id,
                    }));
                  }}
                />
              </Col>
              <Col xs={24} md={12}>
                <ProFormItem label={t('app.haoligo.equipment.patrolRoutes.colWorkshop')}>
                  <Input
                    readOnly
                    disabled
                    style={{ width: '100%' }}
                    value={routeHint?.workshopLabel ?? ''}
                    placeholder="—"
                  />
                </ProFormItem>
              </Col>
            </Row>

            <div
              className="haoligo-route-patrol-lines-panel"
              style={{
                marginTop: 4,
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 8 }}>
                <Typography.Text strong>{t('app.haoligo.equipment.documents.routePatrolLinesTitle')}</Typography.Text>
                {lines.length > 0 ? <Tag color="processing">{lines.length}</Tag> : null}
              </Flex>
              {routeSummaryText ? (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  {routeSummaryText}
                </Typography.Text>
              ) : null}
              <Spin spinning={linesLoading}>
                {!lines.length && !linesLoading ? (
                  <Empty
                    description={t('app.haoligo.equipment.documents.routePatrolSelectRouteFirst')}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                    {lines.map((row, idx) => (
                      <Card key={row._draftKey} size="small" type="inner">
                        <Typography.Text strong>
                          {row.sequence}. {row.asset_code} {row.equipment_name}
                        </Typography.Text>
                        <Row gutter={[16, 12]} style={{ marginTop: 8 }}>
                          <Col xs={24} md={12}>
                            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                              {t('app.haoligo.equipment.documents.colIsNormal')}
                            </Typography.Text>
                            {detailMode ? (
                              <Typography.Text>{formatPatrolLineStatus(row.line_status)}</Typography.Text>
                            ) : (
                              <ThemedSegmented<RoutePatrolLineStatus>
                                block
                                className="form-field-segmented haoligo-route-patrol-line-status-segmented"
                                value={normalizeRoutePatrolLineStatus(row.line_status)}
                                options={patrolStatusSegmentOptions}
                                onChange={(next) => {
                                  setLines((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? patchRoutePatrolLineStatus(x, next) : x,
                                    ),
                                  );
                                }}
                              />
                            )}
                          </Col>
                          <Col xs={24} md={12}>
                            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                              {t('app.haoligo.equipment.documents.formAppliedOperationalStatus')}
                            </Typography.Text>
                            {detailMode ? (
                              <Typography.Text>{formatStatus(row.applied_operational_status)}</Typography.Text>
                            ) : (
                              <ProFormSelect
                                noStyle
                                fieldProps={{
                                  style: { width: '100%' },
                                  allowClear: true,
                                  placeholder: t('app.haoligo.equipment.documents.formAppliedOperationalStatusPh'),
                                  value: row.applied_operational_status ?? undefined,
                                  onChange: (val: string | null) => {
                                    setLines((prev) =>
                                      prev.map((x, i) =>
                                        i === idx ? { ...x, applied_operational_status: val || null } : x,
                                      ),
                                    );
                                  },
                                  options: statusOptions,
                                }}
                              />
                            )}
                          </Col>
                        </Row>
                        {isRoutePatrolLineAbnormal(row.line_status) ? (
                          <div style={{ marginTop: 8 }}>
                            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                              {t('app.haoligo.equipment.documents.colAbnormal')}
                            </Typography.Text>
                            {detailMode ? (
                              <Typography.Text>{row.abnormal_description || '—'}</Typography.Text>
                            ) : (
                              <Input.TextArea
                                rows={2}
                                value={row.abnormal_description || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLines((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, abnormal_description: val } : x)),
                                  );
                                }}
                              />
                            )}
                          </div>
                        ) : null}
                        {isRoutePatrolLineAbnormal(row.line_status) ? (
                          <div style={{ marginTop: 8 }}>
                            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                              {t('app.haoligo.equipment.documents.colLinePhotos')}
                            </Typography.Text>
                            {detailMode ? (
                              <MoldAttachmentImagePreview uuids={row.attachment_file_ids ?? undefined} />
                            ) : (
                              <SecurePictureCardUpload
                                className="haoligo-route-patrol-line-upload"
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
                                      category: 'haoligo_equipment_route_patrol',
                                    });
                                    options.onSuccess?.(res, options.file);
                                  } catch (e) {
                                    options.onError?.(e instanceof Error ? e : new Error(String(e)));
                                  }
                                }}
                              />
                            )}
                          </div>
                        ) : null}
                      </Card>
                    ))}
                  </Space>
                )}
              </Spin>
            </div>

            <Row gutter={[16, 8]} style={{ marginTop: 12 }} align="middle">
              <Col xs={24} md={12}>
                <ProFormDateTimePicker
                  name="recorded_at"
                  label={t('app.haoligo.equipment.documents.formRecordedAt')}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
            </Row>

            <Row gutter={[16, 8]} style={{ marginTop: 4 }}>
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
    </ListPageTemplate>
  );
};

export default RoutePatrolDocumentsPage;

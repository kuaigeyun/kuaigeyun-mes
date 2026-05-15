/**
 * 好力 GO — 设备路线巡检单
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDateTimePicker,
  ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
} from '@ant-design/pro-components';
import { App, Button, Col, Input, Modal, Row, Space, Switch, Table, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import {
  createEquipmentRoutePatrol,
  deleteEquipmentRoutePatrol,
  getEquipmentRoutePatrol,
  listEquipmentRoutePatrols,
  listPatrolRoutes,
  updateEquipmentRoutePatrol,
  type EquipmentRoutePatrolLineRow,
  type EquipmentRoutePatrolRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';

const RoutePatrolDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [phase, setPhase] = useState<'header' | 'lines'>('header');
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [lines, setLines] = useState<EquipmentRoutePatrolLineRow[]>([]);

  const title = t('app.haoligo.menu.equipment.documents.route-patrol');
  const reload = useCallback(() => actionRef.current?.reload(), []);

  const openNew = () => {
    setDetailMode(false);
    setPhase('header');
    setEditId(null);
    setLines([]);
    setModalOpen(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        recorded_at: dayjs(),
        report_required: false,
      });
    }, 0);
  };

  useNewShortcut(openNew);

  const openEdit = async (id: number, view: boolean) => {
    setFormLoading(true);
    setDetailMode(view);
    try {
      const row = await getEquipmentRoutePatrol(id);
      setEditId(id);
      setLines(row.lines || []);
      setPhase('lines');
      setModalOpen(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          patrol_route_id: row.patrol_route_id,
          recorded_at: row.recorded_at ? dayjs(row.recorded_at) : undefined,
          report_required: row.report_required,
          report_to_user_id: row.report_to_user_id ?? undefined,
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
        width: 160,
        hideInSearch: true,
        render: (_, r) => (r.recorded_at ? dayjs(r.recorded_at).format('YYYY-MM-DD HH:mm') : '—'),
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
        title: t('app.haoligo.equipment.documents.colReportRequired'),
        dataIndex: 'report_required',
        width: 100,
        hideInSearch: true,
        render: (_, r) => (r.report_required ? t('app.haoligo.equipment.documents.yes') : t('app.haoligo.equipment.documents.no')),
      },
      moldDocumentCreatedAtColumn<EquipmentRoutePatrolRow>(),
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
                  await deleteEquipmentRoutePatrol(row.id);
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
    setFormLoading(true);
    try {
      const row = await createEquipmentRoutePatrol({
        patrol_route_id: Number(v.patrol_route_id),
        recorded_at: v.recorded_at ? dayjs(v.recorded_at as string).toISOString() : undefined,
        report_required: Boolean(v.report_required),
        report_to_user_id: v.report_to_user_id != null && v.report_to_user_id !== '' ? Number(v.report_to_user_id) : null,
      });
      setEditId(row.id);
      setLines(row.lines || []);
      setPhase('lines');
      messageApi.success(t('app.haoligo.equipment.documents.routePatrolCreatedFillLines'));
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
    const v = formRef.current?.getFieldsValue() as Record<string, unknown>;
    setFormLoading(true);
    try {
      await updateEquipmentRoutePatrol(editId, {
        recorded_at: v.recorded_at ? dayjs(v.recorded_at as string).toISOString() : undefined,
        report_required: Boolean(v.report_required),
        report_to_user_id: v.report_to_user_id != null && v.report_to_user_id !== '' ? Number(v.report_to_user_id) : null,
        lines: lines.map((ln) => ({
          id: ln.id,
          is_normal: ln.is_normal,
          abnormal_description: ln.abnormal_description ?? null,
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

  return (
    <ListPageTemplate>
      <UniTable<EquipmentRoutePatrolRow>
        columnPersistenceId="haoligo-equipment-route-patrols"
        headerTitle={title}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button type="primary" key="new" onClick={openNew}>
            {t('app.haoligo.equipment.documents.btnNew')}
          </Button>,
        ]}
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
        width={920}
        destroyOnClose
        footer={
          detailMode ? (
            <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnClose')}</Button>
          ) : phase === 'header' ? (
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
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
                name="patrol_route_id"
                label={t('app.haoligo.equipment.documents.formPatrolRoute')}
                rules={[{ required: true }]}
                disabled={detailMode || phase === 'lines' || editId != null}
                fieldProps={{ style: { width: '100%' } }}
                request={async () => {
                  const rows = await listPatrolRoutes();
                  return (rows || []).map((r) => ({ label: `${r.code} ${r.name}`, value: r.id }));
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormDateTimePicker
                name="recorded_at"
                label={t('app.haoligo.equipment.documents.formRecordedAt')}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormSwitch name="report_required" label={t('app.haoligo.equipment.documents.formReportRequired')} />
            </Col>
            <Col xs={24} md={12}>
              <ProFormSelect
                name="report_to_user_id"
                label={t('app.haoligo.equipment.documents.formReportToUserId')}
                allowClear
                options={[]}
                fieldProps={{
                  style: { width: '100%' },
                  placeholder: t('app.haoligo.equipment.documents.formReportToUserIdPh'),
                }}
              />
            </Col>
          </Row>
        </ProForm>

        {phase === 'lines' && lines.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text strong>{t('app.haoligo.equipment.documents.routePatrolLinesTitle')}</Typography.Text>
            <Table<EquipmentRoutePatrolLineRow>
              style={{ marginTop: 8 }}
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={lines}
              columns={[
                { title: t('app.haoligo.equipment.documents.colSequence'), dataIndex: 'sequence', width: 72 },
                { title: t('app.haoligo.equipment.documents.colEquipmentCode'), dataIndex: 'asset_code', width: 120 },
                { title: t('app.haoligo.equipment.documents.colEquipmentName'), dataIndex: 'equipment_name' },
                {
                  title: t('app.haoligo.equipment.documents.colIsNormal'),
                  dataIndex: 'is_normal',
                  width: 100,
                  render: (_, row, idx) =>
                    detailMode ? (
                      row.is_normal ? t('app.haoligo.equipment.documents.resultNormal') : t('app.haoligo.equipment.documents.resultAbnormal')
                    ) : (
                      <Switch
                        checked={row.is_normal}
                        onChange={(checked) => {
                          setLines((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, is_normal: checked, abnormal_description: checked ? null : x.abnormal_description } : x)),
                          );
                        }}
                      />
                    ),
                },
                {
                  title: t('app.haoligo.equipment.documents.colAbnormal'),
                  dataIndex: 'abnormal_description',
                  render: (_, row, idx) =>
                    detailMode ? (
                      row.abnormal_description || '—'
                    ) : (
                      <Input
                        size="small"
                        disabled={row.is_normal}
                        value={row.abnormal_description || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, abnormal_description: val } : x)));
                        }}
                      />
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

export default RoutePatrolDocumentsPage;

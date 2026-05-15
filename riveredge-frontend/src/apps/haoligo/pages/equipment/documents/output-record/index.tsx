/**
 * 好力 GO — 设备产出单（制令单号 + 数据集带出）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Col, Modal, Row, Space } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../../hooks/useNewShortcut';
import {
  createEquipmentOutputRecord,
  deleteEquipmentOutputRecord,
  getEquipmentOutputDatasetBinding,
  getEquipmentOutputRecord,
  listEquipmentOutputRecords,
  listEquipments,
  previewEquipmentOutputByWorkOrder,
  updateEquipmentOutputRecord,
  type EquipmentOutputDatasetBindingPayload,
  type EquipmentOutputRecordRow,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';

const OutputRecordDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [datasetSnapshot, setDatasetSnapshot] = useState<Record<string, unknown> | null>(null);
  const [outputDatasetBinding, setOutputDatasetBinding] = useState<EquipmentOutputDatasetBindingPayload | null>(null);

  const canPrefillFromDataset = useMemo(() => {
    const b = outputDatasetBinding;
    return Boolean(b?.dataset_uuid?.trim() && b?.work_order_param_key?.trim());
  }, [outputDatasetBinding]);

  const title = t('app.haoligo.menu.equipment.documents.output-record');
  const reload = useCallback(() => actionRef.current?.reload(), []);

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const b = await getEquipmentOutputDatasetBinding();
        if (cancelled) return;
        setOutputDatasetBinding(b?.dataset_uuid?.trim() ? b : null);
      } catch {
        if (!cancelled) setOutputDatasetBinding(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen]);

  const openNew = () => {
    setDetailMode(false);
    setEditId(null);
    setDatasetSnapshot(null);
    setModalOpen(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        recorded_at: dayjs(),
        completed_qty: 0,
        customer_name: undefined,
        product_name: undefined,
        planned_qty: undefined,
      });
    }, 0);
  };

  useNewShortcut(openNew);

  const openEdit = async (id: number, view: boolean) => {
    setFormLoading(true);
    setDetailMode(view);
    setEditId(id);
    setModalOpen(true);
    try {
      const row = await getEquipmentOutputRecord(id);
      setDatasetSnapshot((row.dataset_snapshot as Record<string, unknown>) || null);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          equipment_id: row.equipment_id,
          recorded_at: row.recorded_at ? dayjs(row.recorded_at) : undefined,
          work_order_no: row.work_order_no,
          customer_name: row.customer_name,
          product_name: row.product_name,
          planned_qty: row.planned_qty != null ? Number(row.planned_qty) : undefined,
          completed_qty: Number(row.completed_qty ?? 0),
          startup_at: row.startup_at ? dayjs(row.startup_at) : undefined,
          completed_at: row.completed_at ? dayjs(row.completed_at) : undefined,
          operator_name: row.operator_name,
          team_leader_name: row.team_leader_name,
        });
      }, 0);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const runPrefill = async () => {
    const wo = String(formRef.current?.getFieldValue('work_order_no') || '').trim();
    if (!wo) {
      messageApi.warning(t('app.haoligo.equipment.documents.outputWorkOrderRequired'));
      return;
    }
    setPrefillBusy(true);
    try {
      const res = await previewEquipmentOutputByWorkOrder({ work_order_no: wo });
      formRef.current?.setFieldsValue({
        customer_name: res.customer_name ?? undefined,
        product_name: res.product_name ?? undefined,
        planned_qty: res.planned_qty != null ? Number(res.planned_qty) : undefined,
      });
      setDatasetSnapshot(res.dataset_row || null);
      messageApi.success(t('app.haoligo.equipment.documents.outputPrefillOk'));
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setPrefillBusy(false);
    }
  };

  const columns = useMemo<ProColumns<EquipmentOutputRecordRow>[]>(
    () => [
      { title: t('app.haoligo.equipment.documents.colSheetNo'), dataIndex: 'sheet_no', width: 130, ellipsis: true },
      {
        title: t('app.haoligo.equipment.documents.colRecordedAt'),
        dataIndex: 'recorded_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.recorded_at ? dayjs(r.recorded_at).format('YYYY-MM-DD HH:mm') : '—'),
      },
      {
        title: t('app.haoligo.equipment.documents.colEquipment'),
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) =>
          r.equipment_asset_code || r.equipment_name
            ? `${r.equipment_asset_code || ''} ${r.equipment_name || ''}`.trim()
            : `ID ${r.equipment_id}`,
      },
      { title: t('app.haoligo.equipment.documents.colWorkOrderNo'), dataIndex: 'work_order_no', width: 140, ellipsis: true },
      { title: t('app.haoligo.equipment.documents.colCustomer'), dataIndex: 'customer_name', ellipsis: true, hideInSearch: true },
      { title: t('app.haoligo.equipment.documents.colProduct'), dataIndex: 'product_name', ellipsis: true, hideInSearch: true },
      {
        title: t('app.haoligo.equipment.documents.colCompletedQty'),
        dataIndex: 'completed_qty',
        width: 100,
        hideInSearch: true,
      },
      moldDocumentCreatedAtColumn<EquipmentOutputRecordRow>(),
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
                  await deleteEquipmentOutputRecord(row.id);
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

  const submit = async () => {
    try {
      await formRef.current?.validateFields();
    } catch {
      return;
    }
    const v = formRef.current?.getFieldsValue() as Record<string, unknown>;
    setFormLoading(true);
    try {
      const body = {
        equipment_id: Number(v.equipment_id),
        work_order_no: String(v.work_order_no || '').trim(),
        recorded_at: v.recorded_at ? dayjs(v.recorded_at as string).toISOString() : undefined,
        customer_name: (v.customer_name as string) || undefined,
        product_name: (v.product_name as string) || undefined,
        planned_qty: v.planned_qty != null && v.planned_qty !== '' ? Number(v.planned_qty) : undefined,
        completed_qty: v.completed_qty != null && v.completed_qty !== '' ? Number(v.completed_qty) : 0,
        startup_at: v.startup_at ? dayjs(v.startup_at as string).toISOString() : undefined,
        completed_at: v.completed_at ? dayjs(v.completed_at as string).toISOString() : undefined,
        operator_name: (v.operator_name as string) || undefined,
        team_leader_name: (v.team_leader_name as string) || undefined,
        dataset_snapshot: datasetSnapshot || undefined,
      };
      if (editId == null) {
        await createEquipmentOutputRecord(body);
      } else {
        await updateEquipmentOutputRecord(editId, body);
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

  return (
    <ListPageTemplate>
      <UniTable<EquipmentOutputRecordRow>
        columnPersistenceId="haoligo-equipment-output-records"
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
          const res = await listEquipmentOutputRecords({
            skip: ((params.current || 1) - 1) * (params.pageSize || 50),
            limit: params.pageSize || 50,
            keyword: (params.keyword as string) || undefined,
            sheet_no: (params.sheet_no as string) || undefined,
            work_order_no: (params.work_order_no as string) || undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <Modal
        {...MODAL_CONFIG}
        title={
          detailMode
            ? `${title} — ${t('app.haoligo.equipment.documents.actionView')}`
            : editId
              ? `${title} — ${t('app.haoligo.equipment.documents.actionEdit')}`
              : `${title} — ${t('app.haoligo.equipment.documents.phaseNew')}`
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnClose
        footer={
          detailMode ? (
            <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnClose')}</Button>
          ) : (
            <Space>
              <Button onClick={() => setModalOpen(false)}>{t('app.haoligo.equipment.documents.btnCancel')}</Button>
              <Button type="primary" loading={formLoading} onClick={() => void submit()}>
                {t('app.haoligo.equipment.documents.btnSave')}
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
                disabled={detailMode || editId != null}
                fieldProps={{ showSearch: true, filterOption: false, style: { width: '100%' } }}
                request={async ({ keyWords }) => {
                  const res = await listEquipments({ keyword: keyWords || undefined, limit: 50 });
                  return (res.items || []).map((e) => ({ label: `${e.asset_code} ${e.name}`, value: e.id }));
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
              <ProFormText
                name="work_order_no"
                label={t('app.haoligo.equipment.documents.colWorkOrderNo')}
                tooltip={t('app.haoligo.equipment.documents.outputWorkOrderTooltip')}
                placeholder={t('app.haoligo.equipment.documents.outputWorkOrderPh')}
                rules={[{ required: true }]}
                fieldProps={{
                  allowClear: true,
                  style: { width: '100%' },
                  addonAfter: !detailMode ? (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: '0 8px' }}
                        loading={prefillBusy}
                        disabled={!canPrefillFromDataset}
                        onClick={() => void runPrefill()}
                      >
                        {t('app.haoligo.equipment.documents.outputPrefillInlineBtn')}
                      </Button>
                    ) : undefined,
                }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormText
                name="customer_name"
                label={t('app.haoligo.equipment.documents.colCustomer')}
                placeholder={t('app.haoligo.equipment.documents.outputPrefilledPlaceholder')}
                tooltip={t('app.haoligo.equipment.documents.outputPrefilledFieldTooltip')}
                fieldProps={{
                  readOnly: true,
                  style: { width: '100%', backgroundColor: detailMode ? undefined : '#fafafa' },
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormText
                name="product_name"
                label={t('app.haoligo.equipment.documents.colProduct')}
                placeholder={t('app.haoligo.equipment.documents.outputPrefilledPlaceholder')}
                tooltip={t('app.haoligo.equipment.documents.outputPrefilledFieldTooltip')}
                fieldProps={{
                  readOnly: true,
                  style: { width: '100%', backgroundColor: detailMode ? undefined : '#fafafa' },
                }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormDigit
                name="planned_qty"
                label={t('app.haoligo.equipment.documents.colPlannedQty')}
                placeholder={t('app.haoligo.equipment.documents.outputPrefilledPlaceholder')}
                tooltip={t('app.haoligo.equipment.documents.outputPrefilledFieldTooltip')}
                fieldProps={{
                  readOnly: true,
                  min: 0,
                  precision: 4,
                  style: { width: '100%', backgroundColor: detailMode ? undefined : '#fafafa' },
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormDigit
                name="completed_qty"
                label={t('app.haoligo.equipment.documents.colCompletedQty')}
                rules={[{ required: true }]}
                fieldProps={{ min: 0, precision: 4, style: { width: '100%' } }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormDateTimePicker
                name="startup_at"
                label={t('app.haoligo.equipment.documents.formStartupAt')}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
            <Col xs={24} md={12}>
              <ProFormDateTimePicker
                name="completed_at"
                label={t('app.haoligo.equipment.documents.formCompletedAt')}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <ProFormText name="operator_name" label={t('app.haoligo.equipment.documents.formOperator')} fieldProps={{ style: { width: '100%' } }} />
            </Col>
            <Col xs={24} md={12}>
              <ProFormText
                name="team_leader_name"
                label={t('app.haoligo.equipment.documents.formTeamLeader')}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
          </Row>
        </ProForm>
      </Modal>
    </ListPageTemplate>
  );
};

export default OutputRecordDocumentsPage;

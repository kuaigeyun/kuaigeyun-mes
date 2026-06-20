/**
 * 好力 GO — 设备状态调整单（手工切换设备运行状态，状态取自数据字典）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../../components/uni-action';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDateTimePicker,
  ProFormInstance,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Modal, Row, Spin, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { DictionarySelect } from '../../../../../../components/dictionary-select';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import {
  createEquipmentStatusAdjustment,
  deleteEquipmentStatusAdjustment,
  getEquipment,
  getEquipmentStatusAdjustment,
  listEquipmentStatusAdjustments,
  listEquipments,
  updateEquipmentStatusAdjustment,
  type EquipmentStatusAdjustmentRow,
} from '../../../../services/haoligo';
import {
  HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT,
  useEquipmentOperationalStatusLabels,
} from '../../../../utils/equipmentOperationalStatus';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { formatDateTime } from '../../../../../../utils/format';

const StatusAdjustmentDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const { formatStatus } = useEquipmentOperationalStatusLabels();

  const [modalOpen, setModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [currentEquipmentStatus, setCurrentEquipmentStatus] = useState<string | null>(null);
  const [savedNewStatus, setSavedNewStatus] = useState<string | null>(null);
  const [statusPreviewLoading, setStatusPreviewLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const title = t('app.haoligo.menu.equipment.documents.status-adjustment');
  const reload = useCallback(() => actionRef.current?.reload(), []);

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      try {
        let done = 0;
        let fail = 0;
        for (const key of keys) {
          try {
            await deleteEquipmentStatusAdjustment(Number(key));
            done++;
          } catch {
            fail++;
          }
        }
        if (fail > 0) {
          messageApi.warning(t('app.haoligo.equipment.documents.batchDeletePartial', { done, fail }));
        } else {
          messageApi.success(t('common.batchDeleteSuccess', { count: done }));
        }
        setSelectedRowKeys([]);
        reload();
      } catch (e) {
        messageApi.error((e as Error).message || t('common.batchDeleteFailed'));
      }
    },
    [messageApi, reload, t],
  );

  const loadEquipmentCurrentStatus = useCallback(
    async (equipmentId: number | undefined) => {
      if (!equipmentId) {
        setCurrentEquipmentStatus(null);
        return;
      }
      setStatusPreviewLoading(true);
      try {
        const eq = await getEquipment(equipmentId);
        setCurrentEquipmentStatus(eq.operational_status ?? null);
      } catch {
        setCurrentEquipmentStatus(null);
      } finally {
        setStatusPreviewLoading(false);
      }
    },
    [],
  );

  const getNewFormDefaults = useCallback(
    () => ({
      recorded_at: dayjs(),
    }),
    [],
  );

  const openNew = () => {
    setDetailMode(false);
    setEditId(null);
    setCurrentEquipmentStatus(null);
    setSavedNewStatus(null);
    setModalOpen(true);
  };

  const openEdit = async (id: number, view: boolean) => {
    setFormLoading(true);
    setDetailMode(view);
    setEditId(id);
    setModalOpen(true);
    try {
      const row = await getEquipmentStatusAdjustment(id);
      setCurrentEquipmentStatus(row.old_operational_status ?? null);
      setSavedNewStatus(row.new_operational_status);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          equipment_id: row.equipment_id,
          new_operational_status: row.new_operational_status,
          recorded_at: row.recorded_at ? dayjs(row.recorded_at) : undefined,
          remark: row.remark,
        });
      }, 0);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const columns = useMemo<ProColumns<EquipmentStatusAdjustmentRow>[]>(
    () => [
      { title: t('app.haoligo.equipment.documents.colSheetNo'), dataIndex: 'sheet_no', width: 130, ellipsis: true },
      {
        title: t('app.haoligo.equipment.documents.colRecordedAt'),
        dataIndex: 'recorded_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.recorded_at ? formatDateTime(r.recorded_at, 'YYYY-MM-DD HH:mm') : '—'),
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
      {
        title: t('app.haoligo.equipment.documents.statusAdjColOldStatus'),
        dataIndex: 'old_operational_status',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatStatus(r.old_operational_status, t('app.haoligo.equipment.ledger.operationalStatusNone')),
      },
      {
        title: t('app.haoligo.equipment.documents.statusAdjColNewStatus'),
        dataIndex: 'new_operational_status',
        width: 100,
        hideInSearch: true,
        render: (_, r) => formatStatus(r.new_operational_status),
      },
      {
        title: t('app.haoligo.equipment.documents.colRemark'),
        dataIndex: 'remark',
        ellipsis: true,
        hideInSearch: true,
      },
      moldDocumentCreatedAtColumn<EquipmentStatusAdjustmentRow>(),
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
              Modal.confirm({
                title: t('app.haoligo.equipment.documents.deleteConfirm'),
                onOk: async () => {
                  await deleteEquipmentStatusAdjustment(row.id);
                  messageApi.success(t('app.haoligo.equipment.updateSuccess'));
                  reload();
                },
              });
            }}
          />,
        ],
      },
    ],
    [t, formatStatus, messageApi, reload],
  );

  const handleSubmit = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (!values) return;
      const recordedAt = values.recorded_at
        ? dayjs.isDayjs(values.recorded_at)
          ? values.recorded_at.toISOString()
          : String(values.recorded_at)
        : dayjs().toISOString();
      const remark = values.remark != null ? String(values.remark).trim() || null : null;
      setFormLoading(true);
      if (editId == null) {
        await createEquipmentStatusAdjustment({
          equipment_id: Number(values.equipment_id),
          new_operational_status: String(values.new_operational_status).trim(),
          recorded_at: recordedAt,
          remark,
        });
        messageApi.success(t('app.haoligo.equipment.createSuccess'));
      } else {
        await updateEquipmentStatusAdjustment(editId, { recorded_at: recordedAt, remark });
        messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      }
      setModalOpen(false);
      reload();
    } catch (e) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const isCreate = editId == null;

  return (
    <ListPageTemplate title={title}>
      <UniTable<EquipmentStatusAdjustmentRow>
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="apps.haoligo.pages.equipment.documents.status-adjustment"
        columns={columns}
        showCreateButton
        onCreate={openNew}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText={t('common.batchDelete')}
        deleteConfirmTitle={t('app.haoligo.equipment.documents.batchDeleteTitle')}
        deleteConfirmDescription={(count) =>
          t('app.haoligo.equipment.documents.batchDeleteDescription', { count })
        }
        request={async (params) => {
          const skip = ((params.current || 1) - 1) * (params.pageSize || 20);
          const res = await listEquipmentStatusAdjustments({
            skip,
            limit: params.pageSize || 20,
            keyword: params.keyword as string | undefined,
            sheet_no: params.sheet_no as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <Modal
        {...MODAL_CONFIG}
        title={
          detailMode
            ? t('app.haoligo.equipment.documents.statusAdjModalView')
            : isCreate
              ? t('app.haoligo.equipment.documents.statusAdjModalCreate')
              : t('app.haoligo.equipment.documents.statusAdjModalEdit')
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        afterOpenChange={(open) => {
          if (open && editId == null && !detailMode) {
            formRef.current?.setFieldsValue(getNewFormDefaults());
          }
        }}
        onOk={detailMode ? () => setModalOpen(false) : handleSubmit}
        okText={detailMode ? t('common.close') : t('common.save')}
        cancelButtonProps={{ style: detailMode ? { display: 'none' } : undefined }}
        confirmLoading={formLoading}
        destroyOnHidden
        width={640}
      >
        <Spin spinning={formLoading}>
          <ProForm
            formRef={formRef}
            submitter={false}
            layout="vertical"
            disabled={detailMode}
            initialValues={editId == null && !detailMode ? getNewFormDefaults() : undefined}
          >
            <Row gutter={16}>
              <Col span={24}>
                <ProFormSelect
                  name="equipment_id"
                  label={t('app.haoligo.equipment.documents.colEquipment')}
                  rules={[{ required: isCreate, message: t('app.haoligo.equipment.documents.statusAdjEquipmentRequired') }]}
                  disabled={!isCreate || detailMode}
                  fieldProps={{
                    showSearch: true,
                    filterOption: false,
                    style: { width: '100%' },
                    onChange: (v: number) => {
                      if (isCreate && !detailMode) void loadEquipmentCurrentStatus(v);
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
              {isCreate ? (
                <Col span={24}>
                  <Typography.Text type="secondary">
                    {t('app.haoligo.equipment.documents.statusAdjCurrentStatus')}：
                    {statusPreviewLoading ? (
                      '…'
                    ) : (
                      formatStatus(
                        currentEquipmentStatus,
                        t('app.haoligo.equipment.ledger.operationalStatusNone'),
                      )
                    )}
                  </Typography.Text>
                </Col>
              ) : (
                <Col span={12}>
                  <Typography.Text>
                    {t('app.haoligo.equipment.documents.statusAdjColOldStatus')}：
                    {formatStatus(
                      currentEquipmentStatus,
                      t('app.haoligo.equipment.ledger.operationalStatusNone'),
                    )}
                  </Typography.Text>
                </Col>
              )}
              <Col span={isCreate ? 24 : 12}>
                {isCreate ? (
                  <DictionarySelect
                    dictionaryCode={HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS_DICT}
                    name="new_operational_status"
                    label={t('app.haoligo.equipment.documents.statusAdjColNewStatus')}
                    required
                    disabled={detailMode}
                    placeholder={t('app.haoligo.equipment.documents.statusAdjNewStatusPh')}
                  />
                ) : (
                  <Typography.Text>
                    {t('app.haoligo.equipment.documents.statusAdjColNewStatus')}：
                    {formatStatus(savedNewStatus)}
                  </Typography.Text>
                )}
              </Col>
              <Col span={24}>
                <ProFormDateTimePicker
                  name="recorded_at"
                  label={t('app.haoligo.equipment.documents.colRecordedAt')}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
              <Col span={24}>
                <ProFormTextArea name="remark" label={t('app.haoligo.equipment.documents.colRemark')} fieldProps={{ rows: 3 }} />
              </Col>
            </Row>
          </ProForm>
        </Spin>
      </Modal>
    </ListPageTemplate>
  );
};

export default StatusAdjustmentDocumentsPage;

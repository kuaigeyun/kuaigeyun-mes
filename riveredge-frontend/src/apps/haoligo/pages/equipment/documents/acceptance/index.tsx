/**
 * 好力 GO — 设备验收单（PC 列表/新建/全流程操作，与手机端对齐）
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
  ProFormText,
} from '@ant-design/pro-components';
import { App, Button, Col, Modal, Row, Space, Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../../components/uni-table';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../../components/layout-templates';
import {
  createEquipmentAcceptanceSheet,
  deleteEquipmentAcceptanceSheet,
  getEquipmentAcceptanceSheet,
  listEquipmentAcceptanceSheets,
  listHaoligoNotifyUserOptions,
  type EquipmentAcceptanceSheetRow,
  type EquipmentAcceptanceWorkflowStatus,
} from '../../../../services/haoligo';
import { moldDocumentCreatedAtColumn } from '../../../../utils/documentTableColumns';
import { formatDateTime } from '../../../../../../utils/format';
import { HAOLIGO_RESOURCE_EQUIPMENT_ACCEPTANCE } from '../../../../constants/documentPermissionResources';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import AcceptanceDetailPanel from './AcceptanceDetailPanel';
import ManufacturerSelect from '../../../../components/ManufacturerSelect';
import { acceptanceWorkflowStatusTagColor } from '../../../../utils/equipmentAcceptance';

const WORKFLOW_STATUSES: EquipmentAcceptanceWorkflowStatus[] = [
  'draft',
  'commissioning',
  'pending_trial',
  'trial_recording',
  'accepted',
  'closed',
];

type AcceptanceWorkflowAction = 'commissioning' | 'trial' | 'ledger';

function resolveAcceptanceWorkflowAction(
  row: EquipmentAcceptanceSheetRow,
  perms: ReturnType<typeof useResourcePermissions>,
): AcceptanceWorkflowAction | null {
  const status = row.workflow_status ?? '';
  if ((status === 'draft' || status === 'commissioning') && (perms.canAction?.('submit') ?? false)) {
    return 'commissioning';
  }
  if (
    (status === 'pending_trial' || status === 'trial_recording') &&
    (perms.canAction?.('execute') ?? false)
  ) {
    return 'trial';
  }
  if (
    status === 'accepted' &&
    (row.ledger_action === 'none' || !row.ledger_action) &&
    (perms.canAction?.('complete') ?? false)
  ) {
    return 'ledger';
  }
  return null;
}

const AcceptanceDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(HAOLIGO_RESOURCE_EQUIPMENT_ACCEPTANCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailMode, setDetailMode] = useState(false);
  const [detailRow, setDetailRow] = useState<EquipmentAcceptanceSheetRow | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailInitialAction, setDetailInitialAction] = useState<'ledger' | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const reload = useCallback(() => actionRef.current?.reload(), []);

  const workflowLabel = useCallback(
    (status: string | null | undefined) => {
      const key = (status || '').trim();
      if (!key) return '—';
      return t(`app.haoligo.equipment.documents.acceptance.workflow.${key}`, { defaultValue: key });
    },
    [t],
  );

  const searchNotifyUsers = useCallback(
    async (keyword?: string, selectedIds?: number[]) => {
      const users = await listHaoligoNotifyUserOptions({
        keyword: keyword?.trim() || undefined,
        selected_user_ids: selectedIds?.length ? selectedIds : undefined,
        limit: 50,
      });
      return users.map((u) => ({ label: u.label, value: u.id }));
    },
    [],
  );

  const reloadDetail = useCallback(async () => {
    if (detailId == null) return;
    const row = await getEquipmentAcceptanceSheet(detailId);
    setDetailRow(row);
    reload();
  }, [detailId, reload]);

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      try {
        let done = 0;
        let fail = 0;
        for (const key of keys) {
          try {
            await deleteEquipmentAcceptanceSheet(Number(key));
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

  const handleDeleteOne = useCallback(
    (row: EquipmentAcceptanceSheetRow) => {
      Modal.confirm({
        title: t('app.haoligo.equipment.documents.deleteConfirm'),
        okType: 'danger',
        onOk: async () => {
          try {
            await deleteEquipmentAcceptanceSheet(row.id);
            messageApi.success(t('app.haoligo.equipment.updateSuccess'));
            reload();
          } catch (e) {
            messageApi.error((e as Error).message || t('common.deleteFailed'));
          }
        },
      });
    },
    [messageApi, reload, t],
  );

  const openNew = () => {
    setDetailMode(false);
    setDetailRow(null);
    setDetailId(null);
    setModalOpen(true);
  };

  const openView = async (id: number, options?: { openLedger?: boolean }) => {
    setFormLoading(true);
    setDetailMode(true);
    setDetailRow(null);
    setDetailId(id);
    setDetailInitialAction(options?.openLedger ? 'ledger' : null);
    setModalOpen(true);
    try {
      const row = await getEquipmentAcceptanceSheet(id);
      setDetailRow(row);
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      setModalOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  const columns = useMemo<ProColumns<EquipmentAcceptanceSheetRow>[]>(
    () => [
      { title: t('app.haoligo.equipment.documents.colSheetNo'), dataIndex: 'sheet_no', width: 130, ellipsis: true },
      {
        title: t('app.haoligo.equipment.documents.acceptance.colEquipmentName'),
        dataIndex: 'equipment_name',
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.acceptance.colManufacturer'),
        dataIndex: 'manufacturer_name',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.acceptance.colInstallLocation'),
        dataIndex: 'install_location',
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.acceptance.colWorkflowStatus'),
        dataIndex: 'workflow_status',
        width: 110,
        valueType: 'select',
        valueEnum: Object.fromEntries(
          WORKFLOW_STATUSES.map((s) => [s, { text: workflowLabel(s) }]),
        ),
        render: (_, r) => (
          <Tag color={acceptanceWorkflowStatusTagColor(r.workflow_status)}>
            {workflowLabel(r.workflow_status)}
          </Tag>
        ),
      },
      {
        title: t('app.haoligo.equipment.documents.acceptance.colCurrentRound'),
        dataIndex: 'current_round',
        width: 88,
        hideInSearch: true,
      },
      {
        title: t('app.haoligo.equipment.documents.acceptance.colArrivedAt'),
        dataIndex: 'arrived_at',
        width: 150,
        hideInSearch: true,
        render: (_, r) => (r.arrived_at ? formatDateTime(r.arrived_at, 'YYYY-MM-DD HH:mm') : '—'),
      },
      moldDocumentCreatedAtColumn<EquipmentAcceptanceSheetRow>(),
      {
        title: t('app.haoligo.equipment.documents.colActions'),
        valueType: 'option',
        fixed: 'right',
        render: (_, row) => {
          const workflowAction = resolveAcceptanceWorkflowAction(row, perms);
          const workflowActionLabel =
            workflowAction === 'commissioning'
              ? t('app.haoligo.equipment.documents.acceptance.actionCommissioning')
              : workflowAction === 'trial'
                ? t('app.haoligo.equipment.documents.acceptance.actionTrial')
                : workflowAction === 'ledger'
                  ? t('app.haoligo.equipment.documents.acceptance.finalizeLedger')
                  : null;
          return (
            <Space size={4} wrap>
              {workflowAction && workflowActionLabel ? (
                <Button
                  {...rowActionKind(
                    workflowAction === 'ledger' ? 'complete' : workflowAction === 'trial' ? 'execute' : 'submit',
                  )}
                  key="workflow"
                  type="primary"
                  onClick={() =>
                    void openView(row.id, { openLedger: workflowAction === 'ledger' })
                  }
                >
                  {workflowActionLabel}
                </Button>
              ) : (
                <Button {...rowActionKind('read')} key="v" onClick={() => void openView(row.id)}>
                  {t('app.haoligo.equipment.documents.actionView')}
                </Button>
              )}
              {(perms.canAction?.('delete') ?? false) ? (
                <Button
                  {...rowActionKind('delete')}
                  key="delete"
                  onClick={() => handleDeleteOne(row)}
                >
                  {t('app.haoligo.equipment.documents.actionDelete')}
                </Button>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [t, workflowLabel, messageApi, reload, perms, handleDeleteOne],
  );

  const handleCreate = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (!values) return;
      const equipmentName = String(values.equipment_name ?? '').trim();
      if (!equipmentName) return;
      const arrivedAt = values.arrived_at
        ? dayjs.isDayjs(values.arrived_at)
          ? values.arrived_at.toISOString()
          : String(values.arrived_at)
        : undefined;
      setFormLoading(true);
      const created = await createEquipmentAcceptanceSheet({
        equipment_name: equipmentName,
        manufacturer_id: values.manufacturer_id != null ? Number(values.manufacturer_id) : undefined,
        arrived_at: arrivedAt,
        install_location: values.install_location != null ? String(values.install_location).trim() || undefined : undefined,
        commissioning_user_ids: Array.isArray(values.commissioning_user_ids)
          ? values.commissioning_user_ids.map((v: unknown) => Number(v)).filter((id) => Number.isFinite(id) && id > 0)
          : [],
      });
      messageApi.success(t('app.haoligo.equipment.createSuccess'));
      setModalOpen(false);
      reload();
      void openView(created.id);
    } catch (e) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<EquipmentAcceptanceSheetRow>
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="apps.haoligo.pages.equipment.documents.acceptance"
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
          const res = await listEquipmentAcceptanceSheets({
            skip,
            limit: params.pageSize || 20,
            keyword: params.keyword as string | undefined,
            workflow_status: params.workflow_status as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <Modal
        {...MODAL_CONFIG}
        title={
          detailMode
            ? t('app.haoligo.equipment.documents.acceptance.modalView')
            : t('app.haoligo.equipment.documents.acceptance.modalCreate')
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={detailMode ? () => setModalOpen(false) : handleCreate}
        okText={detailMode ? t('common.close') : t('common.save')}
        cancelButtonProps={{ style: detailMode ? { display: 'none' } : undefined }}
        confirmLoading={formLoading}
        destroyOnHidden
        width={detailMode ? 920 : 640}
        styles={detailMode ? { body: { maxHeight: '70vh', overflow: 'auto' } } : undefined}
      >
        <Spin spinning={formLoading}>
          {detailMode && detailRow ? (
            <AcceptanceDetailPanel
              detail={detailRow}
              onReload={reloadDetail}
              initialAction={detailInitialAction}
              onInitialActionHandled={() => setDetailInitialAction(null)}
            />
          ) : (
            <ProForm
              formRef={formRef}
              submitter={false}
              layout="vertical"
              initialValues={{ arrived_at: dayjs() }}
            >
              <Row gutter={16}>
                <ManufacturerSelect formRef={formRef} colProps={{ span: 24 }} />
                <Col span={24}>
                  <ProFormDateTimePicker
                    name="arrived_at"
                    label={t('app.haoligo.equipment.documents.acceptance.colArrivedAt')}
                    fieldProps={{ style: { width: '100%' } }}
                  />
                </Col>
                <Col span={24}>
                  <ProFormText
                    name="install_location"
                    label={t('app.haoligo.equipment.documents.acceptance.colInstallLocation')}
                  />
                </Col>
                <Col span={24}>
                  <ProFormText
                    name="equipment_name"
                    label={t('app.haoligo.equipment.documents.acceptance.colEquipmentName')}
                    rules={[{ required: true, message: t('common.required') }]}
                  />
                </Col>
                <Col span={24}>
                  <ProFormSelect
                    name="commissioning_user_ids"
                    label={t('app.haoligo.equipment.documents.acceptance.colCommissioningUsers')}
                    fieldProps={{
                      mode: 'multiple',
                      showSearch: true,
                      filterOption: false,
                      style: { width: '100%' },
                    }}
                    request={async ({ keyWords }) => {
                      const selected = formRef.current?.getFieldValue('commissioning_user_ids') as number[] | undefined;
                      return searchNotifyUsers(keyWords, selected);
                    }}
                  />
                </Col>
              </Row>
            </ProForm>
          )}
        </Spin>
      </Modal>
    </ListPageTemplate>
  );
};

export default AcceptanceDocumentsPage;

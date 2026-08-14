/**
 * 安装执行单列表
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal } from 'antd';
import { EditOutlined, CheckOutlined, DeleteOutlined, StopOutlined } from '@ant-design/icons';
import { rowActionKind } from '../../../../../components/uni-action';
import { rowActionLabelKeep } from '../../../../../components/uni-action/actionCatalog';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { LinkedDocumentCode } from '../../../../../components/linked-document-code';
import { DetailDrawerActions, ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { batchSomeCapabilityAllowed } from '../../../../../hooks/useDocumentCapabilities';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import {
  INSTALL_JOB_STATUSES,
  INSTALL_SUPPLY_SOURCES,
  installExecutionApi,
  type InstallExecution,
} from '../../../services/install-execution';
import {
  InstallExecutionFormModal,
  formatInstallStageLabel,
} from '../../../components/InstallExecutionFormModal';
import InstallExecutionTaskFormModal from '../../../components/InstallExecutionTaskFormModal';
import InstallExecutionAdvanceStageModal from '../../../components/InstallExecutionAdvanceStageModal';
import InstallExecutionCostFormModal from '../../../components/InstallExecutionCostFormModal';
import { InstallExecutionDetailDrawer } from './components/InstallExecutionDetailDrawer';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  AFTER_SALES_INSTALL_STATUS_COLOR,
  renderAfterSalesStatusTag,
  renderAfterSalesTypeMarker,
} from '../shared/afterSalesListPresentation';
import { getAntdModal } from '../../../../../utils/antdAppApis';

const RESOURCE = 'kuaizhizao:after-sales-install';

function installExecutionBatchCloseAllowed(
  records: InstallExecution[],
  canClose: boolean,
): boolean {
  return batchSomeCapabilityAllowed(records, canClose, (r) => r.capabilities?.close);
}

const InstallExecutionPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>();
  const perms = useResourcePermissions(RESOURCE);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InstallExecution | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<InstallExecution | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);
  const [taskJob, setTaskJob] = useState<InstallExecution | null>(null);
  const [advanceJob, setAdvanceJob] = useState<InstallExecution | null>(null);
  const [costJob, setCostJob] = useState<InstallExecution | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<InstallExecution[]>([]);

  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is InstallExecution => row != null),
    [selectedRowKeys],
  );

  const canBatchClose = perms.canAction?.('close') ?? perms.canUpdate;

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  useNewShortcut(openCreate);

  const reload = () => actionRef.current?.reload();

  const handleBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    reload();
  }, []);

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.installExecution.selectToDelete'));
      return;
    }
    const failed: string[] = [];
    let successCount = 0;
    for (const key of keys) {
      try {
        await installExecutionApi.delete(Number(key));
        successCount += 1;
      } catch (error: any) {
        failed.push(`${String(key)}: ${error?.message || t('common.deleteFailed')}`);
      }
    }
    setSelectedRowKeys([]);
    if (detailRow?.id != null && keys.map(Number).includes(detailRow.id)) {
      setDetailOpen(false);
      setDetailRow(null);
    }
    reload();
    if (failed.length === 0) {
      messageApi.success(t('app.kuaizhizao.installExecution.batchDeleteSuccess', { count: successCount }));
      return;
    }
    messageApi.warning(
      t('app.kuaizhizao.installExecution.batchDeletePartial', {
        success: successCount,
        failed: failed.length,
      }),
    );
    getAntdModal().error({
      title: t('app.kuaizhizao.installExecution.batchDeleteFailedTitle'),
      content: (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {failed.map((msg) => (
            <div key={msg}>{msg}</div>
          ))}
        </div>
      ),
      width: 640,
    });
  };

  const handleSavedFromAction = async (row: InstallExecution) => {
    messageApi.success(t('common.saveSuccess'));
    reload();
    if (detailRow?.id === row.id) {
      setDetailRow(row);
    }
  };

  const openTaskRegister = async (row: InstallExecution) => {
    const full = await installExecutionApi.get(row.id);
    setTaskJob(full);
  };

  const openAdvanceStage = async (row: InstallExecution) => {
    const full = await installExecutionApi.get(row.id);
    setAdvanceJob(full);
  };

  const openCostRegister = async (row: InstallExecution) => {
    const full = await installExecutionApi.get(row.id);
    setCostJob(full);
  };

  const renderBusinessActions = (
    row: InstallExecution,
    keyPrefix: string,
    options?: { gatePermission?: boolean },
  ) => {
    const caps = row.capabilities;
    const gate = (action: string) => {
      if (!options?.gatePermission) return true;
      if (!perms.enabled) return true;
      if (action === 'update') return perms.canUpdate;
      return perms.canAction?.(action) ?? false;
    };
    const nodes: React.ReactNode[] = [];
    if (caps?.advance_stage?.allowed !== false && gate('execute')) {
      nodes.push(
        <Button
          {...rowActionKind('execute')}
          {...rowActionLabelKeep()}
          key={`${keyPrefix}-advance`}
          data-action-priority={15}
          onClick={(e) => {
            e.stopPropagation();
            void openAdvanceStage(row);
          }}
        >
          {t('app.kuaizhizao.installExecution.actionAdvanceStage')}
        </Button>,
      );
    }
    if (caps?.assign_task?.allowed !== false && gate('assign')) {
      nodes.push(
        <Button
          {...rowActionKind('assign')}
          {...rowActionLabelKeep()}
          key={`${keyPrefix}-task`}
          data-action-priority={16}
          onClick={(e) => {
            e.stopPropagation();
            void openTaskRegister(row);
          }}
        >
          {t('app.kuaizhizao.installExecution.actionTaskRegister')}
        </Button>,
      );
    }
    if (caps?.register_cost?.allowed !== false && gate('update')) {
      nodes.push(
        <Button
          {...rowActionKind('update')}
          {...rowActionLabelKeep()}
          key={`${keyPrefix}-cost`}
          data-action-priority={17}
          onClick={(e) => {
            e.stopPropagation();
            void openCostRegister(row);
          }}
        >
          {t('app.kuaizhizao.installExecution.actionCostRegister')}
        </Button>,
      );
    }
    return nodes;
  };

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetailRow(await installExecutionApi.get(id));
    } catch (error) {
      setDetailRow(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.installExecution.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = (row: InstallExecution) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetailRow(null);
    setDetailError(null);
    void loadDetail(row.id);
  };

  const handleClose = (row: InstallExecution) => {
    modal.confirm({
      title: t('app.kuaizhizao.installExecution.closeConfirmTitle'),
      content: t('app.kuaizhizao.installExecution.closeConfirmContent', { code: row.job_code }),
      onOk: async () => {
        await installExecutionApi.close(row.id);
        messageApi.success(t('app.kuaizhizao.installExecution.closeSuccess'));
        reload();
        if (detailRow?.id === row.id) {
          setDetailRow(await installExecutionApi.get(row.id));
        }
      },
    });
  };

  const handleDelete = (row: InstallExecution) => {
    modal.confirm({
      title: t('app.kuaizhizao.installExecution.deleteConfirmTitle'),
      content: t('app.kuaizhizao.installExecution.deleteConfirmContent', { code: row.job_code }),
      okType: 'danger',
      onOk: async () => {
        await installExecutionApi.delete(row.id);
        messageApi.success(t('app.kuaizhizao.installExecution.deleteSuccess'));
        setDetailOpen(false);
        setDetailRow(null);
        reload();
      },
    });
  };

  const columns: ProColumns<InstallExecution>[] = useMemo(
    () =>
      alignProColumns<InstallExecution>(
        [
          {
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            title: '安装执行单',
            key: 'after_sales_install_stacked',
            dataIndex: 'job_code',
            fixed: 'left',
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={String(row.customer_name ?? '') || '-'}
                secondary={String(row.job_code ?? '') || '-'}
              />
            ),
          },
          {
            title: '供给来源',
            dataIndex: 'supply_source',
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            valueType: 'select',
            valueEnum: Object.fromEntries(
              INSTALL_SUPPLY_SOURCES.map((s) => [s, { text: s }]),
            ),
            hideInSearch: true,
            render: (_, row) => renderAfterSalesTypeMarker(row.supply_source),
          },
          {
            title: t('components.uniLifecycle.listColumnTitle'),
            dataIndex: 'current_stage_key',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, row) => {
              const stage = row.stages?.find((s) => s.stage_key === row.current_stage_key);
              return renderAfterSalesTypeMarker(
                formatInstallStageLabel(row.current_stage_key, stage?.stage_name),
              );
            },
          },
          {
            title: '销售订单',
            dataIndex: 'sales_order_code',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, row) => (
              <LinkedDocumentCode
                documentType="sales_order"
                documentId={row.sales_order_id}
                code={row.sales_order_code}
              />
            ),
          },
          {
            title: '现场地址',
            dataIndex: 'site_address',
            width: 168,
            minWidth: 168,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
          },
          {
            title: '状态',
            dataIndex: 'status',
            hideInTable: true,
            valueType: 'select',
            valueEnum: Object.fromEntries(
              INSTALL_JOB_STATUSES.map((s) => [s, { text: s }]),
            ),
          },
          ...buildDocumentAuditColumns<InstallExecution>(t),
          {
            title: '状态',
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) =>
              renderAfterSalesStatusTag(row.status, AFTER_SALES_INSTALL_STATUS_COLOR),
          },
          {
            title: t('common.actions'),
            key: 'action',
            valueType: 'option',
            fixed: 'right',
            hideInSearch: true,
            uniActionRenderOptions: { directMax: 6 },
            render: (_, row) => {
              const caps = row.capabilities;
              const parts: React.ReactNode[] = [
                <Button
                  {...rowActionKind('read')}
                  key="detail"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(row);
                  }}
                />,
                ...renderBusinessActions(row, 'row'),
              ];
              if (caps?.update?.allowed !== false && perms.canUpdate) {
                parts.push(
                  <Button
                    {...rowActionKind('update')}
                    key="edit"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const full = await installExecutionApi.get(row.id);
                      setEditing(full);
                      setFormOpen(true);
                    }}
                  />,
                );
              }
              if (
                caps?.close?.allowed !== false &&
                perms.canUpdate &&
                row.status !== '已关闭'
              ) {
                parts.push(
                  <Button
                    {...rowActionKind('close')}
                    key="close"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose(row);
                    }}
                  />,
                );
              }
              if (caps?.delete?.allowed !== false && perms.canDelete) {
                parts.push(
                  <Button
                    {...rowActionKind('delete')}
                    key="delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(row);
                    }}
                  />,
                );
              }
              return parts;
            },
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [t, perms, messageApi, modal],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<InstallExecution>
          actionRef={actionRef}
          rowKey="id"
          permissionResource={RESOURCE}
          columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.install-execution.v1"
          headerTitle={t('app.kuaizhizao.menu.after-sales-service.install-execution')}
          columns={columns}
          enableRowSelection={perms.canDelete || canBatchClose}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          showCreateButton={perms.canCreate}
          createButtonText={t('app.kuaizhizao.installExecution.create') + NEW_SHORTCUT_HINT}
          onCreate={openCreate}
          showDeleteButton={perms.canDelete}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('common.confirmBatchDeleteContent', { count })}
          toolBarActionsAfterDelete={[
            <UniCapabilityBatchButton
              key="install-execution-batch-close"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedRecordsForBatch}
              capabilityKey="close"
              permAllowed={canBatchClose}
              batchAllowed={(records, perm) => installExecutionBatchCloseAllowed(records, perm)}
              onRun={(id) => installExecutionApi.close(id)}
              onSuccess={() => {
                handleBatchSuccess();
                if (detailRow?.id != null && selectedRowKeys.map(Number).includes(detailRow.id)) {
                  void installExecutionApi.get(detailRow.id).then(setDetailRow);
                }
              }}
              notAllowedMessage={t('app.kuaizhizao.installExecution.batchCloseNotAllowed')}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.installExecution.batchClose'),
                batch: t('app.kuaizhizao.installExecution.batchClose'),
                batchConfirmTitle: t('app.kuaizhizao.installExecution.batchCloseConfirmTitle'),
                batchConfirmDescription: (count) =>
                  t('app.kuaizhizao.installExecution.batchCloseConfirmDescription', { count }),
              }}
              icon={<StopOutlined />}
              size="medium"
            />,
          ]}
          request={async (params, sort) => {
            const { current = 1, pageSize = 20, keyword, status, sales_order_code } = params;
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            const res = await installExecutionApi.list({
              skip: (current - 1) * pageSize,
              limit: pageSize,
              keyword: keyword as string | undefined,
              status: status as string | undefined,
              sales_order_code: sales_order_code as string | undefined,
              order_by: orderBy,
            });
            return { data: res.data ?? [], total: res.total ?? 0, success: true };
          }}
        />
      </ListPageTemplate>

      <InstallExecutionFormModal
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => reload()}
        onCreate={(payload) => installExecutionApi.create(payload)}
        onUpdate={(id, payload) => installExecutionApi.update(id, payload)}
      />

      <InstallExecutionDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRow(null);
          setDetailError(null);
        }}
        record={detailRow}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        extra={
          <DetailDrawerActions
            items={[
              {
                key: 'business',
                visible: Boolean(detailRow),
                render: () => (
                  <>{detailRow ? renderBusinessActions(detailRow, 'detail', { gatePermission: true }) : null}</>
                ),
              },
              {
                key: 'edit',
                visible: Boolean(
                  detailRow &&
                    detailRow.capabilities?.update?.allowed !== false &&
                    perms.canUpdate,
                ),
                render: () => (
                  <Button
                    icon={<EditOutlined />}
                    onClick={async () => {
                      if (!detailRow) return;
                      const full = await installExecutionApi.get(detailRow.id);
                      setEditing(full);
                      setFormOpen(true);
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                ),
              },
              {
                key: 'close',
                visible: Boolean(
                  detailRow &&
                    detailRow.status !== '已关闭' &&
                    detailRow.capabilities?.close?.allowed !== false &&
                    canBatchClose,
                ),
                render: () => (
                  <Button icon={<CheckOutlined />} onClick={() => handleClose(detailRow!)}>
                    {t('common.close')}
                  </Button>
                ),
              },
              {
                key: 'delete',
                visible: Boolean(
                  detailRow &&
                    detailRow.capabilities?.delete?.allowed !== false &&
                    perms.canDelete,
                ),
                render: () => (
                  <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(detailRow!)}>
                    {t('common.delete')}
                  </Button>
                ),
              },
            ]}
          />
        }
      />

      <InstallExecutionTaskFormModal
        open={Boolean(taskJob)}
        job={taskJob}
        onClose={() => setTaskJob(null)}
        onSaved={handleSavedFromAction}
        onSubmit={(id, payload) => installExecutionApi.registerTask(id, payload)}
      />

      <InstallExecutionAdvanceStageModal
        open={Boolean(advanceJob)}
        job={advanceJob}
        onClose={() => setAdvanceJob(null)}
        onSaved={handleSavedFromAction}
        onSubmit={(id, payload) => installExecutionApi.advanceStage(id, payload)}
      />

      <InstallExecutionCostFormModal
        open={Boolean(costJob)}
        job={costJob}
        onClose={() => setCostJob(null)}
        onSaved={handleSavedFromAction}
        onSubmit={(id, payload) => installExecutionApi.appendCost(id, payload)}
      />
    </>
  );
};

export default InstallExecutionPage;

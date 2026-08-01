/**
 * 安装执行单列表
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Descriptions, Modal, Space, Tag } from 'antd';
import { EditOutlined, CheckOutlined, DeleteOutlined, StopOutlined } from '@ant-design/icons';
import { rowActionKind } from '../../../../../components/uni-action';
import { rowActionLabelKeep } from '../../../../../components/uni-action/actionCatalog';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
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
  formatInstallCostTotal,
  formatInstallStageLabel,
} from '../../../components/InstallExecutionFormModal';
import InstallExecutionTaskFormModal from '../../../components/InstallExecutionTaskFormModal';
import InstallExecutionAdvanceStageModal from '../../../components/InstallExecutionAdvanceStageModal';
import InstallExecutionCostFormModal from '../../../components/InstallExecutionCostFormModal';
import InstallExecutionStageSteps from '../../../components/InstallExecutionStageSteps';
import LineAttachmentsUpload from '../../../components/LineAttachmentsUpload';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { formatDateTime } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

const RESOURCE = 'kuaizhizao:production-execution-install-execution';

const STATUS_COLOR: Record<string, string> = {
  待派工: 'default',
  进行中: 'processing',
  待验收: 'warning',
  已关闭: 'success',
};

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
    Modal.error({
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

  const openDetail = async (row: InstallExecution) => {
    const full = await installExecutionApi.get(row.id);
    setDetailRow(full);
    setDetailOpen(true);
  };

  const handleClose = (row: InstallExecution) => {
    modal.confirm({
      title: '关闭安装执行单',
      content: `确认关闭 ${row.job_code}？`,
      onOk: async () => {
        await installExecutionApi.close(row.id);
        messageApi.success('已关闭');
        reload();
        if (detailRow?.id === row.id) {
          setDetailRow(await installExecutionApi.get(row.id));
        }
      },
    });
  };

  const handleDelete = (row: InstallExecution) => {
    modal.confirm({
      title: '删除安装执行单',
      content: `确认删除 ${row.job_code}？`,
      okType: 'danger',
      onOk: async () => {
        await installExecutionApi.delete(row.id);
        messageApi.success('已删除');
        setDetailOpen(false);
        reload();
      },
    });
  };

  const columns: ProColumns<InstallExecution>[] = useMemo(
    () => [
      {
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        title: '安装执行单',
        dataIndex: 'job_code',
        fixed: 'left',
        render: (_, row) => (
          <UniTableStackedPrimaryCell
            primary={String(row.customer_name ?? '')}
            secondary={String(row.job_code ?? '')}
          />
        ),
      },
      {
        title: '供给来源',
        dataIndex: 'supply_source',
        valueType: 'select',
        valueEnum: Object.fromEntries(
          INSTALL_SUPPLY_SOURCES.map((s) => [s, { text: s }]),
        ),
        hideInSearch: true,
      },
      {
        title: '当前阶段',
        dataIndex: 'current_stage_key',
        hideInSearch: true,
        render: (_, row) => {
          const stage = row.stages?.find((s) => s.stage_key === row.current_stage_key);
          return formatInstallStageLabel(row.current_stage_key, stage?.stage_name);
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: Object.fromEntries(
          INSTALL_JOB_STATUSES.map((s) => [s, { text: s }]),
        ),
        render: (_, row) => <Tag color={STATUS_COLOR[row.status] ?? 'default'}>{row.status}</Tag>,
      },
      {
        title: '销售订单',
        dataIndex: 'sales_order_code',
        hideInSearch: true,
      },
      {
        title: '现场地址',
        dataIndex: 'site_address',
        ellipsis: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<InstallExecution>(t),
      {
        title: t('common.actions'),
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
    [t, perms, messageApi, modal],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<InstallExecution>
          actionRef={actionRef}
          rowKey="id"
          permissionResource={RESOURCE}
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.install-execution"
          headerTitle={t('app.kuaizhizao.menu.production-execution.install-execution')}
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
              size="middle"
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

      <DetailDrawerTemplate
        {...DRAWER_CONFIG}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailRow?.job_code ?? '安装执行详情'}
        extra={
          detailRow && (
            <Space wrap>
              {renderBusinessActions(detailRow, 'detail', { gatePermission: true })}
              {detailRow.capabilities?.update?.allowed !== false && perms.canUpdate && (
                <Button
                  icon={<EditOutlined />}
                  onClick={async () => {
                    const full = await installExecutionApi.get(detailRow.id);
                    setEditing(full);
                    setFormOpen(true);
                  }}
                >
                  编辑
                </Button>
              )}
              {detailRow.status !== '已关闭' &&
                detailRow.capabilities?.close?.allowed !== false &&
                perms.canUpdate && (
                  <Button icon={<CheckOutlined />} onClick={() => handleClose(detailRow)}>
                    关闭
                  </Button>
                )}
              {detailRow.capabilities?.delete?.allowed !== false && perms.canDelete && (
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(detailRow)}>
                  删除
                </Button>
              )}
            </Space>
          )
        }
      >
        {detailRow && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="客户">{detailRow.customer_name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLOR[detailRow.status] ?? 'default'}>{detailRow.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="供给来源">{detailRow.supply_source}</Descriptions.Item>
              <Descriptions.Item label="负责人">{detailRow.owner_name ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="销售订单">{detailRow.sales_order_code ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="销售出库">{detailRow.sales_delivery_code ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="现场地址" span={2}>
                {detailRow.site_address ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="费用合计">
                {formatInstallCostTotal(detailRow.total_cost_amount)}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {detailRow.started_at ? formatDateTime(detailRow.started_at) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {detailRow.notes ?? '-'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <strong>安装阶段</strong>
              <InstallExecutionStageSteps stages={detailRow.stages} style={{ marginTop: 12, marginBottom: 12 }} />
              <UniTable
                rowKey="stage_key"
                search={false}
                options={false}
                pagination={false}
                dataSource={detailRow.stages ?? []}
                columns={[
                  { title: '阶段', dataIndex: 'stage_name' },
                  { title: '状态', dataIndex: 'status' },
                  {
                    title: '计划完成',
                    dataIndex: 'planned_at',
                    render: (v) => (v ? formatDateTime(String(v)) : '-'),
                  },
                  {
                    title: '实际完成',
                    dataIndex: 'actual_at',
                    render: (v) => (v ? formatDateTime(String(v)) : '-'),
                  },
                  { title: '备注', dataIndex: 'notes' },
                ]}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <strong>{t('app.kuaizhizao.installExecution.tasksSection')}</strong>
              <UniTable
                rowKey="id"
                search={false}
                options={false}
                pagination={false}
                dataSource={detailRow.tasks ?? []}
                columns={[
                  { title: t('app.kuaizhizao.installExecution.taskTitle'), dataIndex: 'task_title' },
                  {
                    title: t('app.kuaizhizao.installExecution.taskStage'),
                    dataIndex: 'stage_name',
                    render: (_, r) =>
                      formatInstallStageLabel(r.stage_key, r.stage_name ?? undefined),
                  },
                  { title: t('app.kuaizhizao.installExecution.taskExecutor'), dataIndex: 'executor_name' },
                  { title: t('app.kuaizhizao.installExecution.taskStatus'), dataIndex: 'status' },
                  {
                    title: t('app.kuaizhizao.installExecution.taskPlannedAt'),
                    dataIndex: 'planned_at',
                    render: (v) => (v ? formatDateTime(String(v)) : '-'),
                  },
                  {
                    title: t('app.kuaizhizao.installExecution.taskActualAt'),
                    dataIndex: 'actual_at',
                    render: (v) => (v ? formatDateTime(String(v)) : '-'),
                  },
                  {
                    title: t('app.kuaizhizao.installExecution.taskPhotos'),
                    dataIndex: 'attachments',
                    render: (_, r) => (
                      <LineAttachmentsUpload
                        value={r.attachments}
                        category="install_execution_task_attachments"
                        readOnly
                      />
                    ),
                  },
                  { title: t('app.kuaizhizao.installExecution.taskNotes'), dataIndex: 'notes' },
                ]}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <strong>相关费用</strong>
              <UniTable
                rowKey="id"
                search={false}
                options={false}
                pagination={false}
                dataSource={detailRow.costs ?? []}
                columns={[
                  { title: '类型', dataIndex: 'cost_type' },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    render: (v) => formatInstallCostTotal(v as string | number),
                  },
                  {
                    title: '发生时间',
                    dataIndex: 'occurred_at',
                    render: (v) => formatDateTime(String(v)),
                  },
                  { title: '说明', dataIndex: 'description' },
                ]}
              />
            </div>
          </>
        )}
      </DetailDrawerTemplate>

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

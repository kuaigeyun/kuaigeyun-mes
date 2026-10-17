import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { ProFormSelect, ProFormSwitch, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Popconfirm, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind, rowActionLabelKeep } from '../../../../components/uni-action';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { MarkerTag } from '../../../../constants/statusBadges';
import { formatDateTimeBySiteSetting } from '../../../../utils/format';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDetailDrawerEditExtra } from '../../../kuaizhizao/pages/equipment-management/shared/equipmentMasterDataDetail';
import {
  MasterDataBatchActiveMenuButton,
  useMasterDataBatchSetActive,
} from '../../../master-data/hooks/useMasterDataBatchSetActive';
import { MasterDataDetailDrawer } from '../../../master-data/pages/shared/masterDataDetailDrawer';
import { VISION_LIST_COL, renderVisionEnabledMarker } from '../../utils/visionListPresentation';
import {
  bumpAgentConfig,
  createAgent,
  deleteAgent,
  listAgents,
  rotateAgentToken,
  updateAgent,
  type VisionAgent,
} from '../../services/kuaivision';

const AgentsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaivision:agent');
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const tableRowsRef = useRef<VisionAgent[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VisionAgent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<VisionAgent | null>(null);

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: (uuid, data) => updateAgent(uuid, { is_enabled: data.isActive }),
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: VisionAgent) => {
    setEditing(row);
    setOpen(true);
  };

  const openDetail = (row: VisionAgent) => {
    setDetail(row);
    setDrawerOpen(true);
  };

  const handleSubmit = async (values: {
    code?: string;
    name: string;
    run_mode?: string;
    remark?: string;
    is_enabled?: boolean;
  }) => {
    if (editing) {
      await updateAgent(editing.uuid, {
        name: values.name,
        run_mode: values.run_mode,
        remark: values.remark,
        is_enabled: values.is_enabled,
      });
      messageApi.success(t('common.updateSuccess'));
    } else {
      await createAgent({
        code: String(values.code || '').trim(),
        name: values.name,
        run_mode: values.run_mode || 'local_pipeline',
        remark: values.remark,
        is_enabled: values.is_enabled ?? true,
      });
      messageApi.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  const columns: ProColumns<VisionAgent>[] = alignProColumns(
    [
      {
        title: t('common.code'),
        dataIndex: 'code',
        ...VISION_LIST_COL.code,
        copyable: true,
      },
      {
        title: t('common.name'),
        dataIndex: 'name',
        ...VISION_LIST_COL.name,
      },
      {
        title: t('app.kuaivision.field.online'),
        dataIndex: 'is_online',
        ...VISION_LIST_COL.marker,
        hideInSearch: true,
        render: (_, row) => (
          <MarkerTag color={row.is_online ? 'success' : 'default'}>
            {row.is_online
              ? t('app.kuaivision.status.online')
              : t('app.kuaivision.status.offline')}
          </MarkerTag>
        ),
      },
      {
        title: t('app.kuaivision.field.runMode'),
        dataIndex: 'run_mode',
        ...VISION_LIST_COL.station,
        hideInSearch: true,
        render: (_, row) =>
          t(`app.kuaivision.runMode.${row.run_mode || 'local_pipeline'}`, {
            defaultValue: row.run_mode || 'local_pipeline',
          }),
      },
      {
        title: t('app.kuaivision.field.configVersion'),
        dataIndex: 'config_version',
        ...VISION_LIST_COL.number,
        hideInSearch: true,
      },
      {
        title: t('app.kuaivision.field.deviceToken'),
        dataIndex: 'device_token',
        ...VISION_LIST_COL.token,
        copyable: true,
        hideInSearch: true,
        ellipsis: true,
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_enabled',
        ...VISION_LIST_COL.marker,
        valueType: 'select',
        valueEnum: {
          true: { text: t('common.yes') },
          false: { text: t('common.no') },
        },
        fieldProps: { allowClear: true },
        render: (_, row) => renderVisionEnabledMarker(t, row.is_enabled),
      },
      {
        title: t('app.kuaivision.field.lastHeartbeat'),
        dataIndex: 'last_heartbeat_at',
        ...VISION_LIST_COL.datetime,
        hideInSearch: true,
        render: (_, row) => formatDateTimeBySiteSetting(row.last_heartbeat_at),
      },
      {
        title: t('common.action'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => {
          const nodes: React.ReactNode[] = [];
          if (perms.canRead) {
            nodes.push(
              <Button key="detail" {...rowActionKind('read')} onClick={() => openDetail(row)} />,
            );
          }
          if (perms.canUpdate) {
            nodes.push(
              <Button key="edit" {...rowActionKind('update')} onClick={() => openEdit(row)} />,
              <Button
                key="bump"
                {...rowActionKind('skip')}
                {...rowActionLabelKeep()}
                onClick={async () => {
                  const updated = await bumpAgentConfig(row.uuid);
                  messageApi.success(t('app.kuaivision.message.configBumped'));
                  if (detail?.uuid === row.uuid) setDetail(updated);
                  actionRef.current?.reload();
                }}
              >
                {t('app.kuaivision.action.bumpConfig')}
              </Button>,
              <Button
                key="rotate"
                {...rowActionKind('skip')}
                {...rowActionLabelKeep()}
                onClick={async () => {
                  const updated = await rotateAgentToken(row.uuid);
                  messageApi.success(t('app.kuaivision.message.tokenRotated'));
                  if (detail?.uuid === row.uuid) setDetail(updated);
                  actionRef.current?.reload();
                }}
              >
                {t('app.kuaivision.action.rotateToken')}
              </Button>,
            );
          }
          if (perms.canDelete) {
            nodes.push(
              <Popconfirm
                key="delete"
                title={t('common.confirmDelete')}
                onConfirm={async () => {
                  await deleteAgent(row.uuid);
                  messageApi.success(t('common.deleteSuccess'));
                  actionRef.current?.reload();
                }}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button type="link" size="small" {...rowActionKind('delete')} />
              </Popconfirm>,
            );
          }
          return nodes;
        },
      },
    ],
    GLOBAL_DOC_LIST_FIELD_RANK,
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<VisionAgent>[]>(
    () => [
      { title: t('common.code'), dataIndex: 'code', copyable: true },
      { title: t('common.name'), dataIndex: 'name' },
      {
        title: t('app.kuaivision.field.online'),
        dataIndex: 'is_online',
        render: (_, row) => (
          <MarkerTag color={row.is_online ? 'success' : 'default'}>
            {row.is_online
              ? t('app.kuaivision.status.online')
              : t('app.kuaivision.status.offline')}
          </MarkerTag>
        ),
      },
      {
        title: t('app.kuaivision.field.runMode'),
        dataIndex: 'run_mode',
        render: (_, row) =>
          t(`app.kuaivision.runMode.${row.run_mode || 'local_pipeline'}`, {
            defaultValue: row.run_mode || 'local_pipeline',
          }),
      },
      { title: t('app.kuaivision.field.deviceToken'), dataIndex: 'device_token', copyable: true },
      {
        title: t('common.enabled'),
        dataIndex: 'is_enabled',
        render: (_, row) => renderVisionEnabledMarker(t, row.is_enabled),
      },
      {
        title: t('app.kuaivision.field.lastHeartbeat'),
        dataIndex: 'last_heartbeat_at',
        render: (_, row) => formatDateTimeBySiteSetting(row.last_heartbeat_at),
      },
      { title: t('app.kuaivision.field.configVersion'), dataIndex: 'config_version' },
      { title: t('app.kuaivision.field.agentVersion'), dataIndex: 'agent_version' },
      { title: t('app.kuaivision.field.bufferPending'), dataIndex: 'buffer_pending_count' },
      { title: t('app.kuaivision.field.diskFreeMb'), dataIndex: 'disk_free_mb' },
      { title: t('app.kuaivision.field.lastError'), dataIndex: 'last_error' },
      { title: t('common.remark'), dataIndex: 'remark' },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      {contextHolder}
      <UniTable<VisionAgent>
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        columnPersistenceId="apps.kuaivision.pages.agents.list-v3"
        permissionResource="kuaivision:agent"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaivision.action.createAgent')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete || perms.canUpdate}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((k) => deleteAgent(String(k))));
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        }}
        toolBarActionsAfterDelete={
          perms.canUpdate
            ? [
                <MasterDataBatchActiveMenuButton
                  key="agents-batch-active"
                  menuKey="agents-batch-active"
                  selectedRowKeys={selectedRowKeys}
                  menuItems={batchActiveMenuItems}
                />,
              ]
            : undefined
        }
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        request={async (params) => {
          const res = await listAgents({
            page: params.current,
            page_size: params.pageSize,
            q: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <MasterDataDetailDrawer
        title={t('app.kuaivision.menu.agents')}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDetail(null);
        }}
        detail={detail}
        detailColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail) && perms.canUpdate, () => {
          if (!detail) return;
          setDrawerOpen(false);
          openEdit(detail);
        })}
        afterBasic={
          detail ? (
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
              {t('app.kuaivision.hint.ingestUrl', {
                token: detail.device_token,
              })}
            </Typography.Paragraph>
          ) : null
        }
      />

      <FormModalTemplate
        key={editing?.uuid || 'create'}
        open={open}
        title={
          editing
            ? t('app.kuaivision.modal.editAgent')
            : t('app.kuaivision.modal.createAgent')
        }
        onClose={() => setOpen(false)}
        onFinish={handleSubmit}
        isEdit={Boolean(editing)}
        formRef={formRef as React.RefObject<ProFormInstance>}
        grid
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={
          editing
            ? {
                code: editing.code,
                name: editing.name,
                run_mode: editing.run_mode || 'local_pipeline',
                remark: editing.remark,
                is_enabled: editing.is_enabled,
              }
            : { is_enabled: true, run_mode: 'local_pipeline' }
        }
      >
        <ProFormText
          name="code"
          label={t('common.code')}
          colProps={{ span: 12 }}
          disabled={Boolean(editing)}
          rules={editing ? [] : [{ required: true, message: t('common.required') }]}
        />
        <ProFormText
          name="name"
          label={t('common.name')}
          colProps={{ span: 12 }}
          rules={[{ required: true, message: t('common.required') }]}
        />
        <ProFormSelect
          name="run_mode"
          label={t('app.kuaivision.field.runMode')}
          colProps={{ span: 12 }}
          options={[
            {
              value: 'local_pipeline',
              label: t('app.kuaivision.runMode.local_pipeline'),
            },
            {
              value: 'external_forward',
              label: t('app.kuaivision.runMode.external_forward'),
            },
          ]}
        />
        <ProFormTextArea name="remark" label={t('common.remark')} colProps={{ span: 24 }} />
        <ProFormSwitch name="is_enabled" label={t('common.enabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default AgentsPage;

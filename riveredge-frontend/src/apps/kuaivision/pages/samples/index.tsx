import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { ProFormSwitch, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Popconfirm, Table, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind, rowActionLabelKeep } from '../../../../components/uni-action';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
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
  createSampleSet,
  deleteSampleSet,
  exportSamplePack,
  getSampleSet,
  listSampleSets,
  updateSampleSet,
  type VisionSampleSet,
} from '../../services/kuaivision';

const SamplesPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaivision:sample');
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const tableRowsRef = useRef<VisionSampleSet[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VisionSampleSet | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<VisionSampleSet | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: (uuid, data) => updateSampleSet(uuid, { is_enabled: data.isActive }),
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: VisionSampleSet) => {
    setEditing(row);
    setOpen(true);
  };

  const openDetail = async (row: VisionSampleSet) => {
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await getSampleSet(row.uuid));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editing) {
      await updateSampleSet(editing.uuid, values);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await createSampleSet(values);
      messageApi.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  const columns: ProColumns<VisionSampleSet>[] = alignProColumns(
    [
      { title: t('common.code'), dataIndex: 'code', ...VISION_LIST_COL.code, copyable: true },
      { title: t('common.name'), dataIndex: 'name', ...VISION_LIST_COL.name },
      {
        title: t('app.kuaivision.field.recipe'),
        dataIndex: 'recipe_code',
        ...VISION_LIST_COL.recipe,
      },
      {
        title: t('app.kuaivision.field.itemCount'),
        dataIndex: 'item_count',
        ...VISION_LIST_COL.number,
        search: false,
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_enabled',
        ...VISION_LIST_COL.marker,
        render: (_, row) => renderVisionEnabledMarker(t, row.is_enabled),
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
              <Button key="detail" {...rowActionKind('read')} onClick={() => void openDetail(row)} />,
            );
          }
          if (perms.canUpdate) {
            nodes.push(<Button key="edit" {...rowActionKind('update')} onClick={() => openEdit(row)} />);
          }
          if (perms.canAction?.('export')) {
            nodes.push(
              <Button
                key="export"
                {...rowActionKind('skip')}
                {...rowActionLabelKeep()}
                onClick={async () => {
                  const pack = await exportSamplePack(row.uuid);
                  const blob = new Blob([JSON.stringify(pack, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${row.code}-pack.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  messageApi.success(t('app.kuaivision.message.sampleExported'));
                }}
              >
                {t('app.kuaivision.action.exportPack')}
              </Button>,
            );
          }
          if (perms.canDelete) {
            nodes.push(
              <Popconfirm
                key="delete"
                title={t('common.confirmDelete')}
                onConfirm={async () => {
                  await deleteSampleSet(row.uuid);
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

  const detailColumns = useMemo<ProDescriptionsItemProps<VisionSampleSet>[]>(
    () => [
      { title: t('common.code'), dataIndex: 'code', copyable: true },
      { title: t('common.name'), dataIndex: 'name' },
      { title: t('app.kuaivision.field.recipe'), dataIndex: 'recipe_code' },
      { title: t('app.kuaivision.field.itemCount'), dataIndex: 'item_count' },
      {
        title: t('common.enabled'),
        dataIndex: 'is_enabled',
        render: (_, row) => renderVisionEnabledMarker(t, row.is_enabled),
      },
      { title: t('common.remark'), dataIndex: 'remark' },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      {contextHolder}
      <UniTable<VisionSampleSet>
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        columnPersistenceId="apps.kuaivision.pages.samples.list-v2"
        permissionResource="kuaivision:sample"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaivision.action.createSampleSet')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete || perms.canUpdate}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((k) => deleteSampleSet(String(k))));
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        }}
        toolBarActionsAfterDelete={
          perms.canUpdate
            ? [
                <MasterDataBatchActiveMenuButton
                  key="samples-batch-active"
                  menuKey="samples-batch-active"
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
          const res = await listSampleSets({
            page: params.current,
            page_size: params.pageSize,
            q: params.keyword as string | undefined,
            recipe_code: params.recipe_code as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <MasterDataDetailDrawer
        title={t('app.kuaivision.menu.samples')}
        open={drawerOpen}
        loading={detailLoading}
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
        linesTitle={t('app.kuaivision.section.sampleItems')}
        lines={
          detail?.items?.length ? (
            <Table
              size="small"
              pagination={false}
              rowKey="uuid"
              dataSource={detail.items}
              columns={[
                { title: t('app.kuaivision.field.sampleLabel'), dataIndex: 'label' },
                {
                  title: t('app.kuaivision.field.objectKey'),
                  dataIndex: 'object_key',
                  ellipsis: true,
                },
                {
                  title: t('app.kuaivision.field.eventId'),
                  dataIndex: 'source_event_uuid',
                  ellipsis: true,
                },
              ]}
            />
          ) : null
        }
      />

      <FormModalTemplate
        key={editing?.uuid || 'create'}
        open={open}
        title={
          editing
            ? t('app.kuaivision.modal.editSampleSet')
            : t('app.kuaivision.modal.createSampleSet')
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
                recipe_code: editing.recipe_code,
                is_enabled: editing.is_enabled,
                remark: editing.remark,
              }
            : { is_enabled: true }
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
        <ProFormText
          name="recipe_code"
          label={t('app.kuaivision.field.recipe')}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea name="remark" label={t('common.remark')} colProps={{ span: 24 }} />
        <ProFormSwitch name="is_enabled" label={t('common.enabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default SamplesPage;

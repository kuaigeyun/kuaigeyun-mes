import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import { ProFormSelect, ProFormSwitch, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Popconfirm, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../components/uni-action';
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
  createCamera,
  deleteCamera,
  listCameras,
  updateCamera,
  type VisionCamera,
} from '../../services/kuaivision';

const SDK_OPTIONS = [
  { value: 'external_only', labelKey: 'app.kuaivision.sdk.external_only' },
  { value: 'hik_mvs', labelKey: 'app.kuaivision.sdk.hik_mvs' },
  { value: 'basler_pylon', labelKey: 'app.kuaivision.sdk.basler_pylon' },
  { value: 'genicam', labelKey: 'app.kuaivision.sdk.genicam' },
];

const CamerasPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaivision:camera');
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const tableRowsRef = useRef<VisionCamera[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VisionCamera | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<VisionCamera | null>(null);

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: (uuid, data) => updateCamera(uuid, { is_enabled: data.isActive }),
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  const sdkOptions = useMemo(
    () => SDK_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t],
  );

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: VisionCamera) => {
    setEditing(row);
    setOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (editing) {
      await updateCamera(editing.uuid, values);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await createCamera(values);
      messageApi.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  const handleDelete = async (row: VisionCamera) => {
    await deleteCamera(row.uuid);
    messageApi.success(t('common.deleteSuccess'));
    actionRef.current?.reload();
  };

  const columns: ProColumns<VisionCamera>[] = alignProColumns(
    [
      { title: t('common.code'), dataIndex: 'code', ...VISION_LIST_COL.code, copyable: true },
      { title: t('common.name'), dataIndex: 'name', ...VISION_LIST_COL.name },
      {
        title: t('app.kuaivision.field.sdkType'),
        dataIndex: 'sdk_type',
        ...VISION_LIST_COL.recipe,
        render: (_, row) => t(`app.kuaivision.sdk.${row.sdk_type}`, { defaultValue: row.sdk_type }),
      },
      {
        title: t('app.kuaivision.field.station'),
        dataIndex: 'station_code',
        ...VISION_LIST_COL.station,
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
              <Button
                key="detail"
                {...rowActionKind('read')}
                onClick={() => {
                  setDetail(row);
                  setDrawerOpen(true);
                }}
              />,
            );
          }
          if (perms.canUpdate) {
            nodes.push(<Button key="edit" {...rowActionKind('update')} onClick={() => openEdit(row)} />);
          }
          if (perms.canDelete) {
            nodes.push(
              <Popconfirm
                key="delete"
                title={t('common.confirmDelete')}
                onConfirm={() => handleDelete(row)}
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

  const detailColumns = useMemo<ProDescriptionsItemProps<VisionCamera>[]>(
    () => [
      { title: t('common.code'), dataIndex: 'code', copyable: true },
      { title: t('common.name'), dataIndex: 'name' },
      {
        title: t('app.kuaivision.field.sdkType'),
        dataIndex: 'sdk_type',
        render: (_, row) => t(`app.kuaivision.sdk.${row.sdk_type}`, { defaultValue: row.sdk_type }),
      },
      { title: t('app.kuaivision.field.serialNo'), dataIndex: 'serial_no' },
      { title: t('app.kuaivision.field.station'), dataIndex: 'station_code' },
      { title: t('app.kuaivision.field.plant'), dataIndex: 'plant_code' },
      { title: t('app.kuaivision.field.workshop'), dataIndex: 'workshop_code' },
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
      <UniTable<VisionCamera>
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        columnPersistenceId="apps.kuaivision.pages.cameras.list-v2"
        permissionResource="kuaivision:camera"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaivision.action.createCamera')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete || perms.canUpdate}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((k) => deleteCamera(String(k))));
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        }}
        toolBarActionsAfterDelete={
          perms.canUpdate
            ? [
                <MasterDataBatchActiveMenuButton
                  key="cameras-batch-active"
                  menuKey="cameras-batch-active"
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
          const res = await listCameras({
            page: params.current,
            page_size: params.pageSize,
            q: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <MasterDataDetailDrawer
        title={t('app.kuaivision.menu.cameras')}
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
      />

      <FormModalTemplate
        key={editing?.uuid || 'create'}
        open={open}
        title={
          editing ? t('app.kuaivision.modal.editCamera') : t('app.kuaivision.modal.createCamera')
        }
        onClose={() => setOpen(false)}
        onFinish={handleSubmit}
        isEdit={Boolean(editing)}
        formRef={formRef as React.RefObject<ProFormInstance>}
        grid
        width={MODAL_CONFIG.STANDARD_WIDTH}
        initialValues={
          editing
            ? { ...editing }
            : { sdk_type: 'external_only', is_enabled: true }
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
          name="sdk_type"
          label={t('app.kuaivision.field.sdkType')}
          colProps={{ span: 12 }}
          options={sdkOptions}
          rules={[{ required: true, message: t('common.required') }]}
        />
        <ProFormText name="serial_no" label={t('app.kuaivision.field.serialNo')} colProps={{ span: 12 }} />
        <ProFormText name="station_code" label={t('app.kuaivision.field.station')} colProps={{ span: 12 }} />
        <ProFormText name="plant_code" label={t('app.kuaivision.field.plant')} colProps={{ span: 12 }} />
        <ProFormText name="workshop_code" label={t('app.kuaivision.field.workshop')} colProps={{ span: 12 }} />
        <ProFormTextArea name="remark" label={t('common.remark')} colProps={{ span: 24 }} />
        <ProFormSwitch name="is_enabled" label={t('common.enabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default CamerasPage;

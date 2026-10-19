import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';
import {
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import { Button, Popconfirm, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../components/uni-action';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { uploadFile } from '../../../../services/file';
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
  createModel,
  deleteModel,
  listModels,
  updateModel,
  type VisionModelArtifact,
} from '../../services/kuaivision';

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const ModelsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions('kuaivision:model');
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const tableRowsRef = useRef<VisionModelArtifact[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VisionModelArtifact | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<VisionModelArtifact | null>(null);

  const { batchActiveMenuItems } = useMasterDataBatchSetActive({
    update: (uuid, data) => updateModel(uuid, { is_enabled: data.isActive }),
    messageApi,
    actionRef,
    selectedRowKeys,
    setSelectedRowKeys,
  });

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row: VisionModelArtifact) => {
    setEditing(row);
    setOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      code: values.code,
      name: values.name,
      framework: values.framework || 'onnx',
      object_key: values.object_key,
      checksum: values.checksum,
      input_width: values.input_width,
      input_height: values.input_height,
      is_enabled: values.is_enabled,
      remark: values.remark,
    };
    if (editing) {
      await updateModel(editing.uuid, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await createModel(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setOpen(false);
    actionRef.current?.reload();
  };

  const columns: ProColumns<VisionModelArtifact>[] = alignProColumns(
    [
      { title: t('common.code'), dataIndex: 'code', ...VISION_LIST_COL.code, copyable: true },
      { title: t('common.name'), dataIndex: 'name', ...VISION_LIST_COL.name },
      {
        title: t('app.kuaivision.field.framework'),
        dataIndex: 'framework',
        ...VISION_LIST_COL.station,
        search: false,
      },
      {
        title: t('app.kuaivision.field.checksum'),
        dataIndex: 'checksum',
        ...VISION_LIST_COL.token,
        search: false,
        ellipsis: true,
        copyable: true,
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
                onConfirm={async () => {
                  await deleteModel(row.uuid);
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

  const detailColumns = useMemo<ProDescriptionsItemProps<VisionModelArtifact>[]>(
    () => [
      { title: t('common.code'), dataIndex: 'code', copyable: true },
      { title: t('common.name'), dataIndex: 'name' },
      { title: t('app.kuaivision.field.framework'), dataIndex: 'framework' },
      { title: t('app.kuaivision.field.objectKey'), dataIndex: 'object_key', copyable: true },
      { title: t('app.kuaivision.field.checksum'), dataIndex: 'checksum', copyable: true },
      { title: t('app.kuaivision.field.inputWidth'), dataIndex: 'input_width' },
      { title: t('app.kuaivision.field.inputHeight'), dataIndex: 'input_height' },
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
      <UniTable<VisionModelArtifact>
        actionRef={actionRef}
        columns={columns}
        rowKey="uuid"
        columnPersistenceId="apps.kuaivision.pages.models.list-v2"
        permissionResource="kuaivision:model"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaivision.action.createModel')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete || perms.canUpdate}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((k) => deleteModel(String(k))));
          messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        }}
        toolBarActionsAfterDelete={
          perms.canUpdate
            ? [
                <MasterDataBatchActiveMenuButton
                  key="models-batch-active"
                  menuKey="models-batch-active"
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
          const res = await listModels({
            page: params.current,
            page_size: params.pageSize,
            q: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <MasterDataDetailDrawer
        title={t('app.kuaivision.menu.models')}
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
          editing ? t('app.kuaivision.modal.editModel') : t('app.kuaivision.modal.createModel')
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
                framework: editing.framework,
                object_key: editing.object_key,
                checksum: editing.checksum,
                input_width: editing.input_width,
                input_height: editing.input_height,
                is_enabled: editing.is_enabled,
                remark: editing.remark,
              }
            : { framework: 'onnx', is_enabled: true }
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
        <ProFormText name="framework" label={t('app.kuaivision.field.framework')} colProps={{ span: 12 }} />
        <ProFormUploadButton
          name="upload"
          label={t('app.kuaivision.field.modelFile')}
          colProps={{ span: 12 }}
          max={1}
          fieldProps={{
            customRequest: async (options) => {
              try {
                const file = options.file as File;
                const checksum = await sha256Hex(file);
                const uploaded = await uploadFile(file, { category: 'kuaivision-model' });
                const objectKey = String(
                  (uploaded as { uuid?: string; file_path?: string }).uuid ||
                    (uploaded as { file_path?: string }).file_path ||
                    '',
                );
                formRef.current?.setFieldsValue({ object_key: objectKey, checksum });
                options.onSuccess?.(uploaded);
                message.success(t('app.kuaivision.message.modelUploaded'));
              } catch (err) {
                options.onError?.(err as Error);
              }
            },
            showUploadList: false,
          }}
        />
        <ProFormText
          name="object_key"
          label={t('app.kuaivision.field.objectKey')}
          colProps={{ span: 12 }}
          rules={[{ required: true, message: t('common.required') }]}
        />
        <ProFormText
          name="checksum"
          label={t('app.kuaivision.field.checksum')}
          colProps={{ span: 12 }}
          rules={[{ required: true, message: t('common.required') }]}
        />
        <ProFormDigit name="input_width" label={t('app.kuaivision.field.inputWidth')} colProps={{ span: 12 }} />
        <ProFormDigit name="input_height" label={t('app.kuaivision.field.inputHeight')} colProps={{ span: 12 }} />
        <ProFormTextArea name="remark" label={t('common.remark')} colProps={{ span: 24 }} />
        <ProFormSwitch name="is_enabled" label={t('common.enabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ModelsPage;

/**
 * 轻办公通用 CRUD 列表页
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Form, Input, Modal, Select, Switch } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate } from '../../../components/layout-templates';
import { useResourcePermissions } from '../../../hooks/useResourcePermissions';
import {
  alignProColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  renderOaActiveTag,
  renderOaApprovalStatusTag,
  renderOaStatusMarker,
  renderOaTypeMarker,
  renderOaYesNoTag,
} from '../utils/oaListPresentation';

export type KuaioaFieldConfig = {
  name: string;
  labelKey: string;
  type?: 'text' | 'textarea' | 'select' | 'switch' | 'number';
  options?: Array<{ label: string; value: string | number | boolean }>;
  required?: boolean;
  hideInTable?: boolean;
  width?: number;
};

export type KuaioaActionConfig = {
  key: string;
  labelKey: string;
  onClick: (record: Record<string, unknown>) => Promise<void> | void;
  visible?: (record: Record<string, unknown>) => boolean;
};

/** lifecycle：审批流程态右固定 StatusTag；marker：台账/启用类 MarkerTag */
export type KuaioaStatusPresentation = 'lifecycle' | 'marker';

type Props = {
  createButtonKey: string;
  resource: string;
  columnPersistenceId?: string;
  rowKey?: string;
  codeField?: string;
  nameField?: string;
  fields: KuaioaFieldConfig[];
  listFn: (params?: Record<string, unknown>) => Promise<{ items: Record<string, unknown>[]; total: number }>;
  createFn?: (data: Record<string, unknown>) => Promise<unknown>;
  updateFn?: (id: number, data: Record<string, unknown>) => Promise<unknown>;
  deleteFn?: (id: number) => Promise<void>;
  extraActions?: KuaioaActionConfig[];
  statusEnum?: Record<string, { text: string; status?: string }>;
  statusPresentation?: KuaioaStatusPresentation;
  autoGenerateCode?: boolean;
};

const TYPE_MARKER_FIELDS = new Set([
  'category',
  'plan_type',
  'license_type',
  'asset_category',
]);

const KuaioaCrudListPage: React.FC<Props> = ({
  createButtonKey,
  resource,
  columnPersistenceId,
  rowKey = 'id',
  codeField = 'code',
  nameField = 'name',
  fields,
  listFn,
  createFn,
  updateFn,
  deleteFn,
  extraActions = [],
  statusEnum,
  statusPresentation = 'marker',
  autoGenerateCode = false,
}) => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<ActionType>();
  const perms = useResourcePermissions(resource);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();

  const persistenceId =
    columnPersistenceId ?? `apps.kuaioa.${resource.replace(':', '.')}.list-v1`;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Record<string, unknown>) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing?.id) {
        await updateFn?.(Number(editing.id), values);
        messageApi.success(t('app.kuaioa.common.updateSuccess'));
      } else {
        await createFn?.(values);
        messageApi.success(t('app.kuaioa.common.createSuccess'));
      }
      setModalOpen(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaioa.common.operationFailed'));
    }
  };

  const handleDelete = useCallback(
    (record: Record<string, unknown>) => {
      modal.confirm({
        title: t('app.kuaioa.common.confirmDelete'),
        onOk: async () => {
          try {
            await deleteFn?.(Number(record.id));
            messageApi.success(t('app.kuaioa.common.deleteSuccess'));
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error?.message || t('app.kuaioa.common.operationFailed'));
          }
        },
      });
    },
    [deleteFn, messageApi, modal, t],
  );

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      try {
        for (const key of keys) {
          await deleteFn?.(Number(key));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        setSelectedRowKeys([]);
        actionRef.current?.reload();
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaioa.common.operationFailed'));
      }
    },
    [deleteFn, messageApi, t],
  );

  const columns = useMemo<ProColumns<Record<string, unknown>>[]>(() => {
    const keepWidthProps = (width?: number) =>
      width
        ? {
            width,
            minWidth: width,
            uniTableKeepWidth: true as const,
            resizable: false as const,
          }
        : {};

    const statusField = fields.find((f) => !f.hideInTable && f.name === 'status');
    const businessFields = fields.filter((f) => !f.hideInTable && f.name !== 'status');

    const base: ProColumns<Record<string, unknown>>[] = businessFields.map((field) => {
      const col: ProColumns<Record<string, unknown>> = {
        title: t(field.labelKey),
        dataIndex: field.name,
        ...keepWidthProps(field.width),
        ellipsis: !field.width || field.name === nameField || field.name === 'title',
      };

      if (field.type === 'switch') {
        col.hideInSearch = true;
        col.render = (_, row) =>
          field.name === 'is_active'
            ? renderOaActiveTag(t, Boolean(row[field.name]))
            : renderOaYesNoTag(t, Boolean(row[field.name]));
        return col;
      }

      if (TYPE_MARKER_FIELDS.has(field.name)) {
        col.hideInSearch = true;
        col.render = (_, row) => {
          const raw = row[field.name];
          const text = raw == null || raw === '' ? '' : String(raw);
          if (!text) return '-';
          const fromOptions = field.options?.find((o) => String(o.value) === text)?.label;
          const label =
            fromOptions ||
            t(`${field.labelKey}.${text}`, { defaultValue: text });
          return renderOaTypeMarker(label);
        };
        return col;
      }

      if (field.name === codeField) {
        col.hideInSearch = true;
      }

      return col;
    });

    if (statusField) {
      const statusCol: ProColumns<Record<string, unknown>> = {
        title: t(statusField.labelKey),
        dataIndex: 'status',
        valueType: statusEnum ? 'select' : undefined,
        valueEnum: statusEnum,
        ...keepWidthProps(statusField.width ?? 100),
        render: (_, row) => {
          const value = row.status == null ? null : String(row.status);
          if (statusPresentation === 'lifecycle') {
            return renderOaApprovalStatusTag(statusEnum, value);
          }
          return renderOaStatusMarker(statusEnum, value);
        },
      };
      if (statusPresentation === 'lifecycle') {
        statusCol.key = 'lifecycle';
        statusCol.fixed = 'right';
      }
      base.push(statusCol);
    }

    base.push({
      title: t('app.kuaioa.common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const actions = [];
        if (perms.canUpdate) {
          actions.push(
            <Button key="edit" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              {t('app.kuaioa.common.edit')}
            </Button>,
          );
        }
        extraActions.forEach((action) => {
          if (action.visible && !action.visible(record)) return;
          actions.push(
            <Button
              key={action.key}
              type="link"
              onClick={async () => {
                try {
                  await action.onClick(record);
                  messageApi.success(t('app.kuaioa.common.operationSuccess'));
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error?.message || t('app.kuaioa.common.operationFailed'));
                }
              }}
            >
              {t(action.labelKey)}
            </Button>,
          );
        });
        if (perms.canDelete && deleteFn) {
          actions.push(
            <Button key="delete" type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
              {t('app.kuaioa.common.delete')}
            </Button>,
          );
        }
        return actions;
      },
    });

    return alignProColumns(base, GLOBAL_DOC_LIST_FIELD_RANK);
  }, [
    codeField,
    deleteFn,
    extraActions,
    fields,
    handleDelete,
    messageApi,
    nameField,
    perms.canDelete,
    perms.canUpdate,
    statusEnum,
    statusPresentation,
    t,
  ]);

  if (!perms.canRead) {
    return <ListPageTemplate>{t('app.kuaioa.common.noPermission')}</ListPageTemplate>;
  }

  return (
    <ListPageTemplate>
      <UniTable<Record<string, unknown>>
        actionRef={actionRef}
        rowKey={rowKey}
        columnPersistenceId={persistenceId}
        columns={columns}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        permissionResource={resource}
        request={async (params) => {
          const res = await listFn({
            keyword: params.keyword as string | undefined,
            status: params.status as string | undefined,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        search={{ labelWidth: 'auto' }}
        showCreateButton={!!createFn}
        createButtonText={t(createButtonKey)}
        onCreate={openCreate}
        showDeleteButton={!!deleteFn}
        onDelete={handleBatchDelete}
        deleteButtonText={t('common.batchDelete')}
        deleteConfirmTitle={t('common.confirmBatchDelete')}
        deleteConfirmDescription={(count) => t('common.confirmBatchDeleteContent', { count })}
      />

      <Modal
        open={modalOpen}
        title={editing ? t('app.kuaioa.common.edit') : t(createButtonKey)}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {fields.map((field) => {
            const label = t(field.labelKey);
            const rules = field.required ? [{ required: true, message: t('app.kuaioa.common.required') }] : [];
            if (field.type === 'textarea') {
              return (
                <Form.Item key={field.name} name={field.name} label={label} rules={rules}>
                  <Input.TextArea rows={3} />
                </Form.Item>
              );
            }
            if (field.type === 'select') {
              return (
                <Form.Item key={field.name} name={field.name} label={label} rules={rules}>
                  <Select options={field.options} allowClear />
                </Form.Item>
              );
            }
            if (field.type === 'switch') {
              return (
                <Form.Item key={field.name} name={field.name} label={label} valuePropName="checked">
                  <Switch />
                </Form.Item>
              );
            }
            if (field.name === codeField && autoGenerateCode && !editing) {
              return null;
            }
            return (
              <Form.Item key={field.name} name={field.name} label={label} rules={rules}>
                <Input />
              </Form.Item>
            );
          })}
        </Form>
      </Modal>
    </ListPageTemplate>
  );
};

export default KuaioaCrudListPage;

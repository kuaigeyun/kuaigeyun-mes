import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Space, Switch, Tag, message } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { industryRelayApi, type RelayChangeover } from '../../services/industryRelayApi';

export default function RelayChangeoverPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>(null);
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RelayChangeover | null>(null);
  const perms = useResourcePermissions('ind-relay:changeover');

  const openCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ forbid_same_line: false, changeover_minutes: 0 });
    setOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (row: RelayChangeover) => {
      setEditing(row);
      form.setFieldsValue({
        from_family: row.from_family,
        to_family: row.to_family,
        changeover_minutes: row.changeover_minutes,
        forbid_same_line: row.forbid_same_line,
        remarks: row.remarks,
      });
      setOpen(true);
    },
    [form]
  );

  const columns: ProColumns<RelayChangeover>[] = useMemo(
    () => [
      { title: t('app.ind-relay.changeover.fromFamily'), dataIndex: 'from_family', width: 140 },
      { title: t('app.ind-relay.changeover.toFamily'), dataIndex: 'to_family', width: 140 },
      { title: t('app.ind-relay.changeover.minutes'), dataIndex: 'changeover_minutes', width: 120 },
      {
        title: t('app.ind-relay.changeover.forbidSameLine'),
        dataIndex: 'forbid_same_line',
        width: 120,
        render: (_, row) => (
          <Tag variant="filled">
            {row.forbid_same_line ? t('common.yes') : t('common.no')}
          </Tag>
        ),
      },
      { title: t('common.remarks'), dataIndex: 'remarks', ellipsis: true },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 160,
        render: (_, row) =>
          perms.canUpdate ? (
            <Space size={0}>
              <Button type="link" size="small" onClick={() => openEdit(row)}>
                {t('common.edit')}
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={async () => {
                  await industryRelayApi.deleteChangeover(row.id);
                  message.success(t('app.ind-relay.changeover.deleteSuccess'));
                  actionRef.current?.reload();
                }}
              >
                {t('common.disable')}
              </Button>
            </Space>
          ) : null,
      },
    ],
    [openEdit, perms.canUpdate, t]
  );

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    if (editing) {
      await industryRelayApi.updateChangeover(editing.id, {
        changeover_minutes: values.changeover_minutes,
        forbid_same_line: values.forbid_same_line,
        remarks: values.remarks,
      });
      message.success(t('common.updateSuccess'));
    } else {
      await industryRelayApi.createChangeover(values);
      message.success(t('app.ind-relay.changeover.createSuccess'));
    }
    setOpen(false);
    setEditing(null);
    form.resetFields();
    actionRef.current?.reload();
  }, [editing, form, t]);

  return (
    <ListPageTemplate>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title={t('app.ind-relay.changeover.engineHint')}
      />
      <UniTable<RelayChangeover>
        actionRef={actionRef}
        rowKey="id"
        headerTitle={t('app.ind-relay.menu.changeover')}
        columnPersistenceId="apps.ind-relay.pages.changeover-v1"
        permissionResource="ind-relay:changeover"
        createButtonText={t('app.ind-relay.changeover.createButton')}
        showCreateButton
        onCreate={openCreate}
        columns={columns}
        request={async () => {
          const items = await industryRelayApi.listChangeovers();
          return { data: items, success: true, total: items.length };
        }}
      />
      <Modal
        open={open}
        title={
          editing
            ? t('app.ind-relay.changeover.editTitle')
            : t('app.ind-relay.changeover.createTitle')
        }
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={() => void handleSubmit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ forbid_same_line: false, changeover_minutes: 0 }}>
          <Form.Item name="from_family" label={t('app.ind-relay.changeover.fromFamily')} rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="to_family" label={t('app.ind-relay.changeover.toFamily')} rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="changeover_minutes" label={t('app.ind-relay.changeover.minutes')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="forbid_same_line" label={t('app.ind-relay.changeover.forbidSameLine')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="remarks" label={t('common.remarks')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </ListPageTemplate>
  );
}

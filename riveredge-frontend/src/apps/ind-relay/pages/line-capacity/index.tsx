import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, message } from 'antd';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { factoryListItems, productionLineApi } from '../../../master-data/services/factory';
import { industryRelayApi, type RelayLineCapacity } from '../../services/industryRelayApi';

export default function RelayLineCapacityPage() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>(null);
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RelayLineCapacity | null>(null);
  const [lineOptions, setLineOptions] = useState<Array<{ label: string; value: number }>>([]);
  const perms = useResourcePermissions('ind-relay:line-capacity');

  useEffect(() => {
    void (async () => {
      const res = await productionLineApi.list({ is_active: true, limit: 1000 });
      const items = factoryListItems(res);
      setLineOptions(
        items
          .map((row: { id?: number; name?: string; code?: string }) => ({
            value: Number(row.id),
            label: String(row.name || row.code || row.id),
          }))
          .filter((o) => Number.isInteger(o.value) && o.value > 0)
      );
    })();
  }, []);

  const openCreate = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      takt_seconds: 0,
      daily_capacity_qty: 0,
      changeover_minutes_default: 0,
      is_active: true,
    });
    setOpen(true);
  }, [form]);

  const openEdit = useCallback(
    (row: RelayLineCapacity) => {
      setEditing(row);
      form.setFieldsValue({
        production_line_id: row.production_line_id,
        takt_seconds: row.takt_seconds,
        daily_capacity_qty: row.daily_capacity_qty,
        changeover_minutes_default: row.changeover_minutes_default,
        is_active: row.is_active,
        remarks: row.remarks,
      });
      setOpen(true);
    },
    [form]
  );

  const columns: ProColumns<RelayLineCapacity>[] = useMemo(
    () => [
      {
        title: t('app.ind-relay.lineCapacity.line'),
        dataIndex: 'production_line_name',
        ellipsis: true,
        render: (_, row) => row.production_line_name || row.production_line_code || row.production_line_id,
      },
      { title: t('app.ind-relay.lineCapacity.taktSeconds'), dataIndex: 'takt_seconds', width: 120 },
      { title: t('app.ind-relay.lineCapacity.dailyCapacity'), dataIndex: 'daily_capacity_qty', width: 120 },
      {
        title: t('app.ind-relay.lineCapacity.changeoverMinutes'),
        dataIndex: 'changeover_minutes_default',
        width: 140,
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        width: 90,
        render: (_, row) => (row.is_active ? t('common.enable') : t('common.disabled')),
      },
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
                onClick={async () => {
                  await industryRelayApi.updateLineCapacity(row.id, { is_active: !row.is_active });
                  message.success(t('common.updateSuccess'));
                  actionRef.current?.reload();
                }}
              >
                {row.is_active ? t('common.disable') : t('common.enable')}
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
      await industryRelayApi.updateLineCapacity(editing.id, {
        takt_seconds: values.takt_seconds,
        daily_capacity_qty: values.daily_capacity_qty,
        changeover_minutes_default: values.changeover_minutes_default,
        is_active: values.is_active,
        remarks: values.remarks,
      });
      message.success(t('common.updateSuccess'));
    } else {
      await industryRelayApi.createLineCapacity(values);
      message.success(t('app.ind-relay.lineCapacity.createSuccess'));
    }
    setOpen(false);
    setEditing(null);
    form.resetFields();
    actionRef.current?.reload();
  }, [editing, form, t]);

  return (
    <ListPageTemplate>
      <UniTable<RelayLineCapacity>
        actionRef={actionRef}
        rowKey="id"
        createButtonText={t('app.ind-relay.lineCapacity.createButton')}
        onCreateClick={perms.canCreate ? openCreate : undefined}
        columns={columns}
        request={async () => {
          const items = await industryRelayApi.listLineCapacities();
          return { data: items, success: true, total: items.length };
        }}
      />
      <Modal
        open={open}
        title={
          editing
            ? t('app.ind-relay.lineCapacity.editTitle')
            : t('app.ind-relay.lineCapacity.createTitle')
        }
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={() => void handleSubmit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="production_line_id"
            label={t('app.ind-relay.lineCapacity.line')}
            rules={[{ required: true }]}
          >
            <Select options={lineOptions} showSearch optionFilterProp="label" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="takt_seconds" label={t('app.ind-relay.lineCapacity.taktSeconds')} initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="daily_capacity_qty" label={t('app.ind-relay.lineCapacity.dailyCapacity')} initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="changeover_minutes_default"
            label={t('app.ind-relay.lineCapacity.changeoverMinutes')}
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          {editing ? (
            <Form.Item name="is_active" label={t('common.status')} valuePropName="checked">
              <Switch checkedChildren={t('common.enable')} unCheckedChildren={t('common.disable')} />
            </Form.Item>
          ) : null}
          <Form.Item name="remarks" label={t('common.remarks')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </ListPageTemplate>
  );
}

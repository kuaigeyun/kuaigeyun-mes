import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Form, Input, InputNumber, Modal, Select, message } from 'antd';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formDateFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import {
  customerReturnVisitApi,
  type CustomerReturnVisit,
  type CustomerReturnVisitPayload,
} from '../../../services/after-sales-service';

const RESOURCE = 'kuaizhizao:customer-return-visit';

const VISIT_METHODS = ['电话', '现场', '在线'];

const ReturnVisitsPage: React.FC = () => {
  const { t } = useTranslation();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerReturnVisit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CustomerReturnVisit | null>(null);
  const [form] = Form.useForm<CustomerReturnVisitPayload & { visited_at_picker?: dayjs.Dayjs }>();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ visit_method: '电话', visited_at_picker: dayjs() });
    setModalOpen(true);
  };

  const openEdit = async (row: CustomerReturnVisit) => {
    const full = await customerReturnVisitApi.get(row.id);
    setEditing(full);
    form.setFieldsValue({
      ...full,
      visited_at_picker: full.visited_at ? dayjs(full.visited_at) : undefined,
    });
    setModalOpen(true);
  };

  const columns: ProColumns<CustomerReturnVisit>[] = [
    { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitCode'), dataIndex: 'visit_code' },
    { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.customerName'), dataIndex: 'customer_name' },
    { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.sourceCode'), dataIndex: 'source_code' },
    { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitMethod'), dataIndex: 'visit_method' },
    {
      title: t('app.kuaizhizao.afterSalesService.returnVisit.field.satisfactionScore'),
      dataIndex: 'satisfaction_score',
      align: 'center',
    },
    {
      title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitedAt'),
      dataIndex: 'visited_at',
      render: (_, row) => (row.visited_at ? formatDateTime(row.visited_at) : '-'),
    },
    {
      title: t('common.action'),
      valueType: 'option',
      width: 160,
      render: (_, row) => [
        <Button
          {...rowActionKind('read')}
          key="read"
          onClick={async () => {
            setDetail(await customerReturnVisitApi.get(row.id));
            setDetailOpen(true);
          }}
        />,
        perms.canUpdate ? (
          <Button {...rowActionKind('update')} key="edit" onClick={() => void openEdit(row)} />
        ) : null,
      ],
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<CustomerReturnVisit>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        headerTitle={t('app.kuaizhizao.menu.after-sales-service.return-visits')}
        request={async (params) => {
          const res = await customerReturnVisitApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize,
            keyword: params.keyword as string | undefined,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaizhizao.afterSalesService.returnVisit.createTitle')}
        onCreate={openCreate}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          await Promise.all(keys.map((key) => customerReturnVisitApi.delete(Number(key))));
          message.success(t('common.batchDeleteSuccess', { count: keys.length }));
          actionRef.current?.reload();
        }}
      />

      <Modal
        open={modalOpen}
        title={
          editing
            ? t('app.kuaizhizao.afterSalesService.returnVisit.editTitle')
            : t('app.kuaizhizao.afterSalesService.returnVisit.createTitle')
        }
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          const { visited_at_picker, ...rest } = values;
          const payload: CustomerReturnVisitPayload = {
            ...rest,
            visited_at: visited_at_picker?.format('YYYY-MM-DD HH:mm:ss') ?? '',
          };
          if (editing) {
            await customerReturnVisitApi.update(editing.id, payload);
            message.success(t('common.saveSuccess'));
          } else {
            await customerReturnVisitApi.create(payload);
            message.success(t('common.createSuccess'));
          }
          setModalOpen(false);
          actionRef.current?.reload();
        }}
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="customer_id" hidden rules={[{ required: true }]}>
            <InputNumber />
          </Form.Item>
          <Form.Item
            name="customer_name"
            label={t('app.kuaizhizao.afterSalesService.returnVisit.field.customerName')}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="source_type"
            label={t('app.kuaizhizao.afterSalesService.returnVisit.field.sourceType')}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="source_id"
            label={t('app.kuaizhizao.afterSalesService.returnVisit.field.sourceId')}
            rules={[{ required: true }]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="source_code"
            label={t('app.kuaizhizao.afterSalesService.returnVisit.field.sourceCode')}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="visit_method" label={t('app.kuaizhizao.afterSalesService.returnVisit.field.visitMethod')}>
            <Select options={VISIT_METHODS.map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item
            name="satisfaction_score"
            label={t('app.kuaizhizao.afterSalesService.returnVisit.field.satisfactionScore')}
          >
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="visited_at_picker"
            label={t('app.kuaizhizao.afterSalesService.returnVisit.field.visitedAt')}
            rules={[{ required: true }]}
            {...formDateFormItemProps}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="feedback" label={t('app.kuaizhizao.afterSalesService.returnVisit.field.feedback')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="notes" label={t('app.kuaizhizao.afterSalesService.returnVisit.field.notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer open={detailOpen} width={640} title={detail?.visit_code} onClose={() => setDetailOpen(false)}>
        {detail ? (
          <>
            <p>{t('app.kuaizhizao.afterSalesService.returnVisit.field.customerName')}: {detail.customer_name}</p>
            <p>{t('app.kuaizhizao.afterSalesService.returnVisit.field.feedback')}: {detail.feedback || '-'}</p>
            <p>{t('app.kuaizhizao.afterSalesService.returnVisit.field.notes')}: {detail.notes || '-'}</p>
          </>
        ) : null}
      </Drawer>
    </ListPageTemplate>
  );
};

export default ReturnVisitsPage;

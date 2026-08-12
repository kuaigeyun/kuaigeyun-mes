import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Drawer, Form, Input, InputNumber, Modal, Select } from 'antd';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { SourceDocumentCode } from '../../../../../components/linked-document-code/SourceDocumentCode';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formDateFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import { formatApiErrorDetail } from '../../../../../services/api';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import type { Customer } from '../../../../master-data/types/supply-chain';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { renderAfterSalesTypeMarker } from '../shared/afterSalesListPresentation';
import { AfterSalesSourceDocumentSelect } from '../shared/AfterSalesSourceDocumentSelect';
import {
  customerReturnVisitApi,
  type CustomerReturnVisit,
  type CustomerReturnVisitPayload,
} from '../../../services/after-sales-service';

function customerDisplayName(c: Customer | null | undefined): string {
  if (!c) return '';
  const row = c as Record<string, unknown>;
  return String(row.name ?? row.customer_name ?? '').trim();
}

const RESOURCE = 'kuaizhizao:customer-return-visit';

const VISIT_METHODS = ['电话', '现场', '在线'];

const ReturnVisitsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerReturnVisit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CustomerReturnVisit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CustomerReturnVisitPayload & { visited_at_picker?: dayjs.Dayjs }>();
  const customerId = Form.useWatch('customer_id', form);

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

  const columns: ProColumns<CustomerReturnVisit>[] = useMemo(
    () =>
      alignProColumns<CustomerReturnVisit>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitCode'),
            dataIndex: 'visit_code',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={String(row.visit_code ?? '').trim() || '-'}
                secondary={String(row.customer_name ?? '').trim() || '-'}
                secondaryCopyable={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.customerName'),
            dataIndex: 'customer_name',
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.sourceCode'),
            dataIndex: 'source_code',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => (
              <SourceDocumentCode
                sourceType={row.source_type}
                sourceId={row.source_id}
                sourceCode={row.source_code}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitMethod'),
            dataIndex: 'visit_method',
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => renderAfterSalesTypeMarker(row.visit_method),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.satisfactionScore'),
            dataIndex: 'satisfaction_score',
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'center',
            render: (_, row) =>
              row.satisfaction_score != null ? (
                <MarkerTag color="success">{row.satisfaction_score}</MarkerTag>
              ) : (
                '-'
              ),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitedAt'),
            dataIndex: 'visited_at',
            width: 148,
            minWidth: 148,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => (row.visited_at ? formatDateTime(row.visited_at) : '-'),
          },
          {
            title: t('common.action'),
            key: 'action',
            valueType: 'option',
            fixed: 'right',
            hideInSearch: true,
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
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<CustomerReturnVisit>
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.return-visits.v1"
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
        confirmLoading={submitting}
        onOk={async () => {
          try {
            const values = await form.validateFields();
            const { visited_at_picker, ...rest } = values;
            const payload: CustomerReturnVisitPayload = {
              ...rest,
              visited_at: visited_at_picker?.format('YYYY-MM-DD HH:mm:ss') ?? '',
            };
            setSubmitting(true);
            if (editing) {
              await customerReturnVisitApi.update(editing.id, payload);
              message.success(t('common.saveSuccess'));
            } else {
              await customerReturnVisitApi.create(payload);
              message.success(t('common.createSuccess'));
            }
            setModalOpen(false);
            actionRef.current?.reload();
          } catch (error: unknown) {
            if (error && typeof error === 'object' && 'errorFields' in error) {
              return;
            }
            message.error(formatApiErrorDetail(error) || t('common.saveFailed'));
          } finally {
            setSubmitting(false);
          }
        }}
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="customer_name" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="customer_id"
            label={t('app.kuaizhizao.afterSalesService.returnVisit.field.customerName')}
            rules={[{ required: true, message: t('app.kuaizhizao.afterSalesTicket.selectCustomerFirst') }]}
          >
            <CustomerSelectDropdown
              hostResource={RESOURCE}
              placeholder={t('app.kuaizhizao.afterSalesTicket.selectCustomerFirst')}
              style={{ width: '100%' }}
              onCustomerPick={(c) => {
                form.setFieldsValue({
                  customer_id: c?.id,
                  customer_name: customerDisplayName(c),
                  source_id: undefined,
                  source_code: undefined,
                });
              }}
            />
          </Form.Item>
          <AfterSalesSourceDocumentSelect
            customerId={customerId}
            allowedTypes={['after_sales_ticket', 'repair_order']}
            typeLabelKeyPrefix="app.kuaizhizao.afterSalesService.returnVisit.field"
          />
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
            rules={[{ required: true, message: t('common.required') }]}
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

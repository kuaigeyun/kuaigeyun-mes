import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, DatePicker, Form, Input, Modal, Rate, Select } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { SourceDocumentCode } from '../../../../../components/linked-document-code/SourceDocumentCode';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { formDateFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import { formatApiErrorDetail } from '../../../../../services/api';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import type { Customer } from '../../../../master-data/types/supply-chain';
import {
  AFTER_SALES_CUSTOMER_NAME_COLUMN_DEFAULTS,
  renderAfterSalesTypeMarker,
} from '../shared/afterSalesListPresentation';
import { AfterSalesSourceDocumentSelect } from '../shared/AfterSalesSourceDocumentSelect';
import {
  customerReturnVisitApi,
  type CustomerReturnVisit,
  type CustomerReturnVisitPayload,
} from '../../../services/after-sales-service';
import { CustomerReturnVisitDetailDrawer } from './components/CustomerReturnVisitDetailDrawer';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

function customerDisplayName(c: Customer | null | undefined): string {
  if (!c) return '';
  const row = c as Record<string, unknown>;
  return String(row.name ?? row.customer_name ?? '').trim();
}

const RESOURCE = 'kuaizhizao:customer-return-visit';

const VISIT_METHODS = ['电话', '现场', '在线'];

const ReturnVisitsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerReturnVisit | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CustomerReturnVisit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CustomerReturnVisitPayload & { visited_at_picker?: dayjs.Dayjs }>();
  const customerId = Form.useWatch('customer_id', form);
  const sourceType = Form.useWatch('source_type', form) as string | undefined;
  const [blockedSources, setBlockedSources] = useState<Record<number, { disabled: boolean; reason: string }>>({});

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    void customerReturnVisitApi
      .list({ skip: 0, limit: 200 })
      .then((res) => {
        if (cancelled) return;
        const blocked: Record<number, { disabled: boolean; reason: string }> = {};
        for (const row of res.items ?? []) {
          if (sourceType && row.source_type !== sourceType) continue;
          if (editing?.id && row.id === editing.id) continue;
          blocked[row.source_id] = {
            disabled: true,
            reason: t('app.kuaizhizao.afterSalesService.returnVisit.sourceAlreadyVisited', {
              code: row.visit_code,
            }),
          };
        }
        setBlockedSources(blocked);
      })
      .catch(() => {
        if (!cancelled) setBlockedSources({});
      });
    return () => {
      cancelled = true;
    };
  }, [editing?.id, modalOpen, sourceType, t]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ visit_method: '电话', visited_at_picker: dayjs() });
    setModalOpen(true);
  };

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await customerReturnVisitApi.get(id));
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.afterSalesService.detail.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const openDetail = (row: CustomerReturnVisit) => {
    detailRetryIdRef.current = row.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(row.id);
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

  const confirmDelete = (row: CustomerReturnVisit) => {
    modal.confirm({
      title: t('common.confirmDelete'),
      onOk: async () => {
        await customerReturnVisitApi.delete(row.id);
        message.success(t('common.deleteSuccess'));
        if (detail?.id === row.id) {
          setDetailOpen(false);
          setDetail(null);
        }
        actionRef.current?.reload();
      },
    });
  };

  const columns: ProColumns<CustomerReturnVisit>[] = useMemo(
    () =>
      alignProColumns<CustomerReturnVisit>(
        [
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitCode'),
            dataIndex: 'visit_code',
            width: 188,
            minWidth: 188,
            uniTableKeepWidth: true,
            resizable: false,
            fixed: 'left',
            copyable: true,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.customerName'),
            dataIndex: 'customer_name',
            ...AFTER_SALES_CUSTOMER_NAME_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.sourceCode'),
            dataIndex: 'source_code',
            width: 188,
            minWidth: 188,
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
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, row) => renderAfterSalesTypeMarker(row.visit_method),
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.satisfactionScore'),
            dataIndex: 'satisfaction_score',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'center',
            render: (_, row) =>
              row.satisfaction_score != null ? (
                <Rate disabled value={Number(row.satisfaction_score)} count={5} style={{ fontSize: 14 }} />
              ) : (
                '-'
              ),
          },
          {
            // 无行项目：客户反馈吃余量（对齐工单「问题描述」）；单号统一 188
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.feedback'),
            dataIndex: 'feedback',
            minWidth: 160,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            render: (_, row) => {
              const text = String(row.feedback ?? '').trim();
              return text || '—';
            },
          },
          {
            title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitedAt'),
            dataIndex: 'visited_at',
            width: 168,
            minWidth: 168,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, row) => (row.visited_at ? formatDateTime(row.visited_at) : '-'),
          },
          {
            title: t('common.actions'),
            key: 'action',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => [
              <Button
                {...rowActionKind('read')}
                key="read"
                onClick={() => openDetail(row)}
              />,
              perms.canUpdate ? (
                <Button {...rowActionKind('update')} key="edit" onClick={() => void openEdit(row)} />
              ) : null,
              perms.canDelete ? (
                <Button {...rowActionKind('delete')} key="delete" onClick={() => confirmDelete(row)} />
              ) : null,
            ],
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [perms.canDelete, perms.canUpdate, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<CustomerReturnVisit>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.afterSalesReturnVisit)}
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.return-visits.v7"
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
        destroyOnHidden
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
            optionStateById={blockedSources}
          />
          <Form.Item name="visit_method" label={t('app.kuaizhizao.afterSalesService.returnVisit.field.visitMethod')}>
            <Select options={VISIT_METHODS.map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item
            name="satisfaction_score"
            label={t('app.kuaizhizao.afterSalesService.returnVisit.field.satisfactionScore')}
          >
            <Rate count={5} />
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
          <Form.Item name="notes" label={t('common.remark')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <CustomerReturnVisitDetailDrawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailError(null);
        }}
        record={detail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailRetryIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (!detail) return;
          void openEdit(detail);
        })}
      />
    </ListPageTemplate>
  );
};

export default ReturnVisitsPage;

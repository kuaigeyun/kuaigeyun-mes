import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ProForm,
  ProFormDatePicker,
  ProFormDependency,
  ProFormDigit,
  ProFormMoney,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App, Button, Descriptions, Modal, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  detailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { apiRequest } from '../../../../../services/api';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  financeNoteService,
  type FinanceNote,
  type FinanceNoteDirection,
} from '../../../services/finance/note';
import {
  formatNoteBillType,
  formatNoteStatus,
  getNoteBillTypeSelectOptions,
  getNoteStatusSelectOptions,
} from '../../../utils/financeUiLabels';
import { renderFinanceTypeMarker } from '../../../utils/financeListPresentation';
import { FINANCE_DOC_PINNED_STATUS_FIELD, financeDocCreatedUpdatedColumns } from '../../../utils/financeListCore';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  rowActionKind,
  rowActionNoteCollect,
  rowActionNoteDiscount,
  rowActionNoteEndorse,
  rowActionNoteHonor,
} from '../../../../../components/uni-action';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

type Props = {
  direction: FinanceNoteDirection;
  resource: string;
  columnPersistenceId: string;
};

const NS = 'app.kuaicaiwu.notes';

const FinanceNotesPage: React.FC<Props> = ({ direction, resource, columnPersistenceId }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const perms = useResourcePermissions(resource);
  const expiringDays = searchParams.get('expiring_within_days');
  const urlKeyword = searchParams.get('keyword') ?? undefined;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceNote | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<FinanceNote | null>(null);
  const [actionModal, setActionModal] = useState<{ note: FinanceNote; action: string } | null>(null);
  const [partnerOptions, setPartnerOptions] = useState<{ label: string; value: number }[]>([]);

  const isReceivable = direction === 'receivable';
  const partnerLabel = isReceivable
    ? t('app.kuaicaiwu.common.customer')
    : t('app.kuaicaiwu.common.supplier');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const path = isReceivable
          ? '/apps/master-data/supply-chain/customers'
          : '/apps/master-data/supply-chain/suppliers';
        const res = await apiRequest<unknown>(path, { params: { limit: 1000, is_active: true } });
        if (cancelled) return;
        const list = Array.isArray(res)
          ? res
          : (res as { data?: unknown[]; items?: unknown[] })?.data
            ?? (res as { items?: unknown[] })?.items
            ?? [];
        setPartnerOptions(
          (Array.isArray(list) ? list : []).map((row: Record<string, unknown>) => ({
            label: String(row.name || row.customer_name || row.supplier_name || row.code || row.id),
            value: Number(row.id),
          })),
        );
      } catch {
        if (!cancelled) setPartnerOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReceivable]);

  const statusTag = useCallback(
    (status: string) => {
      const color =
        status === 'held' || status === 'issued'
          ? 'processing'
          : status === 'dishonored'
            ? 'error'
            : status === 'collected' || status === 'honored'
              ? 'success'
              : 'default';
      return <MarkerTag color={color}>{formatNoteStatus(status, t)}</MarkerTag>;
    },
    [t],
  );

  const columns: ProColumns<FinanceNote>[] = useMemo(
    () =>
      alignProColumns<FinanceNote>(
        [
          {
            title: t(`${NS}.col.billNo`),
            dataIndex: 'bill_no',
            hideInTable: true,
          },
          {
            // 有 RemainderFlex：主标识叠列 KeepWidth
            title: t(`${NS}.col.billNo`),
            key: 'finance_note_stacked',
            dataIndex: 'bill_no',
            width: 240,
            minWidth: 240,
            uniTableKeepWidth: true,
            uniTablePrimaryFlex: false,
            resizable: false,
            fixed: 'left',
            hideInSearch: true,
            sorter: true,
            render: (_, r) => (
              <UniTableStackedPrimaryCell
                primary={String(r.bill_no ?? '')}
                secondary={String(r.note_code ?? '')}
              />
            ),
          },
          {
            title: partnerLabel,
            key: 'finance_note_partner',
            dataIndex: isReceivable ? 'customer_name' : 'supplier_name',
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            sorter: true,
          },
          {
            title: t(`${NS}.col.billType`),
            key: 'finance_note_bill_type',
            dataIndex: 'bill_type',
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            hideInSearch: true,
            sorter: true,
            render: (_, r) =>
              renderFinanceTypeMarker(formatNoteBillType(r.bill_type, t), 'processing'),
          },
          {
            title: t(`${NS}.col.amount`),
            key: 'finance_note_amount',
            dataIndex: 'amount',
            valueType: 'money',
            align: 'right',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
          },
          {
            title: t(`${NS}.col.issueDate`),
            dataIndex: 'issue_date',
            valueType: 'date',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
          },
          {
            title: t(`${NS}.col.dueDate`),
            dataIndex: 'due_date',
            valueType: 'date',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
          },
          {
            title: t(`${NS}.col.dueDate`),
            dataIndex: 'due_date_range',
            valueType: 'dateRange',
            hideInTable: true,
            formItemProps: formDateRangeFormItemProps,
          },
          {
            // 备注长短不一：唯一 RemainderFlex
            title: t('common.remark'),
            key: 'finance_note_notes',
            dataIndex: 'notes',
            minWidth: 160,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            render: (_, r) => r.notes || '—',
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            valueType: 'select',
            valueEnum: Object.fromEntries(
              getNoteStatusSelectOptions(direction, t).map((o) => [o.value, { text: o.label }]),
            ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            hideInSearch: true,
            render: (_, r) => statusTag(String(r.status)),
          },
          ...financeDocCreatedUpdatedColumns(t),
          {
            title: t('common.actions'),
            key: 'action',
            fixed: 'right',
            hideInSearch: true,
            render: (_, r) => {
              const actions: React.ReactNode[] = [];
              if (perms.canRead) {
                actions.push(
                  <Button
                    key="view"
                    type="link"
                    size="small"
                    {...rowActionKind('read')}
                    onClick={() => {
                      setDetail(r);
                      setDetailOpen(true);
                    }}
                  />,
                );
              }
              const active = isReceivable ? r.status === 'held' : r.status === 'issued';
              if (active && perms.canUpdate) {
                if (isReceivable) {
                  actions.push(
                    <Button
                      key="endorse"
                      type="link"
                      size="small"
                      {...rowActionNoteEndorse('update')}
                      onClick={() => setActionModal({ note: r, action: 'endorse' })}
                    />,
                    <Button
                      key="discount"
                      type="link"
                      size="small"
                      {...rowActionNoteDiscount('update')}
                      onClick={() => setActionModal({ note: r, action: 'discount' })}
                    />,
                    <Button
                      key="collect"
                      type="link"
                      size="small"
                      {...rowActionNoteCollect('update')}
                      onClick={() => setActionModal({ note: r, action: 'collect' })}
                    />,
                  );
                } else {
                  actions.push(
                    <Button
                      key="honor"
                      type="link"
                      size="small"
                      {...rowActionNoteHonor('update')}
                      onClick={() => setActionModal({ note: r, action: 'honor' })}
                    />,
                  );
                }
              }
              if (active && perms.canUpdate) {
                actions.push(
                  <Button
                    key="edit"
                    type="link"
                    size="small"
                    {...rowActionKind('update')}
                    onClick={() => {
                      setEditing(r);
                      setModalOpen(true);
                    }}
                  />,
                );
              }
              if (active && perms.canDelete) {
                actions.push(
                  <Popconfirm
                    key="del"
                    title={t(`${NS}.confirmDelete`)}
                    onConfirm={async () => {
                      try {
                        await financeNoteService.delete(direction, r.id);
                        messageApi.success(t('common.deleteSuccess'));
                        actionRef.current?.reload();
                      } catch (error) {
                        messageApi.error(getApiErrorMessage(error, t('common.deleteFailed')));
                      }
                    }}
                  >
                    <Button type="link" size="small" {...rowActionKind('delete')} />
                  </Popconfirm>,
                );
              }
              return actions;
            },
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [direction, isReceivable, messageApi, partnerLabel, perms, statusTag, t],
  );

  const filterAlert = expiringDays ? (
    <Alert
      type="info"
      showIcon
      title={t(`${NS}.filterExpiring`, { days: expiringDays })}
      style={{ marginBottom: 12 }}
    />
  ) : urlKeyword ? (
    <Alert
      type="info"
      showIcon
      title={t(`${NS}.filterKeyword`, { keyword: urlKeyword })}
      style={{ marginBottom: 12 }}
    />
  ) : null;

  return (
    <ListPageTemplate>
      {filterAlert}
      <UniTable<FinanceNote>
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId={columnPersistenceId}
        viewTypes={['table', 'help']}
        helpViewConfig={buildDocumentListHelpViewConfig(
          isReceivable ? DOCUMENT_LIST_HELP_KEYS.notesReceivable : DOCUMENT_LIST_HELP_KEYS.notesPayable,
        )}
        columns={columns}
        pinnedTabsField={FINANCE_DOC_PINNED_STATUS_FIELD}
        headerTitle={isReceivable ? t(`${NS}.titleReceivable`) : t(`${NS}.titlePayable`)}
        toolBarRender={() =>
          perms.canCreate
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  {t(`${NS}.create`)}
                </Button>,
              ]
            : []
        }
        request={async (params, sort) => {
          const sortField = Object.keys(sort || {})[0];
          const sortOrder = sortField ? sort?.[sortField] : undefined;
          const dueRange = params.due_date_range as string[] | undefined;
          return financeNoteService.list(direction, {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            keyword: (params.keyword as string | undefined) || urlKeyword,
            status: params.status as string | undefined,
            bill_type: params.bill_type as FinanceNote['bill_type'] | undefined,
            expiring_within_days: expiringDays ? Number(expiringDays) : undefined,
            due_date_start: dueRange?.[0],
            due_date_end: dueRange?.[1],
            sort_field: sortField,
            sort_order: sortOrder,
          });
        }}
        rowSelection={false}
        search={{ labelWidth: 'auto' }}
      />

      <FormModalTemplate
        title={editing ? t(`${NS}.edit`) : t(`${NS}.create`)}
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialValues={editing ?? { bill_type: 'bank_acceptance' }}
        modalProps={{ width: MODAL_CONFIG.LARGE_WIDTH, destroyOnHidden: true }}
        onFinish={async (values) => {
          const partnerId = isReceivable ? values.customer_id : values.supplier_id;
          const partner = partnerOptions.find((o) => o.value === partnerId);
          const payload = {
            ...values,
            customer_name: isReceivable ? partner?.label : undefined,
            supplier_name: isReceivable ? undefined : partner?.label,
          };
          try {
            if (editing) {
              await financeNoteService.update(direction, editing.id, payload);
              messageApi.success(t('common.updateSuccess'));
            } else {
              await financeNoteService.create(direction, payload);
              messageApi.success(t('common.createSuccess'));
            }
            setModalOpen(false);
            setEditing(null);
            actionRef.current?.reload();
            return true;
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, t('common.saveFailed')));
            return false;
          }
        }}
      >
        <ProFormSelect
          name={isReceivable ? 'customer_id' : 'supplier_id'}
          label={partnerLabel}
          options={partnerOptions}
          rules={[{ required: true }]}
          showSearch
          fieldProps={{ optionFilterProp: 'label' }}
        />
        <ProFormSelect
          name="bill_type"
          label={t(`${NS}.col.billType`)}
          options={getNoteBillTypeSelectOptions(t)}
          rules={[{ required: true }]}
        />
        <ProFormText name="bill_no" label={t(`${NS}.col.billNo`)} rules={[{ required: true }]} />
        <ProFormMoney name="amount" label={t(`${NS}.col.amount`)} rules={[{ required: true }]} />
        <ProFormDatePicker name="issue_date" label={t(`${NS}.col.issueDate`)} rules={[{ required: true }]} />
        <ProFormDatePicker name="due_date" label={t(`${NS}.col.dueDate`)} rules={[{ required: true }]} />
        <ProFormDependency name={['bill_type']}>
          {({ bill_type }) =>
            bill_type === 'bank_acceptance' ? (
              <ProFormText
                name="accepting_bank"
                label={t(`${NS}.field.acceptingBank`)}
                rules={[{ required: true }]}
              />
            ) : null
          }
        </ProFormDependency>
        <ProFormText name="drawer_name" label={t(`${NS}.field.drawer`)} />
        <ProFormText name="acceptor_name" label={t(`${NS}.field.acceptor`)} />
        <ProFormText name="payee_name" label={t(`${NS}.field.payee`)} />
        {editing && isReceivable ? (
          <ProFormDigit name="receipt_id" label={t(`${NS}.field.receiptId`)} min={1} />
        ) : null}
        {editing && !isReceivable ? (
          <ProFormDigit name="payment_id" label={t(`${NS}.field.paymentId`)} min={1} />
        ) : null}
        <ProFormTextArea name="notes" label={t('common.remark')} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        size={DRAWER_CONFIG.STANDARD_WIDTH}
        title={detail?.note_code}
        loading={false}
        plainBody={
          detail ? (
            <Descriptions {...detailDrawerDescriptionItems} column={2} bordered size="small">
              <Descriptions.Item label={t(`${NS}.col.billNo`)}>{detail.bill_no}</Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.col.billType`)}>
                {formatNoteBillType(detail.bill_type, t)}
              </Descriptions.Item>
              <Descriptions.Item label={partnerLabel}>
                {detail.customer_name || detail.supplier_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.col.amount`)}>
                ¥{Number(detail.amount).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.col.issueDate`)}>{detail.issue_date}</Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.col.dueDate`)}>{detail.due_date}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>{statusTag(detail.status)}</Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.field.acceptingBank`)}>
                {detail.accepting_bank || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.field.drawer`)}>{detail.drawer_name || '—'}</Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.field.acceptor`)}>{detail.acceptor_name || '—'}</Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.field.payee`)}>{detail.payee_name || '—'}</Descriptions.Item>
              {detail.endorse_to_name ? (
                <Descriptions.Item label={t(`${NS}.field.endorseTo`)}>{detail.endorse_to_name}</Descriptions.Item>
              ) : null}
              {detail.discount_bank ? (
                <Descriptions.Item label={t(`${NS}.field.discountBank`)}>{detail.discount_bank}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('common.remark')} span={2}>
                {detail.notes || '—'}
              </Descriptions.Item>
            </Descriptions>
          ) : null
        }
      />

      <Modal
        title={
          actionModal?.action === 'endorse'
            ? t(`${NS}.action.endorse`)
            : actionModal?.action === 'discount'
              ? t(`${NS}.action.discount`)
              : actionModal?.action === 'collect'
                ? t(`${NS}.action.collect`)
                : actionModal?.action === 'honor'
                  ? t(`${NS}.action.honor`)
                  : t('common.confirm')
        }
        open={Boolean(actionModal)}
        onCancel={() => setActionModal(null)}
        footer={null}
        destroyOnHidden
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        {actionModal ? (
          <ProForm
            layout="vertical"
            submitter={{
              searchConfig: { submitText: t('common.confirm') },
              resetButtonProps: { style: { display: 'none' } },
            }}
            onFinish={async (values) => {
              try {
                await financeNoteService.applyAction(direction, actionModal.note.id, {
                  action: actionModal.action,
                  ...values,
                });
                messageApi.success(t('common.operationSuccess'));
                setActionModal(null);
                actionRef.current?.reload();
                return true;
              } catch (error) {
                messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
                return false;
              }
            }}
          >
            {actionModal.action === 'endorse' ? (
              <ProFormText
                name="endorse_to_name"
                label={t(`${NS}.field.endorseTo`)}
                rules={[{ required: true }]}
              />
            ) : null}
            {actionModal.action === 'discount' ? (
              <>
                <ProFormText
                  name="discount_bank"
                  label={t(`${NS}.field.discountBank`)}
                  rules={[{ required: true }]}
                />
                <ProFormDatePicker name="discount_date" label={t(`${NS}.field.discountDate`)} />
                <ProFormMoney name="discount_interest" label={t(`${NS}.field.discountInterest`)} />
              </>
            ) : null}
            {actionModal.action === 'collect' || actionModal.action === 'honor' ? (
              <ProFormDatePicker name="settle_date" label={t(`${NS}.field.settleDate`)} />
            ) : null}
          </ProForm>
        ) : null}
      </Modal>
    </ListPageTemplate>
  );
};

export default FinanceNotesPage;

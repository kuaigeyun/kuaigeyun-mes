/**
 * 进项认证
 */
import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { taxService } from '../../../services/tax';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  rowActionKind,
  rowActionTaxCertify,
  rowActionTaxRedFlush,
  rowActionTaxTransferOut,
  rowActionToneDestructive,
} from '../../../../../components/uni-action';

const NS = 'app.kuaicaiwu.tax.inputCert';
const INPUT_CERT_PINNED_STATUS_FIELD = 'verification_status';

type Row = Record<string, unknown> & { id: number };

const InputCertificationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const { canUpdate } = useResourcePermissions('kuaicaiwu:tax');
  const actionRef = useRef<ActionType>();
  const [selected, setSelected] = useState<Row[]>([]);
  const [transferId, setTransferId] = useState<number | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [redId, setRedId] = useState<number | null>(null);
  const [redReason, setRedReason] = useState('');

  const statusEnum = useMemo(
    () => ({
      pending: { text: t(`${NS}.status.pending`) },
      certified: { text: t(`${NS}.status.certified`) },
      transferred_out: { text: t(`${NS}.status.transferred`) },
      not_deductible: { text: t(`${NS}.status.notDeductible`) },
    }),
    [t],
  );

  const renderVerifyStatus = (status: string) => {
    const text = statusEnum[status as keyof typeof statusEnum]?.text ?? status;
    const color =
      status === 'pending'
        ? 'warning'
        : status === 'certified'
          ? 'success'
          : status === 'transferred_out'
            ? 'processing'
            : 'default';
    return <MarkerTag color={color}>{text}</MarkerTag>;
  };

  const columns: ProColumns<Row>[] = useMemo(
    () =>
      alignProColumns<Row>(
        [
          {
            title: t(`${NS}.col.code`),
            key: 'finance_tax_invoice_code',
            dataIndex: 'invoice_code',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
          },
          {
            title: t(`${NS}.col.number`),
            key: 'finance_tax_invoice_number',
            dataIndex: 'invoice_number',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
          },
          {
            // 销方长短不一：唯一 RemainderFlex
            title: t(`${NS}.col.supplier`),
            key: 'finance_tax_supplier',
            dataIndex: 'supplier_name',
            minWidth: 160,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
          },
          {
            title: t(`${NS}.col.date`),
            key: 'finance_tax_invoice_date',
            dataIndex: 'invoice_date',
            valueType: 'date',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
          },
          {
            title: t(`${NS}.col.tax`),
            key: 'finance_tax_amount',
            dataIndex: 'tax_amount',
            align: 'right',
            width: 110,
            minWidth: 110,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, row) => Number(row.tax_amount || 0).toFixed(2),
          },
          {
            title: t(`${NS}.col.status`),
            key: 'finance_tax_verify_status',
            dataIndex: 'verification_status',
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            hideInSearch: false,
            initialValue: 'pending',
            valueType: 'select',
            valueEnum: statusEnum,
            render: (_, row) => renderVerifyStatus(String(row.verification_status ?? '')),
          },
          {
            title: t('common.actions'),
            key: 'action',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => [
              <Button
                key="view"
                type="link"
                size="small"
                {...rowActionKind('read')}
                onClick={() =>
                  navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${row.id}`)
                }
              />,
              canUpdate && row.verification_status === 'pending' ? (
                <Button
                  key="certify"
                  type="link"
                  size="small"
                  {...rowActionTaxCertify('update')}
                  onClick={async () => {
                    try {
                      await taxService.certify(row.id);
                      messageApi.success(t(`${NS}.certified`));
    actionRef.current?.reload();
                    } catch (error) {
                      messageApi.error(getApiErrorMessage(error, t(`${NS}.certifyFailed`)));
                    }
                  }}
                />
              ) : null,
              canUpdate && row.verification_status === 'certified' ? (
                <Button
                  key="transfer"
                  type="link"
                  size="small"
                  {...rowActionTaxTransferOut('update')}
                  onClick={() => setTransferId(row.id)}
                />
              ) : null,
              canUpdate &&
              !row.original_invoice_id &&
              row.status === '已审核' &&
              !row.red_flush_invoice_id ? (
                <Button
                  key="red"
                  type="link"
                  size="small"
                  {...rowActionTaxRedFlush('update')}
                  {...rowActionToneDestructive()}
                  onClick={() => setRedId(row.id)}
                />
              ) : null,
            ],
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [canUpdate, messageApi, navigate, statusEnum, t],
  );

  return (
    <ListPageTemplate>
      <UniTable<Row>
        viewTypes={['table', 'help']}
        helpViewConfig={buildListPageHelpViewConfig('kuaicaiwu.inputCertification')}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        enableRowSelection={canUpdate}
        onRowSelectionChange={(rows) => setSelected(rows as Row[])}
        columnPersistenceId="apps.kuaicaiwu.pages.tax-management.input-certification.list-v2"
        pinnedTabsField={INPUT_CERT_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        toolBarRender={() =>
          canUpdate
            ? [
                <Button
                  key="batch"
                  type="primary"
                  disabled={!selected.length}
                  onClick={async () => {
                    try {
                      const res = await taxService.batchCertify(selected.map((r) => r.id));
                      messageApi.success(
                        t(`${NS}.batchDone`, {
                          n: res.certified?.length ?? 0,
                        }),
                      );
    actionRef.current?.reload();
                      actionRef.current?.clearSelected?.();
                    } catch (error) {
                      messageApi.error(getApiErrorMessage(error, t(`${NS}.certifyFailed`)));
                    }
                  }}
                >
                  {t(`${NS}.batchCertify`)}
                </Button>,
              ]
            : []
        }
        request={async (params, _sort, _filter, searchFormValues) => {
          const res = await taxService.listInputCertification({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            verification_status: (searchFormValues?.verification_status as string) || 'pending',
            keyword:
              (searchFormValues?.keyword as string | undefined) ??
              (params.keyword as string | undefined),
          });
          return { data: res.items as Row[], success: true, total: res.total };
        }}
      />

      <Modal
        title={t(`${NS}.transferOut`)}
        open={transferId != null}
        onCancel={() => {
          setTransferId(null);
          setTransferReason('');
        }}
        onOk={async () => {
          if (!transferId || !transferReason.trim()) return;
          try {
            await taxService.transferOut(transferId, transferReason.trim());
            messageApi.success(t(`${NS}.transferred`));
            setTransferId(null);
            setTransferReason('');
    actionRef.current?.reload();
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, t(`${NS}.transferFailed`)));
          }
        }}
        destroyOnHidden
      >
        <Input.TextArea
          rows={3}
          value={transferReason}
          onChange={(e) => setTransferReason(e.target.value)}
          placeholder={t(`${NS}.transferReason`)}
        />
      </Modal>

      <Modal
        title={t(`${NS}.redFlush`)}
        open={redId != null}
        onCancel={() => {
          setRedId(null);
          setRedReason('');
        }}
        onOk={async () => {
          if (!redId || !redReason.trim()) return;
          try {
            await taxService.redFlush(redId, redReason.trim());
            messageApi.success(t(`${NS}.redDone`));
            setRedId(null);
            setRedReason('');
    actionRef.current?.reload();
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, t(`${NS}.redFailed`)));
          }
        }}
        destroyOnHidden
      >
        <Input.TextArea
          rows={3}
          value={redReason}
          onChange={(e) => setRedReason(e.target.value)}
          placeholder={t(`${NS}.redReason`)}
        />
      </Modal>
    </ListPageTemplate>
  );
};

export default InputCertificationPage;

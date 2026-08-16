/**
 * 进项认证
 */
import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { taxService } from '../../../services/tax';

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

  const columns: ProColumns<Row>[] = [
    { title: t(`${NS}.col.code`, { defaultValue: '发票编码' }), dataIndex: 'invoice_code', width: 140 },
    { title: t(`${NS}.col.number`, { defaultValue: '票号' }), dataIndex: 'invoice_number', width: 120 },
    { title: t(`${NS}.col.supplier`, { defaultValue: '供应商' }), dataIndex: 'supplier_name', ellipsis: true },
    { title: t(`${NS}.col.date`, { defaultValue: '开票日' }), dataIndex: 'invoice_date', width: 110 },
    {
      title: t(`${NS}.col.tax`, { defaultValue: '税额' }),
      dataIndex: 'tax_amount',
      width: 100,
      render: (_, row) => Number(row.tax_amount || 0).toFixed(2),
    },
    {
      title: t(`${NS}.col.status`, { defaultValue: '认证状态' }),
      dataIndex: 'verification_status',
      width: 100,
      hideInSearch: false,
      initialValue: 'pending',
      valueEnum: {
        pending: { text: t(`${NS}.status.pending`, { defaultValue: '待认证' }) },
        certified: { text: t(`${NS}.status.certified`, { defaultValue: '已认证' }) },
        transferred_out: { text: t(`${NS}.status.transferred`, { defaultValue: '已转出' }) },
        not_deductible: { text: t(`${NS}.status.notDeductible`, { defaultValue: '不可抵扣' }) },
      },
    },
    {
      title: t('common.actions', { defaultValue: '操作' }),
      valueType: 'option',
      width: 220,
      render: (_, row) => [
        <Button key="view" type="link" size="small" onClick={() => navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${row.id}`)}>
          {t(`${NS}.view`, { defaultValue: '详情' })}
        </Button>,
        canUpdate && row.verification_status === 'pending' && (
          <Button
            key="certify"
            type="link"
            size="small"
            onClick={async () => {
              try {
                await taxService.certify(row.id);
                messageApi.success(t(`${NS}.certified`, { defaultValue: '认证成功' }));
                actionRef.current?.reload();
              } catch (error) {
                messageApi.error(getApiErrorMessage(error, t(`${NS}.certifyFailed`, { defaultValue: '认证失败' })));
              }
            }}
          >
            {t(`${NS}.certify`, { defaultValue: '认证' })}
          </Button>
        ),
        canUpdate && row.verification_status === 'certified' && (
          <Button key="transfer" type="link" size="small" onClick={() => setTransferId(row.id)}>
            {t(`${NS}.transferOut`, { defaultValue: '转出' })}
          </Button>
        ),
        canUpdate && !row.original_invoice_id && row.status === '已审核' && !row.red_flush_invoice_id && (
          <Button key="red" type="link" size="small" danger onClick={() => setRedId(row.id)}>
            {t(`${NS}.redFlush`, { defaultValue: '红冲' })}
          </Button>
        ),
      ],
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<Row>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        enableRowSelection={canUpdate}
        onRowSelectionChange={(rows) => setSelected(rows as Row[])}
        columnPersistenceId="apps.kuaicaiwu.pages.tax-management.input-certification.list-v1"
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
                          defaultValue: '已认证 {{n}} 张',
                          n: res.certified?.length ?? 0,
                        }),
                      );
                      actionRef.current?.reload();
                      actionRef.current?.clearSelected?.();
                    } catch (error) {
                      messageApi.error(getApiErrorMessage(error, t(`${NS}.certifyFailed`, { defaultValue: '认证失败' })));
                    }
                  }}
                >
                  {t(`${NS}.batchCertify`, { defaultValue: '批量认证' })}
                </Button>,
              ]
            : []
        }
        request={async (params, _sort, _filter, searchFormValues) => {
          const res = await taxService.listInputCertification({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            verification_status: (searchFormValues?.verification_status as string) || 'pending',
            keyword: (searchFormValues?.keyword as string | undefined) ?? (params.keyword as string | undefined),
          });
          return { data: res.items as Row[], success: true, total: res.total };
        }}
      />

      <Modal
        title={t(`${NS}.transferOut`, { defaultValue: '进项转出' })}
        open={transferId != null}
        onCancel={() => {
          setTransferId(null);
          setTransferReason('');
        }}
        onOk={async () => {
          if (!transferId || !transferReason.trim()) return;
          try {
            await taxService.transferOut(transferId, transferReason.trim());
            messageApi.success(t(`${NS}.transferred`, { defaultValue: '已转出' }));
            setTransferId(null);
            setTransferReason('');
            actionRef.current?.reload();
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, t(`${NS}.transferFailed`, { defaultValue: '转出失败' })));
          }
        }}
        destroyOnHidden
      >
        <Input.TextArea rows={3} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder={t(`${NS}.transferReason`, { defaultValue: '转出原因' })} />
      </Modal>

      <Modal
        title={t(`${NS}.redFlush`, { defaultValue: '红冲' })}
        open={redId != null}
        onCancel={() => {
          setRedId(null);
          setRedReason('');
        }}
        onOk={async () => {
          if (!redId || !redReason.trim()) return;
          try {
            await taxService.redFlush(redId, redReason.trim());
            messageApi.success(t(`${NS}.redDone`, { defaultValue: '红字发票已生成' }));
            setRedId(null);
            setRedReason('');
            actionRef.current?.reload();
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, t(`${NS}.redFailed`, { defaultValue: '红冲失败' })));
          }
        }}
        destroyOnHidden
      >
        <Input.TextArea rows={3} value={redReason} onChange={(e) => setRedReason(e.target.value)} placeholder={t(`${NS}.redReason`, { defaultValue: '红冲原因' })} />
      </Modal>
    </ListPageTemplate>
  );
};

export default InputCertificationPage;

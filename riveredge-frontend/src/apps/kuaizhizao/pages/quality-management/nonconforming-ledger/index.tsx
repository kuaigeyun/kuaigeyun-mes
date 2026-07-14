import { rowActionKind } from '../../../../../components/uni-action';
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Modal, Space } from 'antd';
import {
  renderUnqualifiedQuantity,
  stackedPrimarySecondaryColumn,
} from '../components/qualityTableColumns';
import { MaterialStackedCell, UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { DefectLedgerItem, qualityImprovementApi } from '../../../services/quality-improvement';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { nonconformingLedgerRowGates } from '../../../../../hooks/useDocumentCapabilities';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useTranslation } from 'react-i18next';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  buildNcDefectTypeValueEnum,
  buildNcDispositionValueEnum,
  buildNcLedgerStatusValueEnum,
  NC_LEDGER_PINNED_STATUS_FIELD,
  normalizeQualityImprovementListResponse,
  resolveNonconformingLedgerListParams,
} from '../../../utils/qualityImprovementListCore';
import {
  getQualityDispositionValueEnum,
  getQualityNcLedgerStatusValueEnum,
  renderNcLedgerStatusTag,
} from '../components/qualityMeta';

const NC_RESOURCE = 'kuaizhizao:quality-management-nonconforming-ledger';
const EIGHT_D_RESOURCE = 'kuaizhizao:quality-management-eight-d-reports';

function sourceInspectionPath(row: DefectLedgerItem): string | null {
  if (row.incoming_inspection_id) {
    return `/apps/kuaizhizao/quality-management/incoming-inspection?incoming_inspection_id=${row.incoming_inspection_id}`;
  }
  if (row.process_inspection_id) {
    return `/apps/kuaizhizao/quality-management/process-inspection?process_inspection_id=${row.process_inspection_id}`;
  }
  if (row.finished_goods_inspection_id) {
    return `/apps/kuaizhizao/quality-management/finished-goods-inspection?finished_goods_inspection_id=${row.finished_goods_inspection_id}`;
  }
  return null;
}

function sourceInspectionLabel(row: DefectLedgerItem): string | null {
  return (
    row.incoming_inspection_code ||
    row.process_inspection_code ||
    row.finished_goods_inspection_code ||
    null
  );
}

const NonconformingLedgerPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [searchParams] = useSearchParams();
  const [currentRow, setCurrentRow] = useState<DefectLedgerItem | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const ncPerms = useResourcePermissions(NC_RESOURCE);
  const { canUpdate } = ncPerms;
  const { canCreate: canStart8d } = useResourcePermissions(EIGHT_D_RESOURCE);

  const initialFilter = useMemo(
    () => ({
      incoming_inspection_id: searchParams.get('incoming_inspection_id') || undefined,
      process_inspection_id: searchParams.get('process_inspection_id') || undefined,
      finished_goods_inspection_id: searchParams.get('finished_goods_inspection_id') || undefined,
      defect_id: searchParams.get('defect_id') || undefined,
    }),
    [searchParams],
  );

  const ncStatusValueEnum = useMemo(() => buildNcLedgerStatusValueEnum(t), [t]);
  const ncDefectTypeValueEnum = useMemo(() => buildNcDefectTypeValueEnum(t), [t]);
  const ncDispositionValueEnum = useMemo(() => buildNcDispositionValueEnum(t), [t]);

  const handleStart8d = (row: DefectLedgerItem) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quality.nc.modal.start8dTitle'),
      content: t('app.kuaizhizao.quality.nc.modal.start8dContent', { code: row.code }),
      onOk: async () => {
        const report = await qualityImprovementApi.nonconformingLedger.start8d(
          row.id,
          `8D - ${row.product_name || row.code}`,
        );
        messageApi.success(t('app.kuaizhizao.quality.nc.messages.start8dSuccess', { code: report.report_code }));
        navigate(`/apps/kuaizhizao/quality-management/eight-d-reports?report_id=${report.id}`);
      },
    });
  };

  const columns: ProColumns<DefectLedgerItem>[] = useMemo(
    () => alignProColumns<DefectLedgerItem>([
      {
        title: t('app.kuaizhizao.quality.common.columns.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.status'),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: ncStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.defectType'),
        dataIndex: 'defect_type',
        valueType: 'select',
        valueEnum: ncDefectTypeValueEnum,
        hideInTable: true,
        search: { order: 21 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.common.form.disposition'),
        dataIndex: 'disposition',
        valueType: 'select',
        valueEnum: ncDispositionValueEnum,
        hideInTable: true,
        search: { order: 22 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.ledgerCode'),
        dataIndex: 'code',
        width: 150,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.sourceInspection'),
        width: 150,
        hideInSearch: true,
        render: (_, row) => {
          const label = sourceInspectionLabel(row);
          const path = sourceInspectionPath(row);
          if (!label || !path) return '-';
          return (
            <Button type="link" size="small" onClick={() => navigate(path)}>
              {label}
            </Button>
          );
        },
      },
      stackedPrimarySecondaryColumn<DefectLedgerItem>(
        t('app.kuaizhizao.quality.nc.columns.operationWorkOrder'),
        'operationWorkOrder',
        ['operation_name', 'operationName'],
        ['work_order_code', 'workOrderCode'],
        { dataIndex: 'operation_name' },
      ),
      { title: t('app.kuaizhizao.quality.common.columns.workOrderCode'), dataIndex: 'work_order_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.common.columns.operationName'), dataIndex: 'operation_name', hideInTable: true },
      {
        title: t('app.kuaizhizao.quality.common.columns.material'),
        key: 'product',
        dataIndex: 'product_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        hideInSearch: true,
        render: (_, row) => (
          <MaterialStackedCell
            material_name={row.product_name}
            material_code={row.product_code ?? row.material_code}
          />
        ),
      },
      { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'product_name', hideInTable: true },
      {
        title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
        dataIndex: 'defect_quantity',
        width: 100,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: (_, row) => renderUnqualifiedQuantity(row.defect_quantity),
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.defectType'),
        dataIndex: 'defect_type',
        width: 120,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.defectReason'),
        dataIndex: 'defect_reason',
        width: 240,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.quality.common.form.disposition'),
        dataIndex: 'disposition',
        width: 120,
        sorter: true,
        hideInSearch: true,
        valueEnum: getQualityDispositionValueEnum(t),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.status'),
        dataIndex: 'status',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => renderNcLedgerStatusTag(t, row.status),
      },
      ...buildDocumentAuditColumns<DefectLedgerItem>(t),
      {
        title: t('app.kuaizhizao.quality.common.columns.actions'),
        valueType: 'option',
        width: 180,
        hideInSearch: true,
        render: (_, row) => {
          const gates = nonconformingLedgerRowGates(row, ncPerms, canStart8d, t);
          return (
            <Space>
              {gates.updateDisposition.allowed && (
                <Button
                  {...rowActionKind('execute')}
                  key="execute"
                  type="link"
                  disabled={gates.updateDisposition.disabled}
                  title={gates.updateDisposition.title}
                  onClick={() => {
                    setCurrentRow(row);
                    setOpen(true);
                    setTimeout(
                      () =>
                        formRef.current?.setFieldsValue({
                          disposition: row.disposition,
                          status: row.status,
                          attachments: mapAttachmentsToUploadList(row.attachments),
                        }),
                      50,
                    );
                  }}
                >
                  {t('app.kuaizhizao.quality.nc.actions.updateDisposition')}
                </Button>
              )}
              {gates.start8d.allowed && (
                <Button
                  key="start8d"
                  {...rowActionKind('execute')}
                  disabled={gates.start8d.disabled}
                  title={gates.start8d.title}
                  onClick={() => handleStart8d(row)}
                >
                  {t('app.kuaizhizao.quality.nc.actions.start8d')}
                </Button>
              )}
            </Space>
          );
        },
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, ncPerms, canStart8d, navigate, ncStatusValueEnum, ncDefectTypeValueEnum, ncDispositionValueEnum],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-nonconforming-ledger:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.nc.permission.noReadAccess')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<DefectLedgerItem>
          headerTitle={t('app.kuaizhizao.quality.nc.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.nonconforming-ledger"
          showAdvancedSearch
          pinnedTabsField={NC_LEDGER_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveNonconformingLedgerListParams(
              searchFormValues,
              sort,
              initialFilter,
            );
            const response = await qualityImprovementApi.nonconformingLedger.list({
              skip,
              limit: pageSize,
              ...listParams,
            });
            const { data, total } = normalizeQualityImprovementListResponse(response);
            return {
              success: true,
              data: data as DefectLedgerItem[],
              total,
            };
          }}
        />

        <FormModalTemplate
          title={t('app.kuaizhizao.quality.nc.modal.updateDispositionTitle', { code: currentRow?.code || '' })}
          open={open}
          width={MODAL_CONFIG.SMALL_WIDTH}
          formRef={formRef}
          onClose={() => {
            setOpen(false);
            setCurrentRow(null);
            formRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!currentRow?.id) return;
            if (!canUpdate) {
              messageApi.error(t('app.kuaizhizao.quality.nc.messages.noUpdatePermission'));
              return false;
            }
            await qualityImprovementApi.nonconformingLedger.updateDisposition(currentRow.id, {
              ...values,
              attachments: normalizeDocumentAttachments(values.attachments),
            });
            messageApi.success(t('app.kuaizhizao.quality.nc.messages.updateDispositionSuccess'));
            setOpen(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          <ProFormSelect
            name="disposition"
            label={t('app.kuaizhizao.quality.common.form.disposition')}
            valueEnum={getQualityDispositionValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="status"
            label={t('app.kuaizhizao.quality.nc.form.ledgerStatus')}
            valueEnum={getQualityNcLedgerStatusValueEnum(t)}
          />
          <ProFormTextArea name="remarks" label={t('app.kuaizhizao.quality.common.form.remarks')} />
          <DocumentAttachmentsField category="nonconforming_ledger_attachments" />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default NonconformingLedgerPage;

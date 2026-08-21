import { rowActionKind } from '../../../../../components/uni-action';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Space } from 'antd';
import {
  renderUnqualifiedQuantity,
  buildNcSourceInspectionStackedColumn,
  stackedPrimarySecondaryColumn,
} from '../components/qualityTableColumns';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { DefectLedgerItem, qualityImprovementApi } from '../../../services/quality-improvement';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { nonconformingLedgerRowGates } from '../../../../../hooks/useDocumentCapabilities';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useTranslation } from 'react-i18next';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { todaySiteDateString } from '../../../../../utils/format';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
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
  getQualityDefectTypeText,
  getQualityDispositionText,
  getQualityDispositionValueEnum,
  getQualityNcLedgerStatusText,
  getQualityNcLedgerStatusValueEnum,
  renderNcLedgerStatusTag,
  renderQualityDispositionMarkerTag,
} from '../components/qualityMeta';
import { DowngradeDispositionFields } from '../components/DowngradeDispositionFields';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { NonconformingLedgerDetailDrawer } from './components/NonconformingLedgerDetailDrawer';
import { sourceInspectionLabel, sourceInspectionTypeText } from './ncLedgerSource';

const NC_RESOURCE = 'kuaizhizao:quality-management-nonconforming-ledger';
const EIGHT_D_RESOURCE = 'kuaizhizao:quality-management-eight-d-reports';

const NonconformingLedgerPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const tableRowsRef = useRef<DefectLedgerItem[]>([]);
  const lastListParamsRef = useRef<Record<string, string | number | undefined>>({});
  const [searchParams] = useSearchParams();
  const [currentRow, setCurrentRow] = useState<DefectLedgerItem | null>(null);
  const [open, setOpen] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailId, setDetailId] = useState<number | undefined>(undefined);
  const [detailRefreshNonce, setDetailRefreshNonce] = useState(0);
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

  const resolveSelectedRows = useCallback((keys: React.Key[]) => {
    return tableRowsRef.current.filter((row) => keys.includes(row.id));
  }, []);

  const openDetail = useCallback((row: DefectLedgerItem) => {
    if (!row.id) return;
    setDetailId(row.id);
    setDetailVisible(true);
  }, []);

  const openDisposition = useCallback((row: DefectLedgerItem) => {
    setCurrentRow(row);
    setOpen(true);
  }, []);

  const handleStart8d = useCallback((row: DefectLedgerItem) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.quality.nc.modal.start8dTitle'),
      content: t('app.kuaizhizao.quality.nc.modal.start8dContent', { code: row.code }),
      onOk: async () => {
        const report = await qualityImprovementApi.nonconformingLedger.start8d(
          row.id,
          `8D - ${row.product_name || row.code}`,
        );
        messageApi.success(t('app.kuaizhizao.quality.nc.messages.start8dSuccess', { code: report.report_code }));
        actionRef.current?.reload();
        setDetailRefreshNonce((n) => n + 1);
        navigate(`/apps/kuaizhizao/quality-management/eight-d-reports?report_id=${report.id}`);
      },
    });
  }, [messageApi, navigate, t]);

  const handleBatchStart8d = useCallback(
    async (keys: React.Key[]) => {
      const rows = resolveSelectedRows(keys).filter((row) => {
        const gates = nonconformingLedgerRowGates(row, ncPerms, canStart8d, t);
        return gates.start8d.allowed && !gates.start8d.disabled;
      });
      if (!rows.length) {
        messageApi.warning(t('app.kuaizhizao.quality.nc.messages.batchStart8dEmpty'));
        return;
      }
      const created: string[] = [];
      for (const row of rows) {
        const report = await qualityImprovementApi.nonconformingLedger.start8d(
          row.id,
          `8D - ${row.product_name || row.code}`,
        );
        created.push(report.report_code);
      }
      messageApi.success(
        t('app.kuaizhizao.quality.nc.messages.batchStart8dSuccess', { count: created.length }),
      );
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      setDetailRefreshNonce((n) => n + 1);
    },
    [canStart8d, messageApi, ncPerms, resolveSelectedRows, t],
  );

  const handleExport = useCallback(
    async (
      type: 'selected' | 'currentPage' | 'all',
      exportKeys?: React.Key[],
      currentPageData?: DefectLedgerItem[],
    ) => {
      try {
        let toExport: DefectLedgerItem[] = [];
        if (type === 'all') {
          toExport = await fetchAllListItems((page) =>
            qualityImprovementApi.nonconformingLedger.list({
              ...lastListParamsRef.current,
              ...page,
            }),
          );
        } else if (type === 'selected' && exportKeys?.length) {
          toExport = (currentPageData || tableRowsRef.current).filter(
            (row) => row.id != null && exportKeys.includes(row.id),
          );
        } else {
          toExport = currentPageData || tableRowsRef.current;
        }
        if (toExport.length === 0) {
          messageApi.warning(t('common.exportNoData'));
          return;
        }
        const exportRows = toExport.map((row) => ({
          code: row.code,
          source_inspection: [sourceInspectionTypeText(t, row), sourceInspectionLabel(row)]
            .filter(Boolean)
            .join(' '),
          work_order_code: row.work_order_code || '',
          operation_name: row.operation_name || '',
          product_code: row.product_code || row.material_code || '',
          product_name: row.product_name || '',
          defect_type: getQualityDefectTypeText(t, row.defect_type, row.defect_reason),
          disposition: getQualityDispositionText(t, row.disposition),
          defect_quantity: row.defect_quantity,
          defect_reason: row.defect_reason,
          downgrade_material_name: row.downgrade_material_name
            ? `${row.downgrade_material_code || ''} ${row.downgrade_material_name}`.trim()
            : '',
          status: getQualityNcLedgerStatusText(t, row.status),
          created_at: row.created_at || '',
        }));
        await downloadRecordsAsXlsx(
          exportRows,
          `${t('app.kuaizhizao.quality.nc.pageTitle')}_${todaySiteDateString()}.xlsx`,
          {
            columns: [
              { key: 'code', title: t('app.kuaizhizao.quality.nc.columns.ledgerCode') },
              { key: 'source_inspection', title: t('app.kuaizhizao.quality.nc.columns.sourceInspection') },
              { key: 'work_order_code', title: t('app.kuaizhizao.quality.common.columns.workOrderCode') },
              { key: 'operation_name', title: t('app.kuaizhizao.quality.common.columns.operationName') },
              { key: 'product_code', title: t('app.kuaizhizao.quality.common.columns.materialCode') },
              { key: 'product_name', title: t('app.kuaizhizao.quality.common.columns.materialName') },
              { key: 'defect_type', title: t('app.kuaizhizao.quality.nc.columns.defectType') },
              { key: 'disposition', title: t('app.kuaizhizao.quality.common.form.disposition') },
              { key: 'defect_quantity', title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty') },
              { key: 'defect_reason', title: t('app.kuaizhizao.quality.nc.columns.defectReason') },
              { key: 'downgrade_material_name', title: t('app.kuaizhizao.quality.nc.columns.downgradeMaterial') },
              { key: 'status', title: t('common.status') },
              { key: 'created_at', title: t('common.createdAt') },
            ],
          },
        );
        messageApi.success(t('common.exportCountSuccess', { count: toExport.length }));
      } catch (error: unknown) {
        const message =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: string }).message || '')
            : '';
        messageApi.error(message || t('common.exportFailed'));
      }
    },
    [messageApi, t],
  );

  const dispositionInitialValues = useMemo(() => {
    if (!currentRow) return undefined;
    return {
      disposition: currentRow.disposition,
      status: currentRow.status,
      downgrade_material_id: currentRow.downgrade_material_id,
      downgrade_warehouse_id: currentRow.downgrade_warehouse_id,
      attachments: mapAttachmentsToUploadList(currentRow.attachments),
    };
  }, [currentRow]);

  const batchMenuItems = useMemo(() => {
    const selected = resolveSelectedRows(selectedRowKeys);
    const updateTarget = selected.length === 1 ? selected[0] : null;
    const updateGates = updateTarget
      ? nonconformingLedgerRowGates(updateTarget, ncPerms, canStart8d, t)
      : null;
    const startableCount = selected.filter((row) => {
      const gates = nonconformingLedgerRowGates(row, ncPerms, canStart8d, t);
      return gates.start8d.allowed && !gates.start8d.disabled;
    }).length;
    return [
      {
        key: 'update-disposition',
        label: t('app.kuaizhizao.quality.nc.actions.updateDisposition'),
        disabled: !updateGates?.updateDisposition.allowed || Boolean(updateGates.updateDisposition.disabled),
        onClick: () => {
          if (!updateTarget) {
            messageApi.warning(t('app.kuaizhizao.quality.nc.messages.batchUpdateNeedOne'));
            return;
          }
          openDisposition(updateTarget);
        },
      },
      {
        key: 'start-8d',
        label: t('app.kuaizhizao.quality.nc.actions.start8d'),
        disabled: startableCount === 0,
        requireConfirm: true,
        confirmTitle: t('app.kuaizhizao.quality.nc.modal.start8dTitle'),
        confirmDescription: t('app.kuaizhizao.quality.nc.modal.batchStart8dContent', {
          count: startableCount,
        }),
        onClick: (keys: React.Key[]) => handleBatchStart8d(keys),
      },
    ];
  }, [canStart8d, handleBatchStart8d, messageApi, ncPerms, openDisposition, resolveSelectedRows, selectedRowKeys, t]);

  const columns: ProColumns<DefectLedgerItem>[] = useMemo(
    () => alignProColumns<DefectLedgerItem>([
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.status'),
        key: 'status_search',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: ncStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.defectType'),
        key: 'defect_type_search',
        dataIndex: 'defect_type',
        valueType: 'select',
        valueEnum: ncDefectTypeValueEnum,
        hideInTable: true,
        search: { order: 21 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.common.form.disposition'),
        key: 'disposition_search',
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
        minWidth: 150,
        uniTableKeepWidth: true,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      buildNcSourceInspectionStackedColumn<DefectLedgerItem>(t, navigate),
      stackedPrimarySecondaryColumn<DefectLedgerItem>(
        t('app.kuaizhizao.quality.nc.columns.operationWorkOrder'),
        'operation_work_order_stacked',
        ['operation_name', 'operationName'],
        ['work_order_code', 'workOrderCode'],
        { dataIndex: 'operation_name' },
      ),
      { title: t('app.kuaizhizao.quality.common.columns.workOrderCode'), dataIndex: 'work_order_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.common.columns.operationName'), dataIndex: 'operation_name', hideInTable: true },
      {
        title: t('app.kuaizhizao.quality.common.columns.material'),
        key: 'quality_inspection_material',
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
        title: t('app.kuaizhizao.quality.nc.columns.defectType'),
        key: 'nc_defect_type',
        dataIndex: 'defect_type',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => getQualityDefectTypeText(t, row.defect_type, row.defect_reason),
      },
      {
        title: t('app.kuaizhizao.quality.common.form.disposition'),
        dataIndex: 'disposition',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => renderQualityDispositionMarkerTag(t, row.disposition),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
        dataIndex: 'defect_quantity',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: (_, row) => renderUnqualifiedQuantity(row.defect_quantity),
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.defectReason'),
        dataIndex: 'defect_reason',
        minWidth: 200,
        uniTablePrimaryFlex: true,
        uniTablePrimaryFlexMaxWidth: 480,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.downgradeMaterial'),
        dataIndex: 'downgrade_material_name',
        width: 160,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) =>
          row.downgrade_material_name
            ? `${row.downgrade_material_code || ''} ${row.downgrade_material_name}`.trim()
            : '-',
      },
      {
        title: t('app.kuaizhizao.quality.nc.columns.otherInbound'),
        dataIndex: 'other_inbound_id',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_, row) => (row.other_inbound_id ? `#${row.other_inbound_id}` : '-'),
      },
      ...buildDocumentAuditColumns<DefectLedgerItem>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => renderNcLedgerStatusTag(t, row.status),
      },
      {
        title: t('common.actions'),
        key: 'action',
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) => {
          const gates = nonconformingLedgerRowGates(row, ncPerms, canStart8d, t);
          return (
            <Space>
              <Button
                key="detail"
                {...rowActionKind('read')}
                onClick={() => openDetail(row)}
              >
                {t('common.detail')}
              </Button>
              {gates.updateDisposition.allowed && (
                <Button
                  {...rowActionKind('execute')}
                  key="execute"
                  type="link"
                  disabled={gates.updateDisposition.disabled}
                  title={gates.updateDisposition.title}
                  onClick={() => openDisposition(row)}
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
    ], GLOBAL_DOC_LIST_FIELD_RANK),
    [t, ncPerms, canStart8d, navigate, ncStatusValueEnum, ncDefectTypeValueEnum, ncDispositionValueEnum, openDetail, openDisposition, handleStart8d],
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
          permissionResource={NC_RESOURCE}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.nonconforming-ledger-rank-v5"
          showAdvancedSearch
          pinnedTabsField={NC_LEDGER_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          onDetail={(keys) => {
            const row = resolveSelectedRows(keys)[0];
            if (!row) {
              messageApi.warning(t('app.kuaizhizao.quality.nc.messages.detailMissing'));
              return;
            }
            openDetail(row);
          }}
          showExportButton
          onExport={handleExport}
          toolBarActionsAfterDelete={[
            <UniBatchMenuButton
              key="nc-batch-actions"
              selectedRowKeys={selectedRowKeys}
              menuItems={batchMenuItems}
            />,
          ]}
          request={async (params, sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveNonconformingLedgerListParams(
              searchFormValues,
              sort,
              initialFilter,
            );
            lastListParamsRef.current = listParams;
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
          initialValues={dispositionInitialValues}
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
              status: values.disposition === 'downgrade' ? 'processed' : values.status,
              attachments: normalizeDocumentAttachments(values.attachments),
            });
            messageApi.success(t('app.kuaizhizao.quality.nc.messages.updateDispositionSuccess'));
            setOpen(false);
            setCurrentRow(null);
            actionRef.current?.reload();
            setDetailRefreshNonce((n) => n + 1);
          }}
        >
          <ProFormSelect
            name="disposition"
            label={t('app.kuaizhizao.quality.common.form.disposition')}
            valueEnum={getQualityDispositionValueEnum(t)}
            rules={[{ required: true }]}
          />
          <DowngradeDispositionFields />
          <ProFormSelect
            name="status"
            label={t('app.kuaizhizao.quality.nc.form.ledgerStatus')}
            valueEnum={getQualityNcLedgerStatusValueEnum(t)}
          />
          <ProFormTextArea name="remarks" label={t('common.remark')} />
          <DocumentAttachmentsField category="nonconforming_ledger_attachments" />
        </FormModalTemplate>

        <NonconformingLedgerDetailDrawer
          open={detailVisible}
          defectId={detailId}
          refreshNonce={detailRefreshNonce}
          ncPerms={ncPerms}
          canStart8d={canStart8d}
          onClose={() => {
            setDetailVisible(false);
            setDetailId(undefined);
          }}
          onUpdateDisposition={openDisposition}
          onStart8d={handleStart8d}
        />
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default NonconformingLedgerPage;

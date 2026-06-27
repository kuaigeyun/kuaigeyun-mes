import { rowActionKind } from '../../../../../components/uni-action';
import React, { useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDigit, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { MaterialStackedCell, UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS } from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  qualifiedQuantityColumnProps,
  stackedPrimarySecondaryColumn,
  unqualifiedQuantityColumnProps,
} from '../components/qualityTableColumns';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { OQCInspection, qualityImprovementApi } from '../../../services/quality-improvement';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import { pickInspectionConductExtras } from '../components/inspectionTemplateUtils';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import {
  fetchSalesDeliveriesForOqc,
  fetchShipmentNoticesForOqc,
} from '../components/inspectionCreateSourceUtils';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { oqcInspectionRowGates } from '../../../../../hooks/useDocumentCapabilities';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { useTranslation } from 'react-i18next';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import {
  getQualityInspectionResultValueEnum,
  getQualityQualityStatusValueEnum,
  getQualityReleaseDecisionValueEnum,
  renderReleaseDecisionTag,
} from '../components/qualityMeta';

const OQC_RESOURCE = 'kuaizhizao:quality-management-oqc-inspection';

const OQCInspectionPage: React.FC = () => {
  const { t } = useTranslation();
  const pullFromShipmentNoticeAction = resolveKuaizhizaoDocumentAction(t, 'oqc_inspection.pull_from_shipment_notice');
  const pullFromSalesDeliveryAction = resolveKuaizhizaoDocumentAction(t, 'oqc_inspection.pull_from_sales_delivery');
  const { message: messageApi } = App.useApp();
  const oqcPerms = useResourcePermissions(OQC_RESOURCE);
  const { canCreate, canUpdate } = oqcPerms;
  const oqcAuditEnabled = useAuditRequired('oqc_inspection', false);
  const oqcAuditColumn = useMemo(
    () => createListAuditPhaseColumn<OQCInspection>({ t, auditEnabled: oqcAuditEnabled }),
    [t, oqcAuditEnabled],
  );
  const actionRef = useRef<ActionType>(null);
  const conductFormRef = useRef<any>(null);
  const [conductVisible, setConductVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<OQCInspection | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  type PullSourceCandidate = { id: number; code: string };

  const pullFromShipmentNoticeQuery = useUniPullQuery<PullSourceCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const options = await fetchShipmentNoticesForOqc();
        const kw = keyword.trim().toLowerCase();
        const rows = options
          .map((it) => ({ id: Number(it.value), code: String(it.label || '') }))
          .filter((it) => (kw ? it.code.toLowerCase().includes(kw) : true));
        const start = (page - 1) * pageSize;
        return { data: rows.slice(start, start + pageSize), total: rows.length };
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.loadShipmentNoticeFailed'));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.oqc.messages.selectShipmentNotice'));
        return;
      }
      try {
        const created = await qualityImprovementApi.oqc.createFromShipmentNotice(selected.id);
        messageApi.success(t('app.kuaizhizao.quality.oqc.messages.createSuccess', { count: created.length }));
        pullFromShipmentNoticeQuery.closeModal();
        actionRef.current?.reload();
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.createFailed'));
      }
    },
  });

  const pullFromSalesDeliveryQuery = useUniPullQuery<PullSourceCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const options = await fetchSalesDeliveriesForOqc();
        const kw = keyword.trim().toLowerCase();
        const rows = options
          .map((it) => ({ id: Number(it.value), code: String(it.label || '') }))
          .filter((it) => (kw ? it.code.toLowerCase().includes(kw) : true));
        const start = (page - 1) * pageSize;
        return { data: rows.slice(start, start + pageSize), total: rows.length };
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.loadSalesDeliveryFailed'));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.oqc.messages.selectSalesDelivery'));
        return;
      }
      try {
        const created = await qualityImprovementApi.oqc.createFromSalesDelivery(selected.id);
        messageApi.success(t('app.kuaizhizao.quality.oqc.messages.createSuccess', { count: created.length }));
        pullFromSalesDeliveryQuery.closeModal();
        actionRef.current?.reload();
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.createFailed'));
      }
    },
  });

  const columns: ProColumns<OQCInspection>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
        dataIndex: 'inspection_code',
        width: 150,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }} ellipsis>
            {r.inspection_code ?? '-'}
          </Typography.Text>
        ),
      },
      stackedPrimarySecondaryColumn<OQCInspection>(
        t('app.kuaizhizao.quality.oqc.columns.shipmentNoticeSalesOrder'),
        'noticeSalesOrder',
        ['shipment_notice_code', 'shipmentNoticeCode'],
        ['sales_order_code', 'salesOrderCode'],
        { dataIndex: 'shipment_notice_code' },
      ),
      { title: t('app.kuaizhizao.quality.oqc.columns.shipmentNotice'), dataIndex: 'shipment_notice_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.salesOrder'), dataIndex: 'sales_order_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.customer'), dataIndex: 'customer_name', width: 140, ellipsis: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.sourceCode'), dataIndex: 'source_code', width: 130 },
      {
        title: t('app.kuaizhizao.quality.common.columns.material'),
        key: 'material',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, r) => (
          <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
        ),
      },
      { title: t('app.kuaizhizao.quality.common.columns.materialCode'), dataIndex: 'material_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name', hideInTable: true },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
        dataIndex: 'inspection_quantity',
        valueType: 'digit',
        width: 100,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'),
        dataIndex: 'qualified_quantity',
        ...qualifiedQuantityColumnProps,
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
        dataIndex: 'unqualified_quantity',
        ...unqualifiedQuantityColumnProps,
      },
      {
        title: t('app.kuaizhizao.quality.oqc.columns.releaseDecision'),
        dataIndex: 'release_decision',
        width: 100,
        render: (_, row) => renderReleaseDecisionTag(t, row.release_decision),
      },
      ...(oqcAuditColumn ? [oqcAuditColumn] : []),
      { title: t('app.kuaizhizao.quality.common.columns.status'), dataIndex: 'status', width: 90 },
      { title: t('app.kuaizhizao.quality.common.columns.createdAt'), dataIndex: 'created_at', valueType: 'dateTime', width: 170 },
      {
        title: t('app.kuaizhizao.quality.common.columns.actions'),
        valueType: 'option',
        width: 200,
        render: (_, row) => {
          const gates = oqcInspectionRowGates(row, oqcPerms, t);
          return (
          <Space>
            {gates.conduct.allowed && (
              <Button
                key="submit"
                {...rowActionKind('submit')}
                disabled={gates.conduct.disabled}
                title={gates.conduct.title}
                onClick={() => {
                  setCurrentRow(row);
                  setConductVisible(true);
                  setTimeout(
                    () =>
                      conductFormRef.current?.setFieldsValue({
                        inspection_result: row.inspection_result || '合格',
                        quality_status: row.quality_status || '合格',
                        release_decision: row.release_decision || 'pending',
                        qualified_quantity: row.qualified_quantity,
                        unqualified_quantity: row.unqualified_quantity,
                        attachments: mapAttachmentsToUploadList(row.attachments),
                      }),
                    50,
                  );
                }}
              >
                {t('app.kuaizhizao.quality.oqc.actions.conduct')}
              </Button>
            )}
            <UniWorkflowActions
              {...rowActionKind('skip')}
              key="wf"
              record={row}
              entityName={t('app.kuaizhizao.quality.common.entity.oqcInspection')}
              statusField="status"
              reviewStatusField="review_status"
              draftStatuses={[]}
              pendingStatuses={['待审核', '已检验']}
              approvedStatuses={['已审核']}
              rejectedStatuses={['已驳回']}
              theme="link"
              size="small"
              resourcePrefix={OQC_RESOURCE}
              onSuccess={() => actionRef.current?.reload()}
            />
          </Space>
          );
        },
      },
    ],
    [t, oqcPerms, oqcAuditColumn],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-oqc-inspection:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.oqc.permission.noReadAccess')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<OQCInspection>
          headerTitle={t('app.kuaizhizao.quality.oqc.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          permissionResource={OQC_RESOURCE}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.oqc-inspection"
          showExportButton
          onExport={async () => {
            try {
              const res = await qualityImprovementApi.oqc.export();
              const items = res.items || [];
              if (items.length === 0) {
                messageApi.warning(t('app.kuaizhizao.quality.common.messages.exportEmpty'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const exportDate = new Date().toISOString().slice(0, 10);
              a.download = `${t('app.kuaizhizao.quality.common.entity.oqcInspection')}_${exportDate}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.quality.common.messages.exportFailed'));
            }
          }}
          showDeleteButton
          onDelete={async (keys) => {
            try {
              for (const key of keys) {
                await qualityImprovementApi.oqc.delete(Number(key));
              }
              messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: keys.length }));
              setSelectedRowKeys([]);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.quality.common.messages.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.oqc.messages.deleteConfirm', { count })}
          deleteConfirmDescription={t('app.kuaizhizao.quality.oqc.messages.deleteConfirmDescription')}
          toolBarRender={() =>
            canCreate
              ? [
                  <Button
                    {...rowActionKind('create')}
                    key="from-notice"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={pullFromShipmentNoticeQuery.openModal}
                  >
                    {withSingleNewShortcutHint(pullFromShipmentNoticeAction.label)}
                  </Button>,
                  <Button
                    {...rowActionKind('create')}
                    key="from-delivery"
                    icon={<PlusOutlined />}
                    onClick={pullFromSalesDeliveryQuery.openModal}
                  >
                    {pullFromSalesDeliveryAction.label}
                  </Button>,
                ]
              : []
          }
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const result = await qualityImprovementApi.oqc.list({ skip, limit: pageSize, status: params.status });
            return {
              success: true,
              data: result?.items || [],
              total: result?.total || 0,
            };
          }}
        />

        <UniPullQueryModal<PullSourceCandidate>
          open={pullFromShipmentNoticeQuery.open}
          title={pullFromShipmentNoticeAction.label}
          onCancel={pullFromShipmentNoticeQuery.closeModal}
          onOk={pullFromShipmentNoticeQuery.handleConfirm}
          rowKey="id"
          columns={[{ title: t('app.kuaizhizao.quality.oqc.form.shipmentNotice'), dataIndex: 'code', ellipsis: true }]}
          dataSource={pullFromShipmentNoticeQuery.dataSource}
          loading={pullFromShipmentNoticeQuery.loading}
          confirmLoading={pullFromShipmentNoticeQuery.confirmLoading}
          selectionType={pullFromShipmentNoticeQuery.selectionType}
          selectedRowKeys={pullFromShipmentNoticeQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromShipmentNoticeQuery.handleSelectedRowKeysChange}
          searchDraft={pullFromShipmentNoticeQuery.searchDraft}
          onSearchDraftChange={pullFromShipmentNoticeQuery.setSearchDraft}
          onSearchApply={pullFromShipmentNoticeQuery.handleSearchApply}
          onSearchClear={pullFromShipmentNoticeQuery.handleSearchClear}
          appliedKeyword={pullFromShipmentNoticeQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.quality.oqc.form.shipmentNoticePlaceholder')}
          page={pullFromShipmentNoticeQuery.page}
          pageSize={pullFromShipmentNoticeQuery.pageSize}
          total={pullFromShipmentNoticeQuery.total}
          onPageChange={pullFromShipmentNoticeQuery.handlePageChange}
          okText={t('app.kuaizhizao.quality.oqc.actions.createFromSource')}
        />

        <UniPullQueryModal<PullSourceCandidate>
          open={pullFromSalesDeliveryQuery.open}
          title={pullFromSalesDeliveryAction.label}
          onCancel={pullFromSalesDeliveryQuery.closeModal}
          onOk={pullFromSalesDeliveryQuery.handleConfirm}
          rowKey="id"
          columns={[{ title: t('app.kuaizhizao.quality.oqc.form.salesDelivery'), dataIndex: 'code', ellipsis: true }]}
          dataSource={pullFromSalesDeliveryQuery.dataSource}
          loading={pullFromSalesDeliveryQuery.loading}
          confirmLoading={pullFromSalesDeliveryQuery.confirmLoading}
          selectionType={pullFromSalesDeliveryQuery.selectionType}
          selectedRowKeys={pullFromSalesDeliveryQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromSalesDeliveryQuery.handleSelectedRowKeysChange}
          searchDraft={pullFromSalesDeliveryQuery.searchDraft}
          onSearchDraftChange={pullFromSalesDeliveryQuery.setSearchDraft}
          onSearchApply={pullFromSalesDeliveryQuery.handleSearchApply}
          onSearchClear={pullFromSalesDeliveryQuery.handleSearchClear}
          appliedKeyword={pullFromSalesDeliveryQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.quality.oqc.form.salesDeliveryPlaceholder')}
          page={pullFromSalesDeliveryQuery.page}
          pageSize={pullFromSalesDeliveryQuery.pageSize}
          total={pullFromSalesDeliveryQuery.total}
          onPageChange={pullFromSalesDeliveryQuery.handlePageChange}
          okText={t('app.kuaizhizao.quality.oqc.actions.createFromSource')}
        />

        <FormModalTemplate
          title={t('app.kuaizhizao.quality.oqc.modal.conductTitle', { code: currentRow?.inspection_code || '' })}
          open={conductVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          formRef={conductFormRef}
          onClose={() => {
            setConductVisible(false);
            setCurrentRow(null);
            conductFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!currentRow?.id) return;
            if (!canUpdate) {
              messageApi.error(t('app.kuaizhizao.quality.oqc.messages.noConductPermission'));
              return false;
            }
            await qualityImprovementApi.oqc.conduct(currentRow.id, {
              ...values,
              attachments: normalizeDocumentAttachments(values.attachments),
              ...pickInspectionConductExtras(values),
            });
            messageApi.success(t('app.kuaizhizao.quality.oqc.messages.conductSuccess'));
            setConductVisible(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          <InspectionTemplateConductFields
            inspection={currentRow as Record<string, unknown>}
            photoCategory="oqc_inspection_attachments"
          />
          <ProFormSelect
            name="inspection_result"
            label={t('app.kuaizhizao.quality.common.columns.inspectionResult')}
            valueEnum={getQualityInspectionResultValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="quality_status"
            label={t('app.kuaizhizao.quality.common.columns.qualityStatus')}
            valueEnum={getQualityQualityStatusValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="qualified_quantity"
            label={t('app.kuaizhizao.quality.common.form.qualifiedQty')}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="unqualified_quantity"
            label={t('app.kuaizhizao.quality.common.form.unqualifiedQty')}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="release_decision"
            label={t('app.kuaizhizao.quality.oqc.columns.releaseDecision')}
            valueEnum={getQualityReleaseDecisionValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormTextArea name="release_note" label={t('app.kuaizhizao.quality.oqc.form.releaseNote')} />
          <DocumentAttachmentsField category="oqc_inspection_attachments" />
          <ProFormTextArea name="notes" label={t('app.kuaizhizao.quality.common.form.notes')} />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default OQCInspectionPage;

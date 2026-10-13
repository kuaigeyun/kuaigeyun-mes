/**
 * 委外检验列表（OSQC）
 * 以委外收货为来源取单；交互对齐出货检验取单模式。
 */
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Descriptions, Space } from 'antd';
import { DeleteOutlined, EyeOutlined, PlusOutlined, RollbackOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import {
  buildInspectorNameColumn,
  buildQualityInspectionListCodeColumn,
  buildQualityInspectionListKindColumn,
  buildQualityInspectionListMaterialColumn,
  buildQualityInspectionListMaterialHiddenColumns,
  buildQualityInspectionListNotesColumn,
  buildQualityInspectionListQuantityResultColumns,
  buildQualityInspectionPartnerStackedColumn,
} from '../components/qualityTableColumns';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { qualityApi } from '../../../services/quality-execution';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import {
  buildConductStepResultDefaults,
  getInspectionTemplateSource,
  hasInspectionPlanSteps,
  pickInspectionConductExtras,
} from '../components/inspectionTemplateUtils';
import {
  InspectionConductQuantityFields,
  normalizeInspectionConductPayload,
} from '../../../../../components/quantity-with-unit/inspectionConductQuantities';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useQualityStageCreateEnabled } from '../components/QualityMasterDataHint';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import {
  filterDeletableQualityInspectionRecords,
  filterRevokeConductQualityInspectionRecords,
} from '../components/qualityRevokeConduct';
import {
  buildQualityInspectionDocStatusValueEnum,
  buildQualityInspectionQualityStatusValueEnum,
  normalizeQualityInspectionListResponse,
  QUALITY_INSPECTION_PINNED_STATUS_FIELD,
  resolveQualityInspectionListParams,
} from '../../../utils/qualityInspectionListCore';
import {
  getQualityInspectionResultValueEnum,
  getQualityQualityStatusValueEnum,
  renderQualityDocStatusTag,
  renderQualityQualityStatusTag,
} from '../components/qualityMeta';
import type { QualityPullCandidateBase } from '../components/qualityPullQueryColumns';

type OutsourceInspectionRow = Record<string, any>;

type ReceiptPullCandidate = QualityPullCandidateBase & {
  code?: string;
  outsource_work_order_code?: string;
  supplier_name?: string;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  can_pull?: boolean;
};

const RESOURCE = 'kuaizhizao:quality-management-outsource-inspection';

const OutsourceInspectionPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<OutsourceInspectionRow[]>([]);
  const pullCloseRef = useRef<(() => void) | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<OutsourceInspectionRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [conductOpen, setConductOpen] = useState(false);
  const [conductRow, setConductRow] = useState<OutsourceInspectionRow | null>(null);
  const [conductSubmitting, setConductSubmitting] = useState(false);

  const osqcPerms = useResourcePermissions(RESOURCE);
  const { canRead, canCreate, canDelete, canExecute, canApprove } = osqcPerms;
  const { enabled: stageEnabled } = useQualityStageCreateEnabled('osqc');
  const osqcAuditEnabled = useAuditRequired('outsource_inspection', false);
  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is OutsourceInspectionRow => row != null),
    [selectedRowKeys],
  );
  const osqcAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('outsource_inspection'),
    [],
  );

  const reload = useCallback(() => actionRef.current?.reload?.(), []);

  const executeBatchRevokeConduct = useCallback(async () => {
    const targets = filterRevokeConductQualityInspectionRecords(selectedRecordsForBatch);
    if (!targets.length) {
      message.warning(t('app.kuaizhizao.quality.common.messages.revokeConductBatchEmpty'));
      return;
    }
    try {
      for (const row of targets) {
        await qualityApi.outsourceInspection.revokeConduct(row.id);
      }
      message.success(
        t('app.kuaizhizao.quality.common.messages.revokeConductBatchSuccess', {
          count: targets.length,
        }),
      );
      setSelectedRowKeys([]);
      reload();
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.quality.common.messages.revokeConductFailed'));
    }
  }, [message, reload, selectedRecordsForBatch, t]);

  const openDetail = useCallback(
    async (row: OutsourceInspectionRow) => {
      setDetailOpen(true);
      setDetailLoading(true);
      try {
        const detail = await qualityApi.outsourceInspection.get(row.id);
        setDetailRow(detail as OutsourceInspectionRow);
      } catch (e: any) {
        message.error(e?.message || t('common.loadFailed'));
        setDetailOpen(false);
      } finally {
        setDetailLoading(false);
      }
    },
    [message, t],
  );

  const isPullSelectable = useCallback((row: ReceiptPullCandidate) => row.can_pull !== false, []);

  const pullQueryScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromReceiptQuery = useUniPullQuery<ReceiptPullCandidate>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await qualityApi.outsourceInspection.listReceiptPullCandidates({
          skip: 0,
          limit: 100,
          keyword: keyword.trim() || undefined,
        });
        const rows = ((res as any)?.data || (res as any)?.items || []) as ReceiptPullCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (e: any) {
        message.error(e?.message || t('common.loadFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => !isPullSelectable(row),
    onConfirm: async (_keys, rows) => {
      const selectable = rows.filter(isPullSelectable);
      if (!selectable.length) {
        message.warning(
          t('app.kuaizhizao.quality.pullQuery.noSelectable', { defaultValue: '没有可拉取的单据' }),
        );
        return;
      }
      let created = 0;
      for (const row of selectable) {
        const res = await qualityApi.outsourceInspection.createFromReceipt(row.id);
        const list = Array.isArray(res) ? res : (res as any)?.data ?? [];
        created += Array.isArray(list) ? list.length : 1;
      }
      message.success(
        t('app.kuaizhizao.quality.pullQuery.createdCount', {
          count: created,
          defaultValue: `已创建 ${created} 张检验单`,
        }),
      );
      pullCloseRef.current?.();
      reload();
    },
  });
  pullCloseRef.current = pullFromReceiptQuery.closeModal;

  const receiptPullColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.quality.pullQuery.receiptCode', { defaultValue: '收货单号' }),
        dataIndex: 'code',
      },
      {
        title: t('app.kuaizhizao.quality.common.workOrder', { defaultValue: '委外工单' }),
        dataIndex: 'outsource_work_order_code',
      },
      {
        title: t('app.kuaizhizao.quality.common.supplier', { defaultValue: '供应商' }),
        dataIndex: 'supplier_name',
      },
      {
        title: t('app.kuaizhizao.quality.common.material', { defaultValue: '物料' }),
        dataIndex: 'material_code',
        render: (_: unknown, r: ReceiptPullCandidate) =>
          `${r.material_code || ''} ${r.material_name || ''}`.trim(),
      },
      {
        title: t('app.kuaizhizao.quality.common.quantity', { defaultValue: '数量' }),
        dataIndex: 'quantity',
      },
    ],
    [t],
  );

  const auditCol = useMemo(
    () => createListAuditPhaseColumn<OutsourceInspectionRow>({ t, auditEnabled: true }),
    [t],
  );

  const columns = useMemo(() => {
    const cols: ProColumns<OutsourceInspectionRow>[] = [
      buildQualityInspectionListCodeColumn(t),
      buildQualityInspectionListKindColumn(t),
      buildQualityInspectionPartnerStackedColumn(
        t('app.kuaizhizao.quality.common.supplier', { defaultValue: '供应商' }),
        ['supplier_name'],
        ['outsource_receipt_code'],
      ),
      buildQualityInspectionListMaterialColumn(t),
      ...buildQualityInspectionListMaterialHiddenColumns(t),
      ...buildQualityInspectionListQuantityResultColumns(t),
      buildInspectorNameColumn(
        t('app.kuaizhizao.quality.common.inspector', { defaultValue: '检验员' }),
      ),
      auditCol,
      {
        ...QUALITY_INSPECTION_PINNED_STATUS_FIELD,
        title: t('app.kuaizhizao.quality.common.docStatus', { defaultValue: '单据状态' }),
        dataIndex: 'status',
        valueEnum: buildQualityInspectionDocStatusValueEnum(t),
        render: (_, row) => renderQualityDocStatusTag(t, row.status),
      },
      {
        title: t('app.kuaizhizao.quality.common.qualityStatus', { defaultValue: '质量状态' }),
        dataIndex: 'quality_status',
        valueEnum: buildQualityInspectionQualityStatusValueEnum(t),
        search: false,
        render: (_, row) => renderQualityQualityStatusTag(t, row.quality_status),
      },
      buildQualityInspectionListNotesColumn(t),
      ...buildDocumentAuditColumns(t),
      {
        title: t('common.action'),
        valueType: 'option',
        key: 'option',
        fixed: 'right',
        render: (_, row) => {
          const caps = row.capabilities || {};
          const actions: React.ReactNode[] = [
            <Button
              key="view"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(row)}
            >
              {t('common.detail')}
            </Button>,
          ];
          if (canExecute && caps.conduct?.allowed !== false) {
            actions.push(
              <Button
                key="conduct"
                {...rowActionKind('execute')}
                type="link"
                size="small"
                onClick={() => {
                  setConductRow(row);
                  setConductOpen(true);
                }}
              >
                {t('app.kuaizhizao.quality.common.conduct', { defaultValue: '检验' })}
              </Button>,
            );
          }
          if (canApprove && caps.approve?.allowed) {
            actions.push(
              <ActionConfirmPopconfirm
                key="approve"
                title={t('app.kuaizhizao.quality.common.approveConfirm', {
                  defaultValue: '确认审核通过？',
                })}
                onConfirm={async () => {
                  await qualityApi.outsourceInspection.approve(row.id, { approve: true });
                  message.success(t('common.success'));
                  reload();
                }}
              >
                <Button type="link" size="small">
                  {t('common.approve', { defaultValue: '审核' })}
                </Button>
              </ActionConfirmPopconfirm>,
            );
          }
          if (canDelete && caps.delete?.allowed !== false) {
            actions.push(
              <ActionConfirmPopconfirm
                key="delete"
                title={t('common.deleteConfirm')}
                onConfirm={async () => {
                  await qualityApi.outsourceInspection.delete(row.id);
                  message.success(t('common.deleteSuccess'));
                  reload();
                }}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  {t('common.delete')}
                </Button>
              </ActionConfirmPopconfirm>,
            );
          }
          return <Space size={0}>{actions}</Space>;
        },
      },
    ];
    return alignProColumns(cols, SALES_DOC_LIST_FIELD_RANK);
  }, [t, auditCol, openDetail, canExecute, canApprove, canDelete, message, reload]);

  const handleConductSubmit = async (values: Record<string, any>) => {
    if (!conductRow?.id) return;
    setConductSubmitting(true);
    try {
      const normalized = await normalizeInspectionConductPayload(values, {
        materialId: conductRow.material_id,
        materialUnit: conductRow.material_unit,
        scenario: 'purchase',
      });
      const extras = pickInspectionConductExtras(values);
      await qualityApi.outsourceInspection.conduct(conductRow.id, {
        ...normalized,
        ...extras,
        inspection_result: values.inspection_result || values.quality_status,
        quality_status: values.quality_status,
      });
      message.success(t('common.success'));
      setConductOpen(false);
      setConductRow(null);
      reload();
    } finally {
      setConductSubmitting(false);
    }
  };

  if (!canRead) {
    return (
      <ListPageTemplate>
        <PermissionGuard resource={RESOURCE} action="read" />
      </ListPageTemplate>
    );
  }

  const templateSource = conductRow ? getInspectionTemplateSource(conductRow) : null;
  const pullLabel = t('app.kuaizhizao.quality.outsource.pullFromReceipt', {
    defaultValue: '从委外收货取单',
  });

  return (
    <ListPageTemplate>
      <UniTable<OutsourceInspectionRow>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        columnPersistenceId="kuaizhizao-outsource-inspection-v2"
        permissionResource={RESOURCE}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        showAdvancedSearch
        pinnedTabsField={QUALITY_INSPECTION_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        showCreateButton={false}
        toolBarActionsBeforeCreate={
          canCreate && stageEnabled
            ? [
                <Button
                  key="pull"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => pullFromReceiptQuery.openModal()}
                >
                  {withSingleNewShortcutHint(pullLabel)}
                </Button>,
              ]
            : []
        }
        showDeleteButton={!!canDelete}
        onDelete={async () => {
          try {
            const deletable = filterDeletableQualityInspectionRecords(selectedRecordsForBatch);
            if (!deletable.length) {
              message.warning(t('app.kuaizhizao.quality.common.messages.deleteBatchEmpty'));
              return;
            }
            for (const row of deletable) {
              await qualityApi.outsourceInspection.delete(row.id);
            }
            message.success(
              t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: deletable.length }),
            );
            setSelectedRowKeys([]);
            if (detailRow?.id != null && deletable.some((r) => String(r.id) === String(detailRow.id))) {
              setDetailOpen(false);
              setDetailRow(null);
            }
            reload();
          } catch (e: any) {
            message.error(e?.message || t('common.deleteFailed'));
          }
        }}
        deleteConfirmTitle={(count) =>
          t('app.kuaizhizao.quality.outsource.messages.deleteConfirm', { count })
        }
        toolBarActionsAfterDelete={[
          <ActionConfirmPopconfirm
            key="revoke-conduct-batch"
            title={t('app.kuaizhizao.quality.common.actions.revokeConductConfirmTitle')}
            description={t('app.kuaizhizao.quality.common.messages.revokeConductBatchConfirm', {
              count: filterRevokeConductQualityInspectionRecords(selectedRecordsForBatch).length,
            })}
            onConfirm={() => executeBatchRevokeConduct()}
          >
            <Button icon={<RollbackOutlined />} onClick={(e) => e.stopPropagation()}>
              {t('app.kuaizhizao.quality.common.actions.revokeConduct')}
            </Button>
          </ActionConfirmPopconfirm>,
          <UniAuditBatchMenuButton
            key="outsource-inspection-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedRecordsForBatch}
            auditEnabled={osqcAuditEnabled}
            permGates={osqcPerms}
            handlers={osqcAuditBatchHandlers}
            onSuccess={() => {
              setSelectedRowKeys([]);
              reload();
            }}
            toolBarButtonSize="middle"
          />,
        ]}
        request={async (params, sort) => {
          const q = resolveQualityInspectionListParams(params, sort);
          const res = await qualityApi.outsourceInspection.list(q);
          return normalizeQualityInspectionListResponse(res);
        }}
        onRow={(row) => ({
          onDoubleClick: () => openDetail(row),
        })}
      />

      <UniPullQueryModal<ReceiptPullCandidate>
        open={pullFromReceiptQuery.open}
        title={t('app.kuaizhizao.quality.outsource.pullFromReceipt', {
          defaultValue: '从委外收货取单',
        })}
        onCancel={pullFromReceiptQuery.closeModal}
        onOk={pullFromReceiptQuery.handleConfirm}
        rowKey="id"
        columns={receiptPullColumns}
        dataSource={pullFromReceiptQuery.dataSource}
        loading={pullFromReceiptQuery.loading}
        confirmLoading={pullFromReceiptQuery.confirmLoading}
        selectionType={pullFromReceiptQuery.selectionType}
        selectedRowKeys={pullFromReceiptQuery.selectedRowKeys}
        selectedRows={pullFromReceiptQuery.selectedRows}
        onSelectedRowKeysChange={pullFromReceiptQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromReceiptQuery.isRowDisabled}
        searchDraft={pullFromReceiptQuery.searchDraft}
        onSearchDraftChange={pullFromReceiptQuery.setSearchDraft}
        onSearchApply={pullFromReceiptQuery.handleSearchApply}
        onSearchClear={pullFromReceiptQuery.handleSearchClear}
        appliedKeyword={pullFromReceiptQuery.appliedKeyword}
        page={pullFromReceiptQuery.page}
        pageSize={pullFromReceiptQuery.pageSize}
        total={pullFromReceiptQuery.total}
        onPageChange={pullFromReceiptQuery.handlePageChange}
        scopeOptions={pullFromReceiptQuery.scopeOptions}
        scope={pullFromReceiptQuery.scope}
        onScopeChange={pullFromReceiptQuery.handleScopeChange}
      />

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.quality.outsource.modal.detailTitle', {
          code: detailRow?.inspection_code || '',
        })}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRow(null);
        }}
        size={DRAWER_CONFIG.HALF_WIDTH}
        loading={detailLoading && !detailRow}
        basic={
          detailRow ? (
            <Descriptions column={2} size="small">
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.columns.inspectionCode')}>
                {detailRow.inspection_code}
              </Descriptions.Item>
              <Descriptions.Item
                label={t('app.kuaizhizao.quality.pullQuery.receiptCode', { defaultValue: '收货单号' })}
              >
                {detailRow.outsource_receipt_code || '-'}
              </Descriptions.Item>
              <Descriptions.Item
                label={t('app.kuaizhizao.quality.common.supplier', { defaultValue: '供应商' })}
              >
                {detailRow.supplier_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item
                label={t('app.kuaizhizao.quality.common.material', { defaultValue: '物料' })}
              >
                {`${detailRow.material_code || ''} ${detailRow.material_name || ''}`.trim()}
              </Descriptions.Item>
              <Descriptions.Item
                label={t('app.kuaizhizao.quality.common.quantity', { defaultValue: '检验数量' })}
              >
                {detailRow.inspection_quantity}
              </Descriptions.Item>
              <Descriptions.Item
                label={t('app.kuaizhizao.quality.common.qualityStatus', { defaultValue: '质量状态' })}
              >
                {detailRow.quality_status || '-'}
              </Descriptions.Item>
              <Descriptions.Item
                label={t('app.kuaizhizao.quality.common.docStatus', { defaultValue: '单据状态' })}
              >
                {detailRow.status || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.remark')} span={2}>
                {detailRow.notes || '-'}
              </Descriptions.Item>
            </Descriptions>
          ) : null
        }
      />

      <FormModalTemplate
        open={conductOpen}
        title={
          conductRow?.inspection_code
            ? t('app.kuaizhizao.quality.outsource.modal.conductTitle', {
                code: conductRow.inspection_code,
              })
            : t('app.kuaizhizao.quality.common.conduct', { defaultValue: '执行检验' })
        }
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        onOpenChange={(open) => {
          if (!open) {
            setConductOpen(false);
            setConductRow(null);
          }
        }}
        onFinish={handleConductSubmit}
        submitter={{
          submitButtonProps: { loading: conductSubmitting },
        }}
        initialValues={{
          quality_status: '合格',
          inspection_result: '合格',
          qualified_quantity: conductRow?.inspection_quantity,
          unqualified_quantity: 0,
          ...(conductRow && hasInspectionPlanSteps(conductRow)
            ? buildConductStepResultDefaults(templateSource)
            : {}),
        }}
      >
        {conductRow ? (
          <>
            <InspectionConductQuantityFields
              t={t}
              scenario="purchase"
              materialId={conductRow.material_id}
              materialUnit={conductRow.material_unit}
              inspectionQuantity={Number(conductRow.inspection_quantity || 0)}
              inspection={conductRow}
            />
            <ProFormSelect
              name="quality_status"
              label={t('app.kuaizhizao.quality.common.qualityStatus', { defaultValue: '质量状态' })}
              valueEnum={getQualityQualityStatusValueEnum(t)}
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="inspection_result"
              label={t('app.kuaizhizao.quality.common.inspectionResult', { defaultValue: '检验结果' })}
              valueEnum={getQualityInspectionResultValueEnum(t)}
              rules={[{ required: true }]}
            />
            {hasInspectionPlanSteps(conductRow) ? (
              <InspectionTemplateConductFields templateSource={templateSource} />
            ) : null}
            <ProFormTextArea name="notes" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </>
        ) : null}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default OutsourceInspectionPage;

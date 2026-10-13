/**
 * 质量巡检列表
 * 无强制来源；工具栏新建：物料 + 检验数量，可选批次/工单/车间产线工位/方案。
 */
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormInstance,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Form, Row, Space } from 'antd';
import { DeleteOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import {
  buildInspectorNameColumn,
  buildQualityInspectionListCodeColumn,
  buildQualityInspectionListKindColumn,
  buildQualityInspectionListMaterialColumn,
  buildQualityInspectionListMaterialHiddenColumns,
  buildQualityInspectionListNotesColumn,
  buildQualityInspectionListQuantityResultColumns,
} from '../components/qualityTableColumns';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates/constants';
import { qualityApi } from '../../../services/quality-execution';
import { inspectionPlanApi, unwrapInspectionPlanList } from '../../../services/production';
import InspectionPlanFormModal from '../../../components/InspectionPlanFormModal';
import EquipmentFactoryBindingFields from '../../../components/EquipmentFactoryBindingFields';
import { operationApi, unwrapProcessPagedList } from '../../../../master-data/services/process';
import { workOrderApi } from '../../../services/work-order';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import {
  buildConductStepResultDefaults,
  getInspectionTemplateSource,
  hasInspectionPlanSteps,
  pickInspectionConductExtras,
} from '../components/inspectionTemplateUtils';
import { renderQualityInspectionPlanSummary } from '../components/QualityInspectionDetailSupplement';
import {
  InspectionConductQuantityFields,
  normalizeInspectionConductPayload,
} from '../../../../../components/quantity-with-unit/inspectionConductQuantities';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
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
  renderQualityDocStatusTag,
  renderQualityQualityStatusTag,
} from '../components/qualityMeta';

type QualityPatrolRow = Record<string, any>;

type DropdownOption = { label: string; value: number; meta?: Record<string, unknown> };

const RESOURCE = 'kuaizhizao:quality-management-quality-patrol';

function pickOptionMeta(option: DropdownOption | DropdownOption[] | undefined): Record<string, unknown> | undefined {
  const selected = Array.isArray(option) ? option[0] : option;
  return selected?.meta;
}

const QualityPatrolPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<QualityPatrolRow[]>([]);
  const createFormRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<QualityPatrolRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [conductOpen, setConductOpen] = useState(false);
  const [conductRow, setConductRow] = useState<QualityPatrolRow | null>(null);
  const [conductSubmitting, setConductSubmitting] = useState(false);
  const [patrolPlanOptions, setPatrolPlanOptions] = useState<DropdownOption[]>([]);
  const [operationOptions, setOperationOptions] = useState<DropdownOption[]>([]);
  const [workOrderOptions, setWorkOrderOptions] = useState<DropdownOption[]>([]);
  const [quickPlanModalOpen, setQuickPlanModalOpen] = useState(false);

  const patrolPerms = useResourcePermissions(RESOURCE);
  const { canRead, canCreate, canDelete, canExecute, canApprove } = patrolPerms;
  const patrolAuditEnabled = useAuditRequired('quality_patrol', false);
  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is QualityPatrolRow => row != null),
    [selectedRowKeys],
  );
  const patrolAuditBatchHandlers = useMemo(() => createUniAuditBatchHandlers('quality_patrol'), []);

  const reload = useCallback(() => actionRef.current?.reload?.(), []);

  const reloadPatrolPlanOptions = useCallback(async () => {
    const res = await inspectionPlanApi.list({
      plan_type: 'patrol',
      is_active: true,
      skip: 0,
      limit: 200,
    });
    const items = unwrapInspectionPlanList(res) as Array<{
      id?: number;
      plan_code?: string;
      plan_name?: string;
    }>;
    setPatrolPlanOptions(
      items
        .filter((p) => p.id != null && Number(p.id) > 0)
        .map((p) => ({
          value: Number(p.id),
          label: `${p.plan_name || p.plan_code || p.id}${p.plan_code ? ` (${p.plan_code})` : ''}`,
          meta: { plan_code: p.plan_code, plan_name: p.plan_name },
        })),
    );
  }, []);

  const loadOperationOptions = useCallback(async () => {
    const list = unwrapProcessPagedList(await operationApi.list({ isActive: true, limit: 500 }));
    setOperationOptions(
      list.map((op) => ({
        label: `${op.code || op.uuid} - ${op.name}`,
        value: Number(op.id),
        meta: { code: op.code, name: op.name },
      })),
    );
  }, []);

  const loadWorkOrderOptions = useCallback(async (keyword?: string) => {
    const res: any = await workOrderApi.list({
      keyword: keyword?.trim() || undefined,
      limit: 50,
    });
    const items = Array.isArray(res?.items) ? res.items : Array.isArray(res?.data) ? res.data : [];
    setWorkOrderOptions(
      items
        .filter((wo: { id?: number }) => wo?.id != null)
        .map((wo: { id: number; code?: string; product_name?: string }) => ({
          value: Number(wo.id),
          label: `${wo.code || wo.id}${wo.product_name ? ` ${wo.product_name}` : ''}`,
          meta: { code: wo.code, name: wo.product_name },
        })),
    );
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    void reloadPatrolPlanOptions().catch(() => setPatrolPlanOptions([]));
    void loadOperationOptions().catch(() => setOperationOptions([]));
    void loadWorkOrderOptions().catch(() => setWorkOrderOptions([]));
  }, [createOpen, loadOperationOptions, loadWorkOrderOptions, reloadPatrolPlanOptions]);

  const executeBatchRevokeConduct = useCallback(async () => {
    const targets = filterRevokeConductQualityInspectionRecords(selectedRecordsForBatch);
    if (!targets.length) {
      message.warning(t('app.kuaizhizao.quality.common.messages.revokeConductBatchEmpty'));
      return;
    }
    try {
      for (const row of targets) {
        await qualityApi.qualityPatrol.revokeConduct(row.id);
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
    async (row: QualityPatrolRow) => {
      setDetailOpen(true);
      setDetailLoading(true);
      try {
        const detail = await qualityApi.qualityPatrol.get(row.id);
        setDetailRow(detail as QualityPatrolRow);
      } catch (e: any) {
        message.error(e?.message || t('common.loadFailed'));
        setDetailOpen(false);
      } finally {
        setDetailLoading(false);
      }
    },
    [message, t],
  );

  const auditCol = useMemo(
    () => createListAuditPhaseColumn<QualityPatrolRow>({ t, auditEnabled: patrolAuditEnabled }),
    [t, patrolAuditEnabled],
  );

  const columns = useMemo(() => {
    const cols: ProColumns<QualityPatrolRow>[] = [
      buildQualityInspectionListCodeColumn(t),
      buildQualityInspectionListKindColumn(t),
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionKind'),
        key: 'inspection_plan_summary',
        search: false,
        render: (_, row) => renderQualityInspectionPlanSummary(row as Record<string, unknown>, t),
      },
      buildQualityInspectionListMaterialColumn(t),
      ...buildQualityInspectionListMaterialHiddenColumns(t),
      {
        title: t('app.kuaizhizao.quality.patrol.workshop', { defaultValue: '车间' }),
        dataIndex: 'workshop_name',
        search: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.quality.patrol.productionLine', { defaultValue: '产线' }),
        dataIndex: 'production_line_name',
        search: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.quality.patrol.workstation', { defaultValue: '工位' }),
        dataIndex: 'workstation_name',
        search: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.quality.common.workOrder', { defaultValue: '工单' }),
        dataIndex: 'work_order_code',
        search: false,
        ellipsis: true,
      },
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
          if (canExecute && caps.revoke_conduct?.allowed) {
            actions.push(
              <ActionConfirmPopconfirm
                key="revoke-conduct"
                title={t('app.kuaizhizao.quality.common.actions.revokeConductConfirmTitle')}
                description={t('app.kuaizhizao.quality.common.actions.revokeConductConfirmContent', {
                  code: row.inspection_code || row.id,
                })}
                onConfirm={async () => {
                  await qualityApi.qualityPatrol.revokeConduct(row.id);
                  message.success(t('app.kuaizhizao.quality.common.messages.revokeConductSuccess'));
                  reload();
                }}
              >
                <Button
                  type="link"
                  size="small"
                  icon={<RollbackOutlined />}
                  disabled={caps.revoke_conduct?.disabled}
                  title={caps.revoke_conduct?.title}
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('app.kuaizhizao.quality.common.actions.revokeConduct')}
                </Button>
              </ActionConfirmPopconfirm>,
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
                  await qualityApi.qualityPatrol.approve(row.id, { approve: true });
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
                  await qualityApi.qualityPatrol.delete(row.id);
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

  const handleCreate = async (values: Record<string, any>) => {
    setCreateSubmitting(true);
    try {
      const planId = values.inspection_plan_id != null ? Number(values.inspection_plan_id) : undefined;
      await qualityApi.qualityPatrol.create({
        material_id: Number(values.material_id),
        material_code: values.material_code,
        material_name: values.material_name,
        material_unit: values.material_unit,
        inspection_quantity: Number(values.inspection_quantity || 0),
        batch_number: values.batch_number || undefined,
        inspection_plan_id: planId && planId > 0 ? planId : undefined,
        workshop_id: values.workshop_id != null ? Number(values.workshop_id) : undefined,
        workshop_name: values.workshop_name || undefined,
        production_line_id:
          values.production_line_id != null ? Number(values.production_line_id) : undefined,
        production_line_name: values.production_line_name || undefined,
        workstation_id: values.workstation_id != null ? Number(values.workstation_id) : undefined,
        workstation_name: values.workstation_name || undefined,
        operation_id: values.operation_id != null ? Number(values.operation_id) : undefined,
        operation_name: values.operation_name || undefined,
        work_order_id: values.work_order_id != null ? Number(values.work_order_id) : undefined,
        work_order_code: values.work_order_code || undefined,
        notes: values.notes || undefined,
      });
      message.success(t('common.createSuccess'));
      setCreateOpen(false);
      createFormRef.current?.resetFields();
      reload();
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleConductSubmit = async (values: Record<string, any>) => {
    if (!conductRow?.id) return;
    setConductSubmitting(true);
    try {
      const normalized = await normalizeInspectionConductPayload(values, {
        materialId: conductRow.material_id,
        materialUnit: conductRow.material_unit,
        scenario: 'production',
      });
      const extras = pickInspectionConductExtras(values);
      await qualityApi.qualityPatrol.conduct(conductRow.id, {
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

  const handleQuickPlanSuccess = useCallback(
    (plan: { id?: number; plan_code?: string; plan_name?: string }) => {
      const newId = Number(plan?.id);
      if (!(newId > 0)) return;
      const label = `${plan.plan_name || plan.plan_code || newId}${
        plan.plan_code ? ` (${plan.plan_code})` : ''
      }`;
      setPatrolPlanOptions((prev) => {
        if (prev.some((o) => o.value === newId)) return prev;
        return [{ value: newId, label, meta: { plan_code: plan.plan_code, plan_name: plan.plan_name } }, ...prev];
      });
      createFormRef.current?.setFieldsValue({ inspection_plan_id: newId });
      setQuickPlanModalOpen(false);
      void reloadPatrolPlanOptions().catch(() => undefined);
    },
    [reloadPatrolPlanOptions],
  );

  if (!canRead) {
    return (
      <ListPageTemplate>
        <PermissionGuard resource={RESOURCE} action="read" />
      </ListPageTemplate>
    );
  }

  const createLabel = t('app.kuaizhizao.quality.patrol.createButton', {
    defaultValue: '新建质量巡检',
  });
  const createModalZIndex = 1000;
  const nestedModalZIndex = createModalZIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET;

  return (
    <ListPageTemplate>
      <UniTable<QualityPatrolRow>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        columnPersistenceId="kuaizhizao-quality-patrol-v2"
        permissionResource={RESOURCE}
        search={{ labelWidth: 'auto' }}
        form={{ syncToUrl: false }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        dateFormatter="string"
        showCreateButton={!!canCreate}
        createButtonText={withSingleNewShortcutHint(createLabel)}
        onCreate={() => setCreateOpen(true)}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showAdvancedSearch
        pinnedTabsField={QUALITY_INSPECTION_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        showDeleteButton={!!canDelete}
        onDelete={async () => {
          try {
            const deletable = filterDeletableQualityInspectionRecords(selectedRecordsForBatch);
            if (!deletable.length) {
              message.warning(t('app.kuaizhizao.quality.common.messages.deleteBatchEmpty'));
              return;
            }
            for (const row of deletable) {
              await qualityApi.qualityPatrol.delete(row.id);
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
          t('app.kuaizhizao.quality.patrol.messages.deleteConfirm', {
            defaultValue: `确认删除选中的 ${count} 条质量巡检单？`,
            count,
          })
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
            key="quality-patrol-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedRecordsForBatch}
            auditEnabled={patrolAuditEnabled}
            permGates={patrolPerms}
            handlers={patrolAuditBatchHandlers}
            onSuccess={() => {
              setSelectedRowKeys([]);
              reload();
            }}
            toolBarButtonSize="middle"
          />,
        ]}
        request={async (params, sort) => {
          const query = resolveQualityInspectionListParams(params, sort);
          const res = await qualityApi.qualityPatrol.list(query);
          return normalizeQualityInspectionListResponse(res);
        }}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        onRow={(row) => ({
          onDoubleClick: () => openDetail(row),
        })}
      />

      <FormModalTemplate
        title={createLabel}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          createFormRef.current?.resetFields();
        }}
        onFinish={handleCreate}
        isEdit={false}
        formRef={createFormRef as React.RefObject<ProFormInstance>}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        grid={false}
        loading={createSubmitting}
        zIndex={createModalZIndex}
      >
        <Row gutter={16}>
          <Col span={12}>
            <UniMaterialSelect
              name="material_id"
              label={t('app.kuaizhizao.quality.common.material', { defaultValue: '物料' })}
              required
              fillMapping={{
                material_code: 'mainCode',
                material_name: 'name',
                material_unit: 'baseUnit',
              }}
              showQuickCreate
              showAdvancedSearch
            />
            <Form.Item name="material_code" hidden />
            <Form.Item name="material_name" hidden />
            <Form.Item name="material_unit" hidden />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="inspection_quantity"
              label={t('app.kuaizhizao.quality.common.label.inspectionQty', { defaultValue: '检验数量' })}
              rules={[{ required: true, message: t('common.required') }]}
              min={0.0001}
              fieldProps={{ precision: 4, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <Form.Item
              name="inspection_plan_id"
              label={t('app.kuaizhizao.quality.patrol.form.inspectionPlan', { defaultValue: '质检方案' })}
            >
              <UniDropdown
                allowClear
                showSearch
                style={{ width: '100%' }}
                placeholder={t('app.kuaizhizao.quality.incoming.form.selectInspectionPlan')}
                options={patrolPlanOptions}
                optionFilterProp="label"
                quickCreate={{
                  label: t('field.operation.quickAddInspectionPlan'),
                  onClick: () => setQuickPlanModalOpen(true),
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <ProFormText
              name="batch_number"
              label={t('app.kuaizhizao.quality.common.batch', { defaultValue: '批次号' })}
            />
          </Col>
          <EquipmentFactoryBindingFields
            formRef={createFormRef}
            embedInParentRow
            zIndex={nestedModalZIndex}
          />
          <Col span={12}>
            <Form.Item
              name="operation_id"
              label={t('app.kuaizhizao.quality.patrol.form.operation', { defaultValue: '工序' })}
            >
              <UniDropdown
                allowClear
                showSearch
                style={{ width: '100%' }}
                placeholder={t('app.kuaizhizao.quality.patrol.form.selectOperation', {
                  defaultValue: '请选择工序',
                })}
                options={operationOptions}
                optionFilterProp="label"
                onChange={(_value: number | undefined, option: DropdownOption | DropdownOption[]) => {
                  const meta = pickOptionMeta(option);
                  createFormRef.current?.setFieldsValue({
                    operation_name: meta?.name ?? null,
                  });
                }}
              />
            </Form.Item>
            <Form.Item name="operation_name" hidden />
          </Col>
          <Col span={12}>
            <Form.Item
              name="work_order_id"
              label={t('app.kuaizhizao.quality.common.workOrder', { defaultValue: '工单' })}
            >
              <UniDropdown
                allowClear
                showSearch
                filterOption={false}
                style={{ width: '100%' }}
                placeholder={t('app.kuaizhizao.quality.patrol.form.selectWorkOrder', {
                  defaultValue: '搜索工单编号',
                })}
                options={workOrderOptions}
                onSearch={(kw) => {
                  void loadWorkOrderOptions(kw).catch(() => setWorkOrderOptions([]));
                }}
                onChange={(_value: number | undefined, option: DropdownOption | DropdownOption[]) => {
                  const meta = pickOptionMeta(option);
                  createFormRef.current?.setFieldsValue({
                    work_order_code: meta?.code ?? null,
                  });
                }}
              />
            </Form.Item>
            <Form.Item name="work_order_code" hidden />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="notes"
              label={t('app.kuaizhizao.quality.common.form.notes', { defaultValue: '备注' })}
              fieldProps={{ rows: 2 }}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      <InspectionPlanFormModal
        open={quickPlanModalOpen}
        zIndex={nestedModalZIndex}
        defaultPlanType="patrol"
        lockPlanType
        onClose={() => setQuickPlanModalOpen(false)}
        onSuccess={handleQuickPlanSuccess}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.quality.common.conduct', { defaultValue: '检验' })}
        open={conductOpen}
        onClose={() => {
          setConductOpen(false);
          setConductRow(null);
        }}
        onFinish={handleConductSubmit}
        isEdit={false}
        width={
          hasInspectionPlanSteps(getInspectionTemplateSource(conductRow as Record<string, unknown>))
            ? MODAL_CONFIG.LARGE_WIDTH
            : MODAL_CONFIG.STANDARD_WIDTH
        }
        grid
        loading={conductSubmitting}
        initialValues={{
          qualified_quantity: conductRow?.inspection_quantity || 0,
          unqualified_quantity: 0,
          notes: '',
          conduct_step_results: buildConductStepResultDefaults(
            (conductRow || {}) as Record<string, unknown>,
          ),
        }}
      >
        {conductRow ? (
          <>
            <InspectionTemplateConductFields
              inspection={conductRow as Record<string, unknown>}
              photoCategory="quality_patrol_attachments"
            />
            <InspectionConductQuantityFields
              t={t}
              scenario="production"
              materialId={conductRow.material_id}
              materialUnit={conductRow.material_unit}
              inspectionQuantity={Number(conductRow.inspection_quantity || 0)}
              inspection={conductRow}
            />
            <ProFormTextArea
              name="notes"
              label={t('app.kuaizhizao.quality.common.form.notes', { defaultValue: '备注' })}
              fieldProps={{ rows: 2 }}
              colProps={{ span: 24 }}
            />
          </>
        ) : null}
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRow(null);
        }}
        title={detailRow?.inspection_code || t('app.kuaizhizao.menu.quality-management.quality-patrol')}
        width={DRAWER_CONFIG.HALF_WIDTH}
        loading={detailLoading}
        basic={
          detailRow ? (
            <Descriptions column={2} size="small">
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.code', { defaultValue: '单号' })}>
                {detailRow.inspection_code}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.material', { defaultValue: '物料' })}>
                {`${detailRow.material_code || ''} ${detailRow.material_name || ''}`.trim()}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.label.inspectionQty', { defaultValue: '检验数量' })}>
                {detailRow.inspection_quantity}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.batch', { defaultValue: '批次号' })}>
                {detailRow.batch_number || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.columns.inspectionKind')}>
                {renderQualityInspectionPlanSummary(detailRow as Record<string, unknown>, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.docStatus', { defaultValue: '单据状态' })}>
                {renderQualityDocStatusTag(t, detailRow.status)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.patrol.workshop', { defaultValue: '车间' })}>
                {detailRow.workshop_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.patrol.productionLine', { defaultValue: '产线' })}>
                {detailRow.production_line_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.patrol.workstation', { defaultValue: '工位' })}>
                {detailRow.workstation_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.patrol.form.operation', { defaultValue: '工序' })}>
                {detailRow.operation_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.workOrder', { defaultValue: '工单' })}>
                {detailRow.work_order_code || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.quality.common.form.notes', { defaultValue: '备注' })} span={2}>
                {detailRow.notes || '—'}
              </Descriptions.Item>
            </Descriptions>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default QualityPatrolPage;

/**
 * 质检方案管理页面
 *
 * 提供质检方案的 CRUD 功能，包括列表、新建、编辑、详情。
 * 支持检验步骤的拖拽排序、添加、删除。
 *
 * @author RiverEdge Team
 * @date 2026-02-26
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProFormItem,
  ProFormSwitch,
  ProFormDependency,
} from '@ant-design/pro-components';
import CodeField from '../../../../../components/code-field';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { App, Button, Space, Table, Modal, Row, Col, Descriptions, Typography, Empty, Result } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { stackedPrimarySecondaryColumn } from '../components/qualityTableColumns';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  useDetailDrawerDescriptionItems,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { inspectionPlanApi } from '../../../services/production';
import { InspectionPlanStepEditor, type InspectionPlanStepItem } from '../../../components/InspectionPlanStepEditor';
import { InspectionSamplingTypeTag, InspectionValueTypeTag } from '../../../components/inspectionStepTableBadges';
import { formatAcceptanceCriteriaPreview, normalizeValueType, bumpPlanVersion, stepsFingerprint } from '../../../types/inspectionStepSpec';
import { valueTypeOptions } from '../../../components/InspectionStepValueSpecFields';
import { useTranslation } from 'react-i18next';
import { getQualityPlanTypeFallback, getQualityTypeText } from '../components/qualityMeta';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  buildInspectionPlanActiveValueEnum,
  buildInspectionPlanTypeValueEnum,
  INSPECTION_PLAN_PINNED_STATUS_FIELD,
  normalizeQualityImprovementListResponse,
  resolveInspectionPlanListParams,
} from '../../../utils/qualityImprovementListCore';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import {
  alignDescriptionColumns,
  alignProColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
  SALES_DOC_LIST_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { renderMasterActiveTag } from '../../../../master-data/utils/masterListPresentation';
import { buildDetailDrawerEditExtra } from '../../equipment-management/shared/equipmentMasterDataDetail';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
interface InspectionPlan {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  plan_code?: string;
  plan_name?: string;
  plan_type?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  operation_id?: number;
  version?: string;
  is_active?: boolean;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  steps?: InspectionPlanStepItem[];
}

const InspectionPlansPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const planTypeOptions = useMemo(() => getQualityPlanTypeFallback(t), [t]);
  const planTypeValueEnum = useMemo(() => buildInspectionPlanTypeValueEnum(t), [t]);
  const planActiveValueEnum = useMemo(() => buildInspectionPlanActiveValueEnum(t), [t]);
  const stepValueTypeLabels = useMemo(() => {
    return Object.fromEntries(valueTypeOptions(t).map((o) => [o.value, o.label]));
  }, [t]);

  /** 当 URL 含 operationId 时，自动打开新建弹窗（仅首次） */
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    const operationId = searchParams.get('operationId');
    if (operationId) {
      hasAutoOpenedRef.current = true;
      setIsEdit(false);
      setCurrentPlan(null);
      setSteps([]);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.resetFields();
        formRef.current?.setFieldsValue({
          plan_type: 'process',
          operation_id: parseInt(operationId, 10) || operationId,
        });
      }, 100);
    }
  }, [searchParams]);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<InspectionPlan | null>(null);
  const [steps, setSteps] = useState<InspectionPlanStepItem[]>([]);
  const [stepsBaseline, setStepsBaseline] = useState('');
  const formRef = useRef<any>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [planDetail, setPlanDetail] = useState<InspectionPlan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailPlanId, setDetailPlanId] = useState<number | null>(null);

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号。支持 URL 参数 operationId 预填过程检验 */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentPlan(null);
    setSteps([]);
    setModalVisible(true);
    const operationId = searchParams.get('operationId');
    setTimeout(() => {
      formRef.current?.resetFields();
      if (operationId) {
        formRef.current?.setFieldsValue({
          plan_type: 'process',
          operation_id: parseInt(operationId, 10) || operationId,
        });
      }
    }, 0);
  };
  useNewShortcut(() => {
    void handleCreate();
  });
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.quality.plans.createButton')),
    [t],
  );

  const handleEdit = async (record: InspectionPlan) => {
    try {
      const detail = await inspectionPlanApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentPlan(detail);
      const stepItems: InspectionPlanStepItem[] = (detail.steps || []).map((s: any) => ({
        sequence: s.sequence ?? 0,
        step_key: s.step_key,
        inspection_item: s.inspection_item || '',
        inspection_method: s.inspection_method,
        acceptance_criteria: s.acceptance_criteria,
        value_type: s.value_type,
        value_spec: s.value_spec,
        sampling_type: (s.sampling_type as 'full' | 'sampling') || 'full',
        quality_standard_id: s.quality_standard_id,
        remarks: s.remarks,
      }));
      setSteps(stepItems);
      setStepsBaseline(stepsFingerprint(stepItems));
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          plan_code: detail.plan_code,
          plan_name: detail.plan_name,
          plan_type: detail.plan_type,
          version: detail.version,
          is_active: detail.is_active,
          remarks: detail.remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.quality.plans.messages.loadDetailFailed'));
    }
  };

  const loadPlanDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await inspectionPlanApi.get(id.toString());
      setPlanDetail(detail);
    } catch (error: any) {
      setDetailError(error?.message || t('app.kuaizhizao.quality.plans.messages.loadDetailFailed'));
      setPlanDetail((prev) => (prev?.id === id ? prev : null));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetail = (record: InspectionPlan) => {
    if (record.id == null) return;
    setDetailPlanId(record.id);
    setDrawerVisible(true);
    setPlanDetail((prev) => (prev?.id === record.id ? prev : null));
    void loadPlanDetail(record.id);
  };

  const handleDelete = async (record: InspectionPlan) => {
    try {
      await inspectionPlanApi.delete(record.id!.toString());
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const submitPlan = async (values: any) => {
    const planCode = typeof values.plan_code === 'string' ? values.plan_code.trim() : values.plan_code;
    const submitData = {
      ...values,
      plan_code: planCode,
      material_id: null,
      material_code: null,
      material_name: null,
      steps: steps.map((s, i) => ({ ...s, sequence: i })),
    };

    if (isEdit && currentPlan?.id) {
      await inspectionPlanApi.update(currentPlan.id.toString(), submitData);
      messageApi.success(t('app.kuaizhizao.quality.plans.messages.updateSuccess'));
    } else {
      await inspectionPlanApi.create(submitData);
      messageApi.success(t('app.kuaizhizao.quality.plans.messages.createSuccess'));
    }
    setModalVisible(false);
    setCurrentPlan(null);
    setSteps([]);
    setStepsBaseline('');
    formRef.current?.resetFields();
    actionRef.current?.reload();
  };

  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const stepsChanged = isEdit && stepsFingerprint(steps) !== stepsBaseline;
      if (stepsChanged) {
        const nextVersion = bumpPlanVersion(values.version || currentPlan?.version);
        getAntdModal().confirm({
          title: t('app.kuaizhizao.quality.plans.versionBump.title'),
          content: t('app.kuaizhizao.quality.plans.versionBump.content', {
            from: values.version || currentPlan?.version || '1.0',
            to: nextVersion,
          }),
          okText: t('app.kuaizhizao.quality.plans.versionBump.confirm'),
          cancelText: t('common.cancel'),
          onOk: async () => {
            await submitPlan({ ...values, version: nextVersion });
          },
        });
        return;
      }
      await submitPlan(values);
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  const planTypeLabel = (planType: string | undefined) => getQualityTypeText(t, planType);

  const detailBaseColumns: ProDescriptionsItemProps<InspectionPlan>[] = useMemo(
    () =>
      alignDescriptionColumns(
        [
          {
            title: t('app.kuaizhizao.quality.plans.columns.planCode'),
            dataIndex: 'plan_code',
            render: (_, r) => (
              <Typography.Text copyable={{ text: String(r.plan_code ?? '') }}>{r.plan_code ?? '-'}</Typography.Text>
            ),
          },
          { title: t('app.kuaizhizao.quality.plans.columns.planName'), dataIndex: 'plan_name' },
          {
            title: t('app.kuaizhizao.quality.plans.columns.planType'),
            dataIndex: 'plan_type',
            render: (_, r) => getQualityTypeText(t, r?.plan_type),
          },
          { title: t('app.kuaizhizao.quality.plans.columns.version'), dataIndex: 'version' },
          {
            title: t('common.status'),
            dataIndex: 'is_active',
            render: (_, r) =>
              r
                ? renderMasterActiveTag(
                    t,
                    r.is_active,
                    'common.enabled',
                    'app.kuaizhizao.quality.plans.active.disabled',
                  )
                : '-',
          },
          {
            title: t('common.remark'),
            dataIndex: 'remarks',
            span: 2,
            render: (val) => val || '-',
          },
        ],
        MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
      ),
    [t],
  );

  const columns: ProColumns<InspectionPlan>[] = useMemo(
    () => alignProColumns<InspectionPlan>([
      {
        title: t('app.kuaizhizao.quality.plans.columns.planCode'),
        dataIndex: 'plan_code',
        hideInTable: true,
        order: 10,
        fieldProps: { allowClear: true },
      },
      {
        title: t('app.kuaizhizao.quality.plans.columns.planName'),
        dataIndex: 'plan_name',
        hideInTable: true,
        order: 11,
        fieldProps: { allowClear: true },
      },
      {
        ...stackedPrimarySecondaryColumn<InspectionPlan>(
          t('app.kuaizhizao.quality.plans.columns.planStacked'),
          'planStacked',
          ['plan_name', 'planName'],
          ['plan_code', 'planCode'],
          { dataIndex: 'plan_name', fixed: 'left' },
        ),
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.quality.plans.columns.planType'),
        dataIndex: 'plan_type',
        hideInTable: true,
        order: 20,
        valueType: 'select',
        valueEnum: planTypeValueEnum,
        fieldProps: {
          showSearch: true,
          allowClear: true,
          options: planTypeOptions,
        },
      },
      {
        title: t('app.kuaizhizao.quality.plans.columns.planType'),
        dataIndex: 'plan_type',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => {
          if (!record) return '-';
          return planTypeLabel(record.plan_type);
        },
      },
      {
        title: t('app.kuaizhizao.quality.plans.columns.version'),
        dataIndex: 'version',
        width: 80,
        sorter: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<InspectionPlan>(t),
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 30,
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 31,
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        hideInTable: true,
        order: 21,
        valueType: 'select',
        valueEnum: planActiveValueEnum,
        fieldProps: { allowClear: true },
      },
      {
        title: t('common.status'),
        dataIndex: 'is_active',
        width: 88,
        sorter: true,
        fixed: 'right',
        align: 'center',
        hideInSearch: true,
        valueEnum: planActiveValueEnum,
        render: (_, record) =>
          renderMasterActiveTag(
            t,
            record.is_active,
            'common.enabled',
            'app.kuaizhizao.quality.plans.active.disabled',
          ),
      },
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <Space size="small" wrap>
            <Button
              {...rowActionKind('read')}
              onClick={(e) => {
                e.stopPropagation();
                void handleDetail(record);
              }}
            >
              {t('common.detail')}
            </Button>
            <Button
              {...rowActionKind('update')}
              onClick={(e) => {
                e.stopPropagation();
                void handleEdit(record);
              }}
            >
              {t('common.edit')}
            </Button>
            <Button
              {...rowActionKind('delete')}
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(record);
              }}
            >
              {t('common.delete')}
            </Button>
          </Space>
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [planActiveValueEnum, planTypeOptions, planTypeValueEnum, t],
  );

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBaseColumns, planDetail
  );

  return (
    <ListPageTemplate>
      <UniTable<InspectionPlan>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.inspectionPlans')}
        headerTitle={t('app.kuaizhizao.quality.plans.pageTitle')}
        columnPersistenceId="apps.kuaizhizao.pages.quality-management.inspection-plans"
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pinnedTabsField={INSPECTION_PLAN_PINNED_STATUS_FIELD}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveInspectionPlanListParams(searchFormValues, sort);
            const response = await inspectionPlanApi.list({
              skip,
              limit: pageSize,
              ...listParams,
            });
            const { data, total } = normalizeQualityImprovementListResponse(response);
            return { data: data as InspectionPlan[], success: true, total };
          } catch {
            messageApi.error(t('app.kuaizhizao.quality.plans.messages.loadListFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
        showCreateButton
        createButtonText={createButtonLabel}
        onCreate={handleCreate}
        enableRowSelection={true}
        onRowSelectionChange={setSelectedRowKeys}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            const ids = keys.map(Number);
            for (const id of keys) {
              await inspectionPlanApi.delete(String(id));
            }
            messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: keys.length }));
            setSelectedRowKeys([]);
            if (planDetail?.id != null && ids.includes(planDetail.id)) {
              setDrawerVisible(false);
              setPlanDetail(null);
              setDetailError(null);
              setDetailPlanId(null);
            }
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || t('common.deleteFailed'));
          }
        }}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.plans.messages.deleteConfirm', { count })}
      />

      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.quality.plans.modal.editTitle') : t('app.kuaizhizao.quality.plans.modal.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentPlan(null);
          setSteps([]);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        className="inspection-plan-modal"
        grid={false}
      >
        <ProFormItem name="operation_id" hidden>
          <input type="hidden" />
        </ProFormItem>
        <Row gutter={16}>
          <ProFormDependency name={['plan_type']}>
            {({ plan_type }) => (
              <Col span={12}>
                <CodeField
                  pageCode="kuaizhizao-quality-inspection-plan"
                  name="plan_code"
                  label={t('app.kuaizhizao.quality.plans.form.planCode')}
                  required
                  autoGenerateOnCreate={!isEdit}
                  showGenerateButton={false}
                  disabled={isEdit}
                  context={{
                    plan_type: plan_type || '',
                  }}
                />
              </Col>
            )}
          </ProFormDependency>
          <Col span={12}>
            <ProFormText
              name="plan_name"
              label={t('app.kuaizhizao.quality.plans.form.planName')}
              rules={[{ required: true, message: t('app.kuaizhizao.quality.plans.validation.requiredPlanName') }]}
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.enterPlanName')}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem
              name="plan_type"
              label={t('app.kuaizhizao.quality.plans.form.planType')}
              extra={t('app.kuaizhizao.quality.plans.form.planTypeHint')}
              rules={[{ required: true, message: t('app.kuaizhizao.quality.plans.validation.requiredPlanType') }]}
            >
              <UniDropdown
                placeholder={t('app.kuaizhizao.quality.plans.placeholder.selectPlanType')}
                showSearch
                allowClear
                options={planTypeOptions}
                style={{ width: '100%' }}
              />
            </ProFormItem>
          </Col>
          <Col span={12}>
            <ProFormText
              name="version"
              label={t('app.kuaizhizao.quality.plans.form.version')}
              initialValue="1.0"
              extra={t('app.kuaizhizao.quality.plans.form.versionHint')}
            />
          </Col>
        </Row>

        <ProFormItem label={t('app.kuaizhizao.quality.plans.form.steps')} style={{ width: '100%' }}>
          <InspectionPlanStepEditor value={steps} onChange={setSteps} disabled={false} />
        </ProFormItem>

        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="remarks"
              label={t('common.remark')}
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.optional')}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSwitch name="is_active" label={t('app.kuaizhizao.quality.plans.form.isActive')} initialValue={true} />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.quality.plans.modal.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setPlanDetail(null);
          setDetailError(null);
          setDetailPlanId(null);
        }}
        loading={detailLoading && !planDetail}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        extra={
          planDetail
            ? buildDetailDrawerEditExtra(t, true, () => {
                setDrawerVisible(false);
                void handleEdit(planDetail);
              })
            : null
        }
        plainBody={
          detailError && !planDetail && !detailLoading ? (
            <Result
              status="error"
              title={detailError}
              extra={
                detailPlanId != null ? (
                  <Button type="primary" onClick={() => void loadPlanDetail(detailPlanId)}>
                    {t('common.retry', { defaultValue: '重试' })}
                  </Button>
                ) : null
              }
            />
          ) : undefined
        }
        basic={
          planDetail ? (
            <Descriptions
              column={2}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : detailError && !detailLoading ? null : (
            <div style={{ minHeight: 80 }} />
          )
        }
        linesTitle={t('app.kuaizhizao.quality.common.sections.detailInfo')}
        lines={
          planDetail ? (
            planDetail.steps && planDetail.steps.length > 0 ? (
              <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                <Table
                  style={{ minWidth: 720 }}
                  dataSource={planDetail.steps}
                  rowKey={(_, i) => `step-${i}`}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: t('app.kuaizhizao.quality.plans.step.sequence'),
                      key: 'index',
                      width: 60,
                      render: (_, __, i) => i + 1,
                    },
                    { title: t('app.kuaizhizao.quality.plans.step.inspectionItem'), dataIndex: 'inspection_item' },
                    {
                      title: t('app.kuaizhizao.quality.plans.stepSpec.valueType'),
                      dataIndex: 'value_type',
                      width: 96,
                      render: (v: string) => (
                        <InspectionValueTypeTag
                          valueType={v}
                          label={stepValueTypeLabels[normalizeValueType(v)] || v}
                        />
                      ),
                    },
                    { title: t('app.kuaizhizao.quality.plans.step.inspectionMethod'), dataIndex: 'inspection_method', width: 120 },
                    {
                      title: t('app.kuaizhizao.quality.plans.step.acceptanceCriteria'),
                      dataIndex: 'acceptance_criteria',
                      width: 150,
                      ellipsis: true,
                      render: (v: string, row: InspectionPlanStepItem) =>
                        v ||
                        formatAcceptanceCriteriaPreview(row.value_type || 'boolean', row.value_spec, t) ||
                        '-',
                    },
                    {
                      title: t('app.kuaizhizao.quality.plans.step.samplingType'),
                      dataIndex: 'sampling_type',
                      width: 90,
                      render: (v: string) => <InspectionSamplingTypeTag samplingType={v} t={t} />,
                    },
                  ]}
                />
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.quality.plans.detail.noSteps')} />
            )
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default InspectionPlansPage;

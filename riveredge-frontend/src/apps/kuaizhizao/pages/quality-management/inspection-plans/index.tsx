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
import type { DescriptionsProps } from 'antd';
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
import { App, Button, Tag, Space, Table, Modal, Row, Col, Descriptions, Typography, Empty } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { stackedPrimarySecondaryColumn } from '../components/qualityTableColumns';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { inspectionPlanApi } from '../../../services/production';
import { InspectionPlanStepEditor, type InspectionPlanStepItem } from '../../../components/InspectionPlanStepEditor';
import { InspectionSamplingTypeTag, InspectionValueTypeTag } from '../../../components/inspectionStepTableBadges';
import { formatAcceptanceCriteriaPreview, normalizeValueType, bumpPlanVersion, stepsFingerprint } from '../../../types/inspectionStepSpec';
import { valueTypeOptions } from '../../../components/InspectionStepValueSpecFields';
import { countWithPagedRequests } from '../../../../../utils/pagedCount';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getQualityPlanTypeFallback, getQualityTypeText } from '../components/qualityMeta';
import { formatDateTime } from '../../../../../utils/format';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderPlanActiveStatus(t: (key: string) => string, isActive?: boolean): React.ReactNode {
  return (
    <Tag color={isActive ? 'success' : 'default'}>
      {isActive ? t('app.kuaizhizao.quality.plans.active.enabled') : t('app.kuaizhizao.quality.plans.active.disabled')}
    </Tag>
  );
}

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

  const handleDetail = async (record: InspectionPlan) => {
    try {
      const detail = await inspectionPlanApi.get(record.id!.toString());
      setPlanDetail(detail);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.quality.plans.messages.loadDetailFailed'));
    }
  };

  const handleDelete = async (record: InspectionPlan) => {
    try {
      await inspectionPlanApi.delete(record.id!.toString());
      messageApi.success(t('app.kuaizhizao.quality.plans.messages.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.quality.common.messages.deleteFailed'));
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
        Modal.confirm({
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
      messageApi.error(error.message || t('app.kuaizhizao.quality.plans.messages.operationFailed'));
      throw error;
    }
  };

  const planTypeLabel = (planType: string | undefined) => getQualityTypeText(t, planType);

  const detailBaseColumns: ProDescriptionsItemProps<InspectionPlan>[] = useMemo(
    () => [
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
        render: (_, r) => planTypeLabel(r?.plan_type),
      },
      { title: t('app.kuaizhizao.quality.plans.columns.version'), dataIndex: 'version' },
      {
        title: t('app.kuaizhizao.quality.common.columns.status'),
        dataIndex: 'is_active',
        render: (_, r) => (r ? renderPlanActiveStatus(t, r.is_active) : '-'),
      },
      { title: t('app.kuaizhizao.quality.common.form.remarks'), dataIndex: 'remarks', span: 2, render: (val) => val || '-' },
    ],
    [t],
  );

  const columns: ProColumns<InspectionPlan>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.quality.plans.columns.planCode'),
        dataIndex: 'plan_code',
        hideInTable: true,
      },
      stackedPrimarySecondaryColumn<InspectionPlan>(
        t('app.kuaizhizao.quality.plans.columns.planStacked'),
        'planStacked',
        ['plan_name', 'planName'],
        ['plan_code', 'planCode'],
        { dataIndex: 'plan_name', fixed: 'left' },
      ),
      { title: t('app.kuaizhizao.quality.plans.columns.planName'), dataIndex: 'plan_name', hideInTable: true, ellipsis: true },
      {
        title: t('app.kuaizhizao.quality.plans.columns.planType'),
        dataIndex: 'plan_type',
        width: 100,
        render: (_, record) => {
          if (!record) return '-';
          return planTypeLabel(record.plan_type);
        },
      },
      { title: t('app.kuaizhizao.quality.plans.columns.version'), dataIndex: 'version', width: 80 },
      {
        title: t('app.kuaizhizao.quality.common.columns.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        defaultSortOrder: 'descend',
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.status'),
        dataIndex: 'is_active',
        width: 88,
        fixed: 'right',
        align: 'center',
        valueEnum: {
          true: { text: t('app.kuaizhizao.quality.plans.active.enabled'), status: 'Success' },
          false: { text: t('app.kuaizhizao.quality.plans.active.disabled'), status: 'Default' },
        },
        render: (_, record) => renderPlanActiveStatus(t, record.is_active),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.actions'),
        key: 'action',
        width: 200,
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
              {t('app.kuaizhizao.quality.common.actions.detail')}
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
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<InspectionPlan>
        headerTitle={t('app.kuaizhizao.quality.plans.pageTitle')}
        columnPersistenceId="apps.kuaizhizao.pages.quality-management.inspection-plans"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params: any) => {
          try {
            const filters = {
              plan_type: params.plan_type,
              is_active: params.is_active,
              plan_code: params.plan_code,
              plan_name: params.plan_name,
              keyword: params.keyword,
            };
            const [response, total] = await Promise.all([
              inspectionPlanApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...filters,
              }),
              countWithPagedRequests(
                (p) => inspectionPlanApi.list(p),
                filters,
                { chunkSize: 100 },
              ),
            ]);
            const data = Array.isArray(response) ? response : response?.data || [];
            return { data, success: true, total };
          } catch (error) {
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
            }
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || t('app.kuaizhizao.quality.common.messages.deleteFailed'));
          }
        }}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.plans.messages.deleteConfirm', { count })}
        scroll={{ x: 1600 }}
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
              label={t('app.kuaizhizao.quality.common.form.remarks')}
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
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        customContent={
          planDetail ? (
            <>
              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.basicInfo')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(planDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.detailInfo')}>
                {planDetail.steps && planDetail.steps.length > 0 ? (
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
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.operationLog')}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.quality.common.empty.noActivityLog')} />
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default InspectionPlansPage;

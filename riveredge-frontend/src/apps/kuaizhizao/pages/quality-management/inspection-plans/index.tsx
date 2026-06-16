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
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProFormItem,
  ProFormSwitch,
} from '@ant-design/pro-components';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { App, Button, Tag, Space, Card, Table, Modal, Row, Col, Descriptions, Typography, Empty } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { stackedPrimarySecondaryColumn } from '../components/qualityTableColumns';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import type { LifecycleResult } from '../../../../../components/uni-lifecycle/types';
import { inspectionPlanApi } from '../../../services/production';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { InspectionPlanStepEditor, type InspectionPlanStepItem } from '../../../components/InspectionPlanStepEditor';
import { countWithPagedRequests } from '../../../../../utils/pagedCount';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getQualityPlanTypeFallback, getQualityTypeText } from '../components/qualityMeta';

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
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

function getInspectionPlanLifecycle(t: (key: string) => string, record: InspectionPlan | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const active = record.is_active === true;
  return {
    percent: active ? 100 : 35,
    stageName: active ? t('app.kuaizhizao.quality.plans.lifecycle.active') : t('app.kuaizhizao.quality.plans.lifecycle.inactive'),
    status: active ? 'success' : 'normal',
    mainStages: [
      { key: 'maintain', label: t('app.kuaizhizao.quality.plans.lifecycle.maintain'), status: 'done' },
      {
        key: 'active',
        label: active ? t('app.kuaizhizao.quality.plans.lifecycle.active') : t('app.kuaizhizao.quality.plans.lifecycle.inactive'),
        status: 'active',
      },
    ],
    subStages: [],
    nextStepSuggestions: active ? [] : [t('app.kuaizhizao.quality.plans.lifecycle.enableSuggestion')],
  };
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
  attachments?: Array<{ uid?: string; name?: string; url?: string; status?: string }>;
  created_at?: string;
  updated_at?: string;
  steps?: InspectionPlanStepItem[];
}

const InspectionPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const planTypeFallback = useMemo(() => getQualityPlanTypeFallback(t), [t]);
  const [planTypeOptions, setPlanTypeOptions] = useState<Array<{ label: string; value: string }>>(planTypeFallback);
  const [planTypeLoading, setPlanTypeLoading] = useState(false);

  useEffect(() => {
    setPlanTypeOptions(planTypeFallback);
  }, [planTypeFallback]);

  useEffect(() => {
    const load = async () => {
      setPlanTypeLoading(true);
      try {
        const dictList = await getDataDictionaryList({ code: 'INSPECTION_PLAN_TYPE', page: 1, page_size: 1 });
        const dict = dictList.items?.[0];
        if (!dict) {
          setPlanTypeOptions(planTypeFallback);
          return;
        }
        const items = await getDictionaryItemList(dict.uuid, true);
        setPlanTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setPlanTypeOptions(planTypeFallback);
      } finally {
        setPlanTypeLoading(false);
      }
    };
    load();
  }, [planTypeFallback]);

  /** 当 URL 含 materialId 或 operationId 时，自动打开新建弹窗（仅首次） */
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    const materialId = searchParams.get('materialId');
    const operationId = searchParams.get('operationId');
    if (materialId || operationId) {
      hasAutoOpenedRef.current = true;
      setIsEdit(false);
      setCurrentPlan(null);
      setSteps([]);
      setModalVisible(true);
      const prefill: Record<string, any> = {};
      if (operationId) {
        prefill.plan_type = 'process';
        prefill.operation_id = parseInt(operationId, 10) || operationId;
      }
      if (materialId) {
        const mid = parseInt(materialId, 10);
        if (!isNaN(mid)) prefill.material_id = mid;
      }
      setTimeout(() => {
        formRef.current?.resetFields();
        if (Object.keys(prefill).length > 0) {
          formRef.current?.setFieldsValue(prefill);
        }
      }, 100);
    }
  }, [searchParams]);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<InspectionPlan | null>(null);
  const [steps, setSteps] = useState<InspectionPlanStepItem[]>([]);
  const formRef = useRef<any>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [planDetail, setPlanDetail] = useState<InspectionPlan | null>(null);

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号。支持 URL 参数 materialId/operationId 预填 */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentPlan(null);
    setSteps([]);
    setModalVisible(true);
    const materialId = searchParams.get('materialId');
    const operationId = searchParams.get('operationId');
    setTimeout(() => {
      formRef.current?.resetFields();
      const prefill: Record<string, any> = {};
      if (operationId) {
        prefill.plan_type = 'process';
        prefill.operation_id = parseInt(operationId, 10) || operationId;
      }
      if (materialId) {
        const mid = parseInt(materialId, 10);
        if (!isNaN(mid)) {
          prefill.material_id = mid;
        }
      }
      if (Object.keys(prefill).length > 0) {
        formRef.current?.setFieldsValue(prefill);
      }
    }, 0);
  };

  const handleEdit = async (record: InspectionPlan) => {
    try {
      const detail = await inspectionPlanApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentPlan(detail);
      const stepItems: InspectionPlanStepItem[] = (detail.steps || []).map((s: any) => ({
        sequence: s.sequence ?? 0,
        inspection_item: s.inspection_item || '',
        inspection_method: s.inspection_method,
        acceptance_criteria: s.acceptance_criteria,
        sampling_type: (s.sampling_type as 'full' | 'sampling') || 'full',
        quality_standard_id: s.quality_standard_id,
        remarks: s.remarks,
      }));
      setSteps(stepItems);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          plan_code: detail.plan_code,
          plan_name: detail.plan_name,
          plan_type: detail.plan_type,
          material_id: detail.material_id,
          material_code: detail.material_code,
          material_name: detail.material_name,
          version: detail.version,
          is_active: detail.is_active,
          remarks: detail.remarks,
          attachments: mapAttachmentsToUploadList(detail.attachments),
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

  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        attachments: normalizeDocumentAttachments(values.attachments),
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
      formRef.current?.resetFields();
      actionRef.current?.reload();
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
      {
        title: t('app.kuaizhizao.quality.plans.columns.applicableMaterialCode'),
        dataIndex: 'material_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.material_code ?? '') }}>{r.material_code || '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.quality.plans.columns.applicableMaterial'), dataIndex: 'material_name', render: (val) => val || '-' },
      { title: t('app.kuaizhizao.quality.plans.columns.version'), dataIndex: 'version' },
      {
        title: t('app.kuaizhizao.quality.plans.columns.activeStatus'),
        dataIndex: 'is_active',
        render: (_, r) =>
          r ? (
            <Tag color={r.is_active ? 'success' : 'default'}>
              {r.is_active ? t('app.kuaizhizao.quality.plans.active.enabled') : t('app.kuaizhizao.quality.plans.active.disabled')}
            </Tag>
          ) : (
            '-'
          ),
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
      {
        title: t('app.kuaizhizao.quality.plans.columns.applicableMaterial'),
        key: 'material_name',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, r) => (
          <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
        ),
      },
      { title: t('app.kuaizhizao.quality.plans.columns.applicableMaterialCode'), dataIndex: 'material_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.plans.columns.applicableMaterial'), dataIndex: 'material_name', hideInTable: true },
      { title: t('app.kuaizhizao.quality.plans.columns.version'), dataIndex: 'version', width: 80 },
      {
        title: t('app.kuaizhizao.quality.common.columns.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        defaultSortOrder: 'descend',
        render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getInspectionPlanLifecycle(t, record);
          return (
            <UniLifecycle
              percent={lifecycle.percent}
              stageName={lifecycle.stageName}
              status={lifecycle.status}
              subStages={lifecycle.subStages}
              showLabel
              size="small"
              showCircleTooltip={false}
            />
          );
        },
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
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                void handleDetail(record);
              }}
            >
              {t('app.kuaizhizao.quality.common.actions.detail')}
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                void handleEdit(record);
              }}
            >
              {t('common.edit')}
            </Button>
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
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
        createButtonText={t('app.kuaizhizao.quality.plans.createButton')}
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
        <style>{`
          .inspection-plan-modal .inspection-steps-form-item .ant-form-item-label { display: none; }
          .inspection-plan-modal .inspection-steps-form-item .ant-form-item-control-input { width: 100%; min-width: 0; }
          .inspection-plan-modal .inspection-steps-form-item .ant-form-item-control-input-content { width: 100%; min-width: 0; }
        `}</style>
        <ProFormItem name="material_id" hidden>
          <input type="hidden" />
        </ProFormItem>
        <ProFormItem name="operation_id" hidden>
          <input type="hidden" />
        </ProFormItem>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="plan_code"
              label={t('app.kuaizhizao.quality.plans.form.planCode')}
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.autoGenerate')}
            />
          </Col>
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
                loading={planTypeLoading}
                options={planTypeOptions}
                quickCreate={{
                  label: t('app.kuaizhizao.quality.common.form.dataDictionaryManage'),
                  onClick: () => navigate('/system/data-dictionaries'),
                }}
                style={{ width: '100%' }}
              />
            </ProFormItem>
          </Col>
          <Col span={12}>
            <ProFormText
              name="material_code"
              label={t('app.kuaizhizao.quality.plans.form.materialCode')}
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.optional')}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="material_name"
              label={t('app.kuaizhizao.quality.plans.form.materialName')}
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.optional')}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="version" label={t('app.kuaizhizao.quality.plans.form.version')} initialValue="1.0" />
          </Col>
        </Row>

        <ProForm.Item
          label={null}
          colon={false}
          className="inspection-steps-form-item"
          style={{ width: '100%' }}
        >
          <div style={{ width: '100%', minWidth: 0 }}>
            <Card title={t('app.kuaizhizao.quality.plans.form.steps')} size="small" style={{ marginTop: 16 }}>
              <InspectionPlanStepEditor value={steps} onChange={setSteps} disabled={false} />
            </Card>
          </div>
        </ProForm.Item>

        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="remarks"
              label={t('app.kuaizhizao.quality.common.form.remarks')}
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.optional')}
            />
          </Col>
        </Row>
        <DocumentAttachmentsField category="inspection_plan_attachments" />
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

              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.lifecycle')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getInspectionPlanLifecycle(t, planDetail);
                    const mainStages = lc.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        showLabels
                        status={lc.status}
                        nextStepSuggestions={lc.nextStepSuggestions}
                      />
                    );
                  })()}
                  <Typography.Text type="secondary">{t('app.kuaizhizao.quality.plans.detail.noUpstreamDocs')}</Typography.Text>
                </div>
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
                        { title: t('app.kuaizhizao.quality.plans.step.inspectionMethod'), dataIndex: 'inspection_method', width: 120 },
                        { title: t('app.kuaizhizao.quality.plans.step.acceptanceCriteria'), dataIndex: 'acceptance_criteria', width: 150 },
                        {
                          title: t('app.kuaizhizao.quality.plans.step.samplingType'),
                          dataIndex: 'sampling_type',
                          width: 90,
                          render: (v: string) =>
                            v === 'sampling'
                              ? t('app.kuaizhizao.quality.plans.step.sampling')
                              : t('app.kuaizhizao.quality.plans.step.fullInspection'),
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

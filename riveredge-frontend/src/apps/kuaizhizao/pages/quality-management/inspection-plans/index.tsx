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
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { App, Button, Tag, Space, Card, Table, Modal, Row, Col, Descriptions, Typography, Empty } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
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
import { InspectionPlanStepEditor, type InspectionPlanStepItem } from '../../../components/InspectionPlanStepEditor';
import { countWithPagedRequests } from '../../../../../utils/pagedCount';
import dayjs from 'dayjs';

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

function getInspectionPlanLifecycle(record: InspectionPlan | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const active = record.is_active === true;
  return {
    percent: active ? 100 : 35,
    stageName: active ? '启用' : '停用',
    status: active ? 'success' : 'normal',
    mainStages: [
      { key: 'maintain', label: '维护', status: 'done' },
      { key: 'active', label: active ? '启用' : '停用', status: 'active' },
    ],
    subStages: [],
    nextStepSuggestions: active ? [] : ['可在列表中启用方案'],
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
  created_at?: string;
  updated_at?: string;
  steps?: InspectionPlanStepItem[];
}

const PLAN_TYPE_FALLBACK = [
  { label: '来料检验', value: 'incoming' },
  { label: '过程检验', value: 'process' },
  { label: '成品检验', value: 'finished' },
];

const InspectionPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [planTypeOptions, setPlanTypeOptions] = useState<Array<{ label: string; value: string }>>(PLAN_TYPE_FALLBACK);
  const [planTypeLoading, setPlanTypeLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setPlanTypeLoading(true);
      try {
        const dict = await getDataDictionaryByCode('INSPECTION_PLAN_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        setPlanTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setPlanTypeOptions(PLAN_TYPE_FALLBACK);
      } finally {
        setPlanTypeLoading(false);
      }
    };
    load();
  }, []);

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
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取质检方案详情失败');
    }
  };

  const handleDetail = async (record: InspectionPlan) => {
    try {
      const detail = await inspectionPlanApi.get(record.id!.toString());
      setPlanDetail(detail);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取质检方案详情失败');
    }
  };

  const handleDelete = async (record: InspectionPlan) => {
    try {
      await inspectionPlanApi.delete(record.id!.toString());
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        steps: steps.map((s, i) => ({ ...s, sequence: i })),
      };

      if (isEdit && currentPlan?.id) {
        await inspectionPlanApi.update(currentPlan.id.toString(), submitData);
        messageApi.success('质检方案更新成功');
      } else {
        await inspectionPlanApi.create(submitData);
        messageApi.success('质检方案创建成功');
      }
      setModalVisible(false);
      setCurrentPlan(null);
      setSteps([]);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  const planTypeLabel = (planType: string | undefined) => {
    const map: Record<string, string> = { incoming: '来料检验', process: '过程检验', finished: '成品检验' };
    return map[planType || ''] || planType || '-';
  };

  const detailBaseColumns: ProDescriptionsItemProps<InspectionPlan>[] = useMemo(
    () => [
      {
        title: '方案编号',
        dataIndex: 'plan_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.plan_code ?? '') }}>{r.plan_code ?? '-'}</Typography.Text>
        ),
      },
      { title: '方案名称', dataIndex: 'plan_name' },
      {
        title: '方案类型',
        dataIndex: 'plan_type',
        render: (_, r) => planTypeLabel(r?.plan_type),
      },
      {
        title: '适用物料编号',
        dataIndex: 'material_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.material_code ?? '') }}>{r.material_code || '-'}</Typography.Text>
        ),
      },
      { title: '适用物料', dataIndex: 'material_name', render: (t) => t || '-' },
      { title: '版本', dataIndex: 'version' },
      {
        title: '启用状态',
        dataIndex: 'is_active',
        render: (_, r) => (r ? <Tag color={r.is_active ? 'success' : 'default'}>{r.is_active ? '启用' : '停用'}</Tag> : '-'),
      },
      { title: '备注', dataIndex: 'remarks', span: 2, render: (t) => t || '-' },
    ],
    []
  );

  const columns: ProColumns<InspectionPlan>[] = [
    {
      title: '方案编号',
      dataIndex: 'plan_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.plan_code ?? '') }} ellipsis>
          {r.plan_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '方案名称', dataIndex: 'plan_name', width: 180, ellipsis: true },
    {
      title: '方案类型',
      dataIndex: 'plan_type',
      width: 100,
      render: (_, record) => {
        if (!record) return '-';
        return planTypeLabel(record.plan_type);
      },
    },
    {
      title: '适用物料',
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      render: (_, r) => (
        <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
      ),
    },
    { title: '适用物料编号', dataIndex: 'material_code', hideInTable: true },
    { title: '适用物料', dataIndex: 'material_name', hideInTable: true },
    { title: '版本', dataIndex: 'version', width: 80 },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getInspectionPlanLifecycle(record);
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
      title: '操作',
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
            详情
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
            编辑
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
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<InspectionPlan>
        headerTitle="质检方案"
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
            messageApi.error('获取质检方案列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        showCreateButton
        createButtonText="新建质检方案"
        onCreate={handleCreate}
        enableRowSelection={true}
        onRowSelectionChange={setSelectedRowKeys}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条质检方案吗？`,
            onOk: async () => {
              try {
                const ids = keys.map(Number);
                for (const id of keys) {
                  await inspectionPlanApi.delete(String(id));
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                setSelectedRowKeys([]);
                if (planDetail?.id != null && ids.includes(planDetail.id)) {
                  setDrawerVisible(false);
                  setPlanDetail(null);
                }
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error.message || '删除失败');
              }
            },
          });
        }}
        scroll={{ x: 1600 }}
      />

      <FormModalTemplate
        title={isEdit ? '编辑质检方案' : '新建质检方案'}
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
            <ProFormText name="plan_code" label="方案编号" placeholder="留空则自动生成" />
          </Col>
          <Col span={12}>
            <ProFormText name="plan_name" label="方案名称" rules={[{ required: true, message: '请输入方案名称' }]} placeholder="请输入" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="plan_type" label="方案类型" rules={[{ required: true, message: '请选择方案类型' }]}>
              <UniDropdown
                placeholder="请选择方案类型"
                showSearch
                allowClear
                loading={planTypeLoading}
                options={planTypeOptions}
                quickCreate={{ label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') }}
                style={{ width: '100%' }}
              />
            </ProFormItem>
          </Col>
          <Col span={12}>
            <ProFormText name="material_code" label="物料编号" placeholder="可选" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText name="material_name" label="物料名称" placeholder="可选" />
          </Col>
          <Col span={12}>
            <ProFormText name="version" label="版本号" initialValue="1.0" />
          </Col>
        </Row>

        <ProForm.Item
          label={null}
          colon={false}
          className="inspection-steps-form-item"
          style={{ width: '100%' }}
        >
          <div style={{ width: '100%', minWidth: 0 }}>
            <Card title="检验步骤" size="small" style={{ marginTop: 16 }}>
              <InspectionPlanStepEditor value={steps} onChange={setSteps} disabled={false} />
            </Card>
          </div>
        </ProForm.Item>

        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea name="remarks" label="备注" placeholder="可选" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSwitch name="is_active" label="启用状态" initialValue={true} />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title="质检方案详情"
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
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(planDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getInspectionPlanLifecycle(planDetail);
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
                  <Typography.Text type="secondary">质检方案无上下游业务单据关联</Typography.Text>
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                {planDetail.steps && planDetail.steps.length > 0 ? (
                  <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                    <Table
                      style={{ minWidth: 720 }}
                      dataSource={planDetail.steps}
                      rowKey={(_, i) => `step-${i}`}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: '序号', key: 'index', width: 60, render: (_, __, i) => i + 1 },
                        { title: '检验项目', dataIndex: 'inspection_item' },
                        { title: '检验方法', dataIndex: 'inspection_method', width: 120 },
                        { title: '合格标准', dataIndex: 'acceptance_criteria', width: 150 },
                        {
                          title: '抽样方式',
                          dataIndex: 'sampling_type',
                          width: 90,
                          render: (v: string) => (v === 'sampling' ? '抽检' : '全检'),
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无检验步骤" />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default InspectionPlansPage;

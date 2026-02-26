/**
 * 质检方案管理页面
 *
 * 提供质检方案的 CRUD 功能，包括列表、新建、编辑、详情。
 * 支持检验步骤的拖拽排序、添加、删除。
 *
 * @author RiverEdge Team
 * @date 2026-02-26
 */

import React, { useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemType,
  ProForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Table } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { inspectionPlanApi } from '../../../services/production';
import { InspectionPlanStepEditor, type InspectionPlanStepItem } from '../../../components/InspectionPlanStepEditor';

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

const PLAN_TYPE_OPTIONS = [
  { label: '来料检验', value: 'incoming' },
  { label: '过程检验', value: 'process' },
  { label: '成品检验', value: 'finished' },
];

const InspectionPlansPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<InspectionPlan | null>(null);
  const [steps, setSteps] = useState<InspectionPlanStepItem[]>([]);
  const formRef = useRef<any>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [planDetail, setPlanDetail] = useState<InspectionPlan | null>(null);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlan(null);
    setSteps([]);
    setModalVisible(true);
    formRef.current?.resetFields();
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

  const columns: ProColumns<InspectionPlan>[] = [
    { title: '方案编码', dataIndex: 'plan_code', width: 140, ellipsis: true },
    { title: '方案名称', dataIndex: 'plan_name', width: 180, ellipsis: true },
    {
      title: '方案类型',
      dataIndex: 'plan_type',
      width: 100,
      render: (_, record) => {
        if (!record) return '-';
        const map: Record<string, string> = { incoming: '来料检验', process: '过程检验', finished: '成品检验' };
        return map[record.plan_type || ''] || record.plan_type || '-';
      },
    },
    { title: '适用物料', dataIndex: 'material_name', width: 150, ellipsis: true, render: (t) => t || '-' },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      width: 90,
      render: (_, record) =>
        record ? (
          <Tag color={record.is_active ? 'success' : 'default'}>{record.is_active ? '启用' : '停用'}</Tag>
        ) : (
          '-'
        ),
    },
    { title: '版本', dataIndex: 'version', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const detailColumns: ProDescriptionsItemType<InspectionPlan>[] = [
    { title: '方案编码', dataIndex: 'plan_code' },
    { title: '方案名称', dataIndex: 'plan_name' },
    {
      title: '方案类型',
      dataIndex: 'plan_type',
      render: (_, record) => {
        if (!record) return '-';
        const map: Record<string, string> = { incoming: '来料检验', process: '过程检验', finished: '成品检验' };
        return map[record.plan_type || ''] || record.plan_type || '-';
      },
    },
    { title: '适用物料', dataIndex: 'material_name', render: (t) => t || '-' },
    { title: '版本', dataIndex: 'version' },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      render: (_, record) => (record ? (record.is_active ? '启用' : '停用') : '-'),
    },
    { title: '备注', dataIndex: 'remarks', span: 2 },
  ];

  return (
    <ListPageTemplate>
      <UniTable<InspectionPlan>
        headerTitle="质检方案"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params: any) => {
          try {
            const response = await inspectionPlanApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              plan_type: params.plan_type,
              is_active: params.is_active,
              plan_code: params.plan_code,
              plan_name: params.plan_name,
            });
            const data = Array.isArray(response) ? response : response?.data || [];
            return { data, success: true, total: data.length };
          } catch (error) {
            messageApi.error('获取质检方案列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建质检方案
          </Button>,
        ]}
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
      >
        <style>{`
          .inspection-plan-modal .inspection-steps-form-item .ant-form-item-label { display: none; }
          .inspection-plan-modal .inspection-steps-form-item .ant-form-item-control-input { width: 100%; min-width: 0; }
          .inspection-plan-modal .inspection-steps-form-item .ant-form-item-control-input-content { width: 100%; min-width: 0; }
        `}</style>
        <ProFormText name="plan_code" label="方案编码" placeholder="留空则自动生成" colProps={{ span: 12 }} />
        <ProFormText name="plan_name" label="方案名称" rules={[{ required: true, message: '请输入方案名称' }]} colProps={{ span: 12 }} />
        <ProFormSelect
          name="plan_type"
          label="方案类型"
          options={PLAN_TYPE_OPTIONS}
          rules={[{ required: true, message: '请选择方案类型' }]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="is_active"
          label="启用状态"
          options={[
            { label: '启用', value: true },
            { label: '停用', value: false },
          ]}
          initialValue={true}
          colProps={{ span: 12 }}
        />
        <ProFormText name="material_code" label="物料编码" placeholder="可选" colProps={{ span: 12 }} />
        <ProFormText name="material_name" label="物料名称" placeholder="可选" colProps={{ span: 12 }} />
        <ProFormText name="version" label="版本号" initialValue="1.0" colProps={{ span: 12 }} />
        <ProFormTextArea name="remarks" label="备注" placeholder="可选" colProps={{ span: 24 }} />

        <ProForm.Item
          label={null}
          colon={false}
          colProps={{ span: 24 }}
          className="inspection-steps-form-item"
          style={{ width: '100%' }}
        >
          <div style={{ width: '100%', minWidth: 0 }}>
            <Card title="检验步骤" size="small" style={{ marginTop: 16 }}>
              <InspectionPlanStepEditor value={steps} onChange={setSteps} disabled={false} />
            </Card>
          </div>
        </ProForm.Item>
      </FormModalTemplate>

      <DetailDrawerTemplate<InspectionPlan>
        title="质检方案详情"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setPlanDetail(null);
        }}
        dataSource={planDetail}
        columns={detailColumns}
        width={DRAWER_CONFIG.LARGE_WIDTH}
      >
        {planDetail?.steps && planDetail.steps.length > 0 && (
          <Card title="检验步骤" size="small" style={{ marginTop: 16 }}>
            <Table
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
          </Card>
        )}
      </DetailDrawerTemplate>
    </ListPageTemplate>
  );
};

export default InspectionPlansPage;

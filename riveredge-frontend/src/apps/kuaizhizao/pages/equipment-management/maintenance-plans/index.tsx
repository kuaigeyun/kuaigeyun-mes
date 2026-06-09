import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 维护保养计划管理页面
 *
 * 提供维护保养计划的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持维护保养计划创建、自动生成、提醒预警、执行记录等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DescriptionsProps } from 'antd';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Tag, Space, message, Modal, Row, Col, Descriptions, Typography, Dropdown, Empty, Spin, theme as AntdTheme } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getMaintenancePlanLifecycle } from '../../../utils/equipmentLifecycle';
import { maintenancePlanApi, equipmentApi } from '../../../services/equipment';
import dayjs from 'dayjs';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
    }
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

function renderPlanRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

interface MaintenancePlan {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  plan_no?: string;
  plan_name?: string;
  plan_type?: string;
  equipment_uuid?: string;
  equipment_code?: string;
  equipment_name?: string;
  maintenance_type?: string;
  maintenance_cycle?: number;
  maintenance_cycle_unit?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

const MaintenancePlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const planDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑维护计划）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<MaintenancePlan | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [planDetail, setPlanDetail] = useState<MaintenancePlan | null>(null);

  const [planTrackingRefreshKey, setPlanTrackingRefreshKey] = useState(0);

  const planTracking = useDocumentTracking(
    drawerVisible && planDetail?.id ? 'maintenance_plan' : undefined,
    planDetail?.id,
    planTrackingRefreshKey,
  );

  // 执行维护保养 Modal 状态
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executePlan, setExecutePlan] = useState<MaintenancePlan | null>(null);
  const executeFormRef = useRef<any>(null);

  /**
   * 处理新建维护计划
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPlan(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑维护计划
   */
  const handleEdit = async (record: MaintenancePlan) => {
    try {
      if (!record.uuid) {
        messageApi.error('维护计划UUID不存在');
        return;
      }
      const detail = await maintenancePlanApi.get(record.uuid);
      setIsEdit(true);
      setCurrentPlan(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          plan_name: detail.plan_name,
          plan_type: detail.plan_type,
          equipment_uuid: detail.equipment_uuid,
          maintenance_type: detail.maintenance_type,
          maintenance_cycle: detail.maintenance_cycle,
          maintenance_cycle_unit: detail.maintenance_cycle_unit,
          planned_start_date: detail.planned_start_date ? dayjs(detail.planned_start_date) : null,
          planned_end_date: detail.planned_end_date ? dayjs(detail.planned_end_date) : null,
          status: detail.status,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取维护计划详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: MaintenancePlan) => {
    try {
      if (!record.uuid) {
        messageApi.error('维护计划UUID不存在');
        return;
      }
      const detail = await maintenancePlanApi.get(record.uuid);
      setPlanDetail(detail);
      setDrawerVisible(true);
      setPlanTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error('获取维护计划详情失败');
    }
  };

  /**
   * 处理批量删除维护计划（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 条保养计划吗？`,
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await maintenancePlanApi.delete(String(uuid));
          }
          messageApi.success(`成功删除 ${keys.length} 条记录`);
          setSelectedRowKeys([]);
          if (planDetail?.uuid && keys.map(String).includes(String(planDetail.uuid))) {
            setDrawerVisible(false);
            setPlanDetail(null);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        planned_start_date: values.planned_start_date ? values.planned_start_date.format('YYYY-MM-DD') : null,
        planned_end_date: values.planned_end_date ? values.planned_end_date.format('YYYY-MM-DD') : null,
      };

      const editedUuid = isEdit ? currentPlan?.uuid : undefined;
      if (isEdit && editedUuid) {
        await maintenancePlanApi.update(editedUuid, submitData);
        messageApi.success('维护计划更新成功');
      } else {
        await maintenancePlanApi.create(submitData);
        messageApi.success('维护计划创建成功');
      }
      setModalVisible(false);
      setCurrentPlan(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
      if (editedUuid && planDetail?.uuid === editedUuid) {
        try {
          const fresh = await maintenancePlanApi.get(editedUuid);
          setPlanDetail(fresh);
          setPlanTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 打开执行维护保养 Modal
   */
  const handleExecute = (record: MaintenancePlan) => {
    if (!record.uuid || !record.equipment_uuid) {
      messageApi.error('维护计划或设备信息不完整');
      return;
    }
    setExecutePlan(record);
    setExecuteModalVisible(true);
    setTimeout(() => {
      executeFormRef.current?.setFieldsValue({
        execution_date: dayjs(),
        execution_result: '正常',
        execution_content: `执行维护计划：${record.plan_name}`,
      });
    }, 100);
  };

  /**
   * 提交执行维护保养
   */
  const handleExecuteSubmit = async (values: any) => {
    if (!executePlan?.uuid || !executePlan?.equipment_uuid) return;
    try {
      await maintenancePlanApi.execute({
        equipment_uuid: executePlan.equipment_uuid,
        maintenance_plan_uuid: executePlan.uuid,
        execution_date: values.execution_date?.format?.('YYYY-MM-DD HH:mm:ss') ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
        execution_content: values.execution_content,
        execution_result: values.execution_result ?? '正常',
        status: '已确认',
      });
      messageApi.success('执行记录已提交');
      setExecuteModalVisible(false);
      setExecutePlan(null);
      executeFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '提交失败');
      throw error;
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<MaintenancePlan>[] = useMemo(
    () => [
    {
      title: '计划编号',
      dataIndex: 'plan_no',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.plan_no ?? '') }}>{r.plan_no ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '计划名称',
      dataIndex: 'plan_name',
    },
    {
      title: '计划类型',
      dataIndex: 'plan_type',
    },
    {
      title: '设备编号',
      dataIndex: 'equipment_code',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }}>{r.equipment_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'equipment_name',
    },
    {
      title: '维护类型',
      dataIndex: 'maintenance_type',
    },
    {
      title: '维护周期',
      dataIndex: 'maintenance_cycle',
      render: (_, record) => record ? `${record.maintenance_cycle ?? ''} ${record.maintenance_cycle_unit ?? ''}`.trim() || '-' : '-',
    },
    {
      title: '计划开始日期',
      dataIndex: 'planned_start_date',
      valueType: 'date',
    },
    {
      title: '计划结束日期',
      dataIndex: 'planned_end_date',
      valueType: 'date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const statusKey = String(record.status ?? '');
        const statusMap: Record<string, { text: string; color: string }> = {
          '待执行': { text: '待执行', color: 'default' },
          '执行中': { text: '执行中', color: 'processing' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[statusKey] || { text: statusKey || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
    ],
    []
  );

  const renderPlanRowNodes = (record: MaintenancePlan): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [
      <Button {...rowActionKind('read')}
        key="detail"
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        详情
      </Button>,
      <Button {...rowActionKind('update')}
        key="edit"
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleEdit(record);
        }}
      >
        编辑
      </Button>,
      <Button {...rowActionKind('delete')}
        key="del"
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          Modal.confirm({
            title: '确认删除',
            content: `确定要删除维护计划"${record.plan_name}"吗？`,
            onOk: () => record.uuid && handleDelete([record.uuid]),
          });
        }}
      >
        删除
      </Button>,
    ];
    if (record.status === '待执行') {
      nodes.push(
        <Button {...rowActionKind('execute')}
          key="exec"
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleExecute(record);
          }}
        >
          执行
        </Button>
      );
    }
    return nodes;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaintenancePlan>[] = [
    {
      title: '计划编号',
      dataIndex: 'plan_no',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.plan_no ?? '') }} ellipsis>
          {r.plan_no ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '计划类型',
      dataIndex: 'plan_type',
      width: 120,
    },
    {
      title: '设备编号',
      dataIndex: 'equipment_code',
      width: 140,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.equipment_code ?? '') }} ellipsis>
          {r.equipment_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'equipment_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '维护类型',
      dataIndex: 'maintenance_type',
      width: 120,
    },
    {
      title: '维护周期',
      dataIndex: 'maintenance_cycle',
      width: 120,
      render: (_, record) => record ? `${record.maintenance_cycle ?? ''} ${record.maintenance_cycle_unit ?? ''}`.trim() || '-' : '-',
    },
    {
      title: '计划开始日期',
      dataIndex: 'planned_start_date',
      valueType: 'date',
      width: 120,
    },
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
        const lifecycle = getMaintenancePlanLifecycle(record as Record<string, unknown>);
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
      render: (_, record) =>
        renderPlanRowActions(renderPlanRowNodes(record), `mpl-${record.uuid ?? 'row'}`),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MaintenancePlan>
          headerTitle="维护保养计划管理"
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-plans"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await maintenancePlanApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
                keyword: (params as any).keyword,
              });
              return {
                data: response.items || [],
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取维护计划列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText="新建保养计划"
          onCreate={handleCreate}
          scroll={{ x: 1900 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑维护计划 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑维护计划' : '新建维护计划'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentPlan(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="plan_name"
              label="计划名称"
              placeholder="请输入计划名称"
              rules={[{ required: true, message: '请输入计划名称' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="plan_type"
              label="计划类型"
              placeholder="请选择计划类型"
              options={[
                { label: '定期维护', value: '定期维护' },
                { label: '预防性维护', value: '预防性维护' },
                { label: '故障后维护', value: '故障后维护' },
              ]}
              rules={[{ required: true, message: '请选择计划类型' }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="equipment_uuid"
              label="关联设备"
              placeholder="请选择设备"
              request={async () => {
                try {
                  const response = await equipmentApi.list({ limit: 1000 });
                  return (response.items || []).map((eq: any) => ({
                    label: `${eq.code} - ${eq.name}`,
                    value: eq.uuid,
                  }));
                } catch (error) {
                  return [];
                }
              }}
              rules={[{ required: true, message: '请选择设备' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="maintenance_type"
              label="维护类型"
              placeholder="请选择维护类型"
              options={[
                { label: '日常保养', value: '日常保养' },
                { label: '定期保养', value: '定期保养' },
                { label: '大修', value: '大修' },
                { label: '小修', value: '小修' },
              ]}
              rules={[{ required: true, message: '请选择维护类型' }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDigit
              name="maintenance_cycle"
              label="维护周期"
              placeholder="请输入维护周期"
              min={1}
              rules={[{ required: true, message: '请输入维护周期' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="maintenance_cycle_unit"
              label="周期单位"
              placeholder="请选择周期单位"
              options={[
                { label: '天', value: '天' },
                { label: '周', value: '周' },
                { label: '月', value: '月' },
                { label: '年', value: '年' },
              ]}
              rules={[{ required: true, message: '请选择周期单位' }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_start_date"
              label="计划开始日期"
              placeholder="请选择计划开始日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_end_date"
              label="计划结束日期"
              placeholder="请选择计划结束日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label="状态"
              placeholder="请选择状态"
              options={[
                { label: '待执行', value: '待执行' },
                { label: '执行中', value: '执行中' },
                { label: '已完成', value: '已完成' },
                { label: '已取消', value: '已取消' },
              ]}
              rules={[{ required: true, message: '请选择状态' }]}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 执行维护保养 Modal */}
      <FormModalTemplate
        title="执行维护保养"
        open={executeModalVisible}
        onClose={() => {
          setExecuteModalVisible(false);
          setExecutePlan(null);
          executeFormRef.current?.resetFields();
        }}
        onFinish={handleExecuteSubmit}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={executeFormRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="execution_date"
              label="执行日期"
              placeholder="请选择执行日期"
              rules={[{ required: true, message: '请选择执行日期' }]}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="execution_result"
              label="执行结果"
              placeholder="请选择执行结果"
              options={[
                { label: '正常', value: '正常' },
                { label: '异常', value: '异常' },
                { label: '待处理', value: '待处理' },
              ]}
              rules={[{ required: true, message: '请选择执行结果' }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="execution_content"
              label="执行内容"
              placeholder="请输入执行内容"
              fieldProps={{ rows: 4 }}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 维护计划详情 Drawer */}
      <DetailDrawerTemplate
        title="维护计划详情"
        open={drawerVisible}
        zIndex={planDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setPlanDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={planDetail || undefined}
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
                    const lc = getMaintenancePlanLifecycle(planDetail as Record<string, unknown>);
                    const mainStages = lc.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        showLabels
                        status={lc.status}
                        nextStepSuggestions={lc.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {planDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='maintenance_plan'
                      documentId={planDetail.id}
                      active={drawerVisible}
                      selfDocumentId={planDetail.id}
                      renderBriefActions={(doc) => (
                  <EquipmentTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDrawerVisible(false);
                      setPlanDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="保养计划无明细行表" />
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录">
                {planTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {planTracking.error && !planTracking.loading && (
                  <Typography.Text type="danger">{planTracking.error}</Typography.Text>
                )}
                {planTracking.data && !planTracking.loading && (
                  <DocumentTrackingTimelineBody data={planTracking.data} />
                )}
                {!planTracking.loading && !planTracking.data && !planTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
    </>
  );
};

export default MaintenancePlansPage;


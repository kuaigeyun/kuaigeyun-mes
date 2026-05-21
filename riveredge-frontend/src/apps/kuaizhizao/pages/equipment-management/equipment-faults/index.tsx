/**
 * 设备故障维修管理页面
 *
 * 提供设备故障和维修记录的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持故障记录、维修流程、维修记录、故障分析等。
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
  ProFormSelect,
  ProFormDatePicker,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Tag, Modal, Row, Col, Descriptions, Typography, Empty, Spin, theme as AntdTheme } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  MODAL_CONFIG,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getEquipmentFaultLifecycle } from '../../../utils/equipmentLifecycle';
import { equipmentFaultApi, equipmentApi } from '../../../services/equipment';
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
      content = (col.render as (dom: React.ReactNode, entity: T, i: number) => React.ReactNode)(
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

function renderFaultRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

interface EquipmentFault {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  fault_no?: string;
  equipment_uuid?: string;
  equipment_code?: string;
  equipment_name?: string;
  fault_date?: string;
  fault_type?: string;
  fault_level?: string;
  fault_description?: string;
  status?: string;
  repair_required?: boolean;
  created_at?: string;
  updated_at?: string;
}

const EquipmentFaultsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const faultDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑故障记录）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentFault, setCurrentFault] = useState<EquipmentFault | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [faultDetail, setFaultDetail] = useState<EquipmentFault | null>(null);

  const [faultTrackingRefreshKey, setFaultTrackingRefreshKey] = useState(0);

  const faultTracking = useDocumentTracking(
    drawerVisible && faultDetail?.id ? 'equipment_fault' : undefined,
    faultDetail?.id,
    faultTrackingRefreshKey,
  );

  // 创建维修记录 Modal 状态
  const [repairModalVisible, setRepairModalVisible] = useState(false);
  const [repairFault, setRepairFault] = useState<EquipmentFault | null>(null);
  const repairFormRef = useRef<any>(null);

  /**
   * 处理新建故障记录
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentFault(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑故障记录
   */
  const handleEdit = async (record: EquipmentFault) => {
    try {
      if (!record.uuid) {
        messageApi.error('故障记录UUID不存在');
        return;
      }
      const detail = await equipmentFaultApi.get(record.uuid);
      setIsEdit(true);
      setCurrentFault(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          equipment_uuid: detail.equipment_uuid,
          fault_date: detail.fault_date ? dayjs(detail.fault_date) : null,
          fault_type: detail.fault_type,
          fault_level: detail.fault_level,
          fault_description: detail.fault_description,
          status: detail.status,
          repair_required: detail.repair_required,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取故障记录详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: EquipmentFault) => {
    try {
      if (!record.uuid) {
        messageApi.error('故障记录UUID不存在');
        return;
      }
      const detail = await equipmentFaultApi.get(record.uuid);
      setFaultDetail(detail);
      setDrawerVisible(true);
      setFaultTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error('获取故障记录详情失败');
    }
  };

  /**
   * 处理批量删除故障记录（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 条设备故障记录吗？`,
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await equipmentFaultApi.delete(String(uuid));
          }
          messageApi.success(`成功删除 ${keys.length} 条记录`);
          setSelectedRowKeys([]);
          if (faultDetail?.uuid && keys.map(String).includes(String(faultDetail.uuid))) {
            setDrawerVisible(false);
            setFaultDetail(null);
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
        fault_date: values.fault_date ? values.fault_date.format('YYYY-MM-DD') : null,
      };

      const editedUuid = isEdit ? currentFault?.uuid : undefined;
      if (isEdit && editedUuid) {
        await equipmentFaultApi.update(editedUuid, submitData);
        messageApi.success('故障记录更新成功');
      } else {
        await equipmentFaultApi.create(submitData);
        messageApi.success('故障记录创建成功');
      }
      setModalVisible(false);
      setCurrentFault(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
      if (editedUuid && faultDetail?.uuid === editedUuid) {
        try {
          const fresh = await equipmentFaultApi.get(editedUuid);
          setFaultDetail(fresh);
          setFaultTrackingRefreshKey((k) => k + 1);
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
   * 打开创建维修记录 Modal
   */
  const handleCreateRepair = (record: EquipmentFault) => {
    if (!record.uuid || !record.equipment_uuid) {
      messageApi.error('故障记录或设备信息不完整');
      return;
    }
    setRepairFault(record);
    setRepairModalVisible(true);
    setTimeout(() => {
      repairFormRef.current?.setFieldsValue({
        repair_date: dayjs(),
        repair_type: '现场维修',
        repair_description: `维修故障：${record.fault_no} - ${record.fault_description || ''}`,
        status: '进行中',
      });
    }, 100);
  };

  /**
   * 提交创建维修记录
   */
  const handleRepairSubmit = async (values: any) => {
    if (!repairFault?.uuid || !repairFault?.equipment_uuid) return;
    try {
      await equipmentFaultApi.createRepair({
        equipment_uuid: repairFault.equipment_uuid,
        equipment_fault_uuid: repairFault.uuid,
        repair_date: values.repair_date?.format?.('YYYY-MM-DD HH:mm:ss') ?? new Date().toISOString().slice(0, 19).replace('T', ' '),
        repair_type: values.repair_type ?? '现场维修',
        repair_description: values.repair_description ?? '',
        status: values.status ?? '进行中',
      });
      messageApi.success('维修记录已创建');
      setRepairModalVisible(false);
      setRepairFault(null);
      repairFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '创建失败');
      throw error;
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<EquipmentFault>[] = useMemo(
    () => [
    {
      title: '故障编号',
      dataIndex: 'fault_no',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.fault_no ?? '') }}>{r.fault_no ?? '-'}</Typography.Text>
      ),
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
      title: '故障日期',
      dataIndex: 'fault_date',
      valueType: 'date',
    },
    {
      title: '故障类型',
      dataIndex: 'fault_type',
    },
    {
      title: '故障级别',
      dataIndex: 'fault_level',
      render: (_, record) => {
        const level = record.fault_level;
        const levelMap: Record<string, { text: string; color: string }> = {
          轻微: { text: '轻微', color: 'default' },
          一般: { text: '一般', color: 'warning' },
          严重: { text: '严重', color: 'error' },
        };
        const config = levelMap[level || ''] || { text: level || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '故障描述',
      dataIndex: 'fault_description',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const statusMap: Record<string, { text: string; color: string }> = {
          待处理: { text: '待处理', color: 'default' },
          处理中: { text: '处理中', color: 'processing' },
          已修复: { text: '已修复', color: 'success' },
          已关闭: { text: '已关闭', color: 'default' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '需要维修',
      dataIndex: 'repair_required',
      render: (_, record) => (
        <Tag color={record.repair_required ? 'warning' : 'success'}>
          {record.repair_required ? '是' : '否'}
        </Tag>
      ),
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

  const renderFaultRowNodes = (record: EquipmentFault): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [
      <Button
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
      <Button
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
      <Button
        key="del"
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          Modal.confirm({
            title: '确认删除',
            content: `确定要删除故障记录"${record.fault_no}"吗？`,
            onOk: () => record.uuid && handleDelete([record.uuid]),
          });
        }}
      >
        删除
      </Button>,
    ];
    if (record.repair_required && record.status !== '已修复') {
      nodes.push(
        <Button key="repair" type="link" size="small" onClick={(e) => {
          e.stopPropagation();
          handleCreateRepair(record);
        }}
        >
          创建维修
        </Button>
      );
    }
    return nodes;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<EquipmentFault>[] = [
    {
      title: '故障编号',
      dataIndex: 'fault_no',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.fault_no ?? '') }} ellipsis>
          {r.fault_no ?? '-'}
        </Typography.Text>
      ),
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
      title: '故障日期',
      dataIndex: 'fault_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '故障类型',
      dataIndex: 'fault_type',
      width: 120,
    },
    {
      title: '故障级别',
      dataIndex: 'fault_level',
      width: 100,
      render: (_, record) => {
        const level = record.fault_level;
        const levelMap: Record<string, { text: string; color: string }> = {
          轻微: { text: '轻微', color: 'default' },
          一般: { text: '一般', color: 'warning' },
          严重: { text: '严重', color: 'error' },
        };
        const config = levelMap[level || ''] || { text: level || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '需要维修',
      dataIndex: 'repair_required',
      width: 100,
      render: (_, record) => (
        <Tag color={record.repair_required ? 'warning' : 'success'}>
          {record.repair_required ? '是' : '否'}
        </Tag>
      ),
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
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getEquipmentFaultLifecycle(record as Record<string, unknown>);
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
        renderFaultRowActions(renderFaultRowNodes(record), `flt-${record.uuid ?? 'row'}`),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<EquipmentFault>
          headerTitle="设备故障维修管理"
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment-faults"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await equipmentFaultApi.list({
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
              messageApi.error('获取故障记录列表失败');
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
          createButtonText="新建设备故障"
          onCreate={handleCreate}
          scroll={{ x: 1900 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑故障记录 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑故障记录' : '新建故障记录'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentFault(null);
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
            <ProFormDatePicker
              name="fault_date"
              label="故障日期"
              placeholder="请选择故障日期"
              rules={[{ required: true, message: '请选择故障日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="fault_type"
              label="故障类型"
              placeholder="请选择故障类型"
              options={[
                { label: '机械故障', value: '机械故障' },
                { label: '电气故障', value: '电气故障' },
                { label: '软件故障', value: '软件故障' },
                { label: '其他', value: '其他' },
              ]}
              rules={[{ required: true, message: '请选择故障类型' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="fault_level"
              label="故障级别"
              placeholder="请选择故障级别"
              options={[
                { label: '轻微', value: '轻微' },
                { label: '一般', value: '一般' },
                { label: '严重', value: '严重' },
              ]}
              rules={[{ required: true, message: '请选择故障级别' }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="fault_description"
              label="故障描述"
              placeholder="请输入故障描述"
              rules={[{ required: true, message: '请输入故障描述' }]}
              fieldProps={{ rows: 4 }}
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
                { label: '待处理', value: '待处理' },
                { label: '处理中', value: '处理中' },
                { label: '已修复', value: '已修复' },
                { label: '已关闭', value: '已关闭' },
              ]}
              rules={[{ required: true, message: '请选择状态' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="repair_required"
              label="需要维修"
              placeholder="请选择是否需要维修"
              options={[
                { label: '是', value: true },
                { label: '否', value: false },
              ]}
              rules={[{ required: true, message: '请选择是否需要维修' }]}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 创建维修记录 Modal */}
      <FormModalTemplate
        title="创建维修记录"
        open={repairModalVisible}
        onClose={() => {
          setRepairModalVisible(false);
          setRepairFault(null);
          repairFormRef.current?.resetFields();
        }}
        onFinish={handleRepairSubmit}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={repairFormRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="repair_date"
              label="维修日期"
              placeholder="请选择维修日期"
              rules={[{ required: true, message: '请选择维修日期' }]}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="repair_type"
              label="维修类型"
              placeholder="请选择维修类型"
              options={[
                { label: '现场维修', value: '现场维修' },
                { label: '返厂维修', value: '返厂维修' },
                { label: '委外维修', value: '委外维修' },
              ]}
              rules={[{ required: true, message: '请选择维修类型' }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="repair_description"
              label="维修描述"
              placeholder="请输入维修描述"
              rules={[{ required: true, message: '请输入维修描述' }]}
              fieldProps={{ rows: 4 }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="status"
              label="维修状态"
              placeholder="请选择维修状态"
              options={[
                { label: '进行中', value: '进行中' },
                { label: '已完成', value: '已完成' },
                { label: '已取消', value: '已取消' },
              ]}
              rules={[{ required: true, message: '请选择维修状态' }]}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 故障记录详情 Drawer */}
      <DetailDrawerTemplate
        title="故障记录详情"
        open={drawerVisible}
        zIndex={faultDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setFaultDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={faultDetail || undefined}
        traceDocument={
          faultDetail?.id != null
            ? {
                documentType: 'equipment_fault',
                documentId: faultDetail.id,
                selfDocumentId: faultDetail.id,
                renderBriefActions: (doc) => (
                  <EquipmentTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDrawerVisible(false);
                      setFaultDetail(null);
                    }}
                  />
                ),
              }
            : null
        }
        customContent={
          faultDetail ? (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(faultDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getEquipmentFaultLifecycle(faultDetail as Record<string, unknown>);
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
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="故障单无明细行表" />
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录">
                {faultTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {faultTracking.error && !faultTracking.loading && (
                  <Typography.Text type="danger">{faultTracking.error}</Typography.Text>
                )}
                {faultTracking.data && !faultTracking.loading && (
                  <DocumentTrackingTimelineBody data={faultTracking.data} />
                )}
                {!faultTracking.loading && !faultTracking.data && !faultTracking.error && (
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

export default EquipmentFaultsPage;


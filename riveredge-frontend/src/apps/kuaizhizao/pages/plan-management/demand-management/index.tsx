/**
 * 统一需求管理页面
 *
 * 提供销售预测和销售订单的统一管理功能，支持MTS/MTO两种模式。
 *
 * 根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Table, Input, Select, Tabs, Alert, Row, Col } from 'antd';
import { EyeOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, ArrowDownOutlined, MergeCellsOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  listDemands,
  getDemand,
  updateDemand,
  submitDemand,
  approveDemand,
  rejectDemand,
  pushDemandToComputation,
  cleanOrphanDemands,
  listDemandRecalcHistory,
  listDemandSnapshots,
  Demand,
  DemandItem,
  DemandStatus,
  ReviewStatus,
  DemandRecalcHistoryItem,
  DemandSnapshotItem,
} from '../../../services/demand';
import { createDemandComputation } from '../../../services/demand-computation';
import { getDocumentRelations } from '../../../services/document-relation';
import DocumentRelationDisplay from '../../../../../components/document-relation-display';
import type { DocumentRelationData } from '../../../../../components/document-relation-display';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getDemandLifecycle } from '../../../utils/demandLifecycle';
import dayjs from 'dayjs';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';

/** 根据字典 code 和 value 获取标签，无匹配时返回原值（支持大小写不敏感匹配） */
function getDictLabel(map: Record<string, Record<string, string>>, code: string, value: string | undefined): string {
  if (!value) return '-';
  const dict = map[code];
  if (!dict) return value;
  const label = dict[value] ?? Object.entries(dict).find(([k]) => k.toUpperCase() === value.toUpperCase())?.[1];
  return label ?? value;
}

/** 格式化时间为 YYYY-MM-DD HH:mm:ss */
function formatDateTime(t: string | undefined): string {
  if (!t) return '-';
  const d = dayjs(t);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : t;
}

/** 统一状态判断（兼容枚举与中文） */
function isDemandDraft(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  return s === DemandStatus.DRAFT || s === '草稿';
}
function isDemandPendingReview(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  return s === DemandStatus.PENDING_REVIEW || s === '待审核' || s === '已提交';
}
function isDemandAuditedAndApproved(d: Demand): boolean {
  const s = (d?.status ?? '').trim();
  const r = (d?.review_status ?? '').trim();
  return (s === DemandStatus.AUDITED || s === '已审核') && (r === ReviewStatus.APPROVED || r === '审核通过' || r === '通过' || r === '已通过');
}
function statusDisplayText(status: string | undefined): string {
  const s = (status ?? '').trim();
  if (s === DemandStatus.DRAFT || s === '草稿') return '草稿';
  if (s === DemandStatus.PENDING_REVIEW || s === '待审核') return '待审核';
  if (s === DemandStatus.AUDITED || s === '已审核') return '已审核';
  if (s === DemandStatus.REJECTED || s === '已驳回') return '已驳回';
  return s || '-';
}
function reviewStatusDisplayText(reviewStatus: string | undefined): string {
  const r = (reviewStatus ?? '').trim();
  if (r === ReviewStatus.APPROVED || r === '审核通过' || r === '通过' || r === '已通过') return '审核通过';
  if (r === ReviewStatus.REJECTED || r === '审核驳回' || r === '驳回') return '审核驳回';
  if (r === ReviewStatus.PENDING || r === '待审核') return '待审核';
  return r || '-';
}

const DemandManagementPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [searchParams] = useSearchParams();

  // Modal 相关状态（新建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false); // 当前编辑的需求是否为草稿（草稿可改更多字段）

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDemand, setCurrentDemand] = useState<Demand | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelationData | null>(null);
  const [recalcHistory, setRecalcHistory] = useState<DemandRecalcHistoryItem[]>([]);
  const [snapshots, setSnapshots] = useState<DemandSnapshotItem[]>([]);
  const [recalcHistoryLoading, setRecalcHistoryLoading] = useState(false);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [detailTabKey, setDetailTabKey] = useState<string>('detail');
  /** 数据字典 value->label 映射（用于详情抽屉显示标签） */
  const [dictLabelMap, setDictLabelMap] = useState<Record<string, Record<string, string>>>({});

  // 需求类型选择（销售预测/销售订单），支持从 URL 参数读取
  const urlDemandType = searchParams.get('demand_type') as 'sales_forecast' | 'sales_order' | null;
  const [demandType, setDemandType] = useState<'sales_forecast' | 'sales_order'>(
    urlDemandType || 'sales_forecast'
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 当 URL 参数变化时，更新需求类型
  useEffect(() => {
    if (urlDemandType && (urlDemandType === 'sales_forecast' || urlDemandType === 'sales_order')) {
      setDemandType(urlDemandType);
    }
  }, [urlDemandType]);

  /** 页面加载时预加载数据字典（发货方式、付款条件、物料单位），用于详情抽屉显示标签值 */
  useEffect(() => {
    const loadDicts = async () => {
      const result: Record<string, Record<string, string>> = {};
      const codes = ['SHIPPING_METHOD', 'PAYMENT_TERMS', 'MATERIAL_UNIT'];
      for (const code of codes) {
        try {
          const dict = await getDataDictionaryByCode(code);
          const items = await getDictionaryItemList(dict.uuid, true);
          const map: Record<string, string> = {};
          items.forEach((it) => { map[it.value] = it.label; });
          result[code] = map;
        } catch {
          result[code] = {};
        }
      }
      setDictLabelMap(result);
    };
    loadDicts();
  }, []);

  /**
   * 需求由销售订单/销售预测审核通过后自动产生，不再支持手动新建
   */

  /**
   * 处理编辑需求
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      try {
        const data = await getDemand(id);
        formRef.current?.setFieldsValue(data);
        setDemandType(data.demand_type || 'sales_forecast');
        setIsEditingDraft(isDemandDraft(data));
      } catch (error: any) {
        messageApi.error('获取需求详情失败');
      }
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getDemand(id, true, true);  // includeItems=true, includeDuration=true
        setCurrentDemand(data);

        // 获取单据关联关系
        try {
          const relations = await getDocumentRelations('demand', id);
          setDocumentRelations(relations);
        } catch (error) {
          console.error('获取单据关联关系失败:', error);
          setDocumentRelations(null);
        }

        setDrawerVisible(true);
      } catch (error: any) {
        messageApi.error('获取需求详情失败');
      }
    }
  };

  /**
   * 处理删除需求
   */
  const handleDelete = async (_keys: React.Key[]) => {
    // TODO: 实现删除功能
    messageApi.info('删除功能待实现');
  };

  /**
   * 处理提交表单（仅用于编辑，如修改优先级）
   */
  const handleSubmit = async (values: any) => {
    if (!isEdit || !currentId) return;
    try {
      await updateDemand(currentId, values);
      messageApi.success('需求更新成功');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 合并多选需求进行计算
   */
  const handleMergeComputation = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要合并计算的需求');
      return;
    }
    const ids = selectedRowKeys.map(k => Number(k)).filter(n => !isNaN(n));
    if (ids.length === 0) return;
    Modal.confirm({
      title: '合并需求计算',
      content: `确定将选中的 ${ids.length} 个需求合并进行需求计算吗？合并计算将保留各需求来源追溯。`,
      onOk: async () => {
        try {
          const payload = ids.length === 1
            ? { demand_id: ids[0], computation_type: 'MRP' as const, computation_params: {} }
            : { demand_ids: ids, computation_type: 'MRP' as const, computation_params: {} };
          const computation = await createDemandComputation(payload);
          messageApi.success('合并计算任务已创建');
          setSelectedRowKeys([]);
          actionRef.current?.reload();
          if (computation?.id) {
            window.location.href = `/apps/kuaizhizao/plan-management/demand-computation?highlight=${computation.id}`;
          }
        } catch (error: any) {
          messageApi.error(error?.message || '创建合并计算失败');
        }
      },
    });
  };

  /**
   * 处理下推需求到物料需求运算
   */
  const handlePushToComputation = async (id: number) => {
    Modal.confirm({
      title: '下推到物料需求运算',
      content: '确定要将此需求下推到物料需求运算吗？下推后将创建需求计算任务。',
      onOk: async () => {
        try {
          const result = await pushDemandToComputation(id);
          messageApi.success(result.message || '需求下推成功');
          if (result.computation_code) {
            messageApi.info(`计算编码：${result.computation_code}`);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '下推失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Demand>[] = [
    {
      title: '需求编码',
      dataIndex: 'demand_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '需求类型',
      dataIndex: 'demand_type',
      width: 120,
      valueEnum: {
        'sales_forecast': { text: '销售预测', status: 'Processing' },
        'sales_order': { text: '销售订单', status: 'Success' },
      },
    },
    {
      title: '需求名称',
      dataIndex: 'demand_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '业务模式',
      dataIndex: 'business_mode',
      width: 100,
      valueEnum: {
        'MTS': { text: '按库存生产', status: 'Processing' },
        'MTO': { text: '按订单生产', status: 'Success' },
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (val: number | undefined, record: Demand) => (
        <Select
          size="small"
          value={val ?? 5}
          options={[
            { label: '高 (1)', value: 1 },
            { label: '中 (5)', value: 5 },
            { label: '低 (10)', value: 10 },
          ]}
          onChange={async (v) => {
            if (record.id == null) return;
            try {
              await updateDemand(record.id, { priority: v });
              messageApi.success('优先级已更新');
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || '更新失败');
            }
          }}
          style={{ width: 90 }}
        />
      ),
    },
    {
      title: '来源',
      dataIndex: ['source_type', 'source_code'],
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: Demand) => {
        const st = record.source_type;
        const sc = record.source_code;
        if (!st && !sc) return '-';
        const label =
          st === 'sales_order' ? '销售订单' :
          st === 'sales_forecast' ? '销售预测' :
          st === 'sample_trial' ? '样件试制' :
          st === 'quotation' ? '报价单' :
          st || '';
        return sc ? `${label} ${sc}` : label || '-';
      },
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      fixed: 'right' as const,
      valueType: 'select',
      valueEnum: {
        草稿: { text: '草稿' },
        待审核: { text: '待审核' },
        已驳回: { text: '已驳回' },
        已审核: { text: '已审核' },
        已下推计算: { text: '已下推计算' },
      },
      render: (_: unknown, record: Demand) => {
        const lifecycle = getDemandLifecycle(record);
        const stageName = lifecycle.stageName && lifecycle.stageName !== '-' ? lifecycle.stageName : statusDisplayText(record.status);
        const colorMap: Record<string, string> = {
          草稿: 'default',
          待审核: 'warning',
          已驳回: 'error',
          已审核: 'green',
          已下推计算: 'blue',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail([record.id!])}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit([record.id!])}>
            {isDemandDraft(record) ? '编辑' : '修改'}
          </Button>
          <UniWorkflowActions
            record={record}
            entityName="需求"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[DemandStatus.DRAFT, '草稿']}
            pendingStatuses={[DemandStatus.PENDING_REVIEW, '待审核', '已提交']}
            approvedStatuses={[DemandStatus.AUDITED, '已审核', ReviewStatus.APPROVED, '审核通过', '通过', '已通过']}
            rejectedStatuses={[DemandStatus.REJECTED, '已驳回', ReviewStatus.REJECTED, '审核驳回', '驳回']}
            theme="link"
            size="small"
            actions={{
              submit: submitDemand,
              approve: approveDemand,
              reject: async (id, reason) => {
              if (!reason?.trim()) {
                throw new Error('请输入驳回原因');
              }
              return rejectDemand(id, reason.trim());
            },
            }}
            onSuccess={() => actionRef.current?.reload()}
          />
          {isDemandAuditedAndApproved(record) && !record.pushed_to_computation && (
            <Button
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => handlePushToComputation(record.id!)}
              style={{ color: '#1890ff' }}
            >
              下推
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Demand>
          headerTitle="需求管理"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };

            // 处理搜索参数，优先使用搜索表单的值，如果没有则使用 URL 参数的值
            if (searchFormValues?.demand_type) {
              apiParams.demand_type = searchFormValues.demand_type;
            } else if (urlDemandType) {
              apiParams.demand_type = urlDemandType;
            }
            // 生命周期搜索映射到 status（与销售订单一致）
            if (searchFormValues?.lifecycle) {
              const lifecycleToStatus: Record<string, string> = {
                草稿: 'DRAFT',
                待审核: 'PENDING_REVIEW',
                已驳回: 'REJECTED',
                已审核: 'AUDITED',
                已下推计算: 'AUDITED',
              };
              apiParams.status = lifecycleToStatus[searchFormValues.lifecycle] ?? searchFormValues.lifecycle;
              if (searchFormValues.lifecycle === '已下推计算') {
                apiParams.pushed_to_computation = true;
              }
            } else if (searchFormValues?.status) {
              apiParams.status = searchFormValues.status;
            }
            if (searchFormValues?.business_mode) {
              apiParams.business_mode = searchFormValues.business_mode;
            }
            if (searchFormValues?.review_status) {
              apiParams.review_status = searchFormValues.review_status;
            }

            // 处理排序
            if (sort) {
              const sortKeys = Object.keys(sort);
              if (sortKeys.length > 0) {
                const key = sortKeys[0];
                apiParams.order_by = sort[key] === 'ascend' ? key : `-${key}`;
              }
            }

            try {
              const response = await listDemands(apiParams);
              return {
                data: response.data || [],
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error: any) {
              messageApi.error(error?.message || '获取列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="id"
          showAdvancedSearch={true}
          showCreateButton={false}
          showEditButton={false}
          showDeleteButton={false}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listDemands({ skip: 0, limit: 10000 });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: Demand) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `demands-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          toolBarActions={[
            <Button
              key="merge-computation"
              type="primary"
              icon={<MergeCellsOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleMergeComputation}
            >
              合并计算
            </Button>,
          ]}
        />
      </ListPageTemplate>

      {/* 编辑需求 Modal：非草稿仅可改优先级和备注；草稿可改更多字段 */}
      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        title={isEditingDraft ? '编辑需求' : '修改需求'}
        width={isEditingDraft ? 560 : 480}
        footer={null}
        destroyOnClose
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          layout="vertical"
          submitter={{
            render: () => (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setModalVisible(false)}>取消</Button>
                  <Button type="primary" onClick={() => formRef.current?.submit()}>
                    更新
                  </Button>
                </Space>
              </div>
            ),
          }}
        >
          {/* 非草稿：仅可修改优先级和备注（与上游同步） */}
          {!isEditingDraft && (
            <Row gutter={16}>
              <Col span={24}>
                <ProFormSelect
                  name="priority"
                  label="优先级"
                  options={[
                    { label: '高 (1)', value: 1 },
                    { label: '中 (5)', value: 5 },
                    { label: '低 (10)', value: 10 },
                  ]}
                  fieldProps={{ style: { width: 200 } }}
                />
              </Col>
              <Col span={24}>
                <ProFormTextArea
                  name="notes"
                  label="备注"
                  fieldProps={{ rows: 3 }}
                />
              </Col>
            </Row>
          )}
          {/* 草稿：可编辑必要字段 */}
          {isEditingDraft && (
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="priority"
                  label="优先级"
                  options={[
                    { label: '高 (1)', value: 1 },
                    { label: '中 (5)', value: 5 },
                    { label: '低 (10)', value: 10 },
                  ]}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="demand_type"
                  label="需求类型"
                  options={[
                    { label: '销售预测', value: 'sales_forecast' },
                    { label: '销售订单', value: 'sales_order' },
                  ]}
                  rules={[{ required: true, message: '请选择需求类型' }]}
                  fieldProps={{
                    onChange: (value: 'sales_forecast' | 'sales_order') => setDemandType(value),
                    style: { width: '100%' },
                  }}
                />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="demand_name"
                  label="需求名称"
                  placeholder="请输入需求名称"
                  rules={[{ required: true, message: '请输入需求名称' }]}
                />
              </Col>
              <Col span={12}>
                <ProFormDatePicker
                  name="start_date"
                  label="开始日期"
                  rules={[{ required: true, message: '请选择开始日期' }]}
                  width="100%"
                />
              </Col>
              <Col span={12}>
                <ProFormDatePicker
                  name="end_date"
                  label="结束日期"
                  width="100%"
                />
              </Col>
              {demandType === 'sales_forecast' && (
                <Col span={12}>
                  <ProFormText
                    name="forecast_period"
                    label="预测周期"
                    placeholder="例如：2026-01"
                    rules={[{ required: true, message: '请输入预测周期' }]}
                  />
                </Col>
              )}
              {demandType === 'sales_order' && (
                <>
                  <Col span={12}>
                    <ProFormText
                      name="customer_name"
                      label="客户名称"
                      rules={[{ required: true, message: '请输入客户名称' }]}
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormDatePicker
                      name="order_date"
                      label="订单日期"
                      rules={[{ required: true, message: '请选择订单日期' }]}
                      width="100%"
                    />
                  </Col>
                  <Col span={12}>
                    <ProFormDatePicker
                      name="delivery_date"
                      label="交货日期"
                      rules={[{ required: true, message: '请选择交货日期' }]}
                      width="100%"
                    />
                  </Col>
                </>
              )}
              <Col span={24}>
                <ProFormTextArea
                  name="notes"
                  label="备注"
                  fieldProps={{ rows: 3 }}
                />
              </Col>
            </Row>
          )}
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        title={`需求详情 - ${currentDemand?.demand_code || ''}`}
        width="50%"
        styles={{ body: { paddingTop: 8 } }}
        extra={
          currentDemand && (
            <Space>
              <UniWorkflowActions
                record={currentDemand}
                entityName="需求"
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={[DemandStatus.DRAFT, '草稿']}
                pendingStatuses={[DemandStatus.PENDING_REVIEW, '待审核', '已提交']}
                approvedStatuses={[DemandStatus.AUDITED, '已审核', ReviewStatus.APPROVED, '审核通过', '通过', '已通过']}
                rejectedStatuses={[DemandStatus.REJECTED, '已驳回', ReviewStatus.REJECTED, '审核驳回', '驳回']}
                theme="default"
                size="middle"
                actions={{
                  submit: submitDemand,
                  approve: approveDemand,
                  reject: async (id, reason) => {
                    if (!reason?.trim()) throw new Error('请输入驳回原因');
                    return rejectDemand(id, reason.trim());
                  },
                }}
                onSuccess={async () => {
                  actionRef.current?.reload();
                  if (currentDemand?.id) {
                    const updated = await getDemand(currentDemand.id);
                    setCurrentDemand(updated);
                  }
                }}
              />
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setDrawerVisible(false);
                  handleEdit([currentDemand.id!]);
                }}
              >
                编辑
              </Button>
              {isDemandAuditedAndApproved(currentDemand) && !currentDemand.pushed_to_computation && (
                <Button
                  type="primary"
                  icon={<ArrowDownOutlined />}
                  onClick={() => handlePushToComputation(currentDemand.id!)}
                >
                  下推到物料需求运算
                </Button>
              )}
            </Space>
          )
        }
      >
        {currentDemand && (
          <div style={{ padding: '0 0 16px 0' }}>
            <Tabs
              activeKey={detailTabKey}
              onChange={(key) => {
                setDetailTabKey(key);
                if (key === 'recalc' && currentDemand.id) {
                  setRecalcHistoryLoading(true);
                  listDemandRecalcHistory(currentDemand.id, { limit: 50 })
                    .then(setRecalcHistory)
                    .catch(() => messageApi.error('获取重算历史失败'))
                    .finally(() => setRecalcHistoryLoading(false));
                }
                if (key === 'snapshots' && currentDemand.id) {
                  setSnapshotsLoading(true);
                  listDemandSnapshots(currentDemand.id, { limit: 20 })
                    .then(setSnapshots)
                    .catch(() => messageApi.error('获取快照列表失败'))
                    .finally(() => setSnapshotsLoading(false));
                }
              }}
              items={[
                {
                  key: 'detail',
                  label: '详情',
                  children: (
                    <>
                      {currentDemand.pushed_to_computation && currentDemand.computation_id && (
                        <Alert
                          type="info"
                          showIcon
                          message="需求已变更时，请前往需求计算重新执行计算"
                          description={
                            <span>
                              本需求已下推至需求计算
                              {currentDemand.computation_code && `（${currentDemand.computation_code}）`}
                              。若上游已修改并同步，请
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: 0 }}
                                onClick={() => {
                                  setDrawerVisible(false);
                                  navigate(`/apps/kuaizhizao/plan-management/demand-computation?highlight=${currentDemand.computation_id}`);
                                }}
                              >
                                前往需求计算
                              </Button>
                              重新执行计算。
                            </span>
                          }
                          style={{ marginBottom: 16 }}
                        />
                      )}
                      <ProDescriptions
                        column={2}
                        title="基本信息"
                        dataSource={currentDemand}
                      >
                        <ProDescriptions.Item label="需求编码" dataIndex="demand_code" />
                        <ProDescriptions.Item label="需求类型" dataIndex="demand_type">
                          <Tag color={currentDemand.demand_type === 'sales_forecast' ? 'processing' : 'success'}>
                            {currentDemand.demand_type === 'sales_forecast' ? '销售预测' : '销售订单'}
                          </Tag>
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="需求名称" dataIndex="demand_name" />
                        <ProDescriptions.Item label="业务模式" dataIndex="business_mode">
                          <Tag color={currentDemand.business_mode === 'MTS' ? 'processing' : 'success'}>
                            {currentDemand.business_mode === 'MTS' ? '按库存生产' : '按订单生产'}
                          </Tag>
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="开始日期" dataIndex="start_date" valueType="date" />
                        <ProDescriptions.Item label="结束日期" dataIndex="end_date" valueType="date" />
                        {currentDemand.demand_type === 'sales_forecast' && (
                          <ProDescriptions.Item label="预测周期" dataIndex="forecast_period" />
                        )}
                        {currentDemand.demand_type === 'sales_order' && (
                          <>
                            <ProDescriptions.Item label="订单日期" dataIndex="order_date" valueType="date" />
                            <ProDescriptions.Item label="交货日期" dataIndex="delivery_date" valueType="date" />
                          </>
                        )}
                        <ProDescriptions.Item label="客户名称" dataIndex="customer_name" />
                        {currentDemand.demand_type === 'sales_order' && (
                          <>
                            <ProDescriptions.Item label="客户联系人" dataIndex="customer_contact" />
                            <ProDescriptions.Item label="客户电话" dataIndex="customer_phone" />
                            <ProDescriptions.Item label="销售员" dataIndex="salesman_name" />
                            <ProDescriptions.Item label="收货地址" dataIndex="shipping_address" span={2} />
                            <ProDescriptions.Item label="发货方式">
                              {getDictLabel(dictLabelMap, 'SHIPPING_METHOD', currentDemand.shipping_method)}
                            </ProDescriptions.Item>
                            <ProDescriptions.Item label="付款条件">
                              {getDictLabel(dictLabelMap, 'PAYMENT_TERMS', currentDemand.payment_terms)}
                            </ProDescriptions.Item>
                          </>
                        )}
                        <ProDescriptions.Item label="总数量" dataIndex="total_quantity" />
                        <ProDescriptions.Item label="状态">
                          <Tag
                            color={
                              statusDisplayText(currentDemand.status) === '已审核' ? 'success' :
                                statusDisplayText(currentDemand.status) === '待审核' ? 'processing' :
                                  statusDisplayText(currentDemand.status) === '已驳回' ? 'error' : 'default'
                            }
                          >
                            {statusDisplayText(currentDemand.status)}
                          </Tag>
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="审核状态">
                          <Tag
                            color={
                              reviewStatusDisplayText(currentDemand.review_status) === '审核通过' ? 'success' :
                                reviewStatusDisplayText(currentDemand.review_status) === '审核驳回' ? 'error' : 'default'
                            }
                          >
                            {reviewStatusDisplayText(currentDemand.review_status)}
                          </Tag>
                        </ProDescriptions.Item>
                        {currentDemand.reviewer_name && (
                          <>
                            <ProDescriptions.Item label="审核人" dataIndex="reviewer_name" />
                            <ProDescriptions.Item label="审核时间" dataIndex="review_time" valueType="dateTime" />
                          </>
                        )}
                        {currentDemand.review_remarks && (
                          <ProDescriptions.Item label="审核备注" dataIndex="review_remarks" span={2} />
                        )}
                        {currentDemand.notes && (
                          <ProDescriptions.Item label="备注" dataIndex="notes" span={2} />
                        )}
                        {currentDemand.submit_time && (
                          <ProDescriptions.Item label="提交时间" dataIndex="submit_time" valueType="dateTime" />
                        )}
                      </ProDescriptions>

                      <div style={{ marginTop: 24, marginBottom: 24 }}>
                        <h4 style={{ marginBottom: 12 }}>生命周期状态</h4>
                        {(() => {
                          const lifecycle = getDemandLifecycle(currentDemand);
                          const mainStages = lifecycle.mainStages ?? [];
                          const subStages = lifecycle.subStages ?? [];
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {mainStages.length > 0 && (
                                <UniLifecycleStepper
                                  steps={mainStages}
                                  status={lifecycle.status}
                                  showLabels
                                  nextStepSuggestions={lifecycle.nextStepSuggestions}
                                />
                              )}
                              {subStages.length > 0 && (
                                <div>
                                  <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                                    执行中 · 全链路
                                  </div>
                                  <UniLifecycleStepper steps={subStages} showLabels />
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {(currentDemand as any).duration_info && (
                        <div style={{ marginTop: 24 }}>
                          <h4>耗时统计</h4>
                          <ProDescriptions
                            column={2}
                            dataSource={(currentDemand as any).duration_info}
                          >
                            <ProDescriptions.Item label="创建时间" dataIndex="created_at" valueType="dateTime" />
                            {currentDemand.submit_time && (
                              <>
                                <ProDescriptions.Item label="提交时间" dataIndex="submit_time" valueType="dateTime" />
                                {(currentDemand as any).duration_info?.duration_to_submit !== null && (
                                  <ProDescriptions.Item label="创建到提交耗时" dataIndex="duration_to_submit">
                                    {(currentDemand as any).duration_info?.duration_to_submit
                                      ? `${(currentDemand as any).duration_info.duration_to_submit} 小时`
                                      : '-'}
                                  </ProDescriptions.Item>
                                )}
                              </>
                            )}
                            {currentDemand.review_time && (
                              <>
                                <ProDescriptions.Item label="审核时间" dataIndex="review_time" valueType="dateTime" />
                                {(currentDemand as any).duration_info?.duration_to_review !== null && (
                                  <ProDescriptions.Item label="创建到审核耗时" dataIndex="duration_to_review">
                                    {(currentDemand as any).duration_info?.duration_to_review
                                      ? `${(currentDemand as any).duration_info.duration_to_review} 小时`
                                      : '-'}
                                  </ProDescriptions.Item>
                                )}
                                {(currentDemand as any).duration_info?.duration_submit_to_review !== null && (
                                  <ProDescriptions.Item label="提交到审核耗时" dataIndex="duration_submit_to_review">
                                    {(currentDemand as any).duration_info?.duration_submit_to_review
                                      ? `${(currentDemand as any).duration_info.duration_submit_to_review} 小时`
                                      : '-'}
                                  </ProDescriptions.Item>
                                )}
                              </>
                            )}
                          </ProDescriptions>
                        </div>
                      )}

                      {currentDemand.items && currentDemand.items.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                          <h4>需求明细</h4>
                          <Table<DemandItem>
                            size="small"
                            columns={[
                              { title: '物料编码', dataIndex: 'material_code', width: 120 },
                              { title: '物料名称', dataIndex: 'material_name', width: 150 },
                              { title: '物料规格', dataIndex: 'material_spec', width: 120 },
                              {
                                title: '单位',
                                dataIndex: 'material_unit',
                                width: 80,
                                render: (v: string) => getDictLabel(dictLabelMap, 'MATERIAL_UNIT', v) || v || '-',
                              },
                              { title: '需求数量', dataIndex: 'required_quantity', width: 100, align: 'right' as const },
                              ...(currentDemand.demand_type === 'sales_forecast' ? [
                                { title: '预测日期', dataIndex: 'forecast_date', width: 120 },
                                { title: '预测月份', dataIndex: 'forecast_month', width: 100 },
                              ] : [
                                { title: '交货日期', dataIndex: 'delivery_date', width: 120 },
                                { title: '已交货数量', dataIndex: 'delivered_quantity', width: 100, align: 'right' as const },
                                { title: '剩余数量', dataIndex: 'remaining_quantity', width: 100, align: 'right' as const },
                              ]),
                            ]}
                            dataSource={currentDemand.items}
                            pagination={false}
                            bordered
                            rowKey="id"
                          />
                        </div>
                      )}

                      {currentDemand.id && (
                        <div style={{ marginTop: 24 }}>
                          <DocumentTrackingPanel
                            documentType="demand"
                            documentId={currentDemand.id}
                            onDocumentClick={(type, id) => messageApi.info(`跳转到${type}#${id}`)}
                          />
                        </div>
                      )}

                      <DocumentRelationDisplay
                        relations={documentRelations}
                        onDocumentClick={(documentType, documentId) => {
                          messageApi.info(`跳转到${documentType}#${documentId}的详情页面`);
                        }}
                        style={{ marginTop: 24 }}
                      />
                    </>
                  ),
                },
                {
                  key: 'recalc',
                  label: '重算历史',
                  children: (
                    <Table<DemandRecalcHistoryItem>
                      size="small"
                      loading={recalcHistoryLoading}
                      dataSource={recalcHistory}
                      rowKey="id"
                      columns={[
                        { title: '操作时间', dataIndex: 'recalc_at', width: 180, render: (t) => formatDateTime(t) },
                        {
                          title: '触发方式',
                          dataIndex: 'trigger_type',
                          width: 100,
                          render: (v) => (v === 'upstream_change' ? '上游变更' : v === 'manual' ? '手动触发' : v || '-'),
                        },
                        {
                          title: '数据来源',
                          dataIndex: 'source_type',
                          width: 100,
                          render: (v) => (v === 'sales_order' ? '销售订单' : v === 'sales_forecast' ? '销售预测' : v || '-'),
                        },
                        { title: '变更说明', dataIndex: 'trigger_reason', ellipsis: true, render: (v) => v || '-' },
                        {
                          title: '执行结果',
                          dataIndex: 'result',
                          width: 90,
                          render: (v) => (v === 'success' ? '成功' : v === 'failed' ? '失败' : v || '-'),
                        },
                        { title: '说明', dataIndex: 'message', ellipsis: true, render: (v) => v || '-' },
                      ]}
                      pagination={false}
                    />
                  ),
                },
                {
                  key: 'snapshots',
                  label: '变更记录',
                  children: (
                    <Table<DemandSnapshotItem>
                      size="small"
                      loading={snapshotsLoading}
                      dataSource={snapshots}
                      rowKey="id"
                      expandable={{
                        expandedRowRender: (record) => (
                          <div style={{ padding: 8 }}>
                            {record.demand_snapshot && (
                              <div style={{ marginBottom: 12 }}>
                                <strong>变更前需求数据：</strong>
                                <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                  {JSON.stringify(record.demand_snapshot, null, 2)}
                                </pre>
                              </div>
                            )}
                            {record.demand_items_snapshot && record.demand_items_snapshot.length > 0 && (
                              <>
                                <strong>变更前明细数据：</strong>
                                <pre style={{ margin: '4px 0 0', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                                  {JSON.stringify(record.demand_items_snapshot, null, 2)}
                                </pre>
                              </>
                            )}
                            {!record.demand_snapshot && (!record.demand_items_snapshot || record.demand_items_snapshot.length === 0) && (
                              <span style={{ color: '#999' }}>暂无详细数据</span>
                            )}
                          </div>
                        ),
                      }}
                      columns={[
                        { title: '记录时间', dataIndex: 'snapshot_at', width: 180, render: (t) => formatDateTime(t) },
                        {
                          title: '变更类型',
                          dataIndex: 'snapshot_type',
                          width: 100,
                          render: (v) => (v === 'before_recalc' ? '重算前' : v || '-'),
                        },
                        {
                          title: '变更说明',
                          dataIndex: 'trigger_reason',
                          ellipsis: true,
                          render: (v) => {
                            if (!v) return '-';
                            if (v.includes('sales_order')) return '销售订单变更';
                            if (v.includes('sales_forecast')) return '销售预测变更';
                            return v;
                          },
                        },
                      ]}
                      pagination={false}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </>
  );
};

export default DemandManagementPage;

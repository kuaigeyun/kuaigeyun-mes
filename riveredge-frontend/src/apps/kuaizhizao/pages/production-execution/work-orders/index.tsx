/**
 * 工单管理页面
 *
 * 提供工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持MTS/MTO模式工单管理。
 * 支持工单拆分、冻结、优先级管理、合并、工序修改等高级功能。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormRadio } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, Row, Col, Table, Radio, InputNumber, Form, Popconfirm, Select, Progress, Tooltip, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, HolderOutlined, RightOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { workOrderApi, reworkOrderApi, outsourceOrderApi } from '../../../services/production';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';
import { operationApi } from '../../../../master-data/services/process';
import { workshopApi } from '../../../../master-data/services/factory';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import { getCodeRuleList } from '../../../../../services/codeRule';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

interface WorkOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  name?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  production_mode?: 'MTS' | 'MTO';
  sales_order_id?: number;
  sales_order_code?: string;
  sales_order_name?: string;
  workshop_id?: number;
  workshop_name?: string;
  work_center_id?: number;
  work_center_name?: string;
  status?: string;
  priority?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  completed_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  is_frozen?: boolean;
  freeze_reason?: string;
  frozen_at?: string;
  frozen_by?: number;
  frozen_by_name?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const WorkOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 产品列表状态
  const [productList, setProductList] = useState<any[]>([]);
  // 编码规则列表状态
  const [codeRuleList, setCodeRuleList] = useState<any[]>([]);

  // Modal 相关状态（创建/编辑工单）
  const [modalVisible, setModalVisible] = useState(false);

  // 初始化产品列表和编码规则列表
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载产品列表
        const products = await materialApi.list({ isActive: true });
        setProductList(products);
        
        // 加载编码规则列表（只加载激活的规则）
        try {
          const codeRulesResponse = await getCodeRuleList({ page: 1, page_size: 1000, is_active: true });
          // 兼容不同的响应格式：可能是 { items: [...] } 或直接是数组
          const rules = Array.isArray(codeRulesResponse) ? codeRulesResponse : (codeRulesResponse?.items || []);
          // 过滤出工单相关的编码规则
          // 匹配规则：code 包含 WORK_ORDER、work-order、工单，或者以 auto-kuaizhizao-production-work-order 开头
          const workOrderRules = rules.filter((rule: any) => {
            if (!rule.code) return false;
            const codeUpper = rule.code.toUpperCase();
            const codeLower = rule.code.toLowerCase();
            return (
              codeUpper.includes('WORK_ORDER') ||
              codeLower.includes('work-order') ||
              codeLower.includes('workorder') ||
              codeLower.includes('工单') ||
              codeLower.startsWith('auto-kuaizhizao-production-work-order')
            );
          });
          setCodeRuleList(workOrderRules);
          console.log('加载的工单编码规则:', workOrderRules);
        } catch (error) {
          console.error('获取编码规则列表失败:', error);
          setCodeRuleList([]);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
        setProductList([]);
        setCodeRuleList([]);
      }
    };
    loadData();
  }, []);
  const [isEdit, setIsEdit] = useState(false);
  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workOrderDetail, setWorkOrderDetail] = useState<WorkOrder | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);
  const [workOrderOperations, setWorkOrderOperations] = useState<any[]>([]);
  const [operationsModalVisible, setOperationsModalVisible] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<any>(null);
  const operationFormRef = useRef<any>();

  // 行展开相关状态
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [expandedOperationsMap, setExpandedOperationsMap] = useState<Record<number, any[]>>({});
  const [loadingOperationsMap, setLoadingOperationsMap] = useState<Record<number, boolean>>({});

  // 创建返工单相关状态
  const [reworkModalVisible, setReworkModalVisible] = useState(false);
  const [currentWorkOrderForRework, setCurrentWorkOrderForRework] = useState<WorkOrder | null>(null);
  const reworkFormRef = useRef<any>(null);

  // 创建委外单相关状态
  const [outsourceModalVisible, setOutsourceModalVisible] = useState(false);
  const [currentWorkOrderForOutsource, setCurrentWorkOrderForOutsource] = useState<WorkOrder | null>(null);
  const outsourceFormRef = useRef<any>(null);
  const [supplierList, setSupplierList] = useState<any[]>([]);

  // 冻结/解冻相关状态
  const [freezeModalVisible, setFreezeModalVisible] = useState(false);
  const [currentWorkOrderForFreeze, setCurrentWorkOrderForFreeze] = useState<WorkOrder | null>(null);
  const freezeFormRef = useRef<any>(null);

  // 批量设置优先级相关状态
  const [batchPriorityModalVisible, setBatchPriorityModalVisible] = useState(false);
  const [batchPriority, setBatchPriority] = useState<string>('normal');

  // 合并工单相关状态
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const mergeFormRef = useRef<any>(null);

  // 拆分工单相关状态
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [currentWorkOrderForSplit, setCurrentWorkOrderForSplit] = useState<WorkOrder | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);
  const [splitType, setSplitType] = useState<'count' | 'quantity'>('count');
  const [splitQuantities, setSplitQuantities] = useState<number[]>([]);

  /**
   * 处理新建工单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkOrder(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    
    // 自动设置编码规则（如果有）
    setTimeout(() => {
      if (codeRuleList.length === 1) {
        // 只有一条编码规则，自动填充
        formRef.current?.setFieldsValue({
          code_rule: codeRuleList[0].code,
        });
      } else if (codeRuleList.length > 1) {
        // 有多条编码规则，默认选择第一条
        formRef.current?.setFieldsValue({
          code_rule: codeRuleList[0].code,
        });
      }
      // 如果没有编码规则，允许手工填写编码
    }, 100);
  };

  /**
   * 处理编辑工单
   */
  const handleEdit = async (record: WorkOrder) => {
    try {
      // 加载完整详情
      const detail = await workOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentWorkOrder(detail);
      setModalVisible(true);
      // 延迟设置表单值，确保表单已渲染
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          quantity: detail.quantity,
          production_mode: detail.production_mode,
          sales_order_id: detail.sales_order_id,
          sales_order_code: detail.sales_order_code,
          sales_order_name: detail.sales_order_name,
          workshop_id: detail.workshop_id,
          workshop_name: detail.workshop_name,
          work_center_id: detail.work_center_id,
          work_center_name: detail.work_center_name,
          status: detail.status,
          priority: detail.priority,
          planned_start_date: detail.planned_start_date,
          planned_end_date: detail.planned_end_date,
          remarks: detail.remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理行展开
   */
  const handleExpand = async (expanded: boolean, record: WorkOrder) => {
    if (expanded && record.id) {
      // 展开时加载工序数据
      if (!expandedOperationsMap[record.id]) {
        setLoadingOperationsMap(prev => ({ ...prev, [record.id!]: true }));
        try {
          const operations = await workOrderApi.getOperations(record.id!.toString());
          setExpandedOperationsMap(prev => ({ ...prev, [record.id!]: operations || [] }));
        } catch (error) {
          console.error('获取工单工序列表失败:', error);
          setExpandedOperationsMap(prev => ({ ...prev, [record.id!]: [] }));
        } finally {
          setLoadingOperationsMap(prev => ({ ...prev, [record.id!]: false }));
        }
      }
    }
  };

  /**
   * 计算工序进度百分比
   */
  const calculateProgress = (operation: any, workOrder: WorkOrder) => {
    if (operation.reporting_type === 'status') {
      // 按状态报工：已完成返回100%，未完成返回0%
      return operation.status === 'completed' ? 100 : 0;
    } else {
      // 按数量报工：已完成数量 / 计划数量
      const completed = Number(operation.completed_quantity || 0);
      const planned = Number(workOrder.quantity || 1);
      return Math.min(Math.round((completed / planned) * 100), 100);
    }
  };

  /**
   * 获取工序进度颜色
   */
  const getProgressColor = (operation: any, progress: number) => {
    if (operation.status === 'completed') {
      return '#52c41a'; // 绿色：已完成
    }
    if (progress >= 95) {
      return '#52c41a'; // 绿色：合格率达标
    }
    if (progress >= 80) {
      return '#faad14'; // 黄色：合格率偏低
    }
    return '#ff4d4f'; // 红色：异常或合格率过低
  };

  /**
   * 计算合格率
   */
  const calculateQualifiedRate = (operation: any) => {
    const qualified = Number(operation.qualified_quantity || 0);
    const completed = Number(operation.completed_quantity || 0);
    if (completed === 0) return 0;
    return Math.round((qualified / completed) * 100);
  };

  /**
   * 渲染工序卡片
   */
  const renderOperationCard = (operation: any, workOrder: WorkOrder, index: number, total: number) => {
    const progress = calculateProgress(operation, workOrder);
    const qualifiedRate = calculateQualifiedRate(operation);
    const progressColor = getProgressColor(operation, qualifiedRate);

    return (
      <div key={operation.id || index} style={{ display: 'inline-block', marginRight: 16, verticalAlign: 'top' }}>
        <Card
          size="small"
          style={{
            width: 200,
            border: operation.status === 'completed' ? '2px solid #52c41a' : 
                   operation.status === 'in_progress' ? '2px solid #1890ff' : 
                   '1px solid #d9d9d9',
          }}
          title={
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>
              {operation.operation_name}
            </div>
          }
          extra={
            <Tag color={
              operation.status === 'completed' ? 'success' :
              operation.status === 'in_progress' ? 'processing' :
              'default'
            }>
              {operation.status === 'completed' ? '已完成' :
               operation.status === 'in_progress' ? '进行中' :
               '待开始'}
            </Tag>
          }
        >
          {/* 环状图进度显示 */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <Progress
              type="circle"
              percent={progress}
              size={80}
              strokeColor={progressColor}
              format={(percent) => `${percent}%`}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              {operation.reporting_type === 'status' ? (
                <div>
                  <div>状态：{operation.status === 'completed' ? '已完成' : '未完成'}</div>
                </div>
              ) : (
                <div>
                  <div>完成：{operation.completed_quantity || 0} / {workOrder.quantity}</div>
                  <div>合格：{operation.qualified_quantity || 0} / 不合格：{operation.unqualified_quantity || 0}</div>
                  {operation.completed_quantity > 0 && (
                    <div style={{ color: qualifiedRate >= 95 ? '#52c41a' : qualifiedRate >= 80 ? '#faad14' : '#ff4d4f' }}>
                      合格率：{qualifiedRate}%
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 工序信息 */}
          <div style={{ fontSize: 12, color: '#666' }}>
            <div style={{ marginBottom: 4 }}>
              <strong>车间：</strong>{operation.workshop_name || '-'}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>工作中心：</strong>{operation.work_center_name || '-'}
            </div>
            {operation.planned_start_date && (
              <div style={{ marginBottom: 4 }}>
                <strong>计划时间：</strong>
                <div>{new Date(operation.planned_start_date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )}
            {operation.actual_start_date && (
              <div style={{ marginBottom: 4 }}>
                <strong>实际开始：</strong>
                <div>{new Date(operation.actual_start_date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )}
          </div>
        </Card>
        {/* 箭头连接（不是最后一个） */}
        {index < total - 1 && (
          <div style={{ display: 'inline-block', verticalAlign: 'top', marginTop: 100, marginRight: 16 }}>
            <RightOutlined style={{ fontSize: 20, color: '#d9d9d9' }} />
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染展开行内容
   */
  const renderExpandedRow = (record: WorkOrder) => {
    const operations = expandedOperationsMap[record.id!] || [];
    const loading = loadingOperationsMap[record.id!];

    if (loading) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      );
    }

    if (operations.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
          暂无工序信息
        </div>
      );
    }

    return (
      <div style={{ padding: '20px', backgroundColor: '#fafafa', overflowX: 'auto' }}>
        <div style={{ whiteSpace: 'nowrap' }}>
          {operations.map((operation: any, index: number) => 
            renderOperationCard(operation, record, index, operations.length)
          )}
        </div>
      </div>
    );
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: WorkOrder) => {
    try {
      // 加载完整详情数据
      const detail = await workOrderApi.get(record.id!.toString());
      setWorkOrderDetail(detail);
      
      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('work_order', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }

      // 加载工单工序列表
      try {
        const operations = await workOrderApi.getOperations(record.id!.toString());
        setWorkOrderOperations(operations);
      } catch (error) {
        console.error('获取工单工序列表失败:', error);
        setWorkOrderOperations([]);
      }
      
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理删除工单
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${keys.length} 个工单吗？`,
      onOk: async () => {
        try {
          // 批量删除
          await Promise.all(keys.map(key => workOrderApi.delete(key.toString())));
          messageApi.success('删除成功');
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
      // 移除显示字段（后端不需要）
      delete values.code_rule_display;
      
      // 自动处理编码规则逻辑：
      // 1. 如果手工填写了编码，优先使用手工编码
      // 2. 如果没有手工编码，使用编码规则生成
      // 3. 如果只有一条编码规则且未选择，自动使用该规则
      if (values.code) {
        // 如果手工填写了编码，移除 code_rule，使用手工编码
        delete values.code_rule;
      } else {
        // 如果没有手工编码，使用编码规则
        if (!values.code_rule && codeRuleList.length === 1) {
          // 只有一条编码规则，自动使用
          values.code_rule = codeRuleList[0].code;
        }
        // 如果既没有手工编码，也没有编码规则，后端会报错
        if (!values.code_rule) {
          messageApi.error('请填写工单编码或选择编码规则');
          throw new Error('请填写工单编码或选择编码规则');
        }
      }
      
      // 如果选择了产品，需要转换为产品编码和名称
      if (values.product_id && !isEdit) {
        const selectedProduct = productList.find(product => product.id === values.product_id);
        if (selectedProduct) {
          values.product_code = selectedProduct.code;
          values.product_name = selectedProduct.name;
        }
      }

      if (isEdit && currentWorkOrder?.id) {
        await workOrderApi.update(currentWorkOrder.id.toString(), values);
        messageApi.success('工单更新成功');
      } else {
        await workOrderApi.create(values);
        messageApi.success('工单创建成功！系统已自动匹配工艺路线并生成工序单');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<WorkOrder>[] = [
    {
      title: '工单编号',
      dataIndex: 'code',
    },
    {
      title: '工单名称',
      dataIndex: 'name',
    },
    {
      title: '产品编码',
      dataIndex: 'product_code',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
    },
    {
      title: '计划数量',
      dataIndex: 'quantity',
    },
    {
      title: '生产模式',
      dataIndex: 'production_mode',
      render: (_, record) => (
        <Tag color={record.production_mode === 'MTO' ? 'blue' : 'green'}>
          {record.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
        </Tag>
      ),
    },
    {
      title: '销售订单',
      dataIndex: 'sales_order_code',
      render: (_, record) => record.production_mode === 'MTO' ? record.sales_order_code || '-' : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '草稿': { text: '草稿', color: 'default' },
          '已下达': { text: '已下达', color: 'processing' },
          '生产中': { text: '生产中', color: 'processing' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (text: string) => {
        const priorityMap: Record<string, { text: string; color: string }> = {
          'low': { text: '低', color: 'default' },
          'normal': { text: '正常', color: 'blue' },
          'high': { text: '高', color: 'orange' },
          'urgent': { text: '紧急', color: 'red' },
        };
        const config = priorityMap[text || 'normal'] || { text: text || '正常', color: 'blue' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
    },
    {
      title: '实际开始时间',
      dataIndex: 'actual_start_date',
      valueType: 'dateTime',
      render: (text) => text || '-',
    },
    {
      title: '实际结束时间',
      dataIndex: 'actual_end_date',
      valueType: 'dateTime',
      render: (text) => text || '-',
    },
    {
      title: '已完成数量',
      dataIndex: 'completed_quantity',
      render: (text) => text || 0,
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 2,
      render: (text) => text || '-',
    },
  ];

  // 批量下达相关状态
  const [batchReleaseModalVisible, setBatchReleaseModalVisible] = useState(false);
  const [batchReleaseCheckResults, setBatchReleaseCheckResults] = useState<any[]>([]);
  const [batchReleaseLoading, setBatchReleaseLoading] = useState(false);

  /**
   * 处理批量下达工单（核心功能，新增）
   */
  const handleBatchRelease = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请至少选择一个工单');
      return;
    }

    setBatchReleaseLoading(true);
    setBatchReleaseModalVisible(true);
    
    try {
      // 获取选中的工单详情
      const workOrders = await Promise.all(
        selectedRowKeys.map((key) => workOrderApi.get(key.toString()))
      );

      // 执行智能检查
      const checkResults = await Promise.all(
        workOrders.map(async (wo) => {
          const checks: any = {
            workOrder: wo,
            passed: true,
            errors: [],
            warnings: [],
          };

          // 检查1：冻结工单检查
          if (wo.is_frozen) {
            checks.passed = false;
            checks.errors.push('工单已冻结，不能下达');
          }

          // 检查2：状态检查（只能下达草稿或已排产的工单）
          if (wo.status !== 'draft' && wo.status !== 'released') {
            checks.passed = false;
            checks.errors.push(`工单状态为"${wo.status}"，不能下达`);
          }

          // 检查3：齐套料检查（TODO: 调用后端API检查物料齐套情况）
          // 这里先模拟，后续对接后端API
          // const materialCheck = await checkMaterialAvailability(wo);
          // if (!materialCheck.available) {
          //   checks.warnings.push(`物料不齐套：${materialCheck.missingMaterials.join(', ')}`);
          // }

          // 检查4：交期风险评估（TODO: 调用后端API评估交期风险）
          // 这里先模拟，后续对接后端API
          // const deadlineRisk = await assessDeadlineRisk(wo);
          // if (deadlineRisk.risk === 'high') {
          //   checks.warnings.push(`交期风险高：预计延期${deadlineRisk.delayDays}天`);
          // }

          // 检查5：工作中心能力检查（TODO: 调用后端API检查工作中心产能）
          // 这里先模拟，后续对接后端API
          // const capacityCheck = await checkWorkCenterCapacity(wo);
          // if (capacityCheck.conflict) {
          //   checks.warnings.push(`工作中心产能冲突：${capacityCheck.conflictWorkCenters.join(', ')}`);
          // }

          // 检查6：计划时间检查（优化，新增）
          if (wo.planned_start_date && wo.planned_end_date) {
            const startDate = new Date(wo.planned_start_date);
            const endDate = new Date(wo.planned_end_date);
            const now = new Date();
            
            if (startDate > now) {
              checks.warnings.push(`计划开始时间在未来：${wo.planned_start_date}`);
            }
            
            if (endDate < now) {
              checks.errors.push(`计划结束时间已过期：${wo.planned_end_date}`);
              checks.passed = false;
            }
            
            if (startDate > endDate) {
              checks.errors.push('计划开始时间晚于结束时间');
              checks.passed = false;
            }
          }

          // 检查7：数量检查（优化，新增）
          if (!wo.quantity || wo.quantity <= 0) {
            checks.errors.push('工单数量无效或为0');
            checks.passed = false;
          }

          return checks;
        })
      );

      setBatchReleaseCheckResults(checkResults);
    } catch (error: any) {
      messageApi.error(error.message || '批量检查失败');
    } finally {
      setBatchReleaseLoading(false);
    }
  };

  /**
   * 处理提交批量下达
   */
  const handleSubmitBatchRelease = async (ignoreErrors: boolean = false) => {
    try {
      const workOrderIds = selectedRowKeys.map(key => Number(key));
      
      // 如果忽略错误，下达所有工单；否则只下达通过检查的工单
      const idsToRelease = ignoreErrors
        ? workOrderIds
        : batchReleaseCheckResults
            .filter(result => result.passed)
            .map(result => result.workOrder.id);

      if (idsToRelease.length === 0) {
        messageApi.warning('没有可下达的工单');
        return;
      }

      // 确认对话框（优化，新增）
      Modal.confirm({
        title: '确认批量下达',
        content: `确定要${ignoreErrors ? '强制' : ''}下达 ${idsToRelease.length} 个工单吗？${ignoreErrors ? '（将忽略所有错误和警告）' : ''}`,
        onOk: async () => {
          try {
            // 批量下达工单
            await Promise.all(
              idsToRelease.map(id => workOrderApi.release(id.toString()))
            );

            messageApi.success(`已批量下达 ${idsToRelease.length} 个工单`);
            setBatchReleaseModalVisible(false);
            setSelectedRowKeys([]);
            setBatchReleaseCheckResults([]);
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || '批量下达失败');
          }
        },
      });
    } catch (error: any) {
      messageApi.error(error.message || '批量下达失败');
    }
  };

  /**
   * 处理下达工单
   */
  const handleRelease = async (record: WorkOrder) => {
    try {
      await workOrderApi.release(record.id!.toString());
      messageApi.success('工单下达成功');
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error('工单下达失败');
    }
  };

  /**
   * 处理创建返工单
   */
  const handleCreateRework = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForRework(detail);
      setReworkModalVisible(true);
      setTimeout(() => {
        reworkFormRef.current?.setFieldsValue({
          original_work_order_id: detail.id,
          original_work_order_uuid: detail.uuid || detail.id?.toString(),
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          workshop_id: detail.workshop_id,
          workshop_name: detail.workshop_name,
          work_center_id: detail.work_center_id,
          work_center_name: detail.work_center_name,
          quantity: 1, // 默认返工数量为1
          rework_type: '返工',
          status: 'draft',
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理提交返工单表单
   */
  const handleSubmitRework = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForRework?.id) {
        throw new Error('原工单信息不存在');
      }
      // 使用ReworkOrderFromWorkOrderRequest格式
      const submitData = {
        rework_reason: values.rework_reason,
        rework_type: values.rework_type,
        quantity: values.quantity ? Number(values.quantity) : undefined,
        route_id: values.route_id || undefined,
        work_center_id: values.work_center_id || currentWorkOrderForRework.work_center_id || undefined,
        remarks: values.remarks || undefined,
      };
      await reworkOrderApi.createFromWorkOrder(currentWorkOrderForRework.id.toString(), submitData);
      messageApi.success('返工单创建成功');
      setReworkModalVisible(false);
      setCurrentWorkOrderForRework(null);
      reworkFormRef.current?.resetFields();
    } catch (error: any) {
      messageApi.error(error.message || '创建返工单失败');
      throw error;
    }
  };

  /**
   * 处理创建委外单
   */
  const handleCreateOutsource = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForOutsource(detail);
      
      // 加载供应商列表
      try {
        const suppliers = await supplierApi.list({ isActive: true });
        setSupplierList(suppliers || []);
      } catch (error) {
        console.error('加载供应商列表失败:', error);
        setSupplierList([]);
      }

      // 加载工单工序列表（如果还没有加载）
      if (!workOrderOperations || workOrderOperations.length === 0) {
        try {
          const operations = await workOrderApi.getOperations(record.id!.toString());
          setWorkOrderOperations(operations);
        } catch (error) {
          console.error('获取工单工序列表失败:', error);
        }
      }

      setOutsourceModalVisible(true);
      setTimeout(() => {
        outsourceFormRef.current?.resetFields();
      }, 100);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理提交委外单表单
   */
  const handleSubmitOutsource = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForOutsource?.id) {
        throw new Error('工单信息不存在');
      }
      
      const submitData = {
        work_order_operation_id: values.work_order_operation_id,
        supplier_id: values.supplier_id,
        outsource_quantity: values.outsource_quantity,
        unit_price: values.unit_price,
        planned_start_date: values.planned_start_date ? values.planned_start_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
        planned_end_date: values.planned_end_date ? values.planned_end_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
        remarks: values.remarks,
      };

      await outsourceOrderApi.createFromWorkOrder(currentWorkOrderForOutsource.id.toString(), submitData);
      messageApi.success('委外单创建成功');
      setOutsourceModalVisible(false);
      setCurrentWorkOrderForOutsource(null);
      outsourceFormRef.current?.resetFields();
    } catch (error: any) {
      messageApi.error(error.message || '创建委外单失败');
      throw error;
    }
  };

  /**
   * 处理冻结工单
   */
  const handleFreeze = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForFreeze(detail);
      setFreezeModalVisible(true);
      freezeFormRef.current?.resetFields();
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理解冻工单
   */
  const handleUnfreeze = async (record: WorkOrder) => {
    Modal.confirm({
      title: '确认解冻',
      content: `确定要解冻工单"${record.code}"吗？`,
      onOk: async () => {
        try {
          await workOrderApi.unfreeze(record.id!.toString());
          messageApi.success('工单解冻成功');
          actionRef.current?.reload();
          // 如果详情页打开，刷新详情
          if (workOrderDetail?.id === record.id) {
            const detail = await workOrderApi.get(record.id!.toString());
            setWorkOrderDetail(detail);
          }
        } catch (error: any) {
          messageApi.error(error.message || '工单解冻失败');
        }
      },
    });
  };

  /**
   * 处理提交冻结表单
   */
  const handleSubmitFreeze = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForFreeze?.id) {
        throw new Error('工单信息不存在');
      }
      await workOrderApi.freeze(currentWorkOrderForFreeze.id.toString(), values);
      messageApi.success('工单冻结成功');
      setFreezeModalVisible(false);
      setCurrentWorkOrderForFreeze(null);
      freezeFormRef.current?.resetFields();
      actionRef.current?.reload();
      // 如果详情页打开，刷新详情
      if (workOrderDetail?.id === currentWorkOrderForFreeze.id) {
        const detail = await workOrderApi.get(currentWorkOrderForFreeze.id.toString());
        setWorkOrderDetail(detail);
      }
    } catch (error: any) {
      messageApi.error(error.message || '工单冻结失败');
      throw error;
    }
  };

  /**
   * 处理设置工单优先级
   */
  const handleSetPriority = async (record: WorkOrder, newPriority: string) => {
    try {
      await workOrderApi.setPriority(record.id!.toString(), { priority: newPriority });
      messageApi.success('优先级设置成功');
      actionRef.current?.reload();
      // 如果详情页打开，刷新详情
      if (workOrderDetail?.id === record.id) {
        const detail = await workOrderApi.get(record.id!.toString());
        setWorkOrderDetail(detail);
      }
    } catch (error: any) {
      messageApi.error(error.message || '优先级设置失败');
    }
  };

  /**
   * 处理批量设置优先级
   */
  const handleBatchSetPriority = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请至少选择一个工单');
      return;
    }
    setBatchPriority('normal');
    setBatchPriorityModalVisible(true);
  };

  /**
   * 处理提交批量设置优先级
   */
  const handleSubmitBatchPriority = async () => {
    try {
      await workOrderApi.batchSetPriority({
        work_order_ids: selectedRowKeys.map(key => Number(key)),
        priority: batchPriority,
      });
      messageApi.success(`已批量设置 ${selectedRowKeys.length} 个工单的优先级`);
      setBatchPriorityModalVisible(false);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '批量设置优先级失败');
    }
  };

  /**
   * 处理合并工单
   */
  const handleMerge = () => {
    if (selectedRowKeys.length < 2) {
      messageApi.warning('请至少选择2个工单进行合并');
      return;
    }
    // 合并功能将在Modal中实现
    setMergeModalVisible(true);
  };

  /**
   * 处理提交合并工单
   */
  const handleSubmitMerge = async (values: any): Promise<void> => {
    try {
      const result = await workOrderApi.merge({
        work_order_ids: selectedRowKeys.map(key => Number(key)),
        remarks: values.remarks,
      });
      messageApi.success(`工单合并成功，新工单编码：${result.merged_work_order.code}`);
      setMergeModalVisible(false);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '工单合并失败');
      throw error;
    }
  };

  /**
   * 处理拆分工单
   */
  const handleSplit = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForSplit(detail);
      setSplitModalVisible(true);
      setSplitType('count');
      setSplitCount(2);
      setSplitQuantities([]);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理提交拆分表单
   */
  const handleSubmitSplit = async (): Promise<void> => {
    try {
      if (!currentWorkOrderForSplit?.id) {
        throw new Error('原工单信息不存在');
      }

      let splitData: any = {
        split_type: 'quantity',
        remarks: '',
      };

      if (splitType === 'count') {
        // 等量拆分
        splitData.split_count = splitCount;
      } else {
        // 指定数量拆分
        if (splitQuantities.length === 0 || splitQuantities.some(q => q <= 0)) {
          messageApi.error('请输入有效的拆分数量');
          return;
        }
        splitData.split_quantities = splitQuantities;
      }

      const result = await workOrderApi.split(currentWorkOrderForSplit.id.toString(), splitData);
      messageApi.success(`工单拆分成功，已拆分为 ${result.total_count} 个工单`);
      setSplitModalVisible(false);
      setCurrentWorkOrderForSplit(null);
      setSplitQuantities([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '工单拆分失败');
    }
  };

  /**
   * 添加拆分数量输入框
   */
  const handleAddSplitQuantity = () => {
    setSplitQuantities([...splitQuantities, 0]);
  };

  /**
   * 移除拆分数量输入框
   */
  const handleRemoveSplitQuantity = (index: number) => {
    const newQuantities = [...splitQuantities];
    newQuantities.splice(index, 1);
    setSplitQuantities(newQuantities);
  };

  /**
   * 更新拆分数量
   */
  const handleUpdateSplitQuantity = (index: number, value: number | null) => {
    const newQuantities = [...splitQuantities];
    newQuantities[index] = value || 0;
    setSplitQuantities(newQuantities);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<WorkOrder>[] = [
    {
      title: '工单编号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '产品',
      dataIndex: 'product_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '生产模式',
      dataIndex: 'production_mode',
      width: 100,
      valueEnum: {
        MTS: { text: '按库存生产', status: 'processing' },
        MTO: { text: '按订单生产', status: 'success' },
      },
    },
    {
      title: '销售订单',
      dataIndex: 'sales_order_code',
      width: 120,
      render: (text, record) => (
        record.production_mode === 'MTO' ? (
          <Tag color="blue">{text}</Tag>
        ) : (
          <span style={{ color: '#999' }}>无</span>
        )
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (text, record) => (
        <Space>
          <Tag
            color={
              text === '草稿' ? 'default' :
              text === '已下达' ? 'processing' :
              text === '生产中' ? 'processing' :
              text === '已完成' ? 'success' :
              'error'
            }
          >
            {text}
          </Tag>
          {record.is_frozen && (
            <Tag color="warning">已冻结</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (text: string) => {
        const priorityMap: Record<string, { text: string; color: string }> = {
          'low': { text: '低', color: 'default' },
          'normal': { text: '正常', color: 'blue' },
          'high': { text: '高', color: 'orange' },
          'urgent': { text: '紧急', color: 'red' },
        };
        const config = priorityMap[text || 'normal'] || { text: text || '正常', color: 'blue' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleRelease(record)}
            >
              下达
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<WorkOrder>
          headerTitle="工单管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await workOrderApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              });
              
              // 后端返回的是数组或分页格式，需要统一处理
              if (Array.isArray(response)) {
                // 后端直接返回数组
                return {
                  data: response,
                  success: true,
                  total: response.length,
                };
              } else if (response && typeof response === 'object') {
                // 后端返回分页格式 { data: [], success: true, total: 0 }
                return {
                  data: response.data || response.items || [],
                  success: response.success !== false,
                  total: response.total || (response.data || response.items || []).length,
                };
              }
              
              return {
                data: [],
                success: false,
                total: 0,
              };
            } catch (error) {
              console.error('获取工单列表失败:', error);
              messageApi.error('获取工单列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          expandable={{
            expandedRowKeys,
            onExpandedRowsChange: setExpandedRowKeys,
            onExpand: handleExpand,
            expandedRowRender: renderExpandedRow,
            expandRowByClick: true, // 支持双击行展开
          }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建工单
            </Button>,
            <Button
              key="batchPriority"
              onClick={handleBatchSetPriority}
              disabled={selectedRowKeys.length === 0}
            >
              批量设置优先级
            </Button>,
            <Button
              key="batchRelease"
              type="primary"
              onClick={handleBatchRelease}
              disabled={selectedRowKeys.length === 0}
            >
              批量下达
            </Button>,
            <Button
              key="merge"
              onClick={handleMerge}
              disabled={selectedRowKeys.length < 2}
            >
              合并工单
            </Button>,
          ]}
          onDelete={handleDelete}
        />
      </ListPageTemplate>

      {/* 创建/编辑工单 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑工单' : '新建工单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentWorkOrder(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        {codeRuleList.length === 0 ? (
          // 没有编码规则，显示手工填写编码
          <ProFormText
            name="code"
            label="工单编码"
            placeholder="请手工填写工单编码"
            disabled={isEdit}
            rules={[{ required: true, message: '请输入工单编码' }]}
            extra="未配置编码规则，请手工填写工单编码"
          />
        ) : codeRuleList.length === 1 ? (
          // 只有一条编码规则，自动使用（允许手工填写覆盖）
          <>
            <ProFormText
              name="code_rule_display"
              label="编码规则"
              disabled
              initialValue={`${codeRuleList[0].name} (${codeRuleList[0].code})`}
              extra="已自动选择编码规则，如需手工填写编码，请清空此字段并在下方填写"
            />
            {/* 隐藏字段，用于提交实际的 code_rule 值 */}
            <ProFormText name="code_rule" initialValue={codeRuleList[0].code} hidden />
            <ProFormText
              name="code"
              label="工单编码（可选，手工填写）"
              placeholder="如需手工填写编码，请在此输入（将覆盖编码规则）"
              disabled={isEdit}
              extra="如果填写了手工编码，将使用手工编码，否则使用编码规则自动生成"
            />
          </>
        ) : (
          // 有多条编码规则，显示选择框（也允许手工填写）
          <>
            <ProFormSelect
              name="code_rule"
              label="编码规则"
              placeholder="请选择编码规则（可选）"
              options={codeRuleList.map((rule: any) => ({
                label: `${rule.name} (${rule.code})`,
                value: rule.code,
              }))}
              disabled={isEdit}
              extra="如果选择了编码规则，将自动生成编码；也可以不选择，在下方手工填写编码"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <ProFormText
              name="code"
              label="工单编码（可选，手工填写）"
              placeholder="如需手工填写编码，请在此输入（将覆盖编码规则）"
              disabled={isEdit}
              extra="如果填写了手工编码，将使用手工编码，否则使用选择的编码规则自动生成"
            />
          </>
        )}
        <ProFormText
          name="name"
          label="工单名称"
          placeholder="请输入工单名称"
          rules={[{ required: true, message: '请输入工单名称' }]}
          disabled={isEdit}
        />
        <ProFormSelect
          name="production_mode"
          label="生产模式"
          placeholder="请选择生产模式"
          options={[
            { label: '按库存生产(MTS)', value: 'MTS' },
            { label: '按订单生产(MTO)', value: 'MTO' },
          ]}
          rules={[{ required: true, message: '请选择生产模式' }]}
          disabled={isEdit}
        />
        <ProFormSelect
          name="product_id"
          label="产品选择"
          placeholder="请选择产品"
          options={productList.map(product => ({
            label: `${product.code} - ${product.name}`,
            value: product.id,
          }))}
          rules={[{ required: true, message: '请选择产品' }]}
          disabled={isEdit}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
        <ProFormDigit
          name="quantity"
          label="计划数量"
          placeholder="请输入计划生产数量"
          min={0}
          precision={2}
          rules={[{ required: true, message: '请输入计划数量' }]}
        />
        <ProFormSelect
          name="priority"
          label="优先级"
          placeholder="请选择优先级"
          options={[
            { label: '低', value: 'low' },
            { label: '正常', value: 'normal' },
            { label: '高', value: 'high' },
            { label: '紧急', value: 'urgent' },
          ]}
          initialValue="normal"
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          width="md"
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          width="md"
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{
            rows: 4,
          }}
        />
      </FormModalTemplate>

      {/* 工单详情 Drawer */}
      <DetailDrawerTemplate<WorkOrder>
        title={`工单详情 - ${workOrderDetail?.code || ''}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setWorkOrderDetail(null);
          setDocumentRelations(null);
        }}
        dataSource={workOrderDetail || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        customContent={
          <>
            {/* 操作按钮区域 */}
            <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  onClick={() => handleCreateRework(workOrderDetail!)}
                  disabled={!workOrderDetail || workOrderDetail.status === 'cancelled'}
                >
                  创建返工单
                </Button>
                <Button
                  type="primary"
                  onClick={() => handleCreateOutsource(workOrderDetail!)}
                  disabled={!workOrderDetail || workOrderDetail.status === 'cancelled' || !workOrderOperations || workOrderOperations.length === 0}
                >
                  创建委外单
                </Button>
                <Button
                  type="default"
                  onClick={() => handleSplit(workOrderDetail!)}
                  disabled={!workOrderDetail || !['draft', 'released'].includes(workOrderDetail.status || '')}
                >
                  拆分工单
                </Button>
                {workOrderDetail?.is_frozen ? (
                  <Button
                    type="default"
                    onClick={() => handleUnfreeze(workOrderDetail!)}
                  >
                    解冻工单
                  </Button>
                ) : (
                  <Button
                    type="default"
                    danger
                    onClick={() => handleFreeze(workOrderDetail!)}
                    disabled={!workOrderDetail || workOrderDetail.status === 'cancelled' || workOrderDetail.status === 'completed'}
                  >
                    冻结工单
                  </Button>
                )}
                <Select
                  value={workOrderDetail?.priority || 'normal'}
                  onChange={(value) => handleSetPriority(workOrderDetail!, value)}
                  disabled={!workOrderDetail}
                  style={{ width: 120 }}
                >
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="normal">正常</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="urgent">紧急</Select.Option>
                </Select>
              </Space>
            </div>
            {documentRelations ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="单据关联">
                {documentRelations.upstream_count > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                      上游单据 ({documentRelations.upstream_count})
                    </div>
                    <Table
                      size="small"
                      columns={[
                        { title: '单据类型', dataIndex: 'document_type', width: 120 },
                        { title: '单据编号', dataIndex: 'document_code', width: 150 },
                        { title: '单据名称', dataIndex: 'document_name', width: 150 },
                        { 
                          title: '状态', 
                          dataIndex: 'status', 
                          width: 100,
                          render: (status: string) => <Tag>{status}</Tag>
                        },
                      ]}
                      dataSource={documentRelations.upstream_documents}
                      pagination={false}
                      rowKey={(record) => `${record.document_type}-${record.document_id}`}
                      bordered
                    />
                  </div>
                )}
                {documentRelations.downstream_count > 0 && (
                  <div>
                    <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                      下游单据 ({documentRelations.downstream_count})
                    </div>
                    <Table
                      size="small"
                      columns={[
                        { title: '单据类型', dataIndex: 'document_type', width: 120 },
                        { title: '单据编号', dataIndex: 'document_code', width: 150 },
                        { title: '单据名称', dataIndex: 'document_name', width: 150 },
                        { 
                          title: '状态', 
                          dataIndex: 'status', 
                          width: 100,
                          render: (status: string) => <Tag>{status}</Tag>
                        },
                      ]}
                      dataSource={documentRelations.downstream_documents}
                      pagination={false}
                      rowKey={(record) => `${record.document_type}-${record.document_id}`}
                      bordered
                    />
                  </div>
                )}
                {documentRelations.upstream_count === 0 && documentRelations.downstream_count === 0 && (
                  <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                    暂无关联单据
                  </div>
                )}
              </Card>
            </div>
            ) : null}

            {/* 工单工序管理 */}
            <div style={{ padding: '16px 0' }}>
              <Card 
                title="工单工序"
                extra={
                  workOrderDetail && ['draft', 'released'].includes(workOrderDetail.status || '') ? (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setCurrentOperation(null);
                        setOperationsModalVisible(true);
                        operationFormRef.current?.resetFields();
                      }}
                    >
                      添加工序
                    </Button>
                  ) : null
                }
              >
                <WorkOrderOperationsList
                  workOrderId={workOrderDetail?.id}
                  operations={workOrderOperations}
                  workOrderStatus={workOrderDetail?.status}
                  onUpdate={async () => {
                    if (workOrderDetail?.id) {
                      const operations = await workOrderApi.getOperations(workOrderDetail.id.toString());
                      setWorkOrderOperations(operations);
                    }
                  }}
                  onEdit={(operation) => {
                    setCurrentOperation(operation);
                    setOperationsModalVisible(true);
                    operationFormRef.current?.setFieldsValue(operation);
                  }}
                />
              </Card>
            </div>
          </>
        }
      />

      {/* 创建返工单Modal */}
      <FormModalTemplate
        title="创建返工单"
        open={reworkModalVisible}
        onCancel={() => {
          setReworkModalVisible(false);
          setCurrentWorkOrderForRework(null);
          reworkFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitRework}
        formRef={reworkFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormText
          name="original_work_order_id"
          label="原工单ID"
          disabled
        />
        <ProFormText
          name="product_code"
          label="产品编码"
          disabled
        />
        <ProFormText
          name="product_name"
          label="产品名称"
          disabled
        />
        <ProFormDigit
          name="quantity"
          label="返工数量"
          placeholder="请输入返工数量"
          rules={[{ required: true, message: '请输入返工数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSelect
          name="rework_type"
          label="返工类型"
          placeholder="请选择返工类型"
          rules={[{ required: true, message: '请选择返工类型' }]}
          options={[
            { label: '返工', value: '返工' },
            { label: '返修', value: '返修' },
            { label: '报废', value: '报废' },
          ]}
        />
        <ProFormTextArea
          name="rework_reason"
          label="返工原因"
          placeholder="请输入返工原因"
          rules={[{ required: true, message: '请输入返工原因' }]}
          fieldProps={{ rows: 3 }}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 创建委外单Modal */}
      <FormModalTemplate
        title="创建委外单"
        open={outsourceModalVisible}
        onCancel={() => {
          setOutsourceModalVisible(false);
          setCurrentWorkOrderForOutsource(null);
          outsourceFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitOutsource}
        formRef={outsourceFormRef}
        {...MODAL_CONFIG}
      >
        {currentWorkOrderForOutsource && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>工单编码：</strong>{currentWorkOrderForOutsource.code}</div>
                </Col>
                <Col span={12}>
                  <div><strong>产品名称：</strong>{currentWorkOrderForOutsource.product_name}</div>
                </Col>
              </Row>
            </Card>
            <ProFormSelect
              name="work_order_operation_id"
              label="选择工序"
              placeholder="请选择要委外的工序"
              rules={[{ required: true, message: '请选择要委外的工序' }]}
              options={workOrderOperations.map((op: any) => ({
                label: `${op.operation_name || op.operation_code} (序号: ${op.sequence || op.id})`,
                value: op.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
            />
            <ProFormSelect
              name="supplier_id"
              label="供应商"
              placeholder="请选择供应商"
              rules={[{ required: true, message: '请选择供应商' }]}
              options={supplierList.map(s => ({
                label: `${s.code} - ${s.name}`,
                value: s.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
              }}
            />
            <ProFormDigit
              name="outsource_quantity"
              label="委外数量"
              placeholder="请输入委外数量"
              rules={[{ required: true, message: '请输入委外数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="unit_price"
              label="单价"
              placeholder="请输入单价（可选）"
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDatePicker
              name="planned_start_date"
              label="计划开始时间"
              placeholder="请选择计划开始时间"
              fieldProps={{ showTime: true }}
            />
            <ProFormDatePicker
              name="planned_end_date"
              label="计划结束时间"
              placeholder="请选择计划结束时间"
              fieldProps={{ showTime: true }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注（可选）"
              fieldProps={{ rows: 3 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 拆分工单Modal */}
      <Modal
        title="拆分工单"
        open={splitModalVisible}
        onCancel={() => {
          setSplitModalVisible(false);
          setCurrentWorkOrderForSplit(null);
          setSplitQuantities([]);
          setSplitCount(2);
          setSplitType('count');
        }}
        onOk={handleSubmitSplit}
        width={600}
        okText="确认拆分"
        cancelText="取消"
      >
        {currentWorkOrderForSplit && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div><strong>原工单编码：</strong>{currentWorkOrderForSplit.code}</div>
              <div><strong>原工单名称：</strong>{currentWorkOrderForSplit.name}</div>
              <div><strong>原工单数量：</strong>{currentWorkOrderForSplit.quantity}</div>
            </div>
            
            <Form layout="vertical">
              <Form.Item label="拆分方式">
                <Radio.Group
                  value={splitType}
                  onChange={(e) => {
                    setSplitType(e.target.value);
                    if (e.target.value === 'count') {
                      setSplitQuantities([]);
                    } else {
                      setSplitCount(2);
                    }
                  }}
                >
                  <Radio value="count">等量拆分</Radio>
                  <Radio value="quantity">指定数量拆分</Radio>
                </Radio.Group>
              </Form.Item>

              {splitType === 'count' ? (
                <Form.Item label="拆分成几个工单">
                  <InputNumber
                    min={2}
                    max={100}
                    value={splitCount}
                    onChange={(value) => setSplitCount(value || 2)}
                    style={{ width: '100%' }}
                    placeholder="请输入拆分数（2-100）"
                  />
                  <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                    每个工单数量：{currentWorkOrderForSplit.quantity ? (Number(currentWorkOrderForSplit.quantity) / splitCount).toFixed(2) : 0}
                    {currentWorkOrderForSplit.quantity && Number(currentWorkOrderForSplit.quantity) % splitCount !== 0 && (
                      <span style={{ color: '#ff4d4f' }}>（不能整除，请使用指定数量拆分）</span>
                    )}
                  </div>
                </Form.Item>
              ) : (
                <Form.Item label="每个拆分工单的数量">
                  <div>
                    {splitQuantities.map((quantity, index) => (
                      <div key={index} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <InputNumber
                          min={0}
                          value={quantity}
                          onChange={(value) => handleUpdateSplitQuantity(index, value)}
                          style={{ flex: 1 }}
                          placeholder={`工单${index + 1}数量`}
                          precision={2}
                        />
                        <Button
                          type="link"
                          danger
                          onClick={() => handleRemoveSplitQuantity(index)}
                          disabled={splitQuantities.length <= 1}
                        >
                          删除
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={handleAddSplitQuantity}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      + 添加工单
                    </Button>
                    <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                      总数量：{splitQuantities.reduce((sum, q) => sum + q, 0).toFixed(2)} / {currentWorkOrderForSplit.quantity}
                      {splitQuantities.reduce((sum, q) => sum + q, 0) !== Number(currentWorkOrderForSplit.quantity) && (
                        <span style={{ color: '#ff4d4f' }}>（数量总和必须等于原工单数量）</span>
                      )}
                    </div>
                  </div>
                </Form.Item>
              )}
            </Form>
          </div>
        )}
      </Modal>

      {/* 工单工序编辑Modal */}
      <FormModalTemplate
        title={currentOperation ? '编辑工序' : '添加工序'}
        open={operationsModalVisible}
        onClose={() => {
          setOperationsModalVisible(false);
          setCurrentOperation(null);
          operationFormRef.current?.resetFields();
        }}
        onFinish={async (values: any) => {
          try {
            if (!workOrderDetail?.id) {
              throw new Error('工单ID不存在');
            }

            // 获取当前工序列表
            const currentOperations = await workOrderApi.getOperations(workOrderDetail.id.toString());
            
            // 如果是编辑，更新对应工序；如果是新增，添加到列表
            let updatedOperations: any[];
            if (currentOperation) {
              // 编辑：更新对应sequence的工序
              updatedOperations = currentOperations.map((op: any) => {
                if (op.id === currentOperation.id) {
                  return {
                    ...op,
                    ...values,
                    sequence: op.sequence, // 保持sequence不变
                  };
                }
                return op;
              });
            } else {
              // 新增：计算新的sequence
              const maxSequence = currentOperations.length > 0 
                ? Math.max(...currentOperations.map((op: any) => op.sequence || 0))
                : 0;
              updatedOperations = [
                ...currentOperations,
                {
                  ...values,
                  sequence: maxSequence + 1,
                },
              ];
            }

            // 更新工序列表（重新排序sequence）
            const sortedOperations = updatedOperations.map((op, index) => ({
              ...op,
              sequence: index + 1,
            }));

            await workOrderApi.updateOperations(workOrderDetail.id.toString(), {
              operations: sortedOperations,
            });

            messageApi.success(currentOperation ? '工序更新成功' : '工序添加成功');
            setOperationsModalVisible(false);
            setCurrentOperation(null);
            operationFormRef.current?.resetFields();

            // 刷新工序列表
            const operations = await workOrderApi.getOperations(workOrderDetail.id.toString());
            setWorkOrderOperations(operations);
          } catch (error: any) {
            messageApi.error(error.message || '操作失败');
            throw error;
          }
        }}
        formRef={operationFormRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormSelect
          name="operation_id"
          label="工序"
          placeholder="请选择工序"
          rules={[{ required: true, message: '请选择工序' }]}
          request={async () => {
            try {
              const operations = await operationApi.list({ is_active: true, limit: 1000 });
              return operations.map((op: any) => ({
                label: `${op.code} - ${op.name}`,
                value: op.id,
                operation: op,
              }));
            } catch (error) {
              return [];
            }
          }}
          fieldProps={{
            onChange: async (value: number, option: any) => {
              if (option?.operation) {
                const op = option.operation;
                operationFormRef.current?.setFieldsValue({
                  operation_code: op.code,
                  operation_name: op.name,
                });
              }
            },
          }}
        />
        <ProFormText
          name="operation_code"
          label="工序编码"
          disabled
        />
        <ProFormText
          name="operation_name"
          label="工序名称"
          disabled
        />
        <ProFormSelect
          name="workshop_id"
          label="车间"
          placeholder="请选择车间"
          request={async () => {
            try {
              const workshops = await workshopApi.list({ limit: 1000 });
              return workshops.map((ws: any) => ({
                label: ws.name,
                value: ws.id,
                workshop: ws,
              }));
            } catch (error) {
              return [];
            }
          }}
          fieldProps={{
            onChange: async (value: number, option: any) => {
              if (option?.workshop) {
                const ws = option.workshop;
                operationFormRef.current?.setFieldsValue({
                  workshop_name: ws.name,
                });
              }
            },
          }}
        />
        <ProFormText
          name="workshop_name"
          label="车间名称"
          disabled
        />
        <ProFormDigit
          name="standard_time"
          label="标准工时（小时）"
          placeholder="请输入标准工时"
          min={0}
          precision={2}
          initialValue={0}
        />
        <ProFormDigit
          name="setup_time"
          label="准备时间（小时）"
          placeholder="请输入准备时间"
          min={0}
          precision={2}
          initialValue={0}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 冻结工单Modal */}
      <FormModalTemplate
        title="冻结工单"
        open={freezeModalVisible}
        onClose={() => {
          setFreezeModalVisible(false);
          setCurrentWorkOrderForFreeze(null);
          freezeFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitFreeze}
        isEdit={false}
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        formRef={freezeFormRef}
      >
        <ProFormTextArea
          name="freeze_reason"
          label="冻结原因"
          placeholder="请输入冻结原因（必填）"
          rules={[{ required: true, message: '请输入冻结原因' }]}
          fieldProps={{
            rows: 4,
          }}
        />
      </FormModalTemplate>

      {/* 批量下达+智能检查Modal */}
      <Modal
        title="批量下达工单 - 智能检查结果"
        open={batchReleaseModalVisible}
        onCancel={() => {
          setBatchReleaseModalVisible(false);
          setBatchReleaseCheckResults([]);
        }}
        width={800}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setBatchReleaseModalVisible(false);
              setBatchReleaseCheckResults([]);
            }}
          >
            取消
          </Button>,
          <Button
            key="ignore"
            onClick={() => handleSubmitBatchRelease(true)}
            disabled={batchReleaseLoading}
          >
            忽略异常，强制下达所有
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => handleSubmitBatchRelease(false)}
            disabled={batchReleaseLoading || batchReleaseCheckResults.filter(r => r.passed).length === 0}
          >
            确认下达正常工单 ({batchReleaseCheckResults.filter(r => r.passed).length}个)
          </Button>,
        ]}
      >
        <Spin spinning={batchReleaseLoading}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {batchReleaseCheckResults.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {batchReleaseCheckResults.map((result, index) => (
                  <Card
                    key={index}
                    size="small"
                    style={{
                      border: result.passed ? '1px solid #52c41a' : '1px solid #ff4d4f',
                      backgroundColor: result.passed ? '#f6ffed' : '#fff2f0',
                    }}
                  >
                    <Row gutter={16}>
                      <Col span={6}>
                        <div><strong>工单编码：</strong>{result.workOrder.code}</div>
                      </Col>
                      <Col span={6}>
                        <div><strong>产品：</strong>{result.workOrder.product_name}</div>
                      </Col>
                      <Col span={6}>
                        <div><strong>状态：</strong>
                          <Tag color={result.passed ? 'success' : 'error'}>
                            {result.passed ? '通过' : '异常'}
                          </Tag>
                        </div>
                      </Col>
                      <Col span={6}>
                        {result.workOrder.is_frozen && (
                          <Tag color="error">已冻结</Tag>
                        )}
                      </Col>
                    </Row>
                    {result.errors.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>错误：</div>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {result.errors.map((error: string, i: number) => (
                            <li key={i} style={{ color: '#ff4d4f' }}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.warnings.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ color: '#faad14', fontWeight: 'bold' }}>警告：</div>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {result.warnings.map((warning: string, i: number) => (
                            <li key={i} style={{ color: '#faad14' }}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
              </Space>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                正在检查工单...
              </div>
            )}
          </div>
        </Spin>
      </Modal>

      {/* 批量设置优先级Modal */}
      <Modal
        title="批量设置优先级"
        open={batchPriorityModalVisible}
        onOk={handleSubmitBatchPriority}
        onCancel={() => setBatchPriorityModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 16 }}>
            已选择 <strong>{selectedRowKeys.length}</strong> 个工单
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>优先级：</div>
            <Select
              value={batchPriority}
              onChange={(value) => setBatchPriority(value)}
              style={{ width: '100%' }}
            >
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="normal">正常</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="urgent">紧急</Select.Option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* 合并工单Modal */}
      <FormModalTemplate
        title="合并工单"
        open={mergeModalVisible}
        onClose={() => {
          setMergeModalVisible(false);
          mergeFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitMerge}
        isEdit={false}
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        formRef={mergeFormRef}
      >
        <div style={{ marginBottom: 16 }}>
          <div>已选择 <strong>{selectedRowKeys.length}</strong> 个工单进行合并</div>
          <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
            注意：只能合并相同产品、相同状态（草稿或已下达）且未报工的工单
          </div>
        </div>
        <ProFormTextArea
          name="remarks"
          label="合并备注"
          placeholder="请输入合并备注（可选）"
          fieldProps={{
            rows: 3,
          }}
        />
      </FormModalTemplate>
    </>
  );
};

/**
 * 工单工序列表组件
 */
interface WorkOrderOperationsListProps {
  workOrderId?: number;
  operations: any[];
  workOrderStatus?: string;
  onUpdate: () => Promise<void>;
  onEdit: (operation: any) => void;
}

const WorkOrderOperationsList: React.FC<WorkOrderOperationsListProps> = ({
  workOrderId,
  operations,
  workOrderStatus,
  onUpdate,
  onEdit,
}) => {
  const { message: messageApi } = App.useApp();
  const [localOperations, setLocalOperations] = useState<any[]>(operations);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setLocalOperations(operations);
  }, [operations]);

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localOperations.findIndex((op) => op.id === active.id);
      const newIndex = localOperations.findIndex((op) => op.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // 检查是否有已报工的工序
      const movedOperation = localOperations[oldIndex];
      if (movedOperation.status !== 'pending' && movedOperation.status !== 'in_progress') {
        messageApi.warning('已报工的工序不允许调整顺序');
        return;
      }

      const newOperations = arrayMove(localOperations, oldIndex, newIndex);
      // 重新计算sequence
      const sortedOperations = newOperations.map((op, index) => ({
        ...op,
        sequence: index + 1,
      }));

      setLocalOperations(sortedOperations);

      // 保存到后端
      if (workOrderId) {
        try {
          setSaving(true);
          await workOrderApi.updateOperations(workOrderId.toString(), {
            operations: sortedOperations,
          });
          messageApi.success('工序顺序已更新');
          await onUpdate();
        } catch (error: any) {
          messageApi.error(error.message || '更新失败');
          // 恢复原顺序
          setLocalOperations(operations);
        } finally {
          setSaving(false);
        }
      }
    }
  };

  /**
   * 删除工序
   */
  const handleDelete = async (operation: any) => {
    if (operation.status !== 'pending' && operation.status !== 'in_progress') {
      messageApi.warning('已报工的工序不允许删除');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除工序"${operation.operation_name}"吗？`,
      onOk: async () => {
        try {
          if (!workOrderId) return;

          const updatedOperations = localOperations
            .filter((op) => op.id !== operation.id)
            .map((op, index) => ({
              ...op,
              sequence: index + 1,
            }));

          await workOrderApi.updateOperations(workOrderId.toString(), {
            operations: updatedOperations,
          });

          messageApi.success('工序删除成功');
          await onUpdate();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const canEdit = workOrderStatus && ['draft', 'released'].includes(workOrderStatus);

  if (localOperations.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999' }}>
        暂无工序
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={localOperations.map((op) => op.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {localOperations.map((operation) => {
            const isReported = operation.status !== 'pending' && operation.status !== 'in_progress';
            return (
              <SortableOperationItem
                key={operation.id}
                operation={operation}
                canEdit={canEdit && !isReported}
                isReported={isReported}
                onEdit={() => onEdit(operation)}
                onDelete={() => handleDelete(operation)}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
};

/**
 * 可拖拽的工序项组件
 */
interface SortableOperationItemProps {
  operation: any;
  canEdit: boolean;
  isReported: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const SortableOperationItem: React.FC<SortableOperationItemProps> = ({
  operation,
  canEdit,
  isReported,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: operation.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isReported ? '#f5f5f5' : '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '8px',
    cursor: canEdit ? 'grab' : 'not-allowed',
  };

  const statusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待开始', color: 'default' },
    in_progress: { text: '进行中', color: 'processing' },
    completed: { text: '已完成', color: 'success' },
    cancelled: { text: '已取消', color: 'error' },
  };

  const statusConfig = statusMap[operation.status] || { text: operation.status, color: 'default' };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {canEdit && (
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HolderOutlined style={{ color: '#999' }} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: isReported ? '#999' : '#000' }}>
              {operation.sequence}. {operation.operation_name || operation.name}
            </span>
            <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
            {isReported && <Tag color="warning">已报工</Tag>}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            <Space split={<span>|</span>}>
              <span>编码: {operation.operation_code || operation.code}</span>
              {operation.workshop_name && <span>车间: {operation.workshop_name}</span>}
              {operation.standard_time > 0 && <span>标准工时: {operation.standard_time}h</span>}
              {operation.planned_start_date && (
                <span>计划: {dayjs(operation.planned_start_date).format('YYYY-MM-DD HH:mm')}</span>
              )}
            </Space>
          </div>
        </div>
        {canEdit && (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={onEdit}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除"
              description={`确定要删除工序"${operation.operation_name || operation.name}"吗？`}
              onConfirm={onDelete}
            >
              <Button
                type="link"
                size="small"
                danger
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>
    </div>
  );
};

export default WorkOrdersPage;

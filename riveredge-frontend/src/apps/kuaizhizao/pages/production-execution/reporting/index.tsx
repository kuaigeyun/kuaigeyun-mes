/**
 * 报工管理页面
 *
 * 提供报工记录的管理和查询功能，支持移动端扫码报工。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDigit, ProFormTextArea, ProFormRadio, ProFormText, ProFormDatePicker, ProFormSwitch } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Input, Alert, Spin, Form, Radio } from 'antd';
import { QrcodeOutlined, ScanOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, WarningOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { reportingApi, workOrderApi, materialBindingApi } from '../../../services/production';
import { getReportingLifecycle } from '../../../utils/reportingLifecycle';
import { materialApi } from '../../../../master-data/services/material';
import { sopApi } from '../../../../master-data/services/process';
import { getUserInfo } from '../../../../../utils/auth';

/** 报工记录（后端返回 snake_case） */
interface ReportingRecord {
  id: number;
  work_order_code: string;
  work_order_name: string;
  operation_name: string;
  worker_name: string;
  reported_quantity: number;
  qualified_quantity: number;
  unqualified_quantity: number;
  work_hours: number;
  status: 'pending' | 'approved' | 'rejected';
  reported_at: string;
  remarks?: string;
  sop_parameters?: Record<string, any>;
}

const ReportingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // 报工Modal状态
  const [reportingModalVisible, setReportingModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const scanFormRef = useRef<any>(null);

  // 扫码报工Modal状态
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanWorkOrderCode, setScanWorkOrderCode] = useState<string>('');
  const [currentWorkOrder, setCurrentWorkOrder] = useState<any>(null);
  const [workOrderOperations, setWorkOrderOperations] = useState<any[]>([]);
  const [currentOperation, setCurrentOperation] = useState<any>(null);
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [jumpRuleError, setJumpRuleError] = useState<string>('');

  // 报废记录Modal状态
  const [scrapModalVisible, setScrapModalVisible] = useState(false);
  const [currentReportingRecord, setCurrentReportingRecord] = useState<ReportingRecord | null>(null);
  const scrapFormRef = useRef<any>(null);

  // 不良品记录Modal状态
  const [defectModalVisible, setDefectModalVisible] = useState(false);
  const [currentReportingRecordForDefect, setCurrentReportingRecordForDefect] = useState<ReportingRecord | null>(null);
  const defectFormRef = useRef<any>(null);

  // 数据修正Modal状态
  const [correctModalVisible, setCorrectModalVisible] = useState(false);
  const [currentReportingRecordForCorrect, setCurrentReportingRecordForCorrect] = useState<ReportingRecord | null>(null);
  const correctFormRef = useRef<any>(null);

  // 工站上下料物料绑定状态
  const [materialBindingVisible, setMaterialBindingVisible] = useState(false);
  const [bindingType, setBindingType] = useState<'feeding' | 'discharging' | null>(null);
  const [feedingList, setFeedingList] = useState<any[]>([]);
  const [dischargingList, setDischargingList] = useState<any[]>([]);
  const materialBindingFormRef = useRef<any>(null);
  const [materialList, setMaterialList] = useState<any[]>([]);

  // SOP参数收集状态
  const [sopFormConfig, setSopFormConfig] = useState<any>(null);
  const [loadingSOP, setLoadingSOP] = useState(false);
  const [currentSOP, setCurrentSOP] = useState<any>(null);

  // 子工艺路线报工状态
  const [subOperations, setSubOperations] = useState<any[]>([]); // 当前主工序的子工序列表
  const [currentSubOperation, setCurrentSubOperation] = useState<any>(null); // 当前选中的子工序
  const [subOperationReportingVisible, setSubOperationReportingVisible] = useState(false); // 子工序报工Modal
  const subOperationFormRef = useRef<any>(null);

  // 新建报工状态（工单、工序列表）
  const [reportWorkOrders, setReportWorkOrders] = useState<any[]>([]);
  const [reportOperations, setReportOperations] = useState<any[]>([]);
  const [reportWorkOrderId, setReportWorkOrderId] = useState<number | null>(null);
  const [reportOperationId, setReportOperationId] = useState<number | null>(null);

  /** 获取报工员工信息：优先使用工序派工的 assigned_worker，否则使用当前登录用户 */
  const getWorkerInfo = (operation?: any) => {
    const user = getUserInfo();
    if (operation?.assigned_worker_id) {
      return { worker_id: operation.assigned_worker_id, worker_name: operation.assigned_worker_name || user?.full_name || user?.username || '操作员' };
    }
    return { worker_id: user?.id ?? 0, worker_name: user?.full_name || user?.username || '当前用户' };
  };

  /**
   * 处理扫码报工
   */
  const handleScanReporting = () => {
    setScanModalVisible(true);
    setScanWorkOrderCode('');
    setCurrentWorkOrder(null);
    setWorkOrderOperations([]);
    setCurrentOperation(null);
    setJumpRuleError('');
  };

  /**
   * 处理扫码输入（模拟扫码功能）
   */
  const handleScanInput = async (value: string) => {
    if (!value || value.trim() === '') {
      return;
    }

    setLoadingOperations(true);
    setJumpRuleError('');

    try {
      // 根据工单编码获取工单信息
      const workOrders = await workOrderApi.list({ code: value.trim() });
      if (!workOrders || workOrders.length === 0) {
        messageApi.error('未找到该工单');
        setLoadingOperations(false);
        return;
      }

      const workOrder = workOrders[0];
      setCurrentWorkOrder(workOrder);

      // 获取工单工序列表
      const operations = await workOrderApi.getOperations(workOrder.id.toString());
      setWorkOrderOperations(operations || []);

      // 自动选择第一个未完成的工序
      const pendingOperation = operations?.find((op: any) => op.status !== 'completed');
      if (pendingOperation) {
        setCurrentOperation(pendingOperation);
        // 检查跳转规则
        await checkJumpRule(pendingOperation, operations);
        // 加载 SOP（传入 workOrder、operations 因 state 可能尚未更新）
        await handleSelectOperation(pendingOperation.operation_id, workOrder, operations);
      } else {
        messageApi.warning('该工单所有工序已完成');
      }
    } catch (error: any) {
      messageApi.error(error.message || '获取工单信息失败');
    } finally {
      setLoadingOperations(false);
    }
  };

  /**
   * 检查工序跳转规则
   */
  const checkJumpRule = async (operation: any, allOperations: any[]) => {
    if (operation.allow_jump) {
      setJumpRuleError('');
      return;
    }

    // 检查前序工序是否完成
    const previousOperations = allOperations.filter(
      (op: any) => op.sequence < operation.sequence && op.status !== 'completed'
    );

    if (previousOperations.length > 0) {
      const prevOpNames = previousOperations.map((op: any) => op.operation_name).join('、');
      setJumpRuleError(`工序跳转规则：必须先完成前序工序 "${prevOpNames}" 才能报工当前工序`);
    } else {
      setJumpRuleError('');
    }
  };

  /**
   * 检查工序是否有子工艺路线
   * 
   * 注意：这是一个简化的实现，通过检查后续工序的sequence是否连续来判断是否有子工序
   * 理想情况下应该从后端获取明确的parent_operation_id信息
   * 
   * 简化逻辑：
   * 1. 如果下一个工序的sequence是currentSequence+1，可能是子工序
   * 2. 如果后续有多个连续的sequence，且下一个主工序的sequence不连续，则这些是子工序
   * 3. 如果后续所有工序的sequence都连续，且没有明显的主工序，则可能是子工序
   */
  const checkSubOperations = (operation: any, allOperations: any[]) => {
    const currentSequence = operation.sequence;
    const subOps: any[] = [];
    
    // 查找sequence大于当前工序的所有工序
    const followingOps = allOperations
      .filter((op: any) => op.sequence > currentSequence)
      .sort((a: any, b: any) => a.sequence - b.sequence);
    
    if (followingOps.length === 0) {
      return subOps;
    }
    
    // 检查下一个工序的sequence是否连续
    // 如果下一个工序的sequence是currentSequence+1，可能是子工序
    const nextOp = followingOps[0];
    if (nextOp.sequence === currentSequence + 1) {
      // 查找下一个主工序（sequence不连续，或者sequence间隔较大）
      // 简化判断：如果后续工序的sequence都连续，且数量>=2，可能是子工序
      let consecutiveCount = 1;
      for (let i = 1; i < followingOps.length; i++) {
        if (followingOps[i].sequence === currentSequence + 1 + i) {
          consecutiveCount++;
        } else {
          break;
        }
      }
      
      // 如果连续数量>=2，认为是子工序
      // 或者如果只有一个后续工序，且sequence连续，也可能是子工序
      if (consecutiveCount >= 1) {
        // 收集连续的子工序
        for (let i = 0; i < consecutiveCount && i < followingOps.length; i++) {
          subOps.push(followingOps[i]);
        }
      }
    }
    
    return subOps;
  };

  /**
   * 处理选择工序
   * @param operationId 工序ID
   * @param workOrderOverride 可选，扫码后自动选择时传入工单（此时 currentWorkOrder 可能尚未更新）
   * @param operationsOverride 可选，扫码后传入工序列表（此时 workOrderOperations 可能尚未更新）
   */
  const handleSelectOperation = async (operationId: number, workOrderOverride?: any, operationsOverride?: any[]) => {
    const ops = operationsOverride ?? workOrderOperations;
    const operation = ops.find((op: any) => op.operation_id === operationId);
    if (operation) {
      setCurrentOperation(operation);
      await checkJumpRule(operation, ops);
      
      // 检查是否有子工艺路线（核心功能，新增）
      const subOps = checkSubOperations(operation, ops);
      setSubOperations(subOps);
      setCurrentSubOperation(null);
      
      // 加载SOP参数配置（按工单+工序匹配，支持不同产品相同工序不同SOP）
      const workOrderForSop = workOrderOverride ?? currentWorkOrder;
      setLoadingSOP(true);
      try {
        const sop = workOrderForSop
          ? await sopApi.getForReporting(workOrderForSop.id, operation.operation_id)
          : null;
        if (sop) {
          setCurrentSOP(sop);
          if (sop.formConfig && sop.formConfig.properties && Object.keys(sop.formConfig.properties).length > 0) {
            setSopFormConfig(sop.formConfig);
            // 初始化参数值
            const initialParams: Record<string, any> = {};
            if (sop.formConfig.properties) {
              Object.keys(sop.formConfig.properties).forEach((key) => {
                const formConfig = (sop as any).formConfig;
                const field = formConfig.properties[key];
                if (field.default !== undefined) {
                  initialParams[key] = field.default;
                }
              });
            }
            // Initial params handled elsewhere
            // 设置表单初始值
            setTimeout(() => {
              scanFormRef.current?.setFieldsValue({
                sop_params: initialParams,
              });
            }, 100);
            
            // 自动填充报工数据（根据工艺路线）
            setTimeout(() => {
              const autoFillValues: any = {};
              const wo = workOrderForSop;
              // 自动填充工时（根据标准工时和工单数量计算）
              if (operation.standard_time && wo) {
                const estimatedWorkHours = parseFloat(operation.standard_time.toString()) * parseFloat(wo.quantity.toString());
                autoFillValues.work_hours = estimatedWorkHours;
              }
              // 按数量报工时，自动填充完成数量（默认等于工单数量）
              if (operation.reporting_type === 'quantity' && wo) {
                const remainingQuantity = parseFloat(wo.quantity.toString()) - (parseFloat(operation.completed_quantity?.toString() || '0'));
                if (remainingQuantity > 0) {
                  autoFillValues.reported_quantity = remainingQuantity;
                  // 默认合格数量等于完成数量
                  autoFillValues.qualified_quantity = remainingQuantity;
                  autoFillValues.unqualified_quantity = 0;
                }
              }
              
              // 按状态报工时，默认选择"完成"
              if (operation.reporting_type === 'status') {
                autoFillValues.completed_status = 'completed';
              }
              
              if (Object.keys(autoFillValues).length > 0) {
                scanFormRef.current?.setFieldsValue(autoFillValues);
              }
            }, 200);
          } else {
            setSopFormConfig(null);
            // Clear SOP parameters
            setCurrentSOP(null);
          }
        } else {
          setSopFormConfig(null);
          // Clear SOP parameters
          setCurrentSOP(null);
        }
      } catch (error: any) {
        console.error('获取SOP信息失败:', error);
        messageApi.warning('获取SOP信息失败，将不显示参数收集表单');
        setSopFormConfig(null);
        // Clear SOP parameters
        setCurrentSOP(null);
      } finally {
        setLoadingSOP(false);
      }
    }
  };

  /**
   * 处理添加上料绑定
   */
  const handleAddFeeding = () => {
    setBindingType('feeding');
    setMaterialBindingVisible(true);
    materialBindingFormRef.current?.resetFields();
  };

  /**
   * 处理添加下料绑定
   */
  const handleAddDischarging = () => {
    setBindingType('discharging');
    setMaterialBindingVisible(true);
    materialBindingFormRef.current?.resetFields();
  };

  /**
   * 处理提交物料绑定
   */
  const handleSubmitMaterialBinding = async (values: any) => {
    try {
      const bindingData = {
        material_id: values.material_id,
        material_code: values.material_code || '',
        material_name: values.material_name || '',
        batch_no: values.batch_no || '',
        barcode: values.barcode || '',
        quantity: values.quantity,
        warehouse_id: values.warehouse_id || null,
        location_id: values.location_id || null,
        location_code: values.location_code || '',
        binding_method: values.barcode ? 'scan' : 'manual',
        remarks: values.remarks || '',
      };

      if (bindingType === 'feeding') {
        setFeedingList([...feedingList, bindingData]);
      } else {
        setDischargingList([...dischargingList, bindingData]);
      }

      setMaterialBindingVisible(false);
      setBindingType(null);
      materialBindingFormRef.current?.resetFields();
      messageApi.success(`${bindingType === 'feeding' ? '上料' : '下料'}绑定添加成功`);
    } catch (error: any) {
      messageApi.error(error.message || '添加物料绑定失败');
      throw error;
    }
  };

  /**
   * 处理删除上料绑定
   */
  const handleRemoveFeeding = (index: number) => {
    const newList = [...feedingList];
    newList.splice(index, 1);
    setFeedingList(newList);
  };

  /**
   * 处理删除下料绑定
   */
  const handleRemoveDischarging = (index: number) => {
    const newList = [...dischargingList];
    newList.splice(index, 1);
    setDischargingList(newList);
  };

  /**
   * 初始化物料列表
   */
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const materials = await materialApi.list({ isActive: true });
        setMaterialList(materials || []);
      } catch (error) {
        console.error('获取物料列表失败:', error);
        setMaterialList([]);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 根据SOP form_config渲染参数表单字段（核心功能，新增）
   */
  const renderSOPParameters = () => {
    if (!sopFormConfig || !sopFormConfig.properties) {
      return null;
    }

    const fields: React.ReactNode[] = [];
    Object.entries(sopFormConfig.properties).forEach(([fieldCode, fieldSchema]: [string, any]) => {
      const fieldName = `sop_params.${fieldCode}`;
      const label = fieldSchema.title || fieldCode;
      const placeholder = fieldSchema['x-component-props']?.placeholder || fieldSchema.description || `请输入${label}`;
      const required = fieldSchema.required || false;
      const component = fieldSchema['x-component'] || 'Input';
      const componentProps = fieldSchema['x-component-props'] || {};
      const defaultValue = fieldSchema.default;

      // 根据组件类型渲染不同的ProForm组件
      switch (component) {
        case 'Input':
        case 'Input.Text':
          fields.push(
            <ProFormText
              key={fieldCode}
              name={fieldName}
              label={label}
              placeholder={placeholder}
              rules={required ? [{ required: true, message: `请输入${label}` }] : []}
              initialValue={defaultValue}
              fieldProps={componentProps}
            />
          );
          break;
        case 'Input.TextArea':
          fields.push(
            <ProFormTextArea
              key={fieldCode}
              name={fieldName}
              label={label}
              placeholder={placeholder}
              rules={required ? [{ required: true, message: `请输入${label}` }] : []}
              initialValue={defaultValue}
              fieldProps={componentProps}
            />
          );
          break;
        case 'InputNumber':
        case 'NumberPicker':
          fields.push(
            <ProFormDigit
              key={fieldCode}
              name={fieldName}
              label={label}
              placeholder={placeholder}
              rules={required ? [{ required: true, message: `请输入${label}` }] : []}
              initialValue={defaultValue}
              fieldProps={componentProps}
            />
          );
          break;
        case 'Select':
          fields.push(
            <ProFormSelect
              key={fieldCode}
              name={fieldName}
              label={label}
              placeholder={placeholder}
              rules={required ? [{ required: true, message: `请选择${label}` }] : []}
              initialValue={defaultValue}
              options={fieldSchema.enum ? fieldSchema.enum.map((val: any, idx: number) => ({
                label: fieldSchema.enumNames?.[idx] || val,
                value: val,
              })) : []}
              fieldProps={componentProps}
            />
          );
          break;
        case 'DatePicker':
          fields.push(
            <ProFormDatePicker
              key={fieldCode}
              name={fieldName}
              label={label}
              placeholder={placeholder}
              rules={required ? [{ required: true, message: `请选择${label}` }] : []}
              initialValue={defaultValue}
              fieldProps={componentProps}
            />
          );
          break;
        case 'Switch':
          fields.push(
            <ProFormSwitch
              key={fieldCode}
              name={fieldName}
              label={label}
              rules={required ? [{ required: true, message: `请选择${label}` }] : []}
              initialValue={defaultValue !== undefined ? defaultValue : false}
              fieldProps={componentProps}
            />
          );
          break;
        case 'Radio.Group':
          fields.push(
            <ProFormRadio.Group
              key={fieldCode}
              name={fieldName}
              label={label}
              rules={required ? [{ required: true, message: `请选择${label}` }] : []}
              initialValue={defaultValue}
              options={fieldSchema.enum ? fieldSchema.enum.map((val: any, idx: number) => ({
                label: fieldSchema.enumNames?.[idx] || val,
                value: val,
              })) : []}
              fieldProps={componentProps}
            />
          );
          break;
        default:
          // 默认使用文本输入框
          fields.push(
            <ProFormText
              key={fieldCode}
              name={fieldName}
              label={label}
              placeholder={placeholder}
              rules={required ? [{ required: true, message: `请输入${label}` }] : []}
              initialValue={defaultValue}
              fieldProps={componentProps}
            />
          );
      }
    });

    if (fields.length === 0) {
      return null;
    }

    return (
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 16 }}>SOP参数收集：</div>
        <Card size="small" style={{ backgroundColor: '#fafafa' }}>
          {fields}
        </Card>
      </div>
    );
  };

  /**
   * 处理新建报工（打开弹窗并加载工单列表）
   */
  const handleNewReporting = async () => {
    setReportingModalVisible(true);
    formRef.current?.resetFields();
    setReportOperations([]);
    setReportWorkOrderId(null);
    setReportOperationId(null);
    try {
      const workOrders = await workOrderApi.list({ status: 'in_progress', limit: 200 });
      const list = Array.isArray(workOrders) ? workOrders : (workOrders as any)?.data ?? (workOrders as any)?.items ?? [];
      setReportWorkOrders(Array.isArray(list) ? list : []);
    } catch (e) {
      messageApi.error('加载工单列表失败');
      setReportWorkOrders([]);
    }
  };

  /**
   * 新建报工：工单变更时加载工序
   */
  const handleReportWorkOrderChange = async (workOrderId: number) => {
    setReportWorkOrderId(workOrderId);
    setReportOperations([]);
    setReportOperationId(null);
    formRef.current?.setFieldsValue({ operation_id: undefined });
    if (!workOrderId) return;
    try {
      const operations = await workOrderApi.getOperations(workOrderId.toString());
      const ops = Array.isArray(operations) ? operations : (operations as any)?.data ?? (operations as any)?.items ?? [];
      setReportOperations(Array.isArray(ops) ? ops : []);
    } catch (e) {
      messageApi.error('加载工序列表失败');
      setReportOperations([]);
    }
  };

  /**
   * 新建报工：工序变更时自动填充
   */
  const handleReportOperationChange = (operationId: number) => {
    setReportOperationId(operationId);
    const operation = (Array.isArray(reportOperations) ? reportOperations : []).find((op: any) => op.operation_id === operationId);
    const workOrder = (Array.isArray(reportWorkOrders) ? reportWorkOrders : []).find((wo: any) => wo.id === reportWorkOrderId);
    if (!operation || !workOrder) return;
    const autoFillValues: any = {};
    if (operation.standard_time) {
      autoFillValues.work_hours = parseFloat(operation.standard_time.toString()) * parseFloat(workOrder.quantity?.toString() || '1');
    }
    if (operation.reporting_type === 'quantity') {
      const remaining = parseFloat(workOrder.quantity?.toString() || '0') - parseFloat(operation.completed_quantity?.toString() || '0');
      if (remaining > 0) {
        autoFillValues.reported_quantity = remaining;
        autoFillValues.qualified_quantity = remaining;
      }
    }
    if (operation.reporting_type === 'status') {
      autoFillValues.completed_status = 'completed';
    }
    if (Object.keys(autoFillValues).length > 0) {
      setTimeout(() => formRef.current?.setFieldsValue(autoFillValues), 100);
    }
  };

  /**
   * 处理报工提交
   */
  const handleReportingSubmit = async (values: any) => {
    try {
      // 如果是扫码报工模式
      if (scanModalVisible && currentWorkOrder && currentOperation) {
        const { worker_id, worker_name } = getWorkerInfo(currentOperation);
        const reportingData = {
          work_order_id: currentWorkOrder.id,
          work_order_code: currentWorkOrder.code,
          work_order_name: currentWorkOrder.name,
          operation_id: currentOperation.operation_id,
          operation_code: currentOperation.operation_code,
          operation_name: currentOperation.operation_name,
          worker_id,
          worker_name,
          reported_quantity: values.reported_quantity || (values.completed_status === 'completed' ? 1 : 0),
          qualified_quantity: values.qualified_quantity || 0,
          unqualified_quantity: values.unqualified_quantity || 0,
          work_hours: values.work_hours || 0,
          status: 'pending',
          reported_at: new Date().toISOString(),
          remarks: values.remarks,
        };

        await reportingApi.create(reportingData);
        messageApi.success('报工成功');
        setScanModalVisible(false);
        setCurrentWorkOrder(null);
        setWorkOrderOperations([]);
        setCurrentOperation(null);
        setScanWorkOrderCode('');
        actionRef.current?.reload();
        return;
      }

      // 新建报工：从工单+工序构建完整 payload
      const workOrder = (Array.isArray(reportWorkOrders) ? reportWorkOrders : []).find((wo: any) => wo.id === values.work_order_id);
      const operation = (Array.isArray(reportOperations) ? reportOperations : []).find((op: any) => op.operation_id === values.operation_id);
      if (!workOrder || !operation) {
        messageApi.error('工单或工序信息不存在');
        throw new Error('工单或工序未选择');
      }
      const { worker_id, worker_name } = getWorkerInfo(operation);
      const reportingData: any = {
        work_order_id: workOrder.id,
        work_order_code: workOrder.code,
        work_order_name: workOrder.name,
        operation_id: operation.operation_id,
        operation_code: operation.operation_code,
        operation_name: operation.operation_name,
        worker_id,
        worker_name,
        status: 'pending',
        reported_at: new Date().toISOString(),
        remarks: values.remarks,
        work_hours: values.work_hours || 0,
      };
      if (operation.reporting_type === 'status') {
        reportingData.reported_quantity = values.completed_status === 'completed' ? 1 : 0;
        reportingData.qualified_quantity = values.completed_status === 'completed' ? 1 : 0;
        reportingData.unqualified_quantity = 0;
      } else {
        reportingData.reported_quantity = values.reported_quantity || 0;
        reportingData.qualified_quantity = values.qualified_quantity ?? values.reported_quantity ?? 0;
        reportingData.unqualified_quantity = (values.reported_quantity || 0) - (values.qualified_quantity ?? values.reported_quantity ?? 0);
      }
      await reportingApi.create(reportingData);
      messageApi.success('报工成功');
      setReportingModalVisible(false);
      formRef.current?.resetFields();
      setReportOperations([]);
      setReportWorkOrderId(null);
      setReportOperationId(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '报工失败');
      throw error;
    }
  };

  /**
   * 处理创建报废记录
   */
  const handleCreateScrap = (record: ReportingRecord) => {
    if ((record.unqualified_quantity || 0) <= 0) {
      messageApi.warning('该报工记录没有不合格数量，无法创建报废记录');
      return;
    }
    setCurrentReportingRecord(record);
    setScrapModalVisible(true);
    setTimeout(() => {
      scrapFormRef.current?.setFieldsValue({
        scrap_quantity: record.unqualified_quantity,
        scrap_type: 'other',
      });
    }, 100);
  };

  /**
   * 处理提交报废记录
   */
  const handleSubmitScrap = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecord?.id) {
        throw new Error('报工记录信息不存在');
      }

      await reportingApi.recordScrap(currentReportingRecord.id.toString(), values);
      messageApi.success('报废记录创建成功');
      setScrapModalVisible(false);
      setCurrentReportingRecord(null);
      scrapFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建报废记录失败');
      throw error;
    }
  };

  /**
   * 处理创建不良品记录
   */
  const handleCreateDefect = (record: ReportingRecord) => {
    if ((record.unqualified_quantity || 0) <= 0) {
      messageApi.warning('该报工记录没有不合格数量，无法创建不良品记录');
      return;
    }
    setCurrentReportingRecordForDefect(record);
    setDefectModalVisible(true);
    setTimeout(() => {
      defectFormRef.current?.setFieldsValue({
        defect_quantity: record.unqualified_quantity,
        defect_type: 'other',
        disposition: 'quarantine',
      });
    }, 100);
  };

  /**
   * 处理提交不良品记录
   */
  const handleSubmitDefect = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecordForDefect?.id) {
        throw new Error('报工记录信息不存在');
      }

      await reportingApi.recordDefect(currentReportingRecordForDefect.id.toString(), values);
      messageApi.success('不良品记录创建成功');
      setDefectModalVisible(false);
      setCurrentReportingRecordForDefect(null);
      defectFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建不良品记录失败');
      throw error;
    }
  };

  /**
   * 处理修正报工数据
   */
  const handleCorrectReporting = async (record: ReportingRecord) => {
    try {
      const detail = await reportingApi.get(record.id!.toString());
      setCurrentReportingRecordForCorrect(detail as ReportingRecord);
      setCorrectModalVisible(true);
      setTimeout(() => {
        correctFormRef.current?.setFieldsValue({
          reported_quantity: (detail as any).reported_quantity ?? (detail as any).reportedQuantity,
          qualified_quantity: (detail as any).qualified_quantity ?? (detail as any).qualifiedQuantity,
          unqualified_quantity: (detail as any).unqualified_quantity ?? (detail as any).unqualifiedQuantity,
          work_hours: (detail as any).work_hours ?? (detail as any).workHours,
          remarks: (detail as any).remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取报工记录详情失败');
    }
  };

  /**
   * 处理提交数据修正
   */
  const handleSubmitCorrect = async (values: any): Promise<void> => {
    try {
      if (!currentReportingRecordForCorrect?.id) {
        throw new Error('报工记录信息不存在');
      }

      if (!values.correction_reason || !values.correction_reason.trim()) {
        messageApi.error('请输入修正原因');
        throw new Error('修正原因不能为空');
      }

      await reportingApi.correct(
        currentReportingRecordForCorrect.id.toString(),
        values
      );
      messageApi.success('报工数据修正成功');
      setCorrectModalVisible(false);
      setCurrentReportingRecordForCorrect(null);
      correctFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== '修正原因不能为空') {
        messageApi.error(error.message || '修正报工数据失败');
      }
      throw error;
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReportingRecord>[] = [
    {
      title: '工单编号',
      dataIndex: 'work_order_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单名称',
      dataIndex: 'work_order_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '工序',
      dataIndex: 'operation_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作工',
      dataIndex: 'worker_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '报工数量',
      dataIndex: 'reported_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '工时(小时)',
      dataIndex: 'work_hours',
      width: 100,
      align: 'right',
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueEnum: {
        pending: { text: '待审核', status: 'default' },
        approved: { text: '已审核', status: 'success' },
        rejected: { text: '已驳回', status: 'error' },
      },
      render: (_, record) => {
        const lifecycle = getReportingLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '待审核';
        const colorMap: Record<string, string> = { 待审核: 'default', 已审核: 'success', 已驳回: 'error' };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    {
      title: '报工时间',
      dataIndex: 'reported_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 300,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <UniWorkflowActions
                record={record}
                entityName="报工记录"
                statusField="status"
                draftStatuses={[]}
                pendingStatuses={['pending']}
                approvedStatuses={['approved']}
                rejectedStatuses={['rejected']}
                actions={{
                  approve: (id) => reportingApi.approve(id.toString(), {}),
                  reject: (id, reason) => reportingApi.approve(id.toString(), {}, { rejection_reason: reason || undefined }),
                }}
                onSuccess={() => actionRef.current?.reload()}
                theme="link"
                size="small"
              />
              <Button
                type="link"
                size="small"
                onClick={() => handleCorrectReporting(record)}
              >
                修正
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <>
              {(record.unqualified_quantity || 0) > 0 && (
                <>
                  <Button
                    type="link"
                    size="small"
                    icon={<WarningOutlined />}
                    onClick={() => handleCreateDefect(record)}
                    style={{ color: '#faad14' }}
                  >
                    不良品
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleCreateScrap(record)}
                  >
                    报废
                  </Button>
                </>
              )}
              <Button
                type="link"
                size="small"
                onClick={() => handleCorrectReporting(record)}
              >
                修正
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  // 报工统计数据（从 API 获取）
  const [statData, setStatData] = useState<{
    total_count: number;
    pending_count: number;
    qualification_rate: number;
    total_work_hours: number;
  } | null>(null);
  useEffect(() => {
    const loadStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const stats = await reportingApi.getStatistics({
          date_start: today.toISOString(),
          date_end: tomorrow.toISOString(),
        });
        setStatData(stats as any);
      } catch (e) {
        setStatData({ total_count: 0, pending_count: 0, qualification_rate: 0, total_work_hours: 0 });
      }
    };
    loadStats();
  }, []);

  return (
    <ListPageTemplate
      statCards={[
        {
          title: '今日报工总数',
          value: statData?.total_count ?? '-',
          prefix: <ClockCircleOutlined />,
          valueStyle: { color: '#1890ff' },
        },
        {
          title: '待审核数量',
          value: statData?.pending_count ?? '-',
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#faad14' },
        },
        {
          title: '合格率',
          value: statData?.qualification_rate != null ? statData.qualification_rate.toFixed(1) : '-',
          suffix: '%',
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '总工时(小时)',
          value: statData?.total_work_hours != null ? statData.total_work_hours.toFixed(1) : '-',
          prefix: <ClockCircleOutlined />,
          valueStyle: { color: '#722ed1' },
        },
      ]}
    >
      <UniTable
        headerTitle="报工管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const skip = ((params.current ?? 1) - 1) * (params.pageSize ?? 20);
            const limit = params.pageSize ?? 20;
            const list = await reportingApi.list({
              skip,
              limit,
              work_order_code: params.work_order_code,
              work_order_name: params.work_order_name,
              operation_name: params.operation_name,
              worker_name: params.worker_name,
              status: params.status,
              reported_at_start: params.reported_at?.[0],
              reported_at_end: params.reported_at?.[1],
            });
            const data = Array.isArray(list) ? list : (list as any)?.items ?? [];
            const total = data.length < limit ? skip + data.length : skip + data.length + 1;
            return {
              data,
              success: true,
              total: data.length < limit ? skip + data.length : total,
            };
          } catch (error: any) {
            messageApi.error(error.message || '获取报工记录失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={true}
        showCreateButton={true}
        createButtonText="新建报工"
        onCreate={handleNewReporting}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条报工记录吗？`,
            onOk: async () => {
              try {
                for (const id of keys) {
                  await reportingApi.delete(String(id));
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error.message || '删除失败');
              }
            },
          });
        }}
        toolBarRender={() => [
          <Button
            key="scan"
            icon={<ScanOutlined />}
            onClick={handleScanReporting}
          >
            扫码报工
          </Button>,
        ]}
      />

      <FormModalTemplate
        title="新建报工"
        open={reportingModalVisible}
        onClose={() => {
          setReportingModalVisible(false);
          setReportOperations([]);
          setReportWorkOrderId(null);
          setReportOperationId(null);
        }}
        onFinish={handleReportingSubmit}
        isEdit={false}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={true}
      >
        <ProFormSelect
          name="work_order_id"
          label="工单"
          placeholder="请选择工单"
          rules={[{ required: true, message: '请选择工单' }]}
          options={(Array.isArray(reportWorkOrders) ? reportWorkOrders : []).map((wo: any) => ({
            label: `${wo.code || wo.work_order_code || ''} - ${wo.name || wo.work_order_name || ''}`,
            value: wo.id,
          }))}
          colProps={{ span: 12 }}
          fieldProps={{
            onChange: (value: number) => handleReportWorkOrderChange(value),
          }}
        />
        <ProFormSelect
          name="operation_id"
          label="工序"
          placeholder="请先选择工单"
          rules={[{ required: true, message: '请选择工序' }]}
          options={(Array.isArray(reportOperations) ? reportOperations : []).map((op: any) => ({
            label: `${op.operation_name || op.name} (${op.sequence || ''})`,
            value: op.operation_id,
          }))}
          colProps={{ span: 12 }}
          fieldProps={{
            disabled: (Array.isArray(reportOperations) ? reportOperations : []).length === 0,
            onChange: (value: number) => handleReportOperationChange(value),
          }}
        />
        {(Array.isArray(reportOperations) ? reportOperations : []).find((op: any) => op.operation_id === reportOperationId)?.reporting_type === 'status' ? (
          <ProFormRadio.Group
            name="completed_status"
            label="完成状态"
            rules={[{ required: true, message: '请选择完成状态' }]}
            options={[
              { label: '完成', value: 'completed' },
              { label: '未完成', value: 'incomplete' },
            ]}
            colProps={{ span: 12 }}
          />
        ) : (
          <>
            <ProFormDigit
              name="reported_quantity"
              label="报工数量"
              placeholder="报工数量"
              rules={[{ required: true, message: '请输入报工数量' }]}
              min={0}
              colProps={{ span: 8 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label="合格数量"
              placeholder="请输入合格数量"
              rules={[{ required: true, message: '请输入合格数量' }]}
              min={0}
              colProps={{ span: 8 }}
            />
          </>
        )}
        <ProFormDigit
          name="work_hours"
          label="工时(小时)"
          placeholder="工时"
          rules={[{ required: true, message: '请输入工时' }]}
          min={0}
          fieldProps={{ step: 0.1 }}
          colProps={{ span: 8 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 扫码报工 Modal - 优化版，支持自动填充和按报工类型显示 */}
      <Modal
        title="扫码报工"
        open={scanModalVisible}
        onCancel={() => {
          setScanModalVisible(false);
          setScanWorkOrderCode('');
          setCurrentWorkOrder(null);
          setWorkOrderOperations([]);
          setCurrentOperation(null);
          setJumpRuleError('');
        }}
        footer={null}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Spin spinning={loadingOperations}>
          <div style={{ padding: '20px 0' }}>
            {/* 扫码输入 */}
            <div style={{ marginBottom: 20 }}>
              <Input
                placeholder="扫描或输入工单编码"
                value={scanWorkOrderCode}
                onChange={(e) => setScanWorkOrderCode(e.target.value)}
                onPressEnter={() => handleScanInput(scanWorkOrderCode)}
                prefix={<QrcodeOutlined />}
                size="large"
                allowClear
              />
              <Button
                type="primary"
                style={{ marginTop: 10, width: '100%' }}
                onClick={() => handleScanInput(scanWorkOrderCode)}
                loading={loadingOperations}
              >
                确认
              </Button>
            </div>

            {/* 工单信息 */}
            {currentWorkOrder && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div><strong>工单编码：</strong>{currentWorkOrder.code}</div>
                  </Col>
                  <Col span={12}>
                    <div><strong>产品：</strong>{currentWorkOrder.product_name}</div>
                  </Col>
                  <Col span={12} style={{ marginTop: 8 }}>
                    <div><strong>计划数量：</strong>{currentWorkOrder.quantity}</div>
                  </Col>
                  <Col span={12} style={{ marginTop: 8 }}>
                    <div><strong>状态：</strong>
                      <Tag color={currentWorkOrder.status === 'in_progress' ? 'processing' : 'default'}>
                        {currentWorkOrder.status === 'in_progress' ? '进行中' : currentWorkOrder.status}
                      </Tag>
                    </div>
                  </Col>
                </Row>
              </Card>
            )}

            {/* 工序选择 */}
            {workOrderOperations.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, fontWeight: 'bold' }}>选择工序：</div>
                <ProFormSelect
                  name="operation_id"
                  placeholder="请选择工序"
                  options={workOrderOperations.map((op: any) => ({
                    label: `${op.operation_name} (${op.status === 'completed' ? '已完成' : op.status === 'in_progress' ? '进行中' : '待开始'})`,
                    value: op.operation_id,
                    disabled: op.status === 'completed',
                  }))}
                  fieldProps={{
                    onChange: handleSelectOperation,
                    value: currentOperation?.operation_id,
                  }}
                />
              </div>
            )}

            {/* 跳转规则提示 */}
            {currentOperation && (
              <div style={{ marginBottom: 16 }}>
                {currentOperation.allow_jump ? (
                  <Alert
                    title="此工序允许跳转，可随时报工"
                    type="info"
                    showIcon
                    description="允许跳转的工序可以并行进行，不依赖上道工序完成"
                  />
                ) : jumpRuleError ? (
                  <Alert
                    title={jumpRuleError}
                    type="warning"
                    showIcon
                    description="不允许跳转的工序，必须完成上道工序才能开始此工序"
                  />
                ) : (
                  <Alert
                    title="此工序不允许跳转"
                    type="info"
                    showIcon
                    description="必须完成上道工序才能开始此工序"
                  />
                )}
              </div>
            )}

            {/* 子工艺路线进度显示（核心功能，新增） */}
            {currentOperation && subOperations.length > 0 && (
              <Card 
                size="small" 
                style={{ marginBottom: 16, backgroundColor: '#fafafa' }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span>子工艺路线进度 - {currentOperation.operation_name}</span>
                  </div>
                }
              >
                <div style={{ marginBottom: 12 }}>
                  {subOperations.map((subOp: any, index: number) => {
                    const isCompleted = subOp.status === 'completed';
                    const isInProgress = subOp.status === 'in_progress';
                    
                    return (
                      <div
                        key={subOp.operation_id || index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 12px',
                          marginBottom: 8,
                          backgroundColor: isCompleted ? '#f6ffed' : isInProgress ? '#e6f7ff' : '#fff',
                          border: `1px solid ${isCompleted ? '#b7eb8f' : isInProgress ? '#91d5ff' : '#d9d9d9'}`,
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {isCompleted ? (
                              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                            ) : isInProgress ? (
                              <ClockCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                            ) : (
                              <CloseCircleOutlined style={{ color: '#d9d9d9', marginRight: 8 }} />
                            )}
                            <span style={{ fontWeight: isInProgress ? 'bold' : 'normal' }}>
                              {subOp.operation_name}
                            </span>
                            <Tag 
                              color={isCompleted ? 'success' : isInProgress ? 'processing' : 'default'}
                              style={{ marginLeft: 8 }}
                            >
                              {isCompleted ? '已完成' : isInProgress ? '进行中' : '未开始'}
                            </Tag>
                          </div>
                          {subOp.completed_quantity > 0 && (
                            <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                              完成数量：{subOp.completed_quantity} / 合格：{subOp.qualified_quantity}
                            </div>
                          )}
                        </div>
                          <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            setCurrentSubOperation(subOp);
                            setSubOperationReportingVisible(true);
                          }}
                          disabled={isCompleted}
                        >
                          {isCompleted ? '已完成' : '报工'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Alert
                  title="提示"
                  description="必须先完成所有子工序，才能完成主工序"
                  type="info"
                  showIcon
                  style={{ marginTop: 12 }}
                />
              </Card>
            )}

            {/* 报工表单 - 根据报工类型显示不同界面 */}
            {currentOperation && (
              <Card 
                size="small" 
                title={
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span>报工 - {currentOperation.operation_name}</span>
                    {subOperations.length > 0 && (
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        有子工艺路线（{subOperations.filter((op: any) => op.status === 'completed').length}/{subOperations.length}已完成）
                      </Tag>
                    )}
                    {currentSOP && (
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        SOP: {currentSOP.name}
                      </Tag>
                    )}
                    {loadingSOP && (
                      <Spin size="small" style={{ marginLeft: 8 }} />
                    )}
                  </div>
                }
              >
                <Form
                  ref={scanFormRef}
                  layout="vertical"
                  onFinish={async (values) => {
                    try {
                      // 验证SOP必填参数（优化，新增）
                      if (sopFormConfig && sopFormConfig.properties) {
                        const missingParams: string[] = [];
                        Object.entries(sopFormConfig.properties).forEach(([key, field]: [string, any]) => {
                          if (field.required && (!values.sop_params || !values.sop_params[key])) {
                            missingParams.push(field.title || key);
                          }
                        });
                        if (missingParams.length > 0) {
                          messageApi.error(`请填写SOP必填参数：${missingParams.join('、')}`);
                          return;
                        }
                      }

                      // 收集SOP参数数据（核心功能，新增）
                      const sopParams: Record<string, any> = {};
                      if (values.sop_params) {
                        Object.entries(values.sop_params).forEach(([key, value]) => {
                          sopParams[key] = value;
                        });
                      }

                      const { worker_id, worker_name } = getWorkerInfo(currentOperation);
                      const reportingData = {
                        work_order_id: currentWorkOrder.id,
                        work_order_code: currentWorkOrder.code,
                        work_order_name: currentWorkOrder.name,
                        operation_id: currentOperation.operation_id,
                        operation_code: currentOperation.operation_code,
                        operation_name: currentOperation.operation_name,
                        worker_id,
                        worker_name,
                        reported_quantity: currentOperation.reporting_type === 'status' 
                          ? (values.completed_status === 'completed' ? 1 : 0)
                          : values.reported_quantity,
                        qualified_quantity: values.qualified_quantity || 0,
                        unqualified_quantity: values.unqualified_quantity || 0,
                        work_hours: values.work_hours || 0,
                        status: 'pending',
                        reported_at: new Date().toISOString(),
                        remarks: values.remarks,
                        // SOP参数数据（核心功能，新增）
                        sop_parameters: Object.keys(sopParams).length > 0 ? sopParams : undefined,
                      };

                      const reportingRecord = await reportingApi.create(reportingData);
                      messageApi.success('报工成功');

                      // 保存上料下料绑定记录（如果存在）
                      if (feedingList.length > 0 || dischargingList.length > 0) {
                        try {
                          // 保存上料绑定
                          for (const feeding of feedingList) {
                            await materialBindingApi.createFeeding(reportingRecord.id.toString(), feeding);
                          }
                          // 保存下料绑定
                          for (const discharging of dischargingList) {
                            await materialBindingApi.createDischarging(reportingRecord.id.toString(), discharging);
                          }
                        } catch (error: any) {
                          console.error('保存物料绑定记录失败:', error);
                          // 物料绑定失败不影响报工成功，只记录日志
                        }
                      }

                      // 刷新工单工序列表（核心功能，新增）
                      const updatedOperations = await workOrderApi.getOperations(currentWorkOrder.id.toString());
                      setWorkOrderOperations(updatedOperations || []);
                      
                      // 更新当前工序状态
                      const updatedCurrentOp = updatedOperations?.find((op: any) => op.operation_id === currentOperation.operation_id);
                      if (updatedCurrentOp) {
                        setCurrentOperation(updatedCurrentOp);
                        // 重新检查子工序
                        const updatedSubOps = checkSubOperations(updatedCurrentOp, updatedOperations || []);
                        setSubOperations(updatedSubOps);
                      }

                      // 自动切换到下一工序（核心功能，新增）
                      const remainingOperations = (updatedOperations || workOrderOperations).filter(
                        (op: any) => {
                          // 排除子工序（如果当前工序有子工序，子工序不算在remainingOperations中）
                          if (subOperations.length > 0) {
                            const isSubOp = subOperations.some((subOp: any) => subOp.operation_id === op.operation_id);
                            if (isSubOp) return false;
                          }
                          return op.sequence > currentOperation.sequence && op.status !== 'completed';
                        }
                      );
                      
                      if (remainingOperations.length > 0) {
                        const nextOperation = remainingOperations[0];
                        setCurrentOperation(nextOperation);
                        await checkJumpRule(nextOperation, updatedOperations || workOrderOperations);
                        // 自动加载下一工序的SOP（核心功能，优化）
                        await handleSelectOperation(nextOperation.operation_id);
                        scanFormRef.current?.resetFields();
                        messageApi.success(`已自动切换到下一工序：${nextOperation.operation_name}`);
                      } else {
                        // 所有工序已完成，关闭报工窗口
                        setScanModalVisible(false);
                        setCurrentWorkOrder(null);
                        setWorkOrderOperations([]);
                        setCurrentOperation(null);
                        setScanWorkOrderCode('');
                        setFeedingList([]);
                        setDischargingList([]);
                        setSubOperations([]);
                        scanFormRef.current?.resetFields();
                        actionRef.current?.reload();
                      }
                    } catch (error: any) {
                      messageApi.error(error.message || '报工失败');
                    }
                  }}
                >
                  {currentOperation.reporting_type === 'status' ? (
                    // 按状态报工
                    <>
                      <Form.Item
                        name="completed_status"
                        label="完成状态"
                        rules={[{ required: true, message: '请选择完成状态' }]}
                      >
                        <Radio.Group>
                          <Radio value="completed">完成</Radio>
                          <Radio value="incomplete">未完成</Radio>
                        </Radio.Group>
                      </Form.Item>
                      <ProFormDigit
                        name="work_hours"
                        label="工时(小时)"
                        placeholder="工时"
                        min={0}
                        fieldProps={{ step: 0.1 }}
                      />
                      
                      {/* SOP参数收集表单（核心功能，新增） */}
                      {renderSOPParameters()}

                      <ProFormTextArea
                        name="remarks"
                        label="备注"
                        placeholder="请输入备注信息"
                        fieldProps={{ rows: 3 }}
                      />
                    </>
                  ) : (
                    // 按数量报工
                    <>
                      <ProFormDigit
                        name="reported_quantity"
                        label="完成数量"
                        placeholder="请输入完成数量"
                        rules={[{
                          required: true,
                          validator: (_: any, value: any) => {
                            if (value === undefined || value === null || value <= 0) {
                              return Promise.reject(new Error('请输入上料数量且必须大于0'));
                            }
                            return Promise.resolve();
                          },
                        }]}
                        min={0}
                        fieldProps={{
                          precision: 2,
                          max: currentWorkOrder.quantity - (currentOperation.completed_quantity || 0),
                        }}
                        extra="完成数量必须大于0"
                      />
                      <ProFormDigit
                        name="qualified_quantity"
                        label="合格数量"
                        placeholder="请输入合格数量"
                        rules={[
                          {
                            required: true,
                            validator: (_: any, value: any) => {
                              if (value === undefined || value === null) {
                                return Promise.reject(new Error('请输入合格数量'));
                              }
                              return Promise.resolve();
                            },
                          },
                          ({ getFieldValue }: any) => ({
                            validator: (_: any, value: any) => {
                              const reportedQuantity = getFieldValue('reported_quantity');
                              if (reportedQuantity !== undefined && value > reportedQuantity) {
                                return Promise.reject(new Error('合格数量不能大于完成数量'));
                              }
                              return Promise.resolve();
                            },
                          }),
                        ]}
                        min={0}
                        fieldProps={{ precision: 2 }}
                        extra="合格数量必须大于等于0，且不能大于完成数量"
                      />
                      <ProFormDigit
                        name="unqualified_quantity"
                        label="不合格数量"
                        placeholder="不合格数量（自动计算）"
                        disabled
                        fieldProps={{ precision: 2 }}
                        extra="不合格数量 = 完成数量 - 合格数量（自动计算）"
                        dependencies={['reported_quantity', 'qualified_quantity']}
                        transform={(_: any, __: any, allValues: any) => {
                          const reportedQuantity = allValues.reported_quantity || 0;
                          const qualifiedQuantity = allValues.qualified_quantity || 0;
                          return reportedQuantity - qualifiedQuantity;
                        }}
                      />
                      <ProFormDigit
                        name="work_hours"
                        label="工时(小时)"
                        placeholder="工时"
                        min={0}
                        fieldProps={{ step: 0.1 }}
                      />
                      
                      {/* 工站上下料物料绑定（核心功能，新增） */}
                      <div style={{ marginTop: 16, marginBottom: 16 }}>
                        <div style={{ marginBottom: 8, fontWeight: 'bold' }}>工站上下料物料绑定：</div>
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                          {/* 上料绑定 */}
                          <Card size="small" title="上料绑定">
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              {feedingList.map((feeding, index) => (
                                <Card key={index} size="small" style={{ backgroundColor: '#f5f5f5' }}>
                                  <Row gutter={16}>
                                    <Col span={8}><strong>物料：</strong>{feeding.material_name || feeding.material_code}</Col>
                                    <Col span={6}><strong>数量：</strong>{feeding.quantity}</Col>
                                    <Col span={6}><strong>批次：</strong>{feeding.batch_no || '-'}</Col>
                                    <Col span={4}>
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        icon={<MinusOutlined />}
                                        onClick={() => handleRemoveFeeding(index)}
                                      >
                                        删除
                                      </Button>
                                    </Col>
                                  </Row>
                                </Card>
                              ))}
                              <Button
                                type="dashed"
                                block
                                icon={<PlusOutlined />}
                                onClick={handleAddFeeding}
                              >
                                添加上料绑定
                              </Button>
                            </Space>
                          </Card>

                          {/* 下料绑定 */}
                          <Card size="small" title="下料绑定">
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              {dischargingList.map((discharging, index) => (
                                <Card key={index} size="small" style={{ backgroundColor: '#f5f5f5' }}>
                                  <Row gutter={16}>
                                    <Col span={8}><strong>物料：</strong>{discharging.material_name || discharging.material_code}</Col>
                                    <Col span={6}><strong>数量：</strong>{discharging.quantity}</Col>
                                    <Col span={6}><strong>批次：</strong>{discharging.batch_no || '-'}</Col>
                                    <Col span={4}>
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        icon={<MinusOutlined />}
                                        onClick={() => handleRemoveDischarging(index)}
                                      >
                                        删除
                                      </Button>
                                    </Col>
                                  </Row>
                                </Card>
                              ))}
                              <Button
                                type="dashed"
                                block
                                icon={<PlusOutlined />}
                                onClick={handleAddDischarging}
                              >
                                添加下料绑定
                              </Button>
                            </Space>
                          </Card>
                        </Space>
                      </div>

                      {/* SOP参数收集表单（核心功能，新增） */}
                      {renderSOPParameters()}

                      <ProFormTextArea
                        name="remarks"
                        label="备注"
                        placeholder="请输入备注信息"
                        fieldProps={{ rows: 3 }}
                      />
                    </>
                  )}
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Button
                      onClick={() => {
                        setScanModalVisible(false);
                        setCurrentWorkOrder(null);
                        setWorkOrderOperations([]);
                        setCurrentOperation(null);
                        setScanWorkOrderCode('');
                        setFeedingList([]);
                        setDischargingList([]);
                        scanFormRef.current?.resetFields();
                      }}
                      style={{ marginRight: 8 }}
                    >
                      取消
                    </Button>
                    <Button 
                      type="primary" 
                      htmlType="submit"
                      disabled={
                        subOperations.length > 0 && 
                        !subOperations.every((subOp: any) => subOp.status === 'completed')
                      }
                      title={
                        subOperations.length > 0 && 
                        !subOperations.every((subOp: any) => subOp.status === 'completed')
                          ? '必须先完成所有子工序才能完成主工序'
                          : ''
                      }
                    >
                      提交报工
                      {subOperations.length > 0 && 
                       !subOperations.every((subOp: any) => subOp.status === 'completed') && 
                       '（需先完成所有子工序）'}
                    </Button>
                  </div>
                </Form>
              </Card>
            )}
          </div>
        </Spin>
      </Modal>

      {/* 创建报废记录Modal */}
      <FormModalTemplate
        title="记录报废"
        open={scrapModalVisible}
        onClose={() => {
          setScrapModalVisible(false);
          setCurrentReportingRecord(null);
          scrapFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitScrap}
        formRef={scrapFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecord && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>工单编码：</strong>{currentReportingRecord.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecord.operation_name}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div><strong>不合格数量：</strong>{currentReportingRecord.unqualified_quantity}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="scrap_quantity"
              label="报废数量"
              placeholder="请输入报废数量"
              rules={[{ required: true, message: '请输入报废数量' }]}
              min={0}
              max={currentReportingRecord.unqualified_quantity}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="scrap_type"
              label="报废类型"
              placeholder="请选择报废类型"
              rules={[{ required: true, message: '请选择报废类型' }]}
              options={[
                { label: '工艺问题', value: 'process' },
                { label: '物料问题', value: 'material' },
                { label: '质量问题', value: 'quality' },
                { label: '设备问题', value: 'equipment' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="scrap_reason"
              label="报废原因"
              placeholder="请输入报废原因"
              rules={[{ required: true, message: '请输入报废原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormDigit
              name="unit_cost"
              label="单位成本（可选）"
              placeholder="请输入单位成本"
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 创建不良品记录Modal */}
      <FormModalTemplate
        title="记录不良品"
        open={defectModalVisible}
        onClose={() => {
          setDefectModalVisible(false);
          setCurrentReportingRecordForDefect(null);
          defectFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitDefect}
        formRef={defectFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecordForDefect && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>工单编码：</strong>{currentReportingRecordForDefect.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecordForDefect.operation_name}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div><strong>不合格数量：</strong>{currentReportingRecordForDefect.unqualified_quantity}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="defect_quantity"
              label="不良品数量"
              placeholder="请输入不良品数量"
              rules={[{ required: true, message: '请输入不良品数量' }]}
              min={0}
              max={currentReportingRecordForDefect.unqualified_quantity}
              fieldProps={{ precision: 2 }}
            />
            <ProFormSelect
              name="defect_type"
              label="不良品类型"
              placeholder="请选择不良品类型"
              rules={[{ required: true, message: '请选择不良品类型' }]}
              options={[
                { label: '尺寸问题', value: 'dimension' },
                { label: '外观问题', value: 'appearance' },
                { label: '功能问题', value: 'function' },
                { label: '物料问题', value: 'material' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="defect_reason"
              label="不良品原因"
              placeholder="请输入不良品原因"
              rules={[{ required: true, message: '请输入不良品原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormSelect
              name="disposition"
              label="处理方式"
              placeholder="请选择处理方式"
              rules={[{ required: true, message: '请选择处理方式' }]}
              options={[
                { label: '隔离', value: 'quarantine' },
                { label: '返工', value: 'rework' },
                { label: '报废', value: 'scrap' },
                { label: '接受', value: 'accept' },
                { label: '其他', value: 'other' },
              ]}
            />
            <ProFormTextArea
              name="quarantine_location"
              label="隔离位置（处理方式为隔离时填写）"
              placeholder="请输入隔离位置"
              fieldProps={{ rows: 2 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 修正报工数据Modal */}
      <FormModalTemplate
        title="修正报工记录"
        open={correctModalVisible}
        onClose={() => {
          setCorrectModalVisible(false);
          setCurrentReportingRecordForCorrect(null);
          correctFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitCorrect}
        formRef={correctFormRef}
        {...MODAL_CONFIG}
      >
        {currentReportingRecordForCorrect && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div><strong>工单编码：</strong>{currentReportingRecordForCorrect.work_order_code}</div>
                </Col>
                <Col span={12}>
                  <div><strong>工序：</strong>{currentReportingRecordForCorrect.operation_name}</div>
                </Col>
              </Row>
            </Card>
            <ProFormDigit
              name="reported_quantity"
              label="报工数量"
              placeholder="请输入报工数量"
              rules={[{ required: true, message: '请输入报工数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label="合格数量"
              placeholder="请输入合格数量"
              rules={[
                { required: true, message: '请输入合格数量' },
                ({ getFieldValue }: { getFieldValue: (name: string) => number }) => ({
                  validator: (_: any, value: number) => {
                    const reportedQuantity = getFieldValue('reported_quantity');
                    if (reportedQuantity !== undefined && value > reportedQuantity) {
                      return Promise.reject(new Error('合格数量不能大于完成数量'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="unqualified_quantity"
              label="不合格数量"
              placeholder="请输入不合格数量"
              rules={[{ required: true, message: '请输入不合格数量' }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="work_hours"
              label="工时（小时）"
              placeholder="请输入工时"
              rules={[{ required: true, message: '请输入工时' }]}
              min={0}
              fieldProps={{ precision: 2, step: 0.1 }}
            />
            <ProFormTextArea
              name="correction_reason"
              label="修正原因"
              placeholder="请输入修正原因（必填）"
              rules={[{ required: true, message: '请输入修正原因' }]}
              fieldProps={{ rows: 3 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注（可选）"
              placeholder="请输入备注"
              fieldProps={{ rows: 2 }}
            />
          </>
        )}
      </FormModalTemplate>

      {/* 物料绑定Modal */}
      <FormModalTemplate
        title={bindingType === 'feeding' ? '添加上料绑定' : '添加下料绑定'}
        open={materialBindingVisible}
        onClose={() => {
          setMaterialBindingVisible(false);
          setBindingType(null);
          materialBindingFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitMaterialBinding}
        formRef={materialBindingFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormSelect
          name="material_id"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materialList.map((material: any) => ({
            label: `${material.code} - ${material.name}`,
            value: material.id,
            material: material,
          }))}
          fieldProps={{
            onChange: (_: number, option: any) => {
              if (option?.material) {
                const material = option.material;
                materialBindingFormRef.current?.setFieldsValue({
                  material_code: material.code,
                  material_name: material.name,
                });
              }
            },
          }}
        />
        <ProFormText
          name="material_code"
          label="物料编码"
          disabled
        />
        <ProFormText
          name="material_name"
          label="物料名称"
          disabled
        />
        <ProFormDigit
          name="quantity"
          label="绑定数量"
          placeholder="请输入绑定数量"
          rules={[{ required: true, message: '请输入绑定数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormText
          name="batch_no"
          label="批次号（可选）"
          placeholder="请输入批次号"
        />
        <ProFormText
          name="barcode"
          label="条码（可选，用于扫码绑定）"
          placeholder="请输入或扫描条码"
        />
        <ProFormTextArea
          name="remarks"
          label="备注（可选）"
          placeholder="请输入备注"
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>

      {/* 子工序报工Modal（核心功能，新增） */}
      <Modal
        title={`报工 - ${currentSubOperation?.operation_name || '子工序'}`}
        open={subOperationReportingVisible}
        onCancel={() => {
          setSubOperationReportingVisible(false);
          setCurrentSubOperation(null);
          subOperationFormRef.current?.resetFields();
        }}
        footer={null}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        {currentSubOperation && (
          <SubOperationReportingForm
            subOperation={currentSubOperation}
            workOrder={currentWorkOrder}
            subOperations={subOperations}
            onSuccess={async () => {
              // 刷新工单工序列表
              const updatedOperations = await workOrderApi.getOperations(currentWorkOrder.id.toString());
              setWorkOrderOperations(updatedOperations || []);
              
              // 更新子工序列表
              if (currentOperation) {
                const updatedCurrentOp = updatedOperations?.find((op: any) => op.operation_id === currentOperation.operation_id);
                if (updatedCurrentOp) {
                  const updatedSubOps = checkSubOperations(updatedCurrentOp, updatedOperations || []);
                  setSubOperations(updatedSubOps);
                }
              }

              // 关闭子工序报工Modal
              setSubOperationReportingVisible(false);
              setCurrentSubOperation(null);
              subOperationFormRef.current?.resetFields();
              messageApi.success('子工序报工成功');
            }}
            onCancel={() => {
              setSubOperationReportingVisible(false);
              setCurrentSubOperation(null);
              subOperationFormRef.current?.resetFields();
            }}
            formRef={subOperationFormRef}
          />
        )}
      </Modal>

    </ListPageTemplate>
  );
};

/**
 * 子工序报工表单组件（核心功能，新增）
 */
const SubOperationReportingForm: React.FC<{
  subOperation: any;
  workOrder: any;
  subOperations: any[];
  onSuccess: () => void;
  onCancel: () => void;
  formRef: React.RefObject<any>;
}> = ({ subOperation, workOrder, subOperations, onSuccess, onCancel, formRef }) => {
  const { message: messageApi } = App.useApp();
  const [subOpSopConfig, setSubOpSopConfig] = useState<any>(null);
  const [loadingSubOpSOP, setLoadingSubOpSOP] = useState(false);

  // 加载子工序的SOP配置（按工单+工序匹配，支持不同产品相同工序不同SOP）
  useEffect(() => {
    const loadSubOpSOP = async () => {
      if (!subOperation?.operation_id || !workOrder?.id) return;
      
      setLoadingSubOpSOP(true);
      try {
        const sop = await sopApi.getForReporting(workOrder.id, subOperation.operation_id);
        if (sop && sop.formConfig && sop.formConfig.properties && Object.keys(sop.formConfig.properties).length > 0) {
          setSubOpSopConfig(sop.formConfig);
          const initialParams: Record<string, any> = {};
          Object.keys(sop.formConfig.properties).forEach((key) => {
            const formConfig = (sop as any).formConfig;
            const field = formConfig.properties[key];
            if (field.default !== undefined) {
              initialParams[key] = field.default;
            }
          });
          setTimeout(() => {
            formRef.current?.setFieldsValue({ sop_params: initialParams });
          }, 100);
        } else {
          setSubOpSopConfig(null);
        }
      } catch (error: any) {
        console.error('获取子工序SOP信息失败:', error);
        setSubOpSopConfig(null);
      } finally {
        setLoadingSubOpSOP(false);
      }
    };
    
    loadSubOpSOP();
  }, [subOperation?.operation_id, workOrder?.id, formRef]);

  // 渲染SOP参数收集表单
  const renderSubOpSOPParameters = () => {
    if (!subOpSopConfig || !subOpSopConfig.properties) return null;
    const fields: React.ReactNode[] = [];
    Object.entries(subOpSopConfig.properties).forEach(([fieldCode, fieldSchema]: [string, any]) => {
      const fieldName = `sop_params.${fieldCode}`;
      if (fieldSchema.type === 'number') {
        fields.push(
          <ProFormDigit
            key={fieldCode}
            name={fieldName}
            label={fieldSchema.title}
            placeholder={fieldSchema['x-component-props']?.placeholder || `请输入${fieldSchema.title}`}
            rules={fieldSchema.required ? [{ required: true, message: `请输入${fieldSchema.title}` }] : []}
            min={fieldSchema['x-validator']?.[0]?.min}
            max={fieldSchema['x-validator']?.[0]?.max}
            fieldProps={{
              precision: fieldSchema['x-component-props']?.precision,
              addonAfter: fieldSchema['x-component-props']?.unit,
            }}
          />
        );
      } else if (fieldSchema.type === 'string') {
        if (fieldSchema['x-component'] === 'Select' || fieldSchema.enum) {
          fields.push(
            <ProFormSelect
              key={fieldCode}
              name={fieldName}
              label={fieldSchema.title}
              placeholder={fieldSchema['x-component-props']?.placeholder || `请选择${fieldSchema.title}`}
              rules={fieldSchema.required ? [{ required: true, message: `请选择${fieldSchema.title}` }] : []}
              options={fieldSchema.enum?.map((opt: any) => ({
                label: opt.label || opt,
                value: opt.value !== undefined ? opt.value : opt,
              }))}
            />
          );
        } else {
          fields.push(
            <ProFormText
              key={fieldCode}
              name={fieldName}
              label={fieldSchema.title}
              placeholder={fieldSchema['x-component-props']?.placeholder || `请输入${fieldSchema.title}`}
              rules={fieldSchema.required ? [{ required: true, message: `请输入${fieldSchema.title}` }] : []}
            />
          );
        }
      }
    });
    return (
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 16 }}>SOP参数收集：</div>
        <Card size="small" style={{ backgroundColor: '#fafafa' }}>
          {fields}
        </Card>
      </div>
    );
  };

  return (
    <Form
      ref={formRef}
      layout="vertical"
      onFinish={async (values) => {
        try {
          // 检查跳转规则（如果不允许跳转，且上道子工序未完成，阻止提交）
          const subOpIndex = subOperations.findIndex((op: any) => op.operation_id === subOperation.operation_id);
          if (subOpIndex > 0) {
            const prevSubOp = subOperations[subOpIndex - 1];
            if (!subOperation.allow_jump && prevSubOp.status !== 'completed') {
              messageApi.error(`无法报工：必须先完成前序子工序 "${prevSubOp.operation_name}"`);
              return;
            }
          }

          // 验证SOP必填参数
          if (subOpSopConfig && subOpSopConfig.properties) {
            const missingParams: string[] = [];
            Object.entries(subOpSopConfig.properties).forEach(([key, field]: [string, any]) => {
              if (field.required && (!values.sop_params || !values.sop_params[key])) {
                missingParams.push(field.title || key);
              }
            });
            if (missingParams.length > 0) {
              messageApi.error(`请填写SOP必填参数：${missingParams.join('、')}`);
              return;
            }
          }

          // 收集SOP参数数据
          const sopParams: Record<string, any> = {};
          if (values.sop_params) {
            Object.entries(values.sop_params).forEach(([key, value]) => {
              sopParams[key] = value;
            });
          }

          const { worker_id, worker_name } = getWorkerInfo(subOperation);
          const reportingData = {
            work_order_id: workOrder.id,
            work_order_code: workOrder.code,
            work_order_name: workOrder.name,
            operation_id: subOperation.operation_id,
            operation_code: subOperation.operation_code,
            operation_name: subOperation.operation_name,
            worker_id,
            worker_name,
            reported_quantity: subOperation.reporting_type === 'status' 
              ? (values.completed_status === 'completed' ? 1 : 0)
              : values.reported_quantity,
            qualified_quantity: values.qualified_quantity || 0,
            unqualified_quantity: values.unqualified_quantity || 0,
            work_hours: values.work_hours || 0,
            status: 'pending',
            reported_at: new Date().toISOString(),
            remarks: values.remarks,
            sop_parameters: Object.keys(sopParams).length > 0 ? sopParams : undefined,
          };

          await reportingApi.create(reportingData);
          onSuccess();
        } catch (error: any) {
          messageApi.error(error.message || '子工序报工失败');
        }
      }}
    >
      {subOperation.reporting_type === 'status' ? (
        // 按状态报工
        <>
          <Form.Item
            name="completed_status"
            label="完成状态"
            rules={[{ required: true, message: '请选择完成状态' }]}
          >
            <Radio.Group>
              <Radio value="completed">完成</Radio>
              <Radio value="incomplete">未完成</Radio>
            </Radio.Group>
          </Form.Item>
          <ProFormDigit
            name="work_hours"
            label="工时(小时)"
            placeholder="工时"
            min={0}
            fieldProps={{ step: 0.1 }}
          />
          
          {/* SOP参数收集表单 */}
          {loadingSubOpSOP ? <Spin /> : renderSubOpSOPParameters()}

          <ProFormTextArea
            name="remarks"
            label="备注"
            placeholder="请输入备注信息"
            fieldProps={{ rows: 3 }}
          />
        </>
      ) : (
        // 按数量报工
        <>
          <ProFormDigit
            name="reported_quantity"
            label="完成数量"
            placeholder="请输入完成数量"
            rules={[{ required: true, message: '请输入完成数量' }]}
            min={0}
            fieldProps={{
              precision: 2,
              max: workOrder.quantity - (subOperation.completed_quantity || 0),
            }}
            extra="完成数量必须大于0"
          />
          <ProFormDigit
            name="qualified_quantity"
            label="合格数量"
            placeholder="请输入合格数量"
            rules={[
              { required: true, message: '请输入合格数量' },
              ({ getFieldValue }: any) => ({
                validator: (_: any, value: any) => {
                  const reportedQuantity = getFieldValue('reported_quantity');
                  if (reportedQuantity && value > reportedQuantity) {
                    return Promise.reject(new Error('合格数量不能大于完成数量'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
            min={0}
            fieldProps={{ precision: 2 }}
            extra="合格数量必须大于等于0，且不能大于完成数量"
          />
          <ProFormDigit
            name="unqualified_quantity"
            label="不合格数量"
            placeholder="自动计算"
            disabled
            fieldProps={{
              precision: 2,
            }}
            extra="不合格数量 = 完成数量 - 合格数量（自动计算）"
          />
          <ProFormDigit
            name="work_hours"
            label="工时(小时)"
            placeholder="工时"
            min={0}
            fieldProps={{ step: 0.1 }}
          />
          
          {/* SOP参数收集表单 */}
          {loadingSubOpSOP ? <Spin /> : renderSubOpSOPParameters()}

          <ProFormTextArea
            name="remarks"
            label="备注"
            placeholder="请输入备注信息"
            fieldProps={{ rows: 3 }}
          />
        </>
      )}
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            提交报工
          </Button>
          <Button onClick={onCancel}>
            取消
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ReportingPage;

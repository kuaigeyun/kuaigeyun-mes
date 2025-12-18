/**
 * eSOP 执行页面
 * 
 * 展示流程进度和表单填写，支持节点完成和流程流转
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { App, Card, Steps, Button, Space, message, Spin, Typography, Tag, Divider, InputNumber } from 'antd';
import { CheckOutlined, PlayCircleOutlined, PauseOutlined, CloseOutlined } from '@ant-design/icons';
import { createForm } from '@formily/core';
import { FormProvider, createSchemaField } from '@formily/react';
import {
  FormItem,
  Input,
  DatePicker,
  Select,
  FormLayout,
  Switch,
} from '@formily/antd-v5';
import { sopExecutionApi, sopApi } from '../../../services/process';
import type { SOPExecution, SOP, SOPNodeCompleteRequest } from '../../../types/process';
import type { ISchema } from '@formily/core';

const { Title, Text } = Typography;
const { Step } = Steps;

const SchemaField = createSchemaField({
  components: {
    FormItem,
    Input,
    'Input.TextArea': Input.TextArea,
    InputNumber,
    DatePicker,
    Select,
    Switch,
  },
});

/**
 * eSOP 执行页面组件
 */
const SOPExecutionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const executionUuid = searchParams.get('uuid');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [execution, setExecution] = useState<SOPExecution | null>(null);
  const [sop, setSop] = useState<SOP | null>(null);
  const [currentNode, setCurrentNode] = useState<any>(null);
  const [currentNodeSchema, setCurrentNodeSchema] = useState<ISchema | null>(null);
  const [form] = useState(() => createForm());
  
  /**
   * 加载执行实例数据
   */
  useEffect(() => {
    if (executionUuid) {
      loadExecutionData();
    } else {
      messageApi.warning('缺少执行实例UUID参数');
      navigate('/apps/master-data/process/sop');
    }
  }, [executionUuid]);
  
  /**
   * 加载执行实例和 SOP 数据
   */
  const loadExecutionData = async () => {
    if (!executionUuid) return;
    
    try {
      setLoading(true);
      
      // 加载执行实例
      const executionData = await sopExecutionApi.get(executionUuid);
      setExecution(executionData);
      
      // 加载 SOP
      const sopData = await sopApi.get(executionData.sopUuid);
      setSop(sopData);
      
      // 解析当前节点
      if (executionData.currentNodeId && sopData.flowConfig) {
        const nodes = sopData.flowConfig.nodes || [];
        const currentNodeData = nodes.find((n: any) => n.id === executionData.currentNodeId);
        setCurrentNode(currentNodeData);
        
        // 获取当前节点的表单配置
        if (sopData.formConfig && sopData.formConfig[executionData.currentNodeId]) {
          setCurrentNodeSchema(sopData.formConfig[executionData.currentNodeId] as ISchema);
        } else {
          setCurrentNodeSchema(null);
        }
        
        // 加载已填写的表单数据
        if (executionData.nodeData && executionData.nodeData[executionData.currentNodeId]) {
          const nodeData = executionData.nodeData[executionData.currentNodeId];
          form.setValues(nodeData.formData || {});
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || '加载执行数据失败');
      navigate('/apps/master-data/process/sop');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 获取流程步骤列表
   */
  const flowSteps = useMemo(() => {
    if (!sop?.flowConfig) return [];
    
    const nodes = sop.flowConfig.nodes || [];
    const edges = sop.flowConfig.edges || [];
    
    // 构建节点顺序（从起始节点开始，按边遍历）
    const steps: any[] = [];
    const visited = new Set<string>();
    
    // 找到起始节点
    const startNode = nodes.find((n: any) => n.type === 'start' || n.data?.type === 'start');
    if (!startNode) return [];
    
    // 从起始节点开始遍历
    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.find((n: any) => n.id === nodeId);
      if (!node) return;
      
      // 跳过开始和结束节点（它们不显示在步骤中）
      const nodeType = node.type || node.data?.type;
      if (nodeType !== 'start' && nodeType !== 'end') {
        steps.push({
          id: node.id,
          title: node.data?.label || nodeId,
          description: node.data?.description,
          type: nodeType,
        });
      }
      
      // 查找下一个节点
      const nextEdges = edges.filter((e: any) => e.source === nodeId);
      nextEdges.forEach((edge: any) => {
        traverse(edge.target);
      });
    };
    
    traverse(startNode.id);
    
    return steps;
  }, [sop]);
  
  /**
   * 获取当前步骤索引
   */
  const currentStepIndex = useMemo(() => {
    if (!execution?.currentNodeId) return -1;
    return flowSteps.findIndex((step) => step.id === execution.currentNodeId);
  }, [execution, flowSteps]);
  
  /**
   * 获取步骤状态
   */
  const getStepStatus = (stepIndex: number): 'wait' | 'process' | 'finish' | 'error' => {
    if (!execution) return 'wait';
    
    if (stepIndex < currentStepIndex) {
      return 'finish';
    } else if (stepIndex === currentStepIndex) {
      return execution.status === 'running' ? 'process' : 'wait';
    } else {
      return 'wait';
    }
  };
  
  /**
   * 处理节点完成
   */
  const handleCompleteNode = async () => {
    if (!execution || !execution.currentNodeId) {
      messageApi.warning('当前没有可完成的节点');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // 获取表单数据
      const formData = form.values;
      
      // 发送节点完成事件
      const request: SOPNodeCompleteRequest = {
        nodeId: execution.currentNodeId,
        formData,
      };
      
      await sopExecutionApi.completeNode(execution.uuid, request);
      
      messageApi.success('节点已完成，正在流转到下一个节点...');
      
      // 重新加载数据
      setTimeout(() => {
        loadExecutionData();
      }, 1000);
    } catch (error: any) {
      messageApi.error(error.message || '完成节点失败');
    } finally {
      setSubmitting(false);
    }
  };
  
  /**
   * 处理返回
   */
  const handleBack = () => {
    navigate('/apps/master-data/process/sop');
  };
  
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载中...</div>
      </div>
    );
  }
  
  if (!execution || !sop) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="danger">执行实例或SOP数据不存在</Text>
      </div>
    );
  }
  
  return (
    <div style={{ padding: 24 }}>
      {/* 标题栏 */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {execution.title}
            </Title>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">SOP: {sop.name} ({sop.code})</Text>
              <Tag
                color={
                  execution.status === 'completed'
                    ? 'success'
                    : execution.status === 'running'
                    ? 'processing'
                    : execution.status === 'cancelled'
                    ? 'error'
                    : 'default'
                }
                style={{ marginLeft: 8 }}
              >
                {execution.status === 'completed'
                  ? '已完成'
                  : execution.status === 'running'
                  ? '执行中'
                  : execution.status === 'cancelled'
                  ? '已取消'
                  : execution.status === 'paused'
                  ? '已暂停'
                  : '待开始'}
              </Tag>
            </div>
          </div>
          <Button icon={<CloseOutlined />} onClick={handleBack}>
            返回
          </Button>
        </Space>
      </Card>
      
      <div style={{ display: 'flex', gap: 16 }}>
        {/* 左侧：流程步骤 */}
        <Card
          title="流程步骤"
          style={{ width: 300, flexShrink: 0 }}
        >
          <Steps direction="vertical" current={currentStepIndex} size="small">
            {flowSteps.map((step, index) => (
              <Step
                key={step.id}
                title={step.title}
                description={step.description}
                status={getStepStatus(index)}
              />
            ))}
          </Steps>
        </Card>
        
        {/* 右侧：当前节点表单 */}
        <Card
          title={
            currentNode
              ? `${currentNode.data?.label || currentNode.id} - 表单填写`
              : '等待开始'
          }
          style={{ flex: 1 }}
          extra={
            execution.status === 'running' && execution.currentNodeId ? (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={submitting}
                onClick={handleCompleteNode}
              >
                完成当前节点
              </Button>
            ) : null
          }
        >
          {execution.status === 'completed' ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <CheckOutlined style={{ fontSize: 48, color: '#52c41a' }} />
              <div style={{ marginTop: 16, fontSize: 16, fontWeight: 'bold' }}>
                流程执行完成
              </div>
              <div style={{ marginTop: 8, color: '#666' }}>
                开始时间: {new Date(execution.startedAt).toLocaleString()}
              </div>
              {execution.completedAt && (
                <div style={{ marginTop: 4, color: '#666' }}>
                  完成时间: {new Date(execution.completedAt).toLocaleString()}
                </div>
              )}
            </div>
          ) : execution.status === 'running' && currentNode && currentNodeSchema ? (
            <FormProvider form={form}>
              <FormLayout labelCol={6} wrapperCol={18}>
                <SchemaField schema={currentNodeSchema} />
              </FormLayout>
            </FormProvider>
          ) : execution.status === 'running' && currentNode ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#666' }}>
              当前节点: {currentNode.data?.label || currentNode.id}
              {currentNode.data?.description && (
                <div style={{ marginTop: 8 }}>{currentNode.data.description}</div>
              )}
              <div style={{ marginTop: 16, color: '#999' }}>
                该节点没有配置表单，可以直接完成
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 48, color: '#666' }}>
              等待流程开始...
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SOPExecutionPage;


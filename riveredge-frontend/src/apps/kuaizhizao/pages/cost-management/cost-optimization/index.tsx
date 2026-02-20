/**
 * 成本优化建议页面
 *
 * 提供基于物料来源类型的成本优化建议功能。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Tag, message, Modal, Divider, List, Badge, Alert } from 'antd';
import { BulbOutlined, CalculatorOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import { costOptimizationApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

interface OptimizationSuggestion {
  suggestion_type: string;
  from_source_type: string;
  to_source_type: string;
  current_cost: number;
  alternative_cost: number;
  potential_savings: number;
  savings_rate: number;
  priority: string;
  description: string;
}

interface OptimizationResult {
  material_id: number;
  material_code: string;
  material_name: string;
  current_source_type: string;
  current_cost: {
    source_type: string;
    total_cost: number;
    unit_cost: number;
  };
  alternative_costs: Record<string, any>;
  suggestions: OptimizationSuggestion[];
  calculation_date: string;
}

const CostOptimizationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 处理生成建议
   */
  const handleGenerateSuggestions = async (values: any) => {
    try {
      setLoading(true);
      let result;
      if (mode === 'single') {
        const data = {
          material_id: values.material_id,
          quantity: values.quantity,
          calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        };
        result = await costOptimizationApi.getSuggestions(data);
      } else {
        const data = {
          material_ids: values.material_ids || [],
          quantity: values.quantity,
          calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        };
        result = await costOptimizationApi.getBatchSuggestions(data);
      }
      setResult(result);
      messageApi.success('成本优化建议生成成功');
    } catch (error: any) {
      messageApi.error(error.message || '成本优化建议生成失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开弹窗
   */
  const handleOpenModal = (m: 'single' | 'batch') => {
    setMode(m);
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      calculation_date: dayjs(),
      quantity: 1,
    });
  };

  /**
   * 获取优先级标签
   */
  const getPriorityTag = (priority: string) => {
    const priorityMap: Record<string, { color: string; text: string }> = {
      高: { color: 'red', text: '高' },
      中: { color: 'orange', text: '中' },
      低: { color: 'blue', text: '低' },
    };
    const p = priorityMap[priority] || { color: 'default', text: priority };
    return <Tag color={p.color}>{p.text}</Tag>;
  };

  /**
   * 获取物料来源类型标签
   */
  const getSourceTypeTag = (sourceType: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      Make: { color: 'blue', text: '自制件' },
      Buy: { color: 'green', text: '采购件' },
      Outsource: { color: 'orange', text: '委外件' },
      Phantom: { color: 'purple', text: '虚拟件' },
      Configure: { color: 'cyan', text: '配置件' },
    };
    const type = typeMap[sourceType] || { color: 'default', text: sourceType };
    return <Tag color={type.color}>{type.text}</Tag>;
  };

  return (
    <PageContainer
      title="成本优化建议"
      contentStyle={{ padding: 0 }}
      extra={[
        <Button
          key="suggestions-single"
          type="primary"
          icon={<BulbOutlined />}
          onClick={() => handleOpenModal('single')}
        >
          生成单个物料优化建议
        </Button>,
        <Button
          key="suggestions-batch"
          icon={<BulbOutlined />}
          onClick={() => handleOpenModal('batch')}
        >
          批量生成优化建议
        </Button>,
      ]}
    >
      {/* 优化建议结果展示 */}
      {result && (
        <Card title="优化建议结果" style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
          {mode === 'single' && result.material_code && (
            <ProDescriptions
              bordered
              column={2}
              style={{ marginBottom: 24 }}
              dataSource={{
                material_code: result.material_code,
                material_name: result.material_name,
                current_source_type: getSourceTypeTag(result.current_source_type),
                current_cost: `¥${result.current_cost?.total_cost?.toFixed(2)}`,
              }}
              columns={[
                { title: '物料编码', dataIndex: 'material_code' },
                { title: '物料名称', dataIndex: 'material_name' },
                { title: '当前来源类型', dataIndex: 'current_source_type' },
                { title: '当前成本', dataIndex: 'current_cost' },
              ]}
            />
          )}

          {result.suggestions && result.suggestions.length > 0 ? (
            <List
              dataSource={result.suggestions}
              renderItem={(item: OptimizationSuggestion, index: number) => (
                <List.Item>
                  <Card
                    style={{ width: '100%' }}
                    title={
                      <Space>
                        <Badge status={item.priority === '高' ? 'error' : item.priority === '中' ? 'warning' : 'processing'} />
                        <span>{item.suggestion_type}</span>
                        {getPriorityTag(item.priority)}
                      </Space>
                    }
                    extra={
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                        预计节约：¥{item.potential_savings.toFixed(2)}
                      </span>
                    }
                  >
                    <ProDescriptions
                      column={2}
                      size="small"
                      dataSource={{
                        from: getSourceTypeTag(item.from_source_type),
                        to: getSourceTypeTag(item.to_source_type),
                        current_cost: `¥${item.current_cost.toFixed(2)}`,
                        alternative_cost: `¥${item.alternative_cost.toFixed(2)}`,
                        potential_savings: `¥${item.potential_savings.toFixed(2)}`,
                        savings_rate: `${item.savings_rate.toFixed(2)}%`,
                      }}
                      columns={[
                        { title: '从', dataIndex: 'from' },
                        { title: '转为', dataIndex: 'to' },
                        { title: '当前成本', dataIndex: 'current_cost' },
                        { title: '替代方案成本', dataIndex: 'alternative_cost' },
                        { title: '潜在节约成本', dataIndex: 'potential_savings' },
                        { title: '节约率', dataIndex: 'savings_rate' },
                      ]}
                    />
                    <Alert
                      title={item.description}
                      type="info"
                      showIcon
                      style={{ marginTop: 12 }}
                    />
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Alert
              title="暂无优化建议"
              description="当前物料的成本已经是最优的，或者无法找到更优的替代方案。"
              type="info"
              showIcon
            />
          )}
        </Card>
      )}

      {/* 生成建议弹窗 */}
      <FormModalTemplate
        title={mode === 'single' ? '生成单个物料优化建议' : '批量生成优化建议'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setResult(null);
        }}
        formRef={formRef}
        onFinish={handleGenerateSuggestions}
        loading={loading}
        width={600}
      >
        {mode === 'single' ? (
          <>
            <ProFormSelect
              name="material_id"
              label="物料"
              placeholder="请选择物料"
              rules={[{ required: true, message: '请选择物料' }]}
              options={materials.map(m => ({
                label: `${m.mainCode || m.code} - ${m.name} (${m.sourceType || m.source_type || 'Make'})`,
                value: m.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input: string, option: any) =>
                  option?.label?.toLowerCase().includes(input.toLowerCase()),
              }}
            />
            <ProFormDigit
              name="quantity"
              label="数量"
              placeholder="请输入数量（用于计算成本）"
              rules={[{ required: true, message: '请输入数量' }, { type: 'number', min: 0.0001, message: '数量必须大于0' }]}
              fieldProps={{
                precision: 4,
                style: { width: '100%' },
                defaultValue: 1,
              }}
            />
          </>
        ) : (
          <ProFormSelect
            name="material_ids"
            label="物料列表"
            placeholder="请选择多个物料"
            rules={[{ required: true, message: '请选择物料' }]}
            options={materials.map(m => ({
              label: `${m.mainCode || m.code} - ${m.name} (${m.sourceType || m.source_type || 'Make'})`,
              value: m.id,
            }))}
            fieldProps={{
              mode: 'multiple',
              showSearch: true,
              filterOption: (input: string, option: any) =>
                option?.label?.toLowerCase().includes(input.toLowerCase()),
            }}
          />
        )}
        <ProFormDatePicker
          name="calculation_date"
          label="核算日期"
          placeholder="请选择核算日期"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
      </FormModalTemplate>
    </PageContainer>
  );
};

export default CostOptimizationPage;

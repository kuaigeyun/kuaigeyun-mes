/**
 * 成本优化建议（物料来源维度）
 */

import React, { useMemo, useRef, useState } from 'react';
import { ProFormSelect, ProFormDigit, ProFormDatePicker, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Card, Tag, List, Badge, Alert, Space } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../components/layout-templates';
import { costOptimizationApi } from '../../services/cost';
import { materialApi } from '../../../master-data/services/material';
import dayjs from 'dayjs';
import { normalizeCostListRows } from './costSelectData';
import { formatSourceType, getPriorityTag, getSourceTypeTag } from '../../utils/costUiLabels';

export interface OptimizationSuggestion {
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

export interface OptimizationResult {
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

const CostOptimizationPanel: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const list = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(normalizeCostListRows(list));
      } catch (error: any) {
        console.error('load materials failed:', error);
      }
    };
    loadMaterials();
  }, []);

  const handleGenerateSuggestions = async (values: any) => {
    try {
      setLoading(true);
      let res;
      if (mode === 'single') {
        res = await costOptimizationApi.getSuggestions({
          material_id: values.material_id,
          quantity: values.quantity,
          calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        });
      } else {
        res = await costOptimizationApi.getBatchSuggestions({
          material_ids: values.material_ids || [],
          quantity: values.quantity,
          calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
        });
      }
      setResult(res);
      messageApi.success(t('app.kuaicaiwu.costOptimization.generateSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaicaiwu.costOptimization.generateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (m: 'single' | 'batch') => {
    setMode(m);
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ calculation_date: dayjs(), quantity: 1 });
  };

  const summaryColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costCommon.col.materialCode'), dataIndex: 'material_code' },
      { title: t('app.kuaicaiwu.costCommon.col.materialName'), dataIndex: 'material_name' },
      { title: t('app.kuaicaiwu.costOptimization.col.currentSourceType'), dataIndex: 'current_source_type' },
      { title: t('app.kuaicaiwu.costOptimization.col.currentCost'), dataIndex: 'current_cost' },
    ],
    [t],
  );

  const suggestionColumns = useMemo(
    () => [
      { title: t('app.kuaicaiwu.costOptimization.col.from'), dataIndex: 'from' },
      { title: t('app.kuaicaiwu.costOptimization.col.to'), dataIndex: 'to' },
      { title: t('app.kuaicaiwu.costOptimization.col.currentCost'), dataIndex: 'current_cost' },
      { title: t('app.kuaicaiwu.costOptimization.col.alternativeCost'), dataIndex: 'alternative_cost' },
      { title: t('app.kuaicaiwu.costOptimization.col.potentialSavings'), dataIndex: 'potential_savings' },
      { title: t('app.kuaicaiwu.costOptimization.col.savingsRate'), dataIndex: 'savings_rate' },
    ],
    [t],
  );

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<BulbOutlined />} onClick={() => handleOpenModal('single')}>
          {t('app.kuaicaiwu.costOptimization.generateSingle')}
        </Button>
        <Button icon={<BulbOutlined />} onClick={() => handleOpenModal('batch')}>
          {t('app.kuaicaiwu.costOptimization.generateBatch')}
        </Button>
      </Space>

      {result && (
        <Card title={t('app.kuaicaiwu.costOptimization.resultTitle')} style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
          {mode === 'single' && result.material_code && (
            <ProDescriptions
              bordered
              column={2}
              style={{ marginBottom: 24 }}
              dataSource={{
                material_code: result.material_code,
                material_name: result.material_name,
                current_source_type: getSourceTypeTag(result.current_source_type, t),
                current_cost: `¥${result.current_cost?.total_cost?.toFixed(2)}`,
              }}
              columns={summaryColumns}
            />
          )}

          {result.suggestions && result.suggestions.length > 0 ? (
            <List
              dataSource={result.suggestions}
              renderItem={(item: OptimizationSuggestion) => (
                <List.Item>
                  <Card
                    style={{ width: '100%' }}
                    title={
                      <Space>
                        <Badge
                          status={
                            item.priority === '高' ? 'error' : item.priority === '中' ? 'warning' : 'processing'
                          }
                        />
                        <span>{item.suggestion_type}</span>
                        {getPriorityTag(item.priority, t)}
                      </Space>
                    }
                    extra={
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                        {t('app.kuaicaiwu.costOptimization.estimatedSavings', {
                          amount: item.potential_savings.toFixed(2),
                        })}
                      </span>
                    }
                  >
                    <ProDescriptions
                      column={2}
                      size="small"
                      dataSource={{
                        from: getSourceTypeTag(item.from_source_type, t),
                        to: getSourceTypeTag(item.to_source_type, t),
                        current_cost: `¥${item.current_cost.toFixed(2)}`,
                        alternative_cost: `¥${item.alternative_cost.toFixed(2)}`,
                        potential_savings: `¥${item.potential_savings.toFixed(2)}`,
                        savings_rate: `${item.savings_rate.toFixed(2)}%`,
                      }}
                      columns={suggestionColumns}
                    />
                    <Alert title={item.description} type="info" showIcon style={{ marginTop: 12 }} />
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Alert
              title={t('app.kuaicaiwu.costOptimization.noSuggestions')}
              description={t('app.kuaicaiwu.costOptimization.noSuggestionsDesc')}
              type="info"
              showIcon
            />
          )}
        </Card>
      )}

      <FormModalTemplate
        title={mode === 'single' ? t('app.kuaicaiwu.costOptimization.modalSingle') : t('app.kuaicaiwu.costOptimization.modalBatch')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setResult(null);
        }}
        formRef={formRef}
        onFinish={handleGenerateSuggestions}
        loading={loading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        {mode === 'single' ? (
          <>
            <ProFormSelect
              name="material_id"
              label={t('app.kuaicaiwu.costCommon.field.material')}
              placeholder={t('app.kuaicaiwu.costCommon.field.materialPlaceholder')}
              rules={[{ required: true, message: t('app.kuaicaiwu.costCommon.field.materialRequired') }]}
              options={materials.map((m) => ({
                label: `${m.mainCode || m.code} - ${m.name} (${formatSourceType(m.sourceType || m.source_type || 'Make', t)})`,
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
              label={t('app.kuaicaiwu.costCommon.col.quantity')}
              placeholder={t('app.kuaicaiwu.costOptimization.field.quantityPlaceholder')}
              rules={[
                { required: true, message: t('app.kuaicaiwu.costCommon.field.quantityRequired') },
                { type: 'number', min: 0.0001, message: t('app.kuaicaiwu.costCommon.field.quantityMin') },
              ]}
              fieldProps={{ precision: 4, style: { width: '100%' }, defaultValue: 1 }}
            />
          </>
        ) : (
          <ProFormSelect
            name="material_ids"
            label={t('app.kuaicaiwu.costOptimization.field.materialList')}
            placeholder={t('app.kuaicaiwu.costOptimization.field.materialListPlaceholder')}
            rules={[{ required: true, message: t('app.kuaicaiwu.costCommon.field.materialRequired') }]}
            options={materials.map((m) => ({
              label: `${m.mainCode || m.code} - ${m.name} (${formatSourceType(m.sourceType || m.source_type || 'Make', t)})`,
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
          label={t('app.kuaicaiwu.costCommon.col.calculationDate')}
          placeholder={t('app.kuaicaiwu.costCommon.field.calculationDatePlaceholder')}
          fieldProps={{ style: { width: '100%' } }}
        />
      </FormModalTemplate>
    </div>
  );
};

export default CostOptimizationPanel;

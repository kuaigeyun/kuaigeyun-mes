/**
 * 质量成本核算页面
 *
 * 提供质量成本核算功能，包括预防成本、鉴定成本、内部损失成本、外部损失成本。
 *
 * @author Luigi Lu
 * @date 2026-01-16
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProFormSelect, ProFormDigit, ProFormDatePicker, PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, Descriptions, Tag, message, Modal, Divider, Row, Col, Statistic } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import { qualityCostApi } from '../../../services/cost';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

interface QualityCostResult {
  prevention_cost: number;
  appraisal_cost: number;
  internal_failure_cost: number;
  external_failure_cost: number;
  total_quality_cost: number;
  cost_details: any;
  calculation_type: string;
  calculation_date: string;
  start_date?: string;
  end_date?: string;
  material_id?: number;
  work_order_id?: number;
}

const QualityCostPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [result, setResult] = useState<QualityCostResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);

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
   * 处理核算
   */
  const handleCalculate = async (values: any) => {
    try {
      setLoading(true);
      const data = {
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
        material_id: values.material_id,
        work_order_id: values.work_order_id,
        calculation_date: values.calculation_date ? values.calculation_date.format('YYYY-MM-DD') : undefined,
      };
      const result = await qualityCostApi.calculate(data);
      setResult(result);
      messageApi.success('质量成本核算成功');
    } catch (error: any) {
      messageApi.error(error.message || '质量成本核算失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开核算弹窗
   */
  const handleOpenModal = () => {
    setModalVisible(true);
    setResult(null);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      calculation_date: dayjs(),
      start_date: dayjs().subtract(30, 'day'),
      end_date: dayjs(),
    });
  };

  return (
    <PageContainer
      title="质量成本核算"
      extra={[
        <Button
          key="calculate"
          type="primary"
          icon={<CalculatorOutlined />}
          onClick={handleOpenModal}
        >
          核算质量成本
        </Button>,
      ]}
    >
      {/* 核算结果展示 */}
      {result && (
        <Card title="核算结果" style={{ marginBottom: 16 }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="预防成本"
                  value={result.prevention_cost}
                  prefix="¥"
                  precision={2}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="鉴定成本"
                  value={result.appraisal_cost}
                  prefix="¥"
                  precision={2}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="内部损失成本"
                  value={result.internal_failure_cost}
                  prefix="¥"
                  precision={2}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="外部损失成本"
                  value={result.external_failure_cost}
                  prefix="¥"
                  precision={2}
                />
              </Card>
            </Col>
          </Row>

          <Descriptions bordered column={2}>
            <Descriptions.Item label="总质量成本">
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
                ¥{result.total_quality_cost?.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="核算类型">{result.calculation_type}</Descriptions.Item>
            {result.start_date && (
              <Descriptions.Item label="开始日期">
                {dayjs(result.start_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
            )}
            {result.end_date && (
              <Descriptions.Item label="结束日期">
                {dayjs(result.end_date).format('YYYY-MM-DD')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="核算日期">
              {result.calculation_date ? dayjs(result.calculation_date).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
          </Descriptions>

          {result.cost_details && (
            <>
              <Divider>成本明细</Divider>
              <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}>
                {JSON.stringify(result.cost_details, null, 2)}
              </pre>
            </>
          )}
        </Card>
      )}

      {/* 核算弹窗 */}
      <FormModalTemplate
        title="核算质量成本"
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setResult(null);
        }}
        formRef={formRef}
        onFinish={handleCalculate}
        loading={loading}
        width={600}
      >
        <ProFormDatePicker
          name="start_date"
          label="开始日期"
          placeholder="请选择开始日期（可选）"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormDatePicker
          name="end_date"
          label="结束日期"
          placeholder="请选择结束日期（可选）"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormSelect
          name="material_id"
          label="物料（可选）"
          placeholder="请选择物料（可选，用于核算特定物料的质量成本）"
          options={materials.map(m => ({
            label: `${m.mainCode || m.code} - ${m.name}`,
            value: m.id,
          }))}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              option?.label?.toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDigit
          name="work_order_id"
          label="工单ID（可选）"
          placeholder="请输入工单ID（可选，用于核算特定工单的质量成本）"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
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

export default QualityCostPage;

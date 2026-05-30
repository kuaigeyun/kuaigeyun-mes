import React from 'react';
import { ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Alert, Divider, Typography } from 'antd';
import {
  getInspectionTemplateSource,
  getTemplateStepItems,
  hasInspectionPlanSteps,
} from './inspectionTemplateUtils';

const { Text } = Typography;

interface InspectionTemplateConductFieldsProps {
  inspection: Record<string, unknown> | null | undefined;
}

/**
 * 按检验单上的方案/标准模板渲染检验项录入（plan 模式逐步判定，simple 模式展示标准摘要）。
 */
const InspectionTemplateConductFields: React.FC<InspectionTemplateConductFieldsProps> = ({ inspection }) => {
  const template = getInspectionTemplateSource(inspection);
  if (!template) return null;

  const planName = (template.plan_code as string) || (template.standard_id ? '质量标准' : null);
  const steps = getTemplateStepItems(template);

  if (hasInspectionPlanSteps(template)) {
    return (
      <>
        <Divider orientation="left" plain>
          检验方案项{planName ? `（${planName}）` : ''}
        </Divider>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="方案模式下须逐项填写检验结果后方可提交。"
        />
        {steps.map((step, idx) => {
          const label = step.inspection_item || `检验项 ${idx + 1}`;
          const hint = [step.inspection_method, step.acceptance_criteria].filter(Boolean).join(' · ');
          return (
            <div key={`${label}-${idx}`} style={{ marginBottom: 12 }}>
              <Text strong>{label}</Text>
              {hint ? (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {hint}
                  </Text>
                </div>
              ) : null}
              <ProFormSelect
                name={['item_results', String(idx)]}
                label="判定"
                rules={[{ required: true, message: `请填写「${label}」的判定结果` }]}
                valueEnum={{ pass: '合格', fail: '不合格' }}
              />
              <ProFormDigit
                name={['measurement_data', label]}
                label="测量值（选填）"
                fieldProps={{ precision: 4, style: { width: '100%' } }}
              />
            </div>
          );
        })}
      </>
    );
  }

  const criteria = template.acceptance_criteria as string | undefined;
  const standardItems = template.inspection_items;
  if (!criteria && !standardItems) return null;

  return (
    <>
      <Divider orientation="left" plain>
        质量标准{planName ? `（${planName}）` : ''}
      </Divider>
      {criteria ? (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`合格标准：${criteria}`} />
      ) : null}
      {standardItems ? (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            检验项目：{typeof standardItems === 'string' ? standardItems : JSON.stringify(standardItems)}
          </Text>
        </div>
      ) : null}
      <ProFormSelect
        name={['item_results', '0']}
        label="整体判定"
        rules={[{ required: true, message: '请填写检验判定' }]}
        valueEnum={{ pass: '合格', fail: '不合格' }}
      />
    </>
  );
};

export default InspectionTemplateConductFields;

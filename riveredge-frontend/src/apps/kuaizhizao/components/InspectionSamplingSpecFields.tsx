import React, { useEffect } from 'react';
import { Form, InputNumber, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { normalizeSamplingSpec, type SamplingSpec } from '../types/inspectionStepSpec';

type Props = {
  value?: SamplingSpec;
  onChange?: (spec: SamplingSpec) => void;
};

export const InspectionSamplingSpecFields: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const spec = normalizeSamplingSpec(value);

  useEffect(() => {
    onChange?.(normalizeSamplingSpec(value));
    // 挂载时将默认 n/Ac/Re 写入 Form，避免仅展示默认值却未注册字段
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次挂载同步
  }, []);

  const patch = (partial: Partial<SamplingSpec>) => {
    onChange?.({ ...spec, ...partial });
  };

  return (
    <Space wrap>
      <Form.Item
        label={t('app.kuaizhizao.quality.plans.stepSpec.sampleSize')}
        style={{ marginBottom: 0 }}
      >
        <InputNumber
          min={1}
          value={spec.sample_size}
          onChange={(v) => patch({ sample_size: v ?? 1 })}
          style={{ width: 100 }}
        />
      </Form.Item>
      <Form.Item
        label={t('app.kuaizhizao.quality.plans.stepSpec.acceptNum')}
        style={{ marginBottom: 0 }}
      >
        <InputNumber
          min={0}
          value={spec.accept_num}
          onChange={(v) => patch({ accept_num: v ?? 0 })}
          style={{ width: 100 }}
        />
      </Form.Item>
      <Form.Item
        label={t('app.kuaizhizao.quality.plans.stepSpec.rejectNum')}
        style={{ marginBottom: 0 }}
      >
        <InputNumber
          min={0}
          value={spec.reject_num}
          onChange={(v) => patch({ reject_num: v ?? 1 })}
          style={{ width: 100 }}
        />
      </Form.Item>
    </Space>
  );
};

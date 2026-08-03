/**
 * KU-Draft 字段级 AI 润色
 */

import React, { useState } from 'react';
import { App, Button, Tooltip } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api';
import { useKuaiaiEntryAvailable } from '../../apps/kuaiai/hooks/useKuaiaiEntryAvailable';

export type AiFieldAssistProps = {
  value?: string;
  onChange?: (next: string) => void;
  fieldName: string;
  scene?: string;
  disabled?: boolean;
};

export const AiFieldAssist: React.FC<AiFieldAssistProps> = ({
  value,
  onChange,
  fieldName,
  scene = '质量异常描述',
  disabled,
}) => {
  const { message } = App.useApp();
  const available = useKuaiaiEntryAvailable();
  const [loading, setLoading] = useState(false);

  if (!available || !onChange) return null;

  const handlePolish = async () => {
    const raw = (value || '').trim();
    if (!raw) {
      message.warning('请先输入内容');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ polished_text: string }>('/apps/kuaiai/draft/polish-field', {
        method: 'POST',
        body: JSON.stringify({ field_name: fieldName, raw_text: raw, scene }),
      });
      onChange(res.polished_text || raw);
      message.success('已润色，请确认后保存');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '润色失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip title="KU-AI 润色">
      <Button
        type="text"
        size="small"
        icon={<BulbOutlined />}
        loading={loading}
        disabled={disabled || loading}
        onClick={() => void handlePolish()}
        aria-label="AI 润色"
      />
    </Tooltip>
  );
};

export default AiFieldAssist;

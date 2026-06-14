/**
 * 自定义字段 JSON 编辑器
 *
 * 默认键值对模式便于普通用户填写；复杂结构可切换 JSON 源码并格式化校验。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Col, Input, Row, Typography, theme } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { ThemedSegmented } from '../themed-segmented';
import {
  formatJsonText,
  isFlatJsonObject,
  jsonValueToKeyValuePairs,
  keyValuePairsToJsonObject,
  parseJsonText,
  type JsonKeyValuePair,
} from './customFieldJsonUtils';

export type CustomFieldJsonEditorMode = 'kv' | 'source';

export interface CustomFieldJsonModeSegmentedProps {
  mode: CustomFieldJsonEditorMode;
  onChange: (mode: CustomFieldJsonEditorMode) => void;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
}

export const CustomFieldJsonModeSegmented: React.FC<CustomFieldJsonModeSegmentedProps> = ({
  mode,
  onChange,
  disabled = false,
  size = 'small',
}) => (
  <ThemedSegmented
    size={size}
    value={mode}
    disabled={disabled}
    onChange={(v) => onChange(v as CustomFieldJsonEditorMode)}
    options={[
      { label: '键值对', value: 'kv' },
      { label: 'JSON 源码', value: 'source' },
    ]}
  />
);

export interface CustomFieldJsonEditorProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 是否在编辑器顶部显示模式切换，默认 true */
  showModeToggle?: boolean;
  mode?: CustomFieldJsonEditorMode;
  onModeChange?: (mode: CustomFieldJsonEditorMode) => void;
}

export const CustomFieldJsonEditor: React.FC<CustomFieldJsonEditorProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  showModeToggle = true,
  mode: controlledMode,
  onModeChange,
}) => {
  const { token } = theme.useToken();
  const initialMode: CustomFieldJsonEditorMode = isFlatJsonObject(value) || value == null ? 'kv' : 'source';
  const [internalMode, setInternalMode] = useState<CustomFieldJsonEditorMode>(initialMode);
  const mode = controlledMode ?? internalMode;
  const [pairs, setPairs] = useState<JsonKeyValuePair[]>(() => jsonValueToKeyValuePairs(value));
  const [sourceText, setSourceText] = useState(() => formatJsonText(value));
  const [error, setError] = useState<string | null>(null);
  const lastModeRef = useRef(mode);
  const skipValueSyncRef = useRef(false);

  const emitChange = (next: unknown) => {
    skipValueSyncRef.current = true;
    onChange?.(next);
  };

  const setMode = (nextMode: CustomFieldJsonEditorMode) => {
    if (controlledMode == null) {
      setInternalMode(nextMode);
    }
    onModeChange?.(nextMode);
  };

  useEffect(() => {
    if (skipValueSyncRef.current) {
      skipValueSyncRef.current = false;
      return;
    }
    if (isFlatJsonObject(value) || value == null) {
      setPairs(jsonValueToKeyValuePairs(value));
      if (mode === 'kv') {
        setSourceText(formatJsonText(value));
        setError(null);
      }
      return;
    }
    setMode('source');
    setSourceText(formatJsonText(value));
    setError(null);
  }, [value]);

  useEffect(() => {
    if (controlledMode == null || lastModeRef.current === mode) return;
    const prev = lastModeRef.current;
    lastModeRef.current = mode;
    if (mode === 'source' && prev === 'kv') {
      const objectValue = keyValuePairsToJsonObject(pairs);
      setSourceText(formatJsonText(objectValue ?? value));
      setError(null);
      return;
    }
    if (mode === 'kv' && prev === 'source') {
      const parsed = parseJsonText(sourceText);
      if (!parsed.ok) {
        setError(parsed.error);
        lastModeRef.current = prev;
        if (controlledMode != null) onModeChange?.(prev);
        return;
      }
      if (parsed.value != null && !isFlatJsonObject(parsed.value)) {
        setError('当前 JSON 结构较复杂，请继续使用 JSON 源码模式编辑');
        lastModeRef.current = prev;
        if (controlledMode != null) onModeChange?.(prev);
        return;
      }
      setPairs(jsonValueToKeyValuePairs(parsed.value));
      setError(null);
      emitChange(parsed.value);
    }
  }, [mode, controlledMode]);

  const hint = useMemo(
    () => placeholder || '例如：{"优先级": 1, "备注": "加急"}',
    [placeholder],
  );

  const handleModeChange = (nextMode: CustomFieldJsonEditorMode) => {
    if (nextMode === 'source') {
      const objectValue = mode === 'kv' ? keyValuePairsToJsonObject(pairs) : value;
      setSourceText(formatJsonText(objectValue ?? value));
      setError(null);
      setMode('source');
      lastModeRef.current = 'source';
      return;
    }

    const parsed = parseJsonText(sourceText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.value != null && !isFlatJsonObject(parsed.value)) {
      setError('当前 JSON 结构较复杂，请继续使用 JSON 源码模式编辑');
      return;
    }
    setPairs(jsonValueToKeyValuePairs(parsed.value));
    setError(null);
    setMode('kv');
    lastModeRef.current = 'kv';
    emitChange(parsed.value);
  };

  const updatePairs = (nextPairs: JsonKeyValuePair[]) => {
    setPairs(nextPairs);
    emitChange(keyValuePairsToJsonObject(nextPairs));
  };

  const handleSourceBlur = () => {
    const parsed = parseJsonText(sourceText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    emitChange(parsed.value);
  };

  const handleFormat = () => {
    const parsed = parseJsonText(sourceText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSourceText(formatJsonText(parsed.value));
    setError(null);
    emitChange(parsed.value);
  };

  return (
    <div style={{ width: '100%' }}>
      {showModeToggle ? (
        <div style={{ marginBottom: 8 }}>
          <CustomFieldJsonModeSegmented mode={mode} onChange={handleModeChange} disabled={disabled} />
        </div>
      ) : null}

      {mode === 'kv' ? (
        <div
          style={{
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadius,
            padding: 12,
            background: token.colorFillAlter,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {pairs.map((pair, index) => (
              <Row key={`${index}-${pair.key}`} gutter={8} align="middle" wrap={false}>
                <Col span={11}>
                  <Input
                    placeholder="字段名"
                    value={pair.key}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...pairs];
                      next[index] = { ...pair, key: e.target.value };
                      updatePairs(next);
                    }}
                  />
                </Col>
                <Col span={11}>
                  <Input
                    placeholder="字段值"
                    value={pair.value}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...pairs];
                      next[index] = { ...pair, value: e.target.value };
                      updatePairs(next);
                    }}
                  />
                </Col>
                <Col span={2} style={{ textAlign: 'center' }}>
                  <Button
                    type="text"
                    danger
                    disabled={disabled || pairs.length <= 1}
                    icon={<MinusCircleOutlined />}
                    onClick={() => updatePairs(pairs.filter((_, i) => i !== index))}
                  />
                </Col>
              </Row>
            ))}
            <Button
              type="dashed"
              block
              size="small"
              disabled={disabled}
              icon={<PlusOutlined />}
              onClick={() => updatePairs([...pairs, { key: '', value: '' }])}
            >
              添加一行
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              适合填写简单参数；数字与 true/false 会自动识别类型。
            </Typography.Text>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          <Input.TextArea
            value={sourceText}
            disabled={disabled}
            placeholder={hint}
            rows={6}
            style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13, width: '100%' }}
            onChange={(e) => {
              setSourceText(e.target.value);
              if (error) setError(null);
            }}
            onBlur={handleSourceBlur}
          />
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              支持对象、数组等复杂结构；失焦或格式化时自动校验。
            </Typography.Text>
            <Button size="small" disabled={disabled} onClick={handleFormat}>
              格式化
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <Typography.Text type="danger" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          {error}
        </Typography.Text>
      ) : null}
    </div>
  );
};

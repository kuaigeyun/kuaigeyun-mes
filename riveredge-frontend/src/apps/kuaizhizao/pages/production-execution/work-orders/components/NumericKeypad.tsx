/**
 * 拟物化数字小键盘 - 触屏友好
 * 用于合格数、不合格数等数字输入
 */

import React from 'react';
import { HMI_DESIGN_TOKENS } from '../../../../../../components/layout-templates';

export interface NumericKeypadProps {
  /** 当前聚焦的字段名 */
  focusedField: string | null;
  /** 点击数字/退格/清空时的回调 */
  onInput: (field: string, action: 'digit' | 'backspace' | 'clear', value?: string) => void;
  /** 字段配置 */
  fields: Array<{ key: string; label: string }>;
  /** 点击某字段设为聚焦 */
  onSelectField: (field: string) => void;
}

const KEY_BASE = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)',
  boxShadow: '5px 5px 10px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 14,
  fontSize: 32,
  fontWeight: 600,
  color: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
  minHeight: 64,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  userSelect: 'none' as const,
  transition: 'all 0.15s ease',
};

const KEY_ACTIVE = {
  boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.4), inset -1px -1px 3px rgba(255,255,255,0.05)',
  transform: 'scale(0.97)',
};

const NumericKeypad: React.FC<NumericKeypadProps> = ({
  focusedField,
  onInput,
  fields,
  onSelectField,
}) => {
  const handleKeyDown = (action: 'digit' | 'backspace' | 'clear', value?: string) => {
    if (!focusedField) return;
    onInput(focusedField, action, value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      {/* 字段选择 */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {fields.map((f) => (
          <div
            key={f.key}
            onClick={() => onSelectField(f.key)}
            style={{
              flex: 1,
              ...KEY_BASE,
              minHeight: 44,
              fontSize: 16,
              background: focusedField === f.key
                ? 'linear-gradient(145deg, rgba(0,200,83,0.25) 0%, rgba(0,200,83,0.12) 100%)'
                : KEY_BASE.background,
              borderColor: focusedField === f.key ? 'rgba(0,200,83,0.5)' : 'rgba(255,255,255,0.1)',
            }}
          >
            {f.label}
          </div>
        ))}
      </div>
      {/* 数字键盘：123 / 456 / 789 / .0删除 */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k, i) => (
          <div
            key={i}
            onClick={() => {
              if (k === '⌫') handleKeyDown('backspace');
              else if (k) handleKeyDown('digit', k);
            }}
            onTouchStart={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = KEY_ACTIVE.boxShadow;
              (e.currentTarget as HTMLElement).style.transform = KEY_ACTIVE.transform;
            }}
            onTouchEnd={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = KEY_BASE.boxShadow;
              (e.currentTarget as HTMLElement).style.transform = 'none';
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = KEY_ACTIVE.boxShadow;
              (e.currentTarget as HTMLElement).style.transform = KEY_ACTIVE.transform;
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = KEY_BASE.boxShadow;
              (e.currentTarget as HTMLElement).style.transform = 'none';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = KEY_BASE.boxShadow;
              (e.currentTarget as HTMLElement).style.transform = 'none';
            }}
            style={{
              ...KEY_BASE,
              visibility: k === '' ? 'hidden' : 'visible',
              pointerEvents: k === '' ? 'none' : 'auto',
            }}
          >
            {k}
          </div>
        ))}
      </div>
      {/* 清空 */}
      <div
        onClick={() => handleKeyDown('clear')}
        onTouchStart={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = KEY_ACTIVE.boxShadow;
          (e.currentTarget as HTMLElement).style.transform = KEY_ACTIVE.transform;
        }}
        onTouchEnd={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = KEY_BASE.boxShadow;
          (e.currentTarget as HTMLElement).style.transform = 'none';
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = KEY_ACTIVE.boxShadow;
          (e.currentTarget as HTMLElement).style.transform = KEY_ACTIVE.transform;
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = KEY_BASE.boxShadow;
          (e.currentTarget as HTMLElement).style.transform = 'none';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = KEY_BASE.boxShadow;
          (e.currentTarget as HTMLElement).style.transform = 'none';
        }}
        style={{
          ...KEY_BASE,
          background: 'linear-gradient(145deg, rgba(211,47,47,0.2) 0%, rgba(211,47,47,0.08) 100%)',
          borderColor: 'rgba(211,47,47,0.4)',
          color: '#ff7875',
          fontSize: 18,
          minHeight: 48,
        }}
      >
        清空
      </div>
    </div>
  );
};

export default NumericKeypad;

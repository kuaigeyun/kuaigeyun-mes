/**
 * 自定义字段公式配置编辑器
 *
 * 左栏展示可参与计算的数字字段，右栏编辑公式表达式。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Col, Empty, Row, Spin, Typography, theme } from 'antd';
import { getCustomFieldsByTable, type CustomField } from '../../services/customField';

const FORMULA_OPERAND_TYPES = new Set(['number']);

const FORMULA_OPERATORS = ['+', '-', '*', '/', '(', ')'] as const;

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  value: string,
  onChange?: (next: string) => void,
) {
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const next = value.slice(0, start) + text + value.slice(end);
  onChange?.(next);
  requestAnimationFrame(() => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    textarea.focus({ preventScroll: true });
    const pos = start + text.length;
    textarea.setSelectionRange(pos, pos);
    window.scrollTo(scrollX, scrollY);
  });
}

export interface CustomFieldFormulaConfigEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  tableName: string;
  excludeFieldCode?: string;
  disabled?: boolean;
}

export const CustomFieldFormulaConfigEditor: React.FC<CustomFieldFormulaConfigEditorProps> = ({
  value = '',
  onChange,
  tableName,
  excludeFieldCode,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(false);
  const [operandFields, setOperandFields] = useState<CustomField[]>([]);

  useEffect(() => {
    if (!tableName) {
      setOperandFields([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getCustomFieldsByTable(tableName, true)
      .then((fields) => {
        if (cancelled) return;
        const operands = fields
          .filter((field) => FORMULA_OPERAND_TYPES.has(field.field_type))
          .filter((field) => !excludeFieldCode || field.code !== excludeFieldCode)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setOperandFields(operands);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tableName, excludeFieldCode]);

  const insertText = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea || disabled) return;
      insertAtCursor(textarea, text, value, onChange);
    },
    [disabled, onChange, value],
  );

  const operandList = useMemo(() => {
    if (!tableName) {
      return (
        <Typography.Text type="secondary">{t('field.customField.formulaOperandsNoTable')}</Typography.Text>
      );
    }

    if (loading) {
      return <Spin size="small" />;
    }

    if (operandFields.length === 0) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('field.customField.formulaOperandsEmpty')} />;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {operandFields.map((field) => {
          const fieldName = field.label || field.name;
          return (
            <div
              key={field.uuid}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (disabled) return;
                insertText(`{${field.code}}`);
              }}
              onKeyDown={(event) => {
                if (disabled) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  insertText(`{${field.code}}`);
                }
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                textAlign: 'left',
                border: `1px solid ${token.colorBorder}`,
                borderRadius: token.borderRadius,
                background: disabled ? token.colorBgContainerDisabled : token.colorBgContainer,
                padding: '6px 10px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: `border-color ${token.motionDurationMid}, background ${token.motionDurationMid}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  lineHeight: 1.4,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: '100%', textAlign: 'left' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('field.customField.formulaOperandNameLabel')}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: 12, marginLeft: 4 }}>{fieldName}</Typography.Text>
                </div>
                <div style={{ width: '100%', textAlign: 'left' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('field.customField.formulaOperandCodeLabel')}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                    {field.code}
                  </Typography.Text>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [disabled, insertText, loading, operandFields, tableName, t, token]);

  const panelStyle: React.CSSProperties = {
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
    background: token.colorBgContainer,
    padding: 12,
    minHeight: 280,
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  };

  const panelBodyStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowX: 'hidden',
    overflowY: 'auto',
  };

  return (
    <Row gutter={16} align="stretch">
      <Col span={10}>
        <div style={panelStyle}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('field.customField.formulaOperands')}</div>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            {t('field.customField.formulaOperandsHint')}
          </Typography.Text>
          <div style={panelBodyStyle}>{operandList}</div>
        </div>
      </Col>
      <Col span={14}>
        <div style={panelStyle}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('field.customField.formulaExpression')}</div>
          <div style={{ marginBottom: 8 }}>
            {FORMULA_OPERATORS.map((operator) => (
              <Button
                key={operator}
                size="small"
                disabled={disabled}
                style={{ marginRight: 8, marginBottom: 8, minWidth: 32 }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertText(operator)}
              >
                {operator}
              </Button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            rows={8}
            placeholder={t('field.customField.formulaExpressionPlaceholder')}
            onChange={(event) => onChange?.(event.target.value)}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '8px 11px',
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorder}`,
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: 1.5,
              boxSizing: 'border-box',
              background: disabled ? token.colorBgContainerDisabled : token.colorBgContainer,
            }}
          />
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 8 }}>
            {t('field.customField.formulaExpressionExtra')}
          </Typography.Text>
        </div>
      </Col>
    </Row>
  );
};

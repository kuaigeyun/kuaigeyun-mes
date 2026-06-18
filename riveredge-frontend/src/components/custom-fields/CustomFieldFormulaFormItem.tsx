/**
 * 业务表单中的公式自定义字段
 *
 * 参与字段变化时自动计算；用户手动修改后保留输入，直至参与字段再次变化时重新计算。
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Form } from 'antd';
import { ProFormDependency, ProFormDigit } from '@ant-design/pro-components';
import {
  evaluateCustomFieldFormula,
  extractFormulaFieldCodes,
} from './customFieldFormulaUtils';
import { customFieldControlLayout, customFieldFieldProps } from './customFieldFormLayout';

const CUSTOM_PREFIX = 'custom_';

function buildOperandSnapshot(operandValues: Record<string, unknown>): string {
  return JSON.stringify(operandValues);
}

interface FormulaFieldControlProps {
  name: string;
  label: React.ReactNode;
  colProps?: { span?: number };
  initialValue?: number | null;
  computedValue: number | undefined;
  operandSnapshot: string;
}

function FormulaFieldControl({
  name,
  label,
  colProps,
  initialValue,
  computedValue,
  operandSnapshot,
}: FormulaFieldControlProps) {
  const form = Form.useFormInstance();
  const isManualOverrideRef = useRef(false);
  const lastOperandSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastOperandSnapshotRef.current === null) {
      lastOperandSnapshotRef.current = operandSnapshot;
      if (initialValue == null) {
        form?.setFieldValue(name, computedValue);
      }
      return;
    }

    if (lastOperandSnapshotRef.current !== operandSnapshot) {
      lastOperandSnapshotRef.current = operandSnapshot;
      isManualOverrideRef.current = false;
      form?.setFieldValue(name, computedValue);
    }
  }, [computedValue, form, initialValue, name, operandSnapshot]);

  return (
    <ProFormDigit
      name={name}
      label={label}
      initialValue={initialValue ?? undefined}
      fieldProps={{
        ...customFieldFieldProps(),
        onChange: () => {
          isManualOverrideRef.current = true;
        },
      }}
      {...customFieldControlLayout(colProps)}
    />
  );
}

export interface CustomFieldFormulaFormItemProps {
  name: string;
  label: React.ReactNode;
  expression?: string;
  initialValue?: number | null;
  colProps?: { span?: number };
}

export const CustomFieldFormulaFormItem: React.FC<CustomFieldFormulaFormItemProps> = ({
  name,
  label,
  expression,
  initialValue,
  colProps,
}) => {
  const fieldCodes = useMemo(() => extractFormulaFieldCodes(expression), [expression]);
  const dependencyNames = useMemo(
    () => fieldCodes.map((code) => `${CUSTOM_PREFIX}${code}`),
    [fieldCodes],
  );

  const renderFormulaField = (
    computedValue: number | undefined,
    operandValues: Record<string, unknown>,
  ) => (
    <FormulaFieldControl
      name={name}
      label={label}
      colProps={colProps}
      initialValue={initialValue}
      computedValue={computedValue}
      operandSnapshot={buildOperandSnapshot(operandValues)}
    />
  );

  if (!expression?.trim()) {
    return renderFormulaField(undefined, {});
  }

  if (dependencyNames.length === 0) {
    const result = evaluateCustomFieldFormula(expression, {});
    return renderFormulaField(result ?? undefined, {});
  }

  return (
    <ProFormDependency name={dependencyNames}>
      {(deps) => {
        const operandValues: Record<string, unknown> = {};
        for (const code of fieldCodes) {
          operandValues[code] = deps[`${CUSTOM_PREFIX}${code}`];
        }
        const result = evaluateCustomFieldFormula(expression, operandValues);
        return renderFormulaField(result ?? undefined, operandValues);
      }}
    </ProFormDependency>
  );
};

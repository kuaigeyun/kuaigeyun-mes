/**
 * 工程图纸：关联研发项目（远程选择 + 可手填存量项目代号）
 */

import React, { useCallback, useRef, useState } from 'react';
import { ProFormField, ProFormSelect } from '@ant-design/pro-components';
import type { ProFormSelectProps } from '@ant-design/pro-components';
import { AutoComplete } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatProjectRefLabel } from '../utils/projectRefLabel';
import { listRdProjectsForDrawingPicker } from '../services/rd-project-picker';

export type DrawingProjectRefSelectProps = Omit<ProFormSelectProps, 'request' | 'options'> & {
  allowManualProjectCode?: boolean;
  idByLabelRef?: React.MutableRefObject<Map<string, number>>;
};

const DrawingProjectComboField: React.FC<{
  disabled?: boolean;
  placeholder?: string;
  idByLabelRef: React.MutableRefObject<Map<string, number>>;
  value?: string;
  onChange?: (value: string) => void;
}> = ({ disabled, placeholder, idByLabelRef, value, onChange }) => {
  const [options, setOptions] = useState<{ value: string }[]>([]);

  const loadOptions = useCallback(async (keyword?: string) => {
    const res = await listRdProjectsForDrawingPicker({
      keyword: keyword?.trim() || undefined,
      limit: 50,
    });
    const nextMap = new Map(idByLabelRef.current);
    const nextOptions = (res.items ?? []).map((item) => {
      const label = formatProjectRefLabel(item.project_code, item.project_name);
      if (item.id != null) {
        nextMap.set(label, item.id);
      }
      return { value: label };
    });
    idByLabelRef.current = nextMap;
    setOptions(nextOptions);
  }, [idByLabelRef]);

  return (
    <AutoComplete
      disabled={disabled}
      allowClear
      options={options}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onFocus={() => void loadOptions()}
      onSearch={(kw) => void loadOptions(kw)}
    />
  );
};

export const DrawingProjectRefSelect: React.FC<DrawingProjectRefSelectProps> = ({
  allowManualProjectCode,
  idByLabelRef: idByLabelRefProp,
  name,
  label,
  rules,
  disabled,
  placeholder,
  colProps,
  ...rest
}) => {
  const { t } = useTranslation();
  const internalIdByLabelRef = useRef(new Map<string, number>());
  const idByLabelRef = idByLabelRefProp ?? internalIdByLabelRef;
  const fieldName = (name as string) || 'project_id';
  const fieldLabel = label ?? t('app.master-data.drawings.project');

  if (allowManualProjectCode) {
    const resolvedName = fieldName === 'project_id' ? 'project_ref' : fieldName;
    return (
      <ProFormField
        name={resolvedName}
        label={fieldLabel}
        rules={rules}
        colProps={colProps}
        disabled={disabled}
        renderFormItem={(_, { fieldProps }) => (
          <DrawingProjectComboField
            disabled={disabled}
            placeholder={placeholder ?? t('app.master-data.drawings.projectPlaceholder')}
            idByLabelRef={idByLabelRef}
            value={fieldProps?.value as string | undefined}
            onChange={fieldProps?.onChange as ((value: string) => void) | undefined}
          />
        )}
        {...rest}
      />
    );
  }

  return (
    <ProFormSelect
      name={fieldName}
      label={fieldLabel}
      showSearch
      allowClear
      debounceTime={300}
      request={async ({ keyWords }) => {
        const res = await listRdProjectsForDrawingPicker({
          keyword: keyWords?.trim() || undefined,
          limit: 50,
        });
        return (res.items ?? []).map((item) => ({
          value: item.id,
          label: formatProjectRefLabel(item.project_code, item.project_name),
        }));
      }}
      rules={rules}
      disabled={disabled}
      placeholder={placeholder}
      colProps={colProps}
      {...rest}
    />
  );
};

export default DrawingProjectRefSelect;

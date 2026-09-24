/**
 * Phase2 表单：研发项目远程选择（可选支持存量项目代号手填）
 */

import React, { useCallback, useRef, useState } from 'react';
import { ProFormItem, ProFormSelect } from '@ant-design/pro-components';
import type { ProFormSelectProps } from '@ant-design/pro-components';
import { AutoComplete } from 'antd';
import { useTranslation } from 'react-i18next';
import { listRdProjects } from '../services/rd-project';

export type Phase2ProjectSelectProps = Omit<ProFormSelectProps, 'request' | 'options'> & {
  /** 允许不选系统项目、直接手填项目代号（存量项目） */
  allowManualProjectCode?: boolean;
  /** 与 allowManualProjectCode 联用：提交时 resolveProjectRefPick 需读取下拉项映射 */
  idByLabelRef?: React.MutableRefObject<Map<string, number>>;
};

export function formatProjectRefLabel(
  projectCode?: string | null,
  projectName?: string | null,
): string {
  const code = String(projectCode || '').trim();
  const name = String(projectName || '').trim();
  if (code && name && name !== code) {
    return `${code} - ${name}`;
  }
  return code || name;
}

/** 将表单 project_ref（下拉选项或手填文本）解析为 API 字段 */
export function resolveProjectRefPick(
  pick: unknown,
  idByLabel: ReadonlyMap<string, number>,
): { project_id?: number | null; project_code?: string | null } {
  if (pick === null || pick === undefined || pick === '') {
    return { project_id: null, project_code: null };
  }
  if (typeof pick === 'number' && Number.isFinite(pick)) {
    return { project_id: pick, project_code: null };
  }
  const text = String(pick).trim();
  if (!text) {
    return { project_id: null, project_code: null };
  }
  const linkedId = idByLabel.get(text);
  if (linkedId != null) {
    return { project_id: linkedId, project_code: null };
  }
  const code = text.includes(' - ') ? text.split(' - ')[0]?.trim() || text : text;
  return { project_id: null, project_code: code };
}

const Phase2ProjectComboField: React.FC<{
  disabled?: boolean;
  placeholder?: string;
  idByLabelRef: React.MutableRefObject<Map<string, number>>;
}> = ({ disabled, placeholder, idByLabelRef }) => {
  const [options, setOptions] = useState<{ value: string }[]>([]);

  const loadOptions = useCallback(async (keyword?: string) => {
    const res = await listRdProjects({
      keyword: keyword?.trim() || undefined,
      limit: 50,
      project_type: 'RD',
    });
    const nextMap = new Map<string, number>();
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
      onFocus={() => void loadOptions()}
      onSearch={(kw) => void loadOptions(kw)}
    />
  );
};

export const Phase2ProjectSelect: React.FC<Phase2ProjectSelectProps> = ({
  allowManualProjectCode,
  idByLabelRef: idByLabelRefProp,
  name,
  label,
  rules,
  disabled,
  placeholder,
  ...rest
}) => {
  const { t } = useTranslation();
  const internalIdByLabelRef = useRef(new Map<string, number>());
  const idByLabelRef = idByLabelRefProp ?? internalIdByLabelRef;
  const fieldName = (name as string) || 'project_id';
  const fieldLabel =
    label ?? t('app.kuaiplm.phase2.requirements.columns.project');

  if (allowManualProjectCode) {
    return (
      <ProFormItem
        name={fieldName === 'project_id' ? 'project_ref' : fieldName}
        label={fieldLabel}
        rules={rules}
      >
        <Phase2ProjectComboField
          disabled={disabled}
          placeholder={
            placeholder ?? t('app.kuaiplm.phase2.projectRefPlaceholder')
          }
          idByLabelRef={idByLabelRef}
        />
      </ProFormItem>
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
        const res = await listRdProjects({
          keyword: keyWords?.trim() || undefined,
          limit: 50,
          project_type: 'RD',
        });
        return (res.items ?? []).map((item) => ({
          value: item.id,
          label: formatProjectRefLabel(item.project_code, item.project_name),
        }));
      }}
      rules={rules}
      disabled={disabled}
      placeholder={placeholder}
      {...rest}
    />
  );
};

export default Phase2ProjectSelect;

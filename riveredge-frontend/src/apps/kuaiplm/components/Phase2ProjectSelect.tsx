/**
 * Phase2 表单：研发项目远程选择
 */

import React from 'react';
import { ProFormSelect } from '@ant-design/pro-components';
import type { ProFormSelectProps } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { listRdProjects } from '../services/rd-project';

type Phase2ProjectSelectProps = Omit<ProFormSelectProps, 'request' | 'options'>;

export const Phase2ProjectSelect: React.FC<Phase2ProjectSelectProps> = (props) => {
  const { t } = useTranslation();

  return (
    <ProFormSelect
      name="project_id"
      label={t('app.kuaiplm.phase2.requirements.columns.project')}
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
          label: `${item.project_code ?? item.id} - ${item.project_name ?? ''}`.trim(),
        }));
      }}
      {...props}
    />
  );
};

export default Phase2ProjectSelect;

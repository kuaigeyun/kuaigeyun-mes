import React, { useMemo } from 'react';
import { ProFormSelect } from '@ant-design/pro-components';
import { Space, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { MenuTree } from '../../../../services/menu';
import { flattenMenuHomePathOptions } from '../../../../utils/menuHomePathOptions';
import { translateMenuName } from '../../../../utils/menuTranslation';

export interface RoleHomePathSelectProps {
  name?: string;
  menuTree: MenuTree[];
}

/** 角色 UniTabs 首页：从导航菜单任选带 path 的页面 */
export const RoleHomePathSelect: React.FC<RoleHomePathSelectProps> = ({
  name = 'home_path',
  menuTree,
}) => {
  const { t } = useTranslation();

  const options = useMemo(
    () =>
      flattenMenuHomePathOptions(menuTree, (menuName, path) => {
        const label = translateMenuName(menuName, t, path);
        return `${label} (${path})`;
      }),
    [menuTree, t],
  );

  const labelText = t('field.role.homePath', { defaultValue: 'UniTabs 首页' });
  const extraText = t('field.role.homePathExtra', {
    defaultValue: '优先级高于「菜单设为主页」；未设置时依次使用菜单主页、系统工作台或系统兜底页。',
  });

  return (
    <ProFormSelect
      name={name}
      colProps={{ span: 24 }}
      label={
        <Space size={4}>
          <span>{labelText}</span>
          <Tooltip title={extraText}>
            <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, cursor: 'help' }} />
          </Tooltip>
        </Space>
      }
      placeholder={t('field.role.homePathPlaceholder', { defaultValue: '选择页面路径，留空则按全局规则' })}
      allowClear
      showSearch
      options={options}
      fieldProps={{
        optionFilterProp: 'label',
        listHeight: 320,
      }}
    />
  );
};

export default RoleHomePathSelect;

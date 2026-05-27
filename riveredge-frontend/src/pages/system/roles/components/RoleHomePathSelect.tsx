import React, { useMemo } from 'react';
import { ProFormSelect } from '@ant-design/pro-components';
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

  return (
    <ProFormSelect
      name={name}
      label={t('field.role.homePath', { defaultValue: 'UniTabs 首页' })}
      placeholder={t('field.role.homePathPlaceholder', { defaultValue: '选择页面路径，留空则按全局规则' })}
      allowClear
      showSearch
      options={options}
      fieldProps={{
        optionFilterProp: 'label',
        listHeight: 320,
      }}
      extra={t('field.role.homePathExtra', {
        defaultValue: '优先级高于「菜单设为主页」；未设置时依次使用菜单主页、系统工作台或系统兜底页。',
      })}
    />
  );
};

export default RoleHomePathSelect;

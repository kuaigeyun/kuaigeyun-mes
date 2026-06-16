import React, { useEffect, useState } from 'react';
import { Switch, type SwitchProps } from 'antd';
import { useTranslation } from 'react-i18next';

export type PriceTypeValue = 'tax_inclusive' | 'tax_exclusive';

export interface PriceTypeSwitchProps extends Omit<SwitchProps, 'checked' | 'onChange' | 'value'> {
  checked: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * 含税 / 不含税切换（受控）。配合 shouldUpdate 块内 setFieldValue 使用，避免 Form.Item 嵌套重挂载导致点击无效。
 */
const PriceTypeSwitch: React.FC<PriceTypeSwitchProps> = ({
  checked: controlledChecked,
  onChange,
  checkedChildren,
  unCheckedChildren,
  ...rest
}) => {
  const { t } = useTranslation();
  const [optimisticChecked, setOptimisticChecked] = useState<boolean | null>(null);
  const checked = optimisticChecked ?? controlledChecked;

  useEffect(() => {
    setOptimisticChecked(null);
  }, [controlledChecked]);

  return (
    <Switch
      {...rest}
      checked={checked}
      checkedChildren={checkedChildren ?? t('app.kuaizhizao.salesOrder.taxInclusive')}
      unCheckedChildren={unCheckedChildren ?? t('app.kuaizhizao.salesOrder.taxExclusive')}
      onChange={(nextChecked) => {
        setOptimisticChecked(nextChecked);
        onChange?.(nextChecked);
      }}
    />
  );
};

export default PriceTypeSwitch;

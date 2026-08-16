import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniDropdown, type UniDropdownProps } from '../../../../../components/uni-dropdown';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates/constants';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { listCarriers, type LogisticsCarrier } from '../../../services/logistics';
import { CarrierFormModal } from './CarrierFormModal';

export type CarrierSelectDropdownProps = Omit<
  UniDropdownProps,
  'options' | 'quickCreate' | 'quickEdit' | 'advancedSearch' | 'loading'
> & {
  modalZIndex?: number;
};

export const CarrierSelectDropdown: React.FC<CarrierSelectDropdownProps> = ({
  modalZIndex,
  onChange,
  value,
  ...rest
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const perms = useResourcePermissions('kuaizhizao:logistics-carrier');
  const [items, setItems] = useState<LogisticsCarrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LogisticsCarrier | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCarriers({ limit: 200 });
      setItems(res.items);
      return res.items;
    } catch (error) {
      messageApi.warning(getApiErrorMessage(error, t('common.loadFailed')));
      return [];
    } finally {
      setLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const options = useMemo(
    () => items.map((item) => ({ value: item.id, label: item.name })),
    [items],
  );

  const handleSuccess = useCallback(
    (record: LogisticsCarrier) => {
      setItems((prev) => {
        const idx = prev.findIndex((item) => item.id === record.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...record };
          return next;
        }
        return [...prev, record];
      });
      onChange?.(record.id, { value: record.id, label: record.name });
      setFormOpen(false);
      setEditing(null);
    },
    [onChange],
  );

  const nestedZIndex =
    modalZIndex != null
      ? modalZIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET
      : token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET;

  return (
    <>
      <UniDropdown
        {...rest}
        value={value}
        allowClear
        loading={loading}
        options={options}
        onChange={onChange}
        quickCreate={
          perms.canCreate
            ? {
                label: t('app.kuaizhizao.logistics.action.quickCreateCarrier'),
                onClick: () => {
                  setEditing(null);
                  setFormOpen(true);
                },
              }
            : undefined
        }
        quickEdit={
          perms.canUpdate
            ? {
                label: t('app.kuaizhizao.logistics.action.editCarrier'),
                onEdit: (id) => {
                  const row = items.find((item) => item.id === id);
                  if (!row) return;
                  setEditing(row);
                  setFormOpen(true);
                },
              }
            : undefined
        }
      />
      {formOpen ? (
        <CarrierFormModal
          open
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSuccess={handleSuccess}
          zIndex={nestedZIndex}
        />
      ) : null}
    </>
  );
};

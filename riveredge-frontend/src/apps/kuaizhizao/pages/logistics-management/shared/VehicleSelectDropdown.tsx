import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniDropdown, type UniDropdownProps } from '../../../../../components/uni-dropdown';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates/constants';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { listVehicles, type Vehicle } from '../../../services/logistics';
import { VehicleFormModal } from './VehicleFormModal';

export type VehicleSelectDropdownProps = Omit<
  UniDropdownProps,
  'options' | 'quickCreate' | 'quickEdit' | 'advancedSearch' | 'loading'
> & {
  modalZIndex?: number;
};

export const VehicleSelectDropdown: React.FC<VehicleSelectDropdownProps> = ({
  modalZIndex,
  onChange,
  value,
  ...rest
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const perms = useResourcePermissions('kuaizhizao:vehicle');
  const [items, setItems] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVehicles({ limit: 200 });
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
    () => items.map((item) => ({ value: item.id, label: item.plate_number })),
    [items],
  );

  const handleSuccess = useCallback(
    (record: Vehicle) => {
      setItems((prev) => {
        const idx = prev.findIndex((item) => item.id === record.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...record };
          return next;
        }
        return [...prev, record];
      });
      onChange?.(record.id, { value: record.id, label: record.plate_number });
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
                label: t('app.kuaizhizao.logistics.action.quickCreateVehicle'),
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
                label: t('app.kuaizhizao.logistics.action.editVehicle'),
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
        <VehicleFormModal
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

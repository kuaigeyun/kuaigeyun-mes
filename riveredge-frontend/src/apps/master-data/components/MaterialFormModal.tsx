/**
 * 物料新建弹窗（可复用）
 * 
 * 封装了 MaterialForm，处理了物料分组加载、自动编号和提交逻辑。
 * 供 UniMaterialSelect 等组件进行「快速新建物料」使用。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { MaterialForm } from './MaterialForm';
import { materialApi, materialGroupApi } from '../services/material';
import type { Material, MaterialCreate } from '../types/material';

export interface MaterialFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 
   * 保存成功回调
   * @param material 新创建的物料对象
   */
  onSuccess?: (material: Material) => void;
  /** 初始值 */
  initialValues?: Partial<MaterialCreate>;
}

export const MaterialFormModal: React.FC<MaterialFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialValues,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [materialGroups, setMaterialGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMaterialGroups = useCallback(() => {
    materialGroupApi.list({ limit: 1000 })
      .then((res) => setMaterialGroups(res || []))
      .catch((err) => {
        console.error('Failed to load material groups:', err);
      });
  }, []);

  useEffect(() => {
    if (open) {
      loadMaterialGroups();
    }
  }, [open, loadMaterialGroups]);

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      // 这里的 values 已经是 MaterialForm 处理过（转换过单位、来源配置等）的深度对象
      const created = await materialApi.create(values as MaterialCreate);
      messageApi.success(t('common.createSuccess'));
      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <MaterialForm
      open={open}
      onClose={onClose}
      onFinish={handleFinish}
      materialGroups={materialGroups}
      onMaterialGroupsChange={loadMaterialGroups}
      loading={loading}
      initialValues={initialValues}
      isEdit={false}
    />
  );
};

export default MaterialFormModal;

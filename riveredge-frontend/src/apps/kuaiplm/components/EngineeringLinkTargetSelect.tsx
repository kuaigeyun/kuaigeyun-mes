/**
 * NPI 工程链接：按 link_type 远程选择目标
 */

import React from 'react';
import { ProFormDependency, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { materialApi } from '../../master-data/services/material';
import { drawingApi } from '../../master-data/services/drawing';
import { processRouteApi } from '../../master-data/services/process';

type TargetOption = {
  target_id?: number;
  target_uuid?: string;
  target_code?: string;
  target_name?: string;
  material_id?: number;
};

function applyTargetFields(formRef: React.MutableRefObject<any> | undefined, fields: TargetOption) {
  formRef?.current?.setFieldsValue({
    target_id: fields.target_id,
    target_uuid: fields.target_uuid,
    target_code: fields.target_code,
    target_name: fields.target_name,
    material_id: fields.material_id,
  });
}

export interface EngineeringLinkTargetSelectProps {
  formRef?: React.MutableRefObject<any>;
}

export const EngineeringLinkTargetSelect: React.FC<EngineeringLinkTargetSelectProps> = ({
  formRef,
}) => {
  const { t } = useTranslation();

  return (
    <ProFormDependency name={['link_type']}>
      {({ link_type }) => {
        const normalized = String(link_type ?? '').toLowerCase();
        if (normalized === 'material' || normalized === 'bom') {
          return (
            <>
              <ProFormSelect
                name="_target_pick"
                label={t('app.kuaiplm.rdProjects.detail.link.targetMaterial')}
                showSearch
                debounceTime={300}
                rules={[{ required: true, message: t('app.kuaiplm.rdProjects.detail.link.targetRequired') }]}
                request={async ({ keyWords }) => {
                  const res = await materialApi.list({
                    keyword: keyWords?.trim() || undefined,
                    limit: 50,
                    isActive: true,
                  });
                  const items = Array.isArray(res) ? res : (res as { items?: unknown[] }).items ?? [];
                  return items.map((item: any) => ({
                    value: item.id,
                    label: `${item.main_code ?? item.code ?? item.id} - ${item.name ?? ''}`.trim(),
                    material: item,
                  }));
                }}
                fieldProps={{
                  onChange: (_value, option) => {
                    const material = (option as { material?: { id?: number; main_code?: string; name?: string } })
                      ?.material;
                    if (!material) return;
                    applyTargetFields(formRef, {
                      target_id: material.id,
                      target_uuid: undefined,
                      target_code: material.main_code,
                      target_name: material.name,
                      material_id: material.id,
                    });
                  },
                }}
              />
              {normalized === 'bom' ? (
                <ProFormText name="version" label={t('app.kuaiplm.common.columns.version')} />
              ) : null}
            </>
          );
        }
        if (normalized === 'drawing') {
          return (
            <ProFormSelect
              name="_target_pick"
              label={t('app.kuaiplm.rdProjects.detail.link.targetDrawing')}
              showSearch
              debounceTime={300}
              rules={[{ required: true, message: t('app.kuaiplm.rdProjects.detail.link.targetRequired') }]}
              request={async ({ keyWords }) => {
                const res = await drawingApi.list({
                  keyword: keyWords?.trim() || undefined,
                  limit: 50,
                });
                return (res.data ?? []).map((item) => ({
                  value: item.uuid,
                  label: `${item.drawing_code ?? item.uuid} - ${item.drawing_name ?? ''}`.trim(),
                  drawing: item,
                }));
              }}
              fieldProps={{
                onChange: (_value, option) => {
                  const drawing = (option as { drawing?: { uuid?: string; drawing_code?: string; drawing_name?: string } })
                    ?.drawing;
                  if (!drawing?.uuid) return;
                  applyTargetFields(formRef, {
                    target_uuid: drawing.uuid,
                    target_id: undefined,
                    target_code: drawing.drawing_code,
                    target_name: drawing.drawing_name,
                  });
                },
              }}
            />
          );
        }
        if (normalized === 'route' || normalized === 'process_route') {
          return (
            <ProFormSelect
              name="_target_pick"
              label={t('app.kuaiplm.rdProjects.detail.link.targetRoute')}
              showSearch
              debounceTime={300}
              rules={[{ required: true, message: t('app.kuaiplm.rdProjects.detail.link.targetRequired') }]}
              request={async ({ keyWords }) => {
                const res = await processRouteApi.list({
                  keyword: keyWords?.trim() || undefined,
                  limit: 50,
                  isActive: true,
                });
                const items = res.items ?? res.data ?? [];
                return items.map((item: any) => ({
                  value: item.uuid,
                  label: `${item.code ?? item.uuid} - ${item.name ?? ''}`.trim(),
                  route: item,
                }));
              }}
              fieldProps={{
                onChange: (_value, option) => {
                  const route = (option as { route?: { uuid?: string; id?: number; code?: string; name?: string } })
                    ?.route;
                  if (!route?.uuid) return;
                  applyTargetFields(formRef, {
                    target_uuid: route.uuid,
                    target_id: route.id,
                    target_code: route.code,
                    target_name: route.name,
                  });
                },
              }}
            />
          );
        }
        return (
          <ProFormText
            name="target_name"
            label={t('app.kuaiplm.rdProjects.detail.link.displayName')}
            rules={[{ required: true, message: t('app.kuaiplm.rdProjects.detail.link.targetRequired') }]}
          />
        );
      }}
    </ProFormDependency>
  );
};

export default EngineeringLinkTargetSelect;

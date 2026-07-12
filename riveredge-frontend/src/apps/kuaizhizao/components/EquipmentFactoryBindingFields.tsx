/**
 * 设备台账 — 车间 / 产线（线组）/ 工位 / 工作中心级联选择
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Col, Row } from 'antd';
import { ProFormDependency, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import {
  factoryListItems,
  productionLineApi,
  workCenterApi,
  workstationApi,
  workshopApi,
} from '../../master-data/services/factory';

type OptionWithMeta = {
  label: string;
  value: number;
  meta?: Record<string, unknown>;
};

interface EquipmentFactoryBindingFieldsProps {
  formRef: React.MutableRefObject<any>;
  embedInParentRow?: boolean;
}

function pickMeta(option: OptionWithMeta | OptionWithMeta[] | undefined): Record<string, unknown> | undefined {
  const selected = Array.isArray(option) ? option[0] : option;
  return selected?.meta;
}

export const EquipmentFactoryBindingFields: React.FC<EquipmentFactoryBindingFieldsProps> = ({
  formRef,
  embedInParentRow = false,
}) => {
  const { t } = useTranslation();

  const wrapField = (key: string, node: React.ReactNode) =>
    embedInParentRow ? <Col key={key} span={12}>{node}</Col> : node;

  const colProps = embedInParentRow ? undefined : { span: 12 };

  const fields = (
    <>
      {wrapField(
        'workshop',
        <>
          <ProFormSelect
            name="workshop_id"
            label={t('app.kuaizhizao.equipment.fieldWorkshop')}
            placeholder={t('app.kuaizhizao.equipment.phWorkshop')}
            colProps={colProps}
            request={async () => {
              const workshops = factoryListItems(await workshopApi.list({ limit: 1000, is_active: true }));
              return workshops.map((ws) => ({
                label: ws.name,
                value: ws.id,
                meta: { name: ws.name },
              }));
            }}
            fieldProps={{
              style: { width: '100%' },
              allowClear: true,
              onChange: (_value: number | undefined, option: OptionWithMeta | OptionWithMeta[]) => {
                const meta = pickMeta(option);
                formRef.current?.setFieldsValue({
                  workshop_name: meta?.name ?? null,
                  production_line_id: null,
                  production_line_code: null,
                  production_line_name: null,
                  workstation_id: null,
                  workstation_code: null,
                  workstation_name: null,
                  work_center_id: null,
                  work_center_code: null,
                  work_center_name: null,
                });
              },
            }}
          />
          <ProFormText name="workshop_name" hidden colProps={colProps} />
        </>,
      )}

      {wrapField(
        'production_line',
        <ProFormDependency name={['workshop_id']}>
          {({ workshop_id }) => (
            <>
              <ProFormSelect
                name="production_line_id"
                label={t('app.kuaizhizao.equipment.fieldProductionLine')}
                placeholder={t('app.kuaizhizao.equipment.phProductionLine')}
                colProps={colProps}
                params={{ workshop_id }}
                request={async (params) => {
                  if (!params?.workshop_id) return [];
                  const lines = factoryListItems(
                    await productionLineApi.list({
                      workshop_id: params.workshop_id,
                      limit: 1000,
                      is_active: true,
                    }),
                  );
                  return lines.map((line) => ({
                    label: `${line.code} - ${line.name}`,
                    value: line.id,
                    meta: { code: line.code, name: line.name },
                  }));
                }}
                fieldProps={{
                  style: { width: '100%' },
                  allowClear: true,
                  disabled: !workshop_id,
                  onChange: (_value: number | undefined, option: OptionWithMeta | OptionWithMeta[]) => {
                    const meta = pickMeta(option);
                    formRef.current?.setFieldsValue({
                      production_line_code: meta?.code ?? null,
                      production_line_name: meta?.name ?? null,
                      workstation_id: null,
                      workstation_code: null,
                      workstation_name: null,
                      work_center_id: null,
                      work_center_code: null,
                      work_center_name: null,
                    });
                  },
                }}
              />
              <ProFormText name="production_line_code" hidden colProps={colProps} />
              <ProFormText name="production_line_name" hidden colProps={colProps} />
            </>
          )}
        </ProFormDependency>,
      )}

      {wrapField(
        'workstation',
        <ProFormDependency name={['production_line_id']}>
          {({ production_line_id }) => (
            <>
              <ProFormSelect
                name="workstation_id"
                label={t('app.kuaizhizao.equipment.fieldWorkstation')}
                placeholder={t('app.kuaizhizao.equipment.phWorkstation')}
                colProps={colProps}
                params={{ production_line_id }}
                request={async (params) => {
                  if (!params?.production_line_id) return [];
                  const stations = factoryListItems(
                    await workstationApi.list({
                      production_line_id: params.production_line_id,
                      limit: 1000,
                      is_active: true,
                    }),
                  );
                  return stations.map((ws) => ({
                    label: `${ws.code} - ${ws.name}`,
                    value: ws.id,
                    meta: { code: ws.code, name: ws.name },
                  }));
                }}
                fieldProps={{
                  style: { width: '100%' },
                  allowClear: true,
                  disabled: !production_line_id,
                  onChange: async (_value: number | undefined, option: OptionWithMeta | OptionWithMeta[]) => {
                    const meta = pickMeta(option);
                    formRef.current?.setFieldsValue({
                      workstation_code: meta?.code ?? null,
                      workstation_name: meta?.name ?? null,
                      work_center_id: null,
                      work_center_code: null,
                      work_center_name: null,
                    });
                    if (_value) {
                      try {
                        const centers = factoryListItems(await workCenterApi.list({ limit: 1000, is_active: true }));
                        const matched = centers.find((wc) => (wc.workstationIds ?? []).includes(_value));
                        if (matched) {
                          formRef.current?.setFieldsValue({
                            work_center_id: matched.id,
                            work_center_code: matched.code,
                            work_center_name: matched.name,
                          });
                        }
                      } catch {
                        /* 工作中心为可选关联，失败不阻断 */
                      }
                    }
                  },
                }}
              />
              <ProFormText name="workstation_code" hidden colProps={colProps} />
              <ProFormText name="workstation_name" hidden colProps={colProps} />
            </>
          )}
        </ProFormDependency>,
      )}

      {wrapField(
        'work_center',
        <>
          <ProFormSelect
            name="work_center_id"
            label={t('app.kuaizhizao.equipment.fieldWorkCenter')}
            placeholder={t('app.kuaizhizao.equipment.phWorkCenter')}
            colProps={colProps}
            request={async () => {
              const centers = factoryListItems(await workCenterApi.list({ limit: 1000, is_active: true }));
              return centers.map((wc) => ({
                label: `${wc.code} - ${wc.name}`,
                value: wc.id,
                meta: { code: wc.code, name: wc.name },
              }));
            }}
            fieldProps={{
              style: { width: '100%' },
              allowClear: true,
              onChange: (_value: number | undefined, option: OptionWithMeta | OptionWithMeta[]) => {
                const meta = pickMeta(option);
                formRef.current?.setFieldsValue({
                  work_center_code: meta?.code ?? null,
                  work_center_name: meta?.name ?? null,
                });
              },
            }}
          />
          <ProFormText name="work_center_code" hidden colProps={colProps} />
          <ProFormText name="work_center_name" hidden colProps={colProps} />
        </>,
      )}
    </>
  );

  if (embedInParentRow) {
    return <>{fields}</>;
  }

  return (
    <Row gutter={16}>
      <Col span={24}>{fields}</Col>
    </Row>
  );
};

export default EquipmentFactoryBindingFields;

import React, { useMemo } from 'react';
import { Input, Select, Table, Typography, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { MaterialStackedCell } from '../../../../components/uni-table/stackedPrimaryColumn';

export type DirectPushBomVersionOption = { version: string; isDefault?: boolean };

export type DirectPushBomMaterialRow = {
  material_id: number;
  material_code: string;
  material_name: string;
  bomVersions?: DirectPushBomVersionOption[];
};

export type DirectPushBomParams = {
  bom_version?: string;
  material_bom_versions?: Record<number, string>;
};

type Props = {
  enabled: boolean;
  materials: DirectPushBomMaterialRow[];
  value: DirectPushBomParams;
  onChange: (next: DirectPushBomParams) => void;
};

export const DirectPushBomVersionFields: React.FC<Props> = ({
  enabled,
  materials,
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const materialBomVersions = value.material_bom_versions || {};

  const handleMaterialVersionChange = (materialId: number, version: string) => {
    const next = { ...materialBomVersions };
    if (version) {
      next[materialId] = version;
    } else {
      delete next[materialId];
    }
    onChange({ ...value, material_bom_versions: next });
  };

  const showGlobal = enabled && materials.length === 0;
  const showTable = enabled && materials.length > 0;

  const boxStyle = useMemo(
    () => ({
      marginBottom: token.marginMD,
      padding: token.paddingSM,
      background: token.colorFillAlter,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusLG,
    }),
    [token],
  );

  if (!enabled) {
    return null;
  }

  return (
    <div style={boxStyle}>
      <Typography.Text strong style={{ display: 'block', marginBottom: token.marginXS }}>
        {t('app.kuaizhizao.salesOrder.directPushBomSectionTitle')}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM, fontSize: token.fontSizeSM }}>
        {t('app.kuaizhizao.salesOrder.directPushBomSectionHint')}
      </Typography.Text>
      {showGlobal ? (
        <div>
          <Typography.Text style={{ display: 'block', marginBottom: token.marginXXS }}>
            {t('app.kuaizhizao.demandComputation.colBomVersion')}
          </Typography.Text>
          <Input
            style={{ maxWidth: 200 }}
            value={value.bom_version ?? ''}
            onChange={e =>
              onChange({ ...value, bom_version: e.target.value.trim() || undefined })
            }
            placeholder={t('app.kuaizhizao.demandComputation.placeholderBomVersionExample')}
          />
        </div>
      ) : null}
      {showTable ? (
        <Table
          size="small"
          dataSource={materials}
          rowKey="material_id"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: t('app.kuaizhizao.demandComputation.colMaterial'),
              key: 'material',
              width: 220,
              render: (_: unknown, record: DirectPushBomMaterialRow) => (
                <MaterialStackedCell
                  material_name={record.material_name}
                  material_code={record.material_code}
                />
              ),
            },
            {
              title: t('app.kuaizhizao.demandComputation.colBomVersion'),
              dataIndex: 'material_id',
              render: (materialId: number, record: DirectPushBomMaterialRow) => {
                const versions = record.bomVersions || [];
                const currentVal = materialBomVersions[materialId] ?? '';
                if (versions.length > 1) {
                  return (
                    <Select
                      placeholder={t('app.kuaizhizao.demandComputation.placeholderSelectVersion')}
                      value={currentVal || undefined}
                      onChange={v => handleMaterialVersionChange(materialId, v || '')}
                      allowClear
                      style={{ width: 140 }}
                      options={versions.map(v => ({
                        value: v.version,
                        label: v.isDefault
                          ? `${v.version}${t('app.kuaizhizao.demandComputation.bomVersionDefault')}`
                          : v.version,
                      }))}
                    />
                  );
                }
                if (versions.length === 1) {
                  return versions[0].version;
                }
                return '—';
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
};

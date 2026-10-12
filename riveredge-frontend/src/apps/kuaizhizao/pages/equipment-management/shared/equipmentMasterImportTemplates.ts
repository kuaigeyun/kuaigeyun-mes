import type { TFunction } from 'i18next';
import { IMPORT_YES_NO_OPTIONS } from '../../../../../utils/loadImportDictionaryValues';
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate';
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues';
import type { ExportXlsxColumn } from '../../../../../utils/exportRecordsXlsx';

const P_INSPECTION = 'app.kuaizhizao.equipmentOps.inspectionItem';
const P_MAINT = 'app.kuaizhizao.equipmentOps.maintenanceItem';

export function buildInspectionItemImportTemplate(t: TFunction) {
  const valueTypeOptions = [
    t(`${P_INSPECTION}.valueType.boolean`),
    t(`${P_INSPECTION}.valueType.numeric`),
    t(`${P_INSPECTION}.valueType.text`),
  ];
  return buildFactoryImportTemplate(
    t,
    [
      { field: 'code', required: true, labelKey: 'common.code', aliases: ['编码', '点检项编码'] },
      { field: 'name', required: true, labelKey: 'common.name', aliases: ['名称', '点检项名称'] },
      {
        field: 'value_type',
        labelKey: `${P_INSPECTION}.col.valueType`,
        aliases: ['值类型'],
        options: valueTypeOptions,
      },
      { field: 'unit', labelKey: 'common.unit', aliases: ['单位'] },
      { field: 'numeric_min', labelKey: `${P_INSPECTION}.col.numericMin`, aliases: ['最小值'] },
      { field: 'numeric_max', labelKey: `${P_INSPECTION}.col.numericMax`, aliases: ['最大值'] },
      { field: 'method', labelKey: `${P_INSPECTION}.col.method`, aliases: ['点检方法', '方法'] },
      {
        field: 'judgment_standard',
        labelKey: `${P_INSPECTION}.col.judgmentStandard`,
        aliases: ['判定标准'],
      },
      { field: 'requirement', labelKey: `${P_INSPECTION}.col.requirement`, aliases: ['要求'] },
      {
        field: 'is_active',
        labelKey: 'common.enabled',
        aliases: ['是否启用', '启用'],
        options: [...IMPORT_YES_NO_OPTIONS],
      },
    ],
    [
      'QC-01',
      t(`${P_INSPECTION}.importExample.name`, { defaultValue: '示例点检项' }),
      t(`${P_INSPECTION}.valueType.boolean`),
      '',
      '',
      '',
      '',
      '',
      t(`${P_INSPECTION}.importExample.requirement`, { defaultValue: '设备运行正常' }),
      pickImportExampleValue([...IMPORT_YES_NO_OPTIONS], t('common.yes')),
    ],
  );
}

export function buildEquipmentMaintenanceItemImportTemplate(t: TFunction) {
  return buildFactoryImportTemplate(
    t,
    [
      { field: 'code', required: true, labelKey: 'common.code', aliases: ['编码', '保养项编码'] },
      { field: 'name', required: true, labelKey: 'common.name', aliases: ['名称', '保养项名称'] },
      {
        field: 'standard_hours',
        labelKey: `${P_MAINT}.col.standardHours`,
        aliases: ['标准工时', '工时'],
      },
      { field: 'requirement', labelKey: `${P_MAINT}.col.requirement`, aliases: ['要求'] },
      {
        field: 'is_active',
        labelKey: 'common.enabled',
        aliases: ['是否启用', '启用'],
        options: [...IMPORT_YES_NO_OPTIONS],
      },
    ],
    [
      'MT-01',
      t(`${P_MAINT}.importExample.name`, { defaultValue: '示例保养项' }),
      '1',
      t(`${P_MAINT}.importExample.requirement`, { defaultValue: '清洁并润滑' }),
      pickImportExampleValue([...IMPORT_YES_NO_OPTIONS], t('common.yes')),
    ],
  );
}

export function inspectionItemExportColumns(t: TFunction): ExportXlsxColumn[] {
  return [
    { key: 'code', title: t('common.code') },
    { key: 'name', title: t('common.name') },
    { key: 'value_type', title: t(`${P_INSPECTION}.col.valueType`) },
    { key: 'unit', title: t('common.unit') },
    { key: 'numeric_min', title: t(`${P_INSPECTION}.col.numericMin`) },
    { key: 'numeric_max', title: t(`${P_INSPECTION}.col.numericMax`) },
    { key: 'method', title: t(`${P_INSPECTION}.col.method`) },
    { key: 'judgment_standard', title: t(`${P_INSPECTION}.col.judgmentStandard`) },
    { key: 'requirement', title: t(`${P_INSPECTION}.col.requirement`) },
    { key: 'is_active', title: t('common.enabled') },
    { key: 'updated_at', title: t('common.updatedAt') },
  ];
}

export function equipmentMaintenanceItemExportColumns(t: TFunction): ExportXlsxColumn[] {
  return [
    { key: 'code', title: t('common.code') },
    { key: 'name', title: t('common.name') },
    { key: 'standard_hours', title: t(`${P_MAINT}.col.standardHours`) },
    { key: 'requirement', title: t(`${P_MAINT}.col.requirement`) },
    { key: 'is_active', title: t('common.enabled') },
    { key: 'updated_at', title: t('common.updatedAt') },
  ];
}

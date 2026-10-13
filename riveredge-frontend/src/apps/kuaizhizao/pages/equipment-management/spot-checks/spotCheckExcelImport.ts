/**
 * 设备点检单 Excel 导入（列表页与设备点检保养造数页共用）
 */

import type { MessageInstance } from 'antd/es/message/interface';
import type { TFunction } from 'i18next';

import { equipmentApi } from '../../../services/equipment';
import { inspectionSchemesApi, spotChecksApi } from '../../../services/equipmentOps';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { parseSpreadsheetDateToApiString } from '../../../../../utils/formDate';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';

export const SPOT_CHECK_IMPORT_I18N = 'app.kuaizhizao.equipmentOps.spotCheck';

export function buildSpotCheckImportTemplate(t: TFunction) {
  const P = SPOT_CHECK_IMPORT_I18N;
  return buildFactoryImportTemplate(
    t,
    [
      {
        field: 'equipment_code',
        required: true,
        labelKey: `${P}.import.equipmentCode`,
        aliases: ['设备编号', '设备编码', '设备代码'],
      },
      {
        field: 'scheme_code',
        required: true,
        labelKey: `${P}.import.schemeCode`,
        aliases: ['方案编号', '方案编码', '点检方案'],
      },
      {
        field: 'check_date',
        required: true,
        labelKey: `${P}.import.checkDate`,
        aliases: ['日期', '点检日'],
      },
      {
        field: 'inspector_name',
        labelKey: `${P}.import.inspectorName`,
        aliases: ['点检人员', '检验人'],
      },
      {
        field: 'remark',
        labelKey: `${P}.import.remark`,
        aliases: ['备注', '说明'],
      },
    ],
    [
      t(`${P}.importExample.equipmentCode`),
      t(`${P}.importExample.schemeCode`),
      t(`${P}.importExample.checkDate`),
      t(`${P}.importExample.inspectorName`),
      t(`${P}.importExample.remark`),
    ],
  );
}

export async function runSpotCheckExcelImport(options: {
  data: unknown[][];
  t: TFunction;
  messageApi: MessageInstance;
  schemeDomain?: string;
}): Promise<{ success: number }> {
  const { data, t, messageApi, schemeDomain } = options;
  const P = SPOT_CHECK_IMPORT_I18N;
  const template = buildSpotCheckImportTemplate(t);

  if (!data || data.length < 2) {
    messageApi.warning(t(`${P}.importEmpty`));
    return { success: 0 };
  }
  const headers = (data[0] || []).map((h: unknown) => String(h || '').trim());
  const headerIndexMap = resolveFactoryImportHeaderIndexMap(headers, template.importHeaderMap);
  if (
    headerIndexMap.equipment_code === undefined ||
    headerIndexMap.scheme_code === undefined ||
    headerIndexMap.check_date === undefined
  ) {
    messageApi.error(t(`${P}.importHeaderMissing`));
    return { success: 0 };
  }

  const cellAt = (row: unknown[], field: string): string => {
    const idx = headerIndexMap[field];
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  const importRows = data.slice(2).filter((row: unknown[]) =>
    Array.isArray(row) && row.some((c: unknown) => c != null && String(c).trim() !== ''),
  );
  if (!importRows.length) {
    messageApi.warning(t(`${P}.importEmpty`));
    return { success: 0 };
  }

  const [equipments, schemes] = await Promise.all([
    fetchAllListItems((p) => equipmentApi.list({ ...p, is_active: true })),
    fetchAllListItems((p) =>
      inspectionSchemesApi.list({
        ...p,
        is_active: true,
        domain: schemeDomain || 'equipment',
      }),
    ),
  ]);

  const equipmentByCode = new Map<string, { id: number; code: string }>();
  for (const eq of equipments as Array<{ id?: number; code?: string }>) {
    const code = String(eq.code || '').trim().toUpperCase();
    if (code && eq.id) equipmentByCode.set(code, { id: Number(eq.id), code: String(eq.code) });
  }
  const schemeByCode = new Map<string, { id: number; code: string; capture_mode?: string }>();
  for (const sc of schemes as Array<{ id?: number; code?: string; capture_mode?: string }>) {
    const code = String(sc.code || '').trim().toUpperCase();
    if (code && sc.id) {
      schemeByCode.set(code, {
        id: Number(sc.id),
        code: String(sc.code),
        capture_mode: sc.capture_mode,
      });
    }
  }

  let success = 0;
  let fail = 0;
  const failMessages: string[] = [];

  for (let i = 0; i < importRows.length; i += 1) {
    const row = importRows[i] as unknown[];
    const equipmentCode = cellAt(row, 'equipment_code');
    const schemeCode = cellAt(row, 'scheme_code');
    const checkDateRaw = cellAt(row, 'check_date');
    const inspectorName = cellAt(row, 'inspector_name') || undefined;
    const remark = cellAt(row, 'remark') || undefined;
    const checkDate = parseSpreadsheetDateToApiString(checkDateRaw);
    const eq = equipmentByCode.get(equipmentCode.toUpperCase());
    const scheme = schemeByCode.get(schemeCode.toUpperCase());

    if (!eq) {
      fail += 1;
      failMessages.push(t(`${P}.importEquipmentMissing`, { code: equipmentCode || `#${i + 1}` }));
      continue;
    }
    if (!scheme) {
      fail += 1;
      failMessages.push(t(`${P}.importSchemeMissing`, { code: schemeCode || `#${i + 1}` }));
      continue;
    }
    if (!checkDate) {
      fail += 1;
      failMessages.push(`${equipmentCode}: ${t(`${P}.import.checkDate`)}`);
      continue;
    }
    const mode = String(scheme.capture_mode || 'A').toUpperCase();
    if (mode === 'B') {
      fail += 1;
      failMessages.push(t(`${P}.importSchemeModeB`, { code: scheme.code }));
      continue;
    }

    try {
      const preview = (await spotChecksApi.previewLines({
        equipment_id: eq.id,
        scheme_id: scheme.id,
      })) as {
        capture_mode?: string;
        lines?: Array<Record<string, unknown>>;
      };
      if (String(preview.capture_mode || mode).toUpperCase() === 'B') {
        fail += 1;
        failMessages.push(t(`${P}.importSchemeModeB`, { code: scheme.code }));
        continue;
      }
      const lines = (preview.lines || []).map((l, idx) => ({
        line_no: (l.line_no as number | undefined) ?? idx + 1,
        item_id: l.item_id,
        item_code: l.item_code,
        item_name: l.item_name,
        requirement: l.requirement,
        method: l.method,
        judgment_standard: l.judgment_standard,
        value_type: l.value_type,
        unit: l.unit,
        numeric_min: l.numeric_min,
        numeric_max: l.numeric_max,
        measured_value: '合格',
        is_pass: true,
        photo_required: false,
      }));
      await spotChecksApi.create({
        equipment_id: eq.id,
        scheme_id: scheme.id,
        check_date: checkDate,
        inspector_name: inspectorName,
        remark,
        lines,
      });
      success += 1;
    } catch (error: unknown) {
      fail += 1;
      failMessages.push(
        `${equipmentCode}/${schemeCode}: ${getApiErrorMessage(error, t('common.failed'))}`,
      );
    }
  }

  if (success > 0 && fail === 0) {
    messageApi.success(t(`${P}.importSuccess`, { count: success }));
  } else if (success > 0) {
    messageApi.warning(
      t(`${P}.importPartial`, { success, fail }) +
        (failMessages.length ? `\n${failMessages.slice(0, 5).join('\n')}` : ''),
    );
  } else {
    messageApi.error(failMessages.slice(0, 8).join('\n') || t(`${P}.importEmpty`));
  }
  return { success };
}

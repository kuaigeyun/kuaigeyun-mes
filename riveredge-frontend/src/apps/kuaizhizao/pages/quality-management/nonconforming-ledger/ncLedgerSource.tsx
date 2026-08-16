import React from 'react';

import { Typography } from 'antd';

import type { TFunction } from 'i18next';

import type { DefectLedgerItem } from '../../../services/quality-improvement';

import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';



export const SOURCE_INSPECTION_TYPE_I18N = {

  incoming: 'app.kuaizhizao.quality.nc.sourceInspection.type.incoming',

  process: 'app.kuaizhizao.quality.nc.sourceInspection.type.process',

  finished: 'app.kuaizhizao.quality.nc.sourceInspection.type.finished',

} as const;



export type SourceInspectionKind = keyof typeof SOURCE_INSPECTION_TYPE_I18N;



function pickSource(

  row: DefectLedgerItem,

): { kind: SourceInspectionKind; id: number; code: string } | null {

  if (row.incoming_inspection_id) {

    return {

      kind: 'incoming',

      id: row.incoming_inspection_id,

      code: String(row.incoming_inspection_code || '').trim(),

    };

  }

  if (row.process_inspection_id) {

    return {

      kind: 'process',

      id: row.process_inspection_id,

      code: String(row.process_inspection_code || '').trim(),

    };

  }

  if (row.finished_goods_inspection_id) {

    return {

      kind: 'finished',

      id: row.finished_goods_inspection_id,

      code: String(row.finished_goods_inspection_code || '').trim(),

    };

  }

  const codeOnly =

    String(row.incoming_inspection_code || '').trim() ||

    String(row.process_inspection_code || '').trim() ||

    String(row.finished_goods_inspection_code || '').trim();

  if (codeOnly) {

    if (row.incoming_inspection_code) {

      return { kind: 'incoming', id: 0, code: codeOnly };

    }

    if (row.process_inspection_code) {

      return { kind: 'process', id: 0, code: codeOnly };

    }

    return { kind: 'finished', id: 0, code: codeOnly };

  }

  return null;

}



export function sourceInspectionPath(row: DefectLedgerItem): string | null {

  const source = pickSource(row);

  if (!source?.id) return null;

  if (source.kind === 'incoming') {

    return `/apps/kuaizhizao/quality-management/incoming-inspection?incoming_inspection_id=${source.id}`;

  }

  if (source.kind === 'process') {

    return `/apps/kuaizhizao/quality-management/process-inspection?process_inspection_id=${source.id}`;

  }

  return `/apps/kuaizhizao/quality-management/finished-goods-inspection?finished_goods_inspection_id=${source.id}`;

}



export function sourceInspectionLabel(row: DefectLedgerItem): string | null {

  const source = pickSource(row);

  if (!source) return null;

  return source.code || null;

}



export function sourceInspectionTypeText(

  t: TFunction,

  row: DefectLedgerItem,

): string | null {

  const source = pickSource(row);

  if (!source) return null;

  return t(SOURCE_INSPECTION_TYPE_I18N[source.kind]);

}



/** 不良处理列表「源检验单」堆叠单元格（类型 + 单号） */

export function renderNcSourceInspectionStackedCell(

  t: TFunction,

  row: DefectLedgerItem,

  navigate?: (path: string) => void,

): React.ReactNode {

  const typeText = sourceInspectionTypeText(t, row);

  const label = sourceInspectionLabel(row);

  const path = sourceInspectionPath(row);



  if (!typeText && !label) {

    return (

      <Typography.Text type="secondary">

        {t('app.kuaizhizao.quality.nc.sourceInspection.empty')}

      </Typography.Text>

    );

  }



  return (

    <UniTableStackedPrimaryCell

      primary={typeText || t('app.kuaizhizao.quality.nc.sourceInspection.empty')}

      secondary={label || '-'}

      skipLinkedDocumentLink

      onSecondaryClick={path && label && navigate ? () => navigate(path) : undefined}

    />

  );

}


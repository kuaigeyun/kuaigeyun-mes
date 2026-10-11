/** 主数据页跳转快研发（不依赖 compose kuaiplm 前端包） */

export function buildDrawingChangeCreateUrl(drawingUuid?: string | null): string {
  const params = new URLSearchParams({ create: 'drawing' });
  if (drawingUuid) params.set('drawingUuid', drawingUuid);
  return `/apps/kuaiplm/change-management?${params.toString()}`;
}

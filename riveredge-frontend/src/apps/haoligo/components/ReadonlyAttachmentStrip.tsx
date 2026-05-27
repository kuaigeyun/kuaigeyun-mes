import React from 'react';

import { MoldAttachmentImagePreview } from './MoldAttachmentImagePreview';

type ReadonlyAttachmentStripProps = {
  uuids: string[] | undefined;
};

/** 只读附件条（维修前对比等），Ant Design Image 预览 */
export function ReadonlyAttachmentStrip({ uuids }: ReadonlyAttachmentStripProps) {
  return <MoldAttachmentImagePreview uuids={uuids} />;
}

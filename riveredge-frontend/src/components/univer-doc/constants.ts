/**
 * Univer 空文档结构（IDocumentData 格式）
 * 包含标准的 A4 页面设置，确保渲染器能够识别并按页面模式显示。
 */
export const EMPTY_UNIVER_DOC = {
  id: '',
  documentStyle: {
    pageSize: {
      width: 595.27,
      height: 841.89
    },
    marginTop: 72,
    marginBottom: 72,
    marginRight: 90,
    marginLeft: 90,
    renderConfig: {
      isPageMode: true
    }
  },
  body: {
    dataStream: '\r\n',
    paragraphs: [{ startIndex: 0 }],
  },
};

export const EMPTY_UNIVER_DOC_JSON = JSON.stringify(EMPTY_UNIVER_DOC);

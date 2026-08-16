import{r as p,j as o,M as E,D as z,ae as v,V as x,aM as $,a4 as M,a9 as d}from"./vendor-DbPimlg3.js";import{g as C,b as L}from"./printTemplateSchemas-BFtOJ9Ib.js";import{b as W,aD as w,w as O}from"./clearSessionQueries-DydS5DPK.js";import{M as D}from"./main-CHVtMZEl.js";import"./LinkedDocumentDetailContext-B4p1VWCs.js";import"./index.es-DwyBu9Zf.js";import"./sessionCurrentUser-DT4m25Ux.js";import"./tokenRefresh-CHMoXSTv.js";import"./building-2-BBu6M6LS.js";import"./index-BuPyvz3E.js";/* empty css                            */import"./UniLifecycleStepper-DGs23OwA.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./lightbulb-1A9YKiYZ.js";import"./send-BjDNTn5c.js";import"./package-check-CWGlkn0M.js";import"./japanese-yen-D8qNEVSc.js";import"./file-CyoiBNSD.js";import"./documentLifecycleStatusTag-BhChzJmN.js";import"./statusBadges-DBJkJnT5.js";import"./actionCatalog-DdZATlzy.js";import"./normalize-MsuyzMuS.js";import"./businessConfig-CcFJ5i68.js";import"./permissionContract-B8trcIKz.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-BYS9r6Ut.js";import"./index-COtidiVo.js";import"./timer-haTt7V0m.js";import"./user-BlwXXtby.js";import"./userDisplay-B3eh-uUz.js";import"./index-D0dNJVml.js";import"./ThemedSegmented-C0iZP0n_.js";import"./index-Bi9fBiRH.js";import"./kuaireportSharedFilePreview-jJ1bPx51.js";import"./index-_WjT98p6.js";import"./index-BbXN95aR.js";import"./index-126A8YRV.js";import"./index-BYBkJPud.js";import"./createForOfIteratorHelper-DIinl_N_.js";import"./index-CAvhV034.js";import"./vendor-libredwg-BVCr_GRZ.js";import"./vendor-three-BPXNOO5B.js";import"./index-Be4lBIgY.js";import"./debounce-BbW1Zi41.js";import"./throttle-93s7Xolb.js";import"./index-DifXrY-n.js";import"./routes-yxoaDZG1.js";import"./workOrderLifecycle-D2-iY6vF.js";import"./listLifecycleStage-CZKWm3oh.js";import"./useResourcePermissions-DHX1kkK6.js";import"./documentStatus-D9519zNV.js";import"./purchase-D2DPVc47.js";import"./fieldPermissionResources-BuDsUgLI.js";import"./quotation-DKPUzIf7.js";import"./warehouseMarkerTags-_NGsFMEP.js";import"./warehouse-execution-CZoG2Plb.js";import"./material-B2f1Cfcf.js";import"./purchase-requisition-omsVIlEx.js";import"./demand-computation-CaUIcos2.js";import"./availableInventoryCell-DjCkJbGd.js";import"./MrpMaterialPlanPanel-BbV62mV4.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-D89VOnCd.js";import"./work-order-odvA_mbz.js";import"./logisticsListPresentation-BUI_EDbS.js";import"./reporting-CbfkM1Gn.js";import"./AuditPhaseBadge-BjOwYb_p.js";const Qt=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=W(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(M,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
        .work-order-print-modal-wrap .ant-modal {
          max-width: calc(100vw - 32px) !important;
        }
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-nested-loading,
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-container,
        .work-order-print-modal-wrap .work-order-print-preview {
          height: 100% !important;
        }
        .work-order-print-modal-wrap .work-order-print-iframe {
          width: 100% !important;
          height: 100% !important;
          min-height: 500px !important;
          border: none !important;
          display: block !important;
          background: #fff !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .ant-modal-wrap,
          .ant-modal-wrap *,
          .ant-modal-content,
          .ant-modal-content *,
          .work-order-print-preview,
          .work-order-print-preview * {
            visibility: visible !important;
          }
          .ant-modal-wrap {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .ant-modal-content {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            background: white;
          }
          .work-order-print-preview {
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, .ant-modal-footer, .ant-modal-header, .ant-modal-close {
            display: none !important;
          }
        }
      `})]})};export{Qt as default};

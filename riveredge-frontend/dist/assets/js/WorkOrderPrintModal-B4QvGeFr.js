import{r as p,j as o,M as E,D as v,aa as z,V as x,aQ as $,a4 as C,ai as s}from"./vendor-DqHx0AFW.js";import{g as L,b as M}from"./printTemplateSchemas-B3WdeJ4T.js";import{b as W,aF as w,C as O}from"./clientRelease-BGXNef1G.js";import{M as H}from"./main-DqRXewTS.js";import"./LinkedDocumentDetailContext-4s7YCc8X.js";import"./detailDrawerTimeFields-hZcZzCbi.js";import"./index.es-Bxbdfbda.js";import"./sessionCurrentUser-Censv6GY.js";import"./globalStore-DUkXpDVA.js";import"./restoredUser-Bx39Cojf.js";import"./tokenRefresh-DRxZmXvv.js";import"./building-2-B3m0Ry-1.js";import"./clearSessionQueries-ClXPQXoH.js";import"./index-CRkyv2f7.js";import"./statusBadges-BTQapjZQ.js";/* empty css                            */import"./UniLifecycleStepper-ByKjLU9M.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./send-BfAaHpIO.js";import"./package-check-RakqnV08.js";import"./japanese-yen-BSOEbW7L.js";import"./file-Yho1S0p4.js";import"./documentLifecycleStatusTag-algtzX-I.js";import"./documentStatusColors-HIqWAAsI.js";import"./actionCatalog-CpYz2iFO.js";import"./normalize-uS9VE3p8.js";import"./businessConfig-DHwiObtw.js";import"./permissionContract-COHI6kDQ.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-BZvXiBBB.js";import"./index-B_dgwmz0.js";import"./timer-haTt7V0m.js";import"./user-DkOB96BM.js";import"./userDisplay-CJbIhU87.js";import"./demandType-LedyCMIm.js";import"./index-DaIcmes5.js";import"./kuaireportSharedFilePreview-C9LdIJMF.js";import"./index-ajC8Xamq.js";import"./index-CPyqo0jv.js";import"./index-B3Jse7hy.js";import"./index-sKs1apR3.js";import"./createForOfIteratorHelper-JcQgFyQB.js";import"./index--me_qK2n.js";import"./vendor-libredwg-Bg6Tzt3C.js";import"./vendor-three-BPXNOO5B.js";import"./index-Bwq8PaVg.js";import"./debounce-Dho7tlUb.js";import"./throttle-CkrrkuZy.js";import"./index-CAQdpbmf.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-C7VUyku_.js";import"./listLifecycleStage-BIJOhOUg.js";import"./useResourcePermissions-CDvpCp_2.js";import"./documentStatus-CPSfF55n.js";import"./QualityInspectionDetailAttachments-d7Tzltuu.js";import"./documentAttachments-CkthOalb.js";import"./purchase-Cwh-CsLd.js";import"./fieldPermissionResources-DKDA4VkQ.js";import"./quotation-ZHwcNDjs.js";import"./warehouseMarkerTags-YXJZOERA.js";import"./warehouse-execution-CxrbJQUs.js";import"./material-Bw3L0tUW.js";import"./purchase-requisition-CoPXstOh.js";import"./demand-computation-BnBcaaPb.js";import"./availableInventoryCell-DIzqTYdl.js";import"./MrpMaterialPlanPanel-DrFxkUBY.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-DNw-UddV.js";import"./work-order-9kxTXSqp.js";import"./logisticsListPresentation-DhFVSRJZ.js";import"./reporting-CDOB08iy.js";import"./AuditPhaseBadge-zKUG_OtX.js";const er=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=W(),[P,b]=p.useState([]),[k,g]=p.useState(!1),[y,d]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),p.useEffect(()=>{m&&a&&n?I():l("")},[m,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===M.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!n){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:P.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("common.print")},"print")],className:"work-order-print-modal",children:[o.jsx(v,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(v,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{er as default};

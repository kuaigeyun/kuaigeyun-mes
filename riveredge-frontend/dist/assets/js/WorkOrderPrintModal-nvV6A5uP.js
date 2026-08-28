import{r as p,j as o,M as E,D as v,a8 as z,V as x,b2 as $,a2 as W,ag as s}from"./vendor-DTMskFkP.js";import{g as C,b as L}from"./printTemplateSchemas-troryiG0.js";import{b as M,aW as w,D as O}from"./clientRelease-BiK1Vc3r.js";import{M as D}from"./main-DPDsw-Q5.js";import"./LinkedDocumentDetailContext-BggOE6_x.js";import"./detailDrawerTimeFields-DvKWMn7a.js";import"./index.es-5TQwouDB.js";import"./sessionCurrentUser-B4Sptfgm.js";import"./globalStore-9-H3qzZh.js";import"./restoredUser-CdeKlfLw.js";import"./tokenRefresh-BstvzD_w.js";import"./building-2-xlN_WsTE.js";import"./clearSessionQueries-ClXPQXoH.js";import"./index-CGIPNfAL.js";import"./statusBadges-BwuFWFMV.js";/* empty css                            */import"./UniLifecycleStepper-B1PkwCdK.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./send-doGngTX_.js";import"./package-check-CMx0pt85.js";import"./japanese-yen-1D6Ppbky.js";import"./file-Ikcl7GOa.js";import"./documentLifecycleStatusTag-Bns7Ds50.js";import"./documentStatusColors-D1HrOBOs.js";import"./operationColumn-DOk3FExG.js";import"./listLifecycleStage-BIJOhOUg.js";import"./permissionContract-BuFHFo7Y.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-W0yrnFcK.js";import"./index-BW1Q_hbi.js";import"./timer-haTt7V0m.js";import"./user-BnjksCj8.js";import"./userDisplay-DjHEVjI8.js";import"./QuantityWithUnitDisplay-BKGeLptj.js";import"./materialUnitDisplay-Zjox8ycF.js";import"./index-BNqnVrbZ.js";import"./kuaireportSharedFilePreview-DQZLlihD.js";import"./index-DHVn2lK3.js";import"./index-Cu8Rko-V.js";import"./index-B_oySicK.js";import"./index-CSq9sBA7.js";import"./createForOfIteratorHelper-DmbOYRcx.js";import"./index-s2uqj815.js";import"./vendor-libredwg-4y9qxdJa.js";import"./vendor-three-BPXNOO5B.js";import"./index-CuqNcND4.js";import"./index-CsYnHzRb.js";import"./index-Bg3s4fbM.js";import"./debounce-Csk3pZ_N.js";import"./throttle-CO6tmVR4.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-DkQ0098Y.js";import"./useResourcePermissions-DIzUiTvl.js";import"./documentStatus-DtPK13AA.js";import"./QualityInspectionDetailAttachments-Cb7WvBAo.js";import"./documentAttachments-lclENkK5.js";import"./purchase-CZdB8eh-.js";import"./fieldPermissionResources-uFL3o5Xf.js";import"./demandType-CIRkT2hu.js";import"./quotation-DVLGkcG4.js";import"./warehouseMarkerTags-BOwch-ET.js";import"./warehouse-execution-Q8XqU7Kw.js";import"./material-Cz_QTokz.js";import"./purchase-requisition-C7mAg62x.js";import"./demand-computation-k0fgK-Th.js";import"./availableInventoryCell-D2WqBMmM.js";import"./MrpMaterialPlanPanel-B3aYhCwf.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-BD2bmEqY.js";import"./work-order-BtdaQnCF.js";import"./logisticsListPresentation-0K7bVney.js";import"./reporting-BS5cObfT.js";import"./AuditPhaseBadge-aj7TYJHq.js";const or=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=M(),[b,P]=p.useState([]),[k,g]=p.useState(!1),[y,d]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),p.useEffect(()=>{m&&a&&n?I():l("")},[m,a,n]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});P(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!n){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(W,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:b.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("common.print")},"print")],className:"work-order-print-modal",children:[o.jsx(v,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(v,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{or as default};

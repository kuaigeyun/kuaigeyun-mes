import{r as p,j as o,M as E,D as v,aa as z,V as x,aQ as $,a4 as C,ai as s}from"./vendor-BORuDE6z.js";import{g as L,b as M}from"./printTemplateSchemas-x7n5bvb_.js";import{b as W,aF as w,C as O}from"./clientRelease-BGA5EJWA.js";import{M as H}from"./main-j13Gkg_l.js";import"./LinkedDocumentDetailContext-BG3j5ien.js";import"./detailDrawerTimeFields-DYSJamia.js";import"./index.es-D1UZtBa5.js";import"./sessionCurrentUser-7IUJ6CSm.js";import"./globalStore-RtyoQvfL.js";import"./restoredUser-efFUfSIK.js";import"./tokenRefresh-DceYfx2q.js";import"./building-2-CoHS5Sbg.js";import"./clearSessionQueries-ClXPQXoH.js";import"./index-dn3bzy9E.js";import"./statusBadges-DFVffvwW.js";/* empty css                            */import"./UniLifecycleStepper-i8tC4MQg.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./send-C0XhNgS5.js";import"./package-check-BWvLfv41.js";import"./japanese-yen-pVK_xPIK.js";import"./file-CtXD0gJd.js";import"./documentLifecycleStatusTag-bxxBug8l.js";import"./documentStatusColors-DNycyRMD.js";import"./actionCatalog-L7DNZ5tY.js";import"./normalize-B5o_G-Ia.js";import"./businessConfig-CIY1db5X.js";import"./permissionContract-D7BJF43E.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-BlTBXfp9.js";import"./index-TGR66HyZ.js";import"./timer-haTt7V0m.js";import"./user-BiXUy4c3.js";import"./userDisplay-B-FF2J82.js";import"./demandType-DIov2zwW.js";import"./index-C4pmgAt0.js";import"./kuaireportSharedFilePreview-BaTIps5V.js";import"./index-Dyp65xq1.js";import"./index-BVkyOt9P.js";import"./index-DAMReQEf.js";import"./index-D-nzzgtn.js";import"./createForOfIteratorHelper-BUpxenhd.js";import"./index-B5koCBa8.js";import"./vendor-libredwg-DadkIvDo.js";import"./vendor-three-BPXNOO5B.js";import"./index-DDElGMYe.js";import"./debounce-QfHzrsvM.js";import"./throttle-B8mwBWUE.js";import"./index-D9Z6h1a3.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-CVSKLfSz.js";import"./listLifecycleStage-BIJOhOUg.js";import"./useResourcePermissions-LldZQRFa.js";import"./documentStatus-DS2QeN7U.js";import"./QualityInspectionDetailAttachments-Ccy_npc9.js";import"./documentAttachments-CHsf8xUE.js";import"./purchase-4dlr7UIk.js";import"./fieldPermissionResources-7FTOfF2l.js";import"./quotation-2tdVBYOM.js";import"./warehouseMarkerTags-BwWg43cB.js";import"./warehouse-execution-CXV6rO95.js";import"./material-DMrJ8eR4.js";import"./purchase-requisition-BKmwlAxO.js";import"./demand-computation-BRHV0_qy.js";import"./availableInventoryCell-DpPy3Zoq.js";import"./MrpMaterialPlanPanel-Cybgx4Jo.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-DffwPhig.js";import"./work-order-BeN45K56.js";import"./logisticsListPresentation-n798Dxjs.js";import"./reporting-D4cNzG0m.js";import"./AuditPhaseBadge-jLZ5C5d4.js";const er=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=W(),[P,b]=p.useState([]),[k,g]=p.useState(!1),[y,d]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),p.useEffect(()=>{m&&a&&n?I():l("")},[m,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===M.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!n){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:P.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("common.print")},"print")],className:"work-order-print-modal",children:[o.jsx(v,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(v,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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

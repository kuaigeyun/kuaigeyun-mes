import{F as M,r as n,j as t,G as N,ak as H,Q as w,a1 as O,a0 as R,U as _,bt as L,ax as G,aw as V,bc as W,cm as Y}from"./vendor-CHSJzsTq.js";import{ad as q}from"./main-DVgzURQc.js";import"./listPageStatCardsContext-D2H_9gga.js";import{T as v}from"./clearSessionQueries-BwZVTAgV.js";import{T as Q}from"./PremiumTerminalTemplate-CcZtW6g5.js";import"./index.es-CgUofJ9r.js";import"./tokenRefresh-Cod5lYJv.js";import"./index-BWGzu1DF.js";import"./building-2-gZD8GUxR.js";import"./index-DhvnnpA1.js";import"./useRequest-M4SnmNGZ.js";import"./index-B-HLy5DS.js";import"./debounce-DjJtCaij.js";import"./throttle-BZowSXiD.js";import"./lodash--BFZcGqt.js";import"./createForOfIteratorHelper-BUKWE6Of.js";import"./timer-DWAvo6M8.js";import"./vendor-xlsx-DcAQ4JWc.js";import"./each-B3dcV3u5.js";import"./quotation-CzfHVebH.js";import"./sales-order-BWMH_j_k.js";import"./work-order-CyQpkUdH.js";import"./warehouse-execution-C4svei5y.js";import"./purchase-ClxTuGfI.js";import"./purchase-requisition-BIsn7t8b.js";import"./fieldPermissionResources-BHOTC6oo.js";import"./materialUnitDisplay-Biephd3A.js";import"./dataDictionary-8UsqKRK0.js";import"./displayContract-OR9USrVS.js";import"./permissionResource-C4537ZA2.js";import"./documentStatus-p-aF91jQ.js";import"./statusBadges-CXCtmZD3.js";import"./backendLifecycle-DVdlPVyL.js";import"./lifecycleI18n-BE5ECl-N.js";import"./globalLifecycleI18n-YKQvqC18.js";import"./listLifecycleStage-C3E9EbE4.js";const{Search:X}=_,ze=()=>{const{message:l}=M.useApp(),j=q(),[I,k]=n.useState(!1),[i,u]=n.useState(""),[g,x]=n.useState(""),[b,E]=n.useState(""),[s,C]=n.useState([]),[c,f]=n.useState(-1),y=n.useRef(null),S=n.useRef(null);n.useEffect(()=>{const e=new URLSearchParams(window.location.search),r=e.get("code"),o=e.get("programCode"),p=e.get("programUrl"),d=e.get("name")||e.get("programName");r?(u(r),x(d||"加工程序")):o?(u(o),x(d||"加工程序")):p?U(p):l.warning("请提供程序代码或程序URL")},[]);const U=async e=>{k(!0);try{const r=await fetch(e);if(!r.ok)throw new Error("加载程序失败");const o=await r.text();u(o),x("加工程序")}catch(r){l.error(r.message||"加载程序失败")}finally{k(!1)}},T=n.useCallback(e=>{if(!e||!i){C([]),f(-1);return}const r=i.split(`
`),o=[],p=e.toLowerCase();r.forEach((d,h)=>{d.toLowerCase().includes(p)&&o.push(h)}),C(o),f(o.length>0?0:-1),o.length>0?(m(o[0]),l.success(`找到 ${o.length} 个匹配项`)):l.warning("未找到匹配项")},[i,l]),m=n.useCallback(e=>{if(y.current){const r=y.current.querySelector(`[data-line="${e}"]`);r&&(r.scrollIntoView({behavior:"smooth",block:"center"}),r.classList.add("highlighted-line"),setTimeout(()=>{r.classList.remove("highlighted-line")},2e3))}},[]),F=n.useCallback(()=>{if(s.length===0)return;const e=(c+1)%s.length;f(e),m(s[e])},[s,c,m]),z=n.useCallback(()=>{if(s.length===0)return;const e=(c-1+s.length)%s.length;f(e),m(s[e])},[s,c,m]),B=n.useCallback((e,r="")=>{if(!e)return"";const o=e.split(`
`),p=r.toLowerCase();return o.map((d,h)=>{let a=d;if(r&&p){const K=new RegExp(`(${r.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`,"gi");a=a.replace(K,"<mark>$1</mark>")}a=a.replace(/\b(G\d{1,2})\b/gi,'<span class="g-code">$1</span>'),a=a.replace(/\b(M\d{1,2})\b/gi,'<span class="m-code">$1</span>'),a=a.replace(/\b([XYZUVW])(-?\d+\.?\d*)\b/gi,'<span class="coordinate">$1$2</span>'),a=a.replace(/(;.*$|\(.*?\))/g,'<span class="comment">$1</span>'),a=a.replace(/\b(\d+\.?\d*)\b/g,'<span class="number">$1</span>');const D=r&&d.toLowerCase().includes(p),$=s.length>0&&c>=0&&s[c]===h;return t.jsxs("div",{"data-line":h,style:{display:"flex",minHeight:"40px",lineHeight:"40px",fontSize:"24px",fontFamily:v,backgroundColor:$?"#fff3cd":D?"#f0f0f0":"transparent",padding:"4px 8px",borderLeft:$?"4px solid #ffc107":"4px solid transparent"},children:[t.jsx("span",{style:{display:"inline-block",minWidth:"60px",textAlign:"right",color:"#999",marginRight:"16px",userSelect:"none"},children:h+1}),t.jsx("span",{style:{flex:1,whiteSpace:"pre-wrap",wordBreak:"break-all"},dangerouslySetInnerHTML:{__html:a||" "}})]},h)})},[b,s,c]),P=n.useCallback(()=>{if(!i){l.warning("没有程序可下载");return}try{const e=new Blob([i],{type:"text/plain"}),r=URL.createObjectURL(e),o=document.createElement("a");o.href=r,o.download=`${g||"program"}-${Date.now()}.txt`,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(r),l.success("程序下载成功")}catch(e){l.error(`下载程序失败: ${e.message||"未知错误"}`)}},[i,g,l]),A=n.useCallback(async()=>{try{await j.enterFullscreen(),l.success("已进入全屏模式")}catch(e){l.error(`进入全屏失败: ${e.message||"未知错误"}`)}},[j,l]);return t.jsxs(Q,{title:g||"加工程序查看",fullscreen:!0,footerButtons:[{title:"上一个",type:"default",icon:t.jsx(G,{}),onClick:z,disabled:s.length===0||c<0,block:!1},{title:`搜索 (${s.length>0?`${c+1}/${s.length}`:"0"})`,type:"default",icon:t.jsx(L,{}),onClick:()=>S.current?.focus(),block:!1},{title:"下一个",type:"default",icon:t.jsx(V,{}),onClick:F,disabled:s.length===0||c<0,block:!1},{title:"下载",type:"default",icon:t.jsx(W,{}),onClick:P,block:!1},{title:"全屏",type:"primary",icon:t.jsx(Y,{}),onClick:A,block:!1}],children:[t.jsx(N,{spinning:I,children:i?t.jsxs("div",{style:{width:"100%",height:"100%",display:"flex",flexDirection:"column"},children:[t.jsx(w,{size:"small",style:{marginBottom:24,backgroundColor:"#f5f5f5"},children:t.jsxs(O,{orientation:"vertical",size:"small",style:{width:"100%"},children:[t.jsxs("div",{children:[t.jsx("strong",{children:"程序名称："}),t.jsx("span",{children:g||"加工程序"})]}),t.jsxs("div",{children:[t.jsx("strong",{children:"总行数："}),t.jsx(R,{color:"blue",children:i.split(`
`).length})]}),s.length>0&&t.jsxs("div",{children:[t.jsx("strong",{children:"搜索结果："}),t.jsxs(R,{color:"green",children:[s.length," 个匹配项"]})]})]})}),t.jsx(w,{size:"small",style:{marginBottom:24},children:t.jsx(X,{ref:S,placeholder:"搜索程序内容（支持G代码、M代码、坐标等）",size:"large",value:b,onChange:e=>E(e.target.value),onSearch:T,enterButton:t.jsx(L,{}),style:{fontSize:24},allowClear:!0})}),t.jsx(w,{title:"程序代码",style:{flex:1,display:"flex",flexDirection:"column",marginBottom:24},styles:{body:{flex:1,overflow:"auto",padding:0}},children:t.jsx("div",{ref:y,style:{width:"100%",height:"100%",overflow:"auto",backgroundColor:"#fafafa",fontFamily:v,fontSize:"24px",lineHeight:"40px"},children:B(i,b)})})]}):t.jsx(H,{description:"未找到程序数据"})}),t.jsx("style",{children:`
        .g-code {
          color: #1890ff;
          font-weight: 600;
        }
        .m-code {
          color: #52c41a;
          font-weight: 600;
        }
        .coordinate {
          color: #fa8c16;
          font-weight: 500;
        }
        .comment {
          color: #8c8c8c;
          font-style: italic;
        }
        .number {
          color: #722ed1;
        }
        mark {
          background-color: #fff3cd;
          color: #856404;
          padding: 2px 4px;
          border-radius: 2px;
        }
        .highlighted-line {
          animation: highlight 0.5s ease;
        }
        @keyframes highlight {
          0% { background-color: #fff3cd; }
          100% { background-color: transparent; }
        }
      `})]})};export{ze as default};

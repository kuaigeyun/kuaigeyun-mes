import{C as K,r as n,j as t,D as M,a7 as O,N as w,Z as H,aw as R,O as _,aX as L,al as V,ak as G,aC as W,cf as X}from"./vendor-BeQJ99FL.js";import{T as Y}from"./PremiumTerminalTemplate-Crb4hGUu.js";import{fn as Z}from"./main-DJsP1I1e.js";import{U as v}from"./clientRelease-e9ep2XtX.js";import"./design-B_8Sx7jg.js";import"./touch-CzJ4Jti_.js";import"./index.es-AP8DZC8h.js";import"./sessionCurrentUser-VeZX7CPB.js";import"./globalStore-JCAJrz5D.js";import"./restoredUser-D6ceVAJD.js";import"./tokenRefresh-D7ACSfW5.js";import"./building-2-BvU5aAxR.js";import"./index-4gWdEHrR.js";import"./vendor-libredwg-D2RQ9ZQN.js";import"./vendor-three-BPXNOO5B.js";import"./clearSessionQueries-Db_KN_8V.js";const{Search:q}=_,fe=()=>{const{message:a}=K.useApp(),C=Z(),[I,j]=n.useState(!1),[i,u]=n.useState(""),[f,x]=n.useState(""),[b,E]=n.useState(""),[o,k]=n.useState([]),[c,m]=n.useState(-1),y=n.useRef(null),S=n.useRef(null);n.useEffect(()=>{const e=new URLSearchParams(window.location.search),r=e.get("code"),s=e.get("programCode"),d=e.get("programUrl"),h=e.get("name")||e.get("programName");r?(u(r),x(h||"加工程序")):s?(u(s),x(h||"加工程序")):d?U(d):a.warning("请提供程序代码或程序URL")},[]);const U=async e=>{j(!0);try{const r=await fetch(e);if(!r.ok)throw new Error("加载程序失败");const s=await r.text();u(s),x("加工程序")}catch(r){a.error(r.message||"加载程序失败")}finally{j(!1)}},T=n.useCallback(e=>{if(!e||!i){k([]),m(-1);return}const r=i.split(`
`),s=[],d=e.toLowerCase();r.forEach((h,p)=>{h.toLowerCase().includes(d)&&s.push(p)}),k(s),m(s.length>0?0:-1),s.length>0?(g(s[0]),a.success(`找到 ${s.length} 个匹配项`)):a.warning("未找到匹配项")},[i,a]),g=n.useCallback(e=>{if(y.current){const r=y.current.querySelector(`[data-line="${e}"]`);r&&(r.scrollIntoView({behavior:"smooth",block:"center"}),r.classList.add("highlighted-line"),setTimeout(()=>{r.classList.remove("highlighted-line")},2e3))}},[]),z=n.useCallback(()=>{if(o.length===0)return;const e=(c+1)%o.length;m(e),g(o[e])},[o,c,g]),B=n.useCallback(()=>{if(o.length===0)return;const e=(c-1+o.length)%o.length;m(e),g(o[e])},[o,c,g]),F=n.useCallback((e,r="")=>{if(!e)return"";const s=e.split(`
`),d=r.toLowerCase();return s.map((h,p)=>{let l=h;if(r&&d){const A=new RegExp(`(${r.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`,"gi");l=l.replace(A,"<mark>$1</mark>")}l=l.replace(/\b(G\d{1,2})\b/gi,'<span class="g-code">$1</span>'),l=l.replace(/\b(M\d{1,2})\b/gi,'<span class="m-code">$1</span>'),l=l.replace(/\b([XYZUVW])(-?\d+\.?\d*)\b/gi,'<span class="coordinate">$1$2</span>'),l=l.replace(/(;.*$|\(.*?\))/g,'<span class="comment">$1</span>'),l=l.replace(/\b(\d+\.?\d*)\b/g,'<span class="number">$1</span>');const N=r&&h.toLowerCase().includes(d),$=o.length>0&&c>=0&&o[c]===p;return t.jsxs("div",{"data-line":p,style:{display:"flex",minHeight:"40px",lineHeight:"40px",fontSize:"24px",fontFamily:v,backgroundColor:$?"#fff3cd":N?"#f0f0f0":"transparent",padding:"4px 8px",borderLeft:$?"4px solid #ffc107":"4px solid transparent"},children:[t.jsx("span",{style:{display:"inline-block",minWidth:"60px",textAlign:"right",color:"#999",marginRight:"16px",userSelect:"none"},children:p+1}),t.jsx("span",{style:{flex:1,whiteSpace:"pre-wrap",wordBreak:"break-all"},dangerouslySetInnerHTML:{__html:l||" "}})]},p)})},[b,o,c]),P=n.useCallback(()=>{if(!i){a.warning("没有程序可下载");return}try{const e=new Blob([i],{type:"text/plain"}),r=URL.createObjectURL(e),s=document.createElement("a");s.href=r,s.download=`${f||"program"}-${Date.now()}.txt`,document.body.appendChild(s),s.click(),document.body.removeChild(s),URL.revokeObjectURL(r),a.success("程序下载成功")}catch(e){a.error(`下载程序失败: ${e.message||"未知错误"}`)}},[i,f,a]),D=n.useCallback(async()=>{try{await C.enterFullscreen(),a.success("已进入全屏模式")}catch(e){a.error(`进入全屏失败: ${e.message||"未知错误"}`)}},[C,a]);return t.jsxs(Y,{title:f||"加工程序查看",fullscreen:!0,footerButtons:[{title:"上一个",type:"default",icon:t.jsx(V,{}),onClick:B,disabled:o.length===0||c<0,block:!1},{title:`搜索 (${o.length>0?`${c+1}/${o.length}`:"0"})`,type:"default",icon:t.jsx(L,{}),onClick:()=>S.current?.focus(),block:!1},{title:"下一个",type:"default",icon:t.jsx(G,{}),onClick:z,disabled:o.length===0||c<0,block:!1},{title:"下载",type:"default",icon:t.jsx(W,{}),onClick:P,block:!1},{title:"全屏",type:"primary",icon:t.jsx(X,{}),onClick:D,block:!1}],children:[t.jsx(M,{spinning:I,children:i?t.jsxs("div",{style:{width:"100%",height:"100%",display:"flex",flexDirection:"column"},children:[t.jsx(w,{size:"small",style:{marginBottom:24,backgroundColor:"#f5f5f5"},children:t.jsxs(H,{orientation:"vertical",size:"small",style:{width:"100%"},children:[t.jsxs("div",{children:[t.jsx("strong",{children:"程序名称："}),t.jsx("span",{children:f||"加工程序"})]}),t.jsxs("div",{children:[t.jsx("strong",{children:"总行数："}),t.jsx(R,{color:"blue",children:i.split(`
`).length})]}),o.length>0&&t.jsxs("div",{children:[t.jsx("strong",{children:"搜索结果："}),t.jsxs(R,{color:"green",children:[o.length," 个匹配项"]})]})]})}),t.jsx(w,{size:"small",style:{marginBottom:24},children:t.jsx(q,{ref:S,placeholder:"搜索程序内容（支持G代码、M代码、坐标等）",size:"large",value:b,onChange:e=>E(e.target.value),onSearch:T,enterButton:t.jsx(L,{}),style:{fontSize:24},allowClear:!0})}),t.jsx(w,{title:"程序代码",style:{flex:1,display:"flex",flexDirection:"column",marginBottom:24},styles:{body:{flex:1,overflow:"auto",padding:0}},children:t.jsx("div",{ref:y,style:{width:"100%",height:"100%",overflow:"auto",backgroundColor:"#fafafa",fontFamily:v,fontSize:"24px",lineHeight:"40px"},children:F(i,b)})})]}):t.jsx(O,{description:"未找到程序数据"})}),t.jsx("style",{children:`
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
      `})]})};export{fe as default};

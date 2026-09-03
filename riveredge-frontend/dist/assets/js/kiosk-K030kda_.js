import{C as K,r as o,j as t,D as M,a8 as O,N as w,Z as H,au as R,O as _,b7 as L,am as V,al as G,aS as W,cd as Y}from"./vendor-DF57fAD-.js";import{T as Z}from"./PremiumTerminalTemplate-hWHPejrH.js";import{aL as q}from"./main-DleVyh6x.js";import{S as v}from"./clientRelease-CNE_5vTl.js";import"./design-B_8Sx7jg.js";import"./touch-CzJ4Jti_.js";import"./index.es-BbNG9duF.js";import"./sessionCurrentUser-6pMVlEat.js";import"./globalStore-BsfonsxI.js";import"./restoredUser-PZK2-K4P.js";import"./tokenRefresh-DYz5aZlb.js";import"./building-2-C3DgydGd.js";import"./clearSessionQueries-Db_KN_8V.js";import"./index-DpsXMatM.js";const{Search:X}=_,pe=()=>{const{message:a}=K.useApp(),j=q(),[I,C]=o.useState(!1),[i,m]=o.useState(""),[f,x]=o.useState(""),[b,E]=o.useState(""),[n,k]=o.useState([]),[c,u]=o.useState(-1),y=o.useRef(null),S=o.useRef(null);o.useEffect(()=>{const e=new URLSearchParams(window.location.search),s=e.get("code"),r=e.get("programCode"),d=e.get("programUrl"),h=e.get("name")||e.get("programName");s?(m(s),x(h||"加工程序")):r?(m(r),x(h||"加工程序")):d?U(d):a.warning("请提供程序代码或程序URL")},[]);const U=async e=>{C(!0);try{const s=await fetch(e);if(!s.ok)throw new Error("加载程序失败");const r=await s.text();m(r),x("加工程序")}catch(s){a.error(s.message||"加载程序失败")}finally{C(!1)}},T=o.useCallback(e=>{if(!e||!i){k([]),u(-1);return}const s=i.split(`
`),r=[],d=e.toLowerCase();s.forEach((h,p)=>{h.toLowerCase().includes(d)&&r.push(p)}),k(r),u(r.length>0?0:-1),r.length>0?(g(r[0]),a.success(`找到 ${r.length} 个匹配项`)):a.warning("未找到匹配项")},[i,a]),g=o.useCallback(e=>{if(y.current){const s=y.current.querySelector(`[data-line="${e}"]`);s&&(s.scrollIntoView({behavior:"smooth",block:"center"}),s.classList.add("highlighted-line"),setTimeout(()=>{s.classList.remove("highlighted-line")},2e3))}},[]),z=o.useCallback(()=>{if(n.length===0)return;const e=(c+1)%n.length;u(e),g(n[e])},[n,c,g]),B=o.useCallback(()=>{if(n.length===0)return;const e=(c-1+n.length)%n.length;u(e),g(n[e])},[n,c,g]),F=o.useCallback((e,s="")=>{if(!e)return"";const r=e.split(`
`),d=s.toLowerCase();return r.map((h,p)=>{let l=h;if(s&&d){const A=new RegExp(`(${s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`,"gi");l=l.replace(A,"<mark>$1</mark>")}l=l.replace(/\b(G\d{1,2})\b/gi,'<span class="g-code">$1</span>'),l=l.replace(/\b(M\d{1,2})\b/gi,'<span class="m-code">$1</span>'),l=l.replace(/\b([XYZUVW])(-?\d+\.?\d*)\b/gi,'<span class="coordinate">$1$2</span>'),l=l.replace(/(;.*$|\(.*?\))/g,'<span class="comment">$1</span>'),l=l.replace(/\b(\d+\.?\d*)\b/g,'<span class="number">$1</span>');const N=s&&h.toLowerCase().includes(d),$=n.length>0&&c>=0&&n[c]===p;return t.jsxs("div",{"data-line":p,style:{display:"flex",minHeight:"40px",lineHeight:"40px",fontSize:"24px",fontFamily:v,backgroundColor:$?"#fff3cd":N?"#f0f0f0":"transparent",padding:"4px 8px",borderLeft:$?"4px solid #ffc107":"4px solid transparent"},children:[t.jsx("span",{style:{display:"inline-block",minWidth:"60px",textAlign:"right",color:"#999",marginRight:"16px",userSelect:"none"},children:p+1}),t.jsx("span",{style:{flex:1,whiteSpace:"pre-wrap",wordBreak:"break-all"},dangerouslySetInnerHTML:{__html:l||" "}})]},p)})},[b,n,c]),P=o.useCallback(()=>{if(!i){a.warning("没有程序可下载");return}try{const e=new Blob([i],{type:"text/plain"}),s=URL.createObjectURL(e),r=document.createElement("a");r.href=s,r.download=`${f||"program"}-${Date.now()}.txt`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(s),a.success("程序下载成功")}catch(e){a.error(`下载程序失败: ${e.message||"未知错误"}`)}},[i,f,a]),D=o.useCallback(async()=>{try{await j.enterFullscreen(),a.success("已进入全屏模式")}catch(e){a.error(`进入全屏失败: ${e.message||"未知错误"}`)}},[j,a]);return t.jsxs(Z,{title:f||"加工程序查看",fullscreen:!0,footerButtons:[{title:"上一个",type:"default",icon:t.jsx(V,{}),onClick:B,disabled:n.length===0||c<0,block:!1},{title:`搜索 (${n.length>0?`${c+1}/${n.length}`:"0"})`,type:"default",icon:t.jsx(L,{}),onClick:()=>S.current?.focus(),block:!1},{title:"下一个",type:"default",icon:t.jsx(G,{}),onClick:z,disabled:n.length===0||c<0,block:!1},{title:"下载",type:"default",icon:t.jsx(W,{}),onClick:P,block:!1},{title:"全屏",type:"primary",icon:t.jsx(Y,{}),onClick:D,block:!1}],children:[t.jsx(M,{spinning:I,children:i?t.jsxs("div",{style:{width:"100%",height:"100%",display:"flex",flexDirection:"column"},children:[t.jsx(w,{size:"small",style:{marginBottom:24,backgroundColor:"#f5f5f5"},children:t.jsxs(H,{orientation:"vertical",size:"small",style:{width:"100%"},children:[t.jsxs("div",{children:[t.jsx("strong",{children:"程序名称："}),t.jsx("span",{children:f||"加工程序"})]}),t.jsxs("div",{children:[t.jsx("strong",{children:"总行数："}),t.jsx(R,{color:"blue",children:i.split(`
`).length})]}),n.length>0&&t.jsxs("div",{children:[t.jsx("strong",{children:"搜索结果："}),t.jsxs(R,{color:"green",children:[n.length," 个匹配项"]})]})]})}),t.jsx(w,{size:"small",style:{marginBottom:24},children:t.jsx(X,{ref:S,placeholder:"搜索程序内容（支持G代码、M代码、坐标等）",size:"large",value:b,onChange:e=>E(e.target.value),onSearch:T,enterButton:t.jsx(L,{}),style:{fontSize:24},allowClear:!0})}),t.jsx(w,{title:"程序代码",style:{flex:1,display:"flex",flexDirection:"column",marginBottom:24},styles:{body:{flex:1,overflow:"auto",padding:0}},children:t.jsx("div",{ref:y,style:{width:"100%",height:"100%",overflow:"auto",backgroundColor:"#fafafa",fontFamily:v,fontSize:"24px",lineHeight:"40px"},children:F(i,b)})})]}):t.jsx(O,{description:"未找到程序数据"})}),t.jsx("style",{children:`
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
      `})]})};export{pe as default};

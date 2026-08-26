const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/js/vendor-BORuDE6z.js"])))=>i.map(i=>d[i]);
import{r as d,j as e,_ as h}from"./vendor-BORuDE6z.js";import{p as g,f as u,K as x}from"./KpiCard-B_spf3Zh.js";import"./chartTheme-CT7-C1Pu.js";function l(t,i){return Math.floor(Math.random()*(i-t+1))+t}function n(t,i,o){return Math.max(i,Math.min(o,t))}function k(t){const{n:i,mode:o,groupThousands:b}=g(t.value);let r=i;switch(t.id){case"orders":r=n(i+l(-5,7),148,235);break;case"otd":r=n(i+(Math.random()-.5)*.45,87.5,98.8);break;case"wip":r=n(i+l(-32,38),1020,1420);break;case"exceptions":r=n(i+l(-2,3),10,42);break;case"turnover":r=n(i+l(-1,1),21,37);break;case"closedWo7d":r=n(i+l(-14,20),250,430);break;case"shipmentsToday":r=n(i+l(-6,8),68,118);break;case"oeeAvg":r=n(i+(Math.random()-.5)*.5,71.5,86.5);break;default:return t.value}return u(r,o,b)}const v=d.lazy(()=>h(()=>import("./BoardHero3D-Bc0_tgJ_.js"),__vite__mapDeps([0]))),c=8,z=({kpiItems:t,t:i,isFullscreen:o=!1})=>{const[b,r]=d.useState(()=>t.slice(0,c).map(a=>({...a})));d.useEffect(()=>{r(t.slice(0,c).map(a=>({...a})))},[t]),d.useEffect(()=>{const a=()=>{r(p=>p.map(m=>({...m,value:k(m)})))},s=window.setInterval(a,7200+Math.floor(Math.random()*2400));return()=>clearInterval(s)},[]);const f=o?"clamp(162px, 42.5vmin, 278px)":"clamp(140px, 35.5vmin, 232px)";return e.jsxs("div",{className:`orbital-kpi-field${o?" orbital-kpi-field--fullscreen":""}`,style:{"--orbit-r":f,"--orbit-cy":"52%",position:"relative",width:"100%",height:"100%",minHeight:260,boxSizing:"border-box",overflow:"visible",isolation:"isolate"},children:[e.jsx("style",{children:`
          @keyframes orbitalRingDrift {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
          @keyframes orbitalRingDriftReverse {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(-360deg); }
          }
          @keyframes stellarPulse {
            0%, 100% { opacity: 0.88; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.97; transform: translate(-50%, -50%) scale(1.018); }
          }
          @keyframes kpiBreathMotion {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.005); }
          }
          @keyframes planetCardSheen {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 0.34; }
          }
          .orbital-kpi-field .kpi-planet-breath {
            animation: kpiBreathMotion 9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            animation-delay: var(--planet-breath-delay, 0s);
            transform-origin: center center;
          }
          .orbital-kpi-field .kpi-planet-breath:hover {
            animation-play-state: paused;
          }
          .orbital-kpi-field .kpi-planet-breath:hover .kpi-planet-card {
            transform: scale(1.045);
          }
          .orbital-kpi-field .kpi-planet-card {
            position: relative;
            transition: transform 0.2s ease;
          }
          .orbital-kpi-field .kpi-planet-card::before {
            content: '';
            position: absolute;
            inset: -1px;
            border-radius: inherit;
            pointer-events: none;
            z-index: 0;
            background: linear-gradient(
              125deg,
              rgba(255, 255, 255, 0.14) 0%,
              transparent 42%,
              rgba(255, 255, 255, 0.05) 58%,
              transparent 100%
            );
            opacity: 0.24;
            animation: planetCardSheen 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            animation-delay: var(--planet-sheen-delay, 0s);
          }
          .orbital-kpi-field .kpi-planet-card > * {
            position: relative;
            z-index: 1;
          }
          .orbital-kpi-field .kpi-planet-breath:hover .kpi-planet-card::before {
            opacity: 0.44;
          }
          .orbital-kpi-field .orbit-ring {
            position: absolute;
            left: 50%;
            top: var(--orbit-cy, 50%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
            border: 1px dashed rgba(56, 189, 248, 0.14);
            box-shadow: 0 0 16px rgba(56, 189, 248, 0.05);
          }
          .orbital-kpi-field .orbit-ring--outer {
            width: min(54%, 280px);
            aspect-ratio: 1;
            animation: orbitalRingDrift 180s linear infinite;
          }
          .orbital-kpi-field .orbit-ring--mid {
            width: min(44%, 228px);
            aspect-ratio: 1;
            border-color: rgba(125, 211, 252, 0.1);
            animation: orbitalRingDriftReverse 120s linear infinite;
          }
          .orbital-kpi-field .orbit-ring--inner {
            width: min(34%, 176px);
            aspect-ratio: 1;
            border-color: rgba(56, 189, 248, 0.09);
            border-style: dotted;
            animation: orbitalRingDrift 88s linear infinite;
          }
          .orbital-kpi-field--fullscreen .orbit-ring--outer {
            width: min(58%, 312px);
          }
          .orbital-kpi-field--fullscreen .orbit-ring--mid {
            width: min(48%, 256px);
          }
          .orbital-kpi-field--fullscreen .orbit-ring--inner {
            width: min(38%, 200px);
          }
          .orbital-kpi-field .orbital-stellar-core {
            animation: stellarPulse 11s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .orbital-kpi-field .orbit-ring--outer,
            .orbital-kpi-field .orbit-ring--mid,
            .orbital-kpi-field .orbit-ring--inner {
              animation: none !important;
            }
            .orbital-kpi-field .kpi-planet-breath {
              animation: none !important;
            }
            .orbital-kpi-field .kpi-planet-card::before {
              animation: none !important;
              opacity: 0.22;
            }
            .orbital-kpi-field .orbital-stellar-core {
              animation: none !important;
              opacity: 0.92;
              transform: translate(-50%, -50%) scale(1);
            }
          }
        `}),e.jsx("div",{className:"orbit-ring orbit-ring--outer"}),e.jsx("div",{className:"orbit-ring orbit-ring--mid"}),e.jsx("div",{className:"orbit-ring orbit-ring--inner"}),e.jsx("div",{className:"orbital-stellar-core",style:{position:"absolute",left:"50%",top:"var(--orbit-cy, 50%)",width:"min(44vmin, 280px)",height:"min(44vmin, 280px)",transform:"translate(-50%, -50%)",borderRadius:"50%",background:"radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, rgba(34, 211, 238, 0.07) 28%, rgba(15, 23, 42, 0) 68%)",pointerEvents:"none",zIndex:1}}),e.jsx("div",{style:{position:"absolute",left:"50%",top:"var(--orbit-cy, 50%)",width:"min(22vmin, 128px)",height:"min(22vmin, 128px)",transform:"translate(-50%, -50%)",borderRadius:"50%",background:"radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, transparent 70%)",pointerEvents:"none",zIndex:1}}),e.jsx("div",{style:{position:"absolute",left:"50%",top:"var(--orbit-cy, 50%)",transform:"translate(-50%, -50%)",height:"min(46vmin, 92%)",width:"auto",aspectRatio:"1",maxWidth:"100%",maxHeight:"100%",zIndex:2,background:"transparent",border:"none",padding:0,overflow:"visible",boxSizing:"border-box"},children:e.jsx(d.Suspense,{fallback:e.jsx("div",{style:{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#475569",fontSize:12},children:"3D…"}),children:e.jsx(v,{})})}),b.map((a,s)=>{const p=-90+s*(360/c);return e.jsx("div",{style:{position:"absolute",left:"50%",top:"var(--orbit-cy, 50%)",width:"clamp(92px, 18vw, 124px)",zIndex:4,transform:`translate(-50%, -50%) rotate(${p}deg) translateY(calc(-1 * var(--orbit-r))) rotate(${-p}deg)`,"--planet-breath-delay":`${s*.55}s`,"--planet-sheen-delay":`${s*.45}s`},children:e.jsx("div",{className:"kpi-planet-breath",children:e.jsx(x,{item:a,t:i,orbital:!0})})},a.id)})]})};export{z as OrbitalKpiField};

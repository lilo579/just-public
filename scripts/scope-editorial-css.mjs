import fs from 'node:fs';
import postcss from 'postcss';
// The pre-cutover stylesheet is kept verbatim as provenance; this only scopes it.
const input=new URL('../src/components/mission/editorial/reference.css',import.meta.url);
const root=postcss.parse(fs.readFileSync(input,'utf8'));
root.walkRules(rule=>{
 if(rule.parent.type==='rule')return;
 let parent=rule.parent;while(parent){if(parent.type==='atrule'&&/keyframes/.test(parent.name))return;parent=parent.parent;}
 rule.selectors=rule.selectors.map(sel=>{
 if(sel===':root'||sel==='body'||sel==='html')return '.mission-editorial';
 if(sel.includes('::backdrop'))return '.mission-editorial::backdrop';
 return '.mission-editorial '+sel;
 });
});
const extra=`
html:has(.mission-editorial) {scroll-behavior:smooth;scroll-padding-top:4.75rem}
body:has(.mission-editorial) {margin:0}
.site-theme-root .mission-editorial h1,.site-theme-root .mission-editorial h2,.site-theme-root .mission-editorial h3,.site-theme-root .mission-editorial h4 {font-family:var(--font-serif);font-weight:500}
.mission-editorial [hidden] {display:none!important}
@media(prefers-reduced-motion:reduce){html:has(.mission-editorial){scroll-behavior:auto}}
`;
fs.mkdirSync(new URL('../public/presentation/mission-editorial/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../public/presentation/mission-editorial/reference.css',import.meta.url),root.toString()+extra);

/* FF7 NES French Editor 0.1 — no dependencies, no network. */
(function(root){'use strict';
const ACCENTS={35:'é',42:'ç',60:'Ç',62:'É',91:'à',93:'ê',94:'è',95:'‥',96:'â',47:'ù'};
const REVERSE=Object.fromEntries(Object.entries(ACCENTS).map(([b,c])=>[c,Number(b)]));
const HEX=n=>n.toString(16).toUpperCase().padStart(2,'0');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const concat=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length}return out};
const utf8=s=>new TextEncoder().encode(s);
function decode(bytes){let s='';for(let i=0;i<bytes.length;i++){let b=bytes[i];
 if(b===64 && i===0 && bytes.length>1){s+='{P:'+HEX(bytes[++i])+'}';continue}
 if(b===92){s+='\n';continue}
 if(ACCENTS[b]){s+=ACCENTS[b];continue}
 if(b<32||b>=123||b===64){s+='{'+HEX(b)+'}';continue}
 s+=String.fromCharCode(b);
 }return s.replace(/ +$/,'')}
function encode(text){const out=[];const s=text.normalize('NFC').replace(/\r\n?/g,'\n');for(let i=0;i<s.length;i++){
 if(s[i]==='{'){const m=s.slice(i).match(/^\{(?:(P):)?([0-9A-Fa-f]{2})\}/);assert(m,'Code protégé invalide : utiliser exactement les codes présents dans le texte de base.');if(m[1])out.push(64);out.push(parseInt(m[2],16));i+=m[0].length-1;continue}
 let c=s[i];if(c==='\n'){out.push(92);continue}if(REVERSE[c]!==undefined){out.push(REVERSE[c]);continue}
 let b=c.charCodeAt(0);assert(b>=32&&b<123&&!ACCENTS[b]&&b!==64&&b!==92,'Caractère non disponible dans la police du jeu : « '+c+' ». Accents disponibles : à é è ê ç Ç É â ù.');out.push(b);
 }return Uint8Array.from(out)}
const tokens=s=>s.match(/\{(?:P:)?[0-9A-Fa-f]{2}\}/g)||[];
function protectedEqual(a,b){return JSON.stringify(tokens(a).map(s=>s.toUpperCase()))===JSON.stringify(tokens(b).map(s=>s.toUpperCase()))}
function graphicPixels(text,e,rom,m){
 const cols=[];const s=e.font==='small'?text.toUpperCase():text;
 for(const ch of s){if(ch===' '){for(let x=0;x<(e.font==='small'?3:4);x++)cols.push(Array(8).fill(0));continue}
  if(e.font==='small'){
   const rows=m.smallFont[ch];assert(rows,'Les menus compacts acceptent A–Z, 0–9, espace, tiret et point.');
   for(let x=0;x<rows[0].length;x++)cols.push([...rows.map(r=>Number(r[x])),0]);
  }else{
   const bs=encode(ch);assert(bs.length===1&&bs[0]>=32&&bs[0]<=122,'Caractère non disponible dans le titre.');
   const rows=rom.slice(m.fontBase+bs[0]*16,m.fontBase+bs[0]*16+8);let xs=[];
   for(let x=0;x<8;x++)if(rows.some(v=>v&(128>>x)))xs.push(x);
   if(xs.length)for(let x=xs[0];x<=xs[xs.length-1];x++)cols.push(Array.from(rows,v=>(v>>(7-x))&1));
  }cols.push(Array(8).fill(0));
 }if(cols.length)cols.pop();assert(cols.length<=e.width,'Libellé trop large : '+cols.length+' pixels pour '+e.width+' disponibles.');
 const pad=e.font==='small'?Math.floor((e.width-cols.length)/2):0;
 return Array.from({length:8},(_,y)=>Array.from({length:e.width},(_,x)=>cols[x-pad]?.[y]||0));
}
function graphicWrites(pix,e){return e.offsets.map((a,k)=>{
 const displayed=e.order.indexOf(k);assert(displayed>=0,'Ordre des tiles invalide.');
 const rows=Uint8Array.from({length:8},(_,y)=>pix[y].slice(displayed*8,displayed*8+8).reduce((v,b)=>v*2+b,0));
 let data;if(e.style==='mono')data=rows;else if(e.style==='blue')data=concat([new Uint8Array(8).fill(255),Uint8Array.from(rows,v=>255-v)]);else data=concat([rows,new Uint8Array(8)]);
 return {offset:a,data};
 })}
function readGraphic(rom,e){const pixels=Array.from({length:8},()=>Array(e.width).fill(0));e.order.forEach((physical,displayed)=>{
 const a=e.offsets[physical];const rows=e.style==='blue'?Uint8Array.from(rom.slice(a+8,a+16),v=>255-v):rom.slice(a,a+8);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)pixels[y][displayed*8+x]=(rows[y]>>(7-x))&1;
 });return pixels}
async function hash(bytes){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),HEX).join('').toLowerCase()}
function maskROM(rom,m){let masked=rom.slice();for(const e of m.entries){if(e.locked)continue;if(e.kind==='text')masked.fill(0,e.offset,e.end);else for(const a of e.offsets)masked.fill(0,a,a+(e.style==='mono'?8:16))}return masked}
async function loadROM(rom,m){assert(rom instanceof Uint8Array,'ROM illisible.');assert(rom.length===m.romSize,'Taille incompatible. Utiliser la v22 incluse ou une ROM exportée par cet outil.');assert(rom[0]===78&&rom[1]===69&&rom[2]===83&&rom[3]===26,'Ce fichier n’est pas une ROM NES.');
 assert(await hash(maskROM(rom,m))===m.fingerprint,'Cette ROM ne correspond pas au profil v22. Le code, les pointeurs ou les graphismes protégés diffèrent.');
 const entries=m.entries.map(e=>{
  let original,custom=false;if(e.kind==='text'){assert([10,13].includes(rom[e.end]),'Fin de texte différente : '+e.id);original=decode(rom.slice(e.offset,e.end));assert(JSON.stringify(tokens(original))===JSON.stringify(e.protectedCodes),'Codes protégés altérés : '+e.id)}
  else{custom=e.baseBytes.some((bs,k)=>bs.some((v,i)=>rom[e.offsets[k]+i]!==v));original=custom?'':e.defaultText}
  return {...e,original,custom};
 });return {rom:rom.slice(),hash:await hash(rom),entries,manifest:m,edits:new Map()};
}
function evaluate(doc,e,text){
 try{
  assert(!e.locked,e.reason||'Entrée protégée.');
  if(e.kind==='graphic'){const pixels=graphicPixels(text,e,doc.rom,doc.manifest);return {ok:true,pixels,writes:graphicWrites(pixels,e),used:pixels[0].length,max:e.width,warnings:[]}}
  const prefix=e.original.match(/^(?:\{(?:P:)?[0-9A-F]{2}\})+/)?.[0]||'';assert(text.startsWith(prefix),'Les codes placés au début du texte doivent rester au début.');
  assert(protectedEqual(e.original,text),'Les codes de portrait, d’icône et de commande doivent rester identiques, dans le même ordre.');
  const bytes=encode(text),max=e.end-e.offset;assert(bytes.length<=max,'Texte trop long : '+bytes.length+' octets pour '+max+' disponibles. Raccourcir la phrase.');
  assert(!bytes.includes(10)&&!bytes.includes(13)&&!bytes.includes(0)&&!bytes.includes(255),'Un code ne doit pas créer de terminaison ou de données invalides.');
  const plain=text.replace(/^\{P:[0-9A-Fa-f]{2}\}/,'').replace(/\{(?:P:)?[0-9A-Fa-f]{2}\}/g,'◆');const lines=plain.split('\n');
  const warnings=[];const width=e.category==='Dialogues'?18:32;
  if(lines.some(s=>s.length>width))warnings.push('Une ligne dépasse '+width+' caractères : vérifier la fenêtre en jeu ou ajouter des retours à la ligne.');
  const data=new Uint8Array(max).fill(32);data.set(bytes);return {ok:true,bytes,used:bytes.length,max,writes:[{offset:e.offset,data}],warnings};
 }catch(err){return {ok:false,error:err.message,warnings:[]}}
}
function build(doc){const rom=doc.rom.slice();let count=0;const writes=[];
 for(const [id,text] of doc.edits){const e=doc.entries.find(e=>e.id===id);assert(e,'ID inconnu dans le projet : '+id);if(text===e.original&&!e.custom)continue;const r=evaluate(doc,e,text);assert(r.ok,id+' : '+r.error);writes.push(...r.writes);count++}
 // Fail closed if a profile ever introduces overlapping writes.
 const occupied=new Set();for(const w of writes){for(let i=0;i<w.data.length;i++){const p=w.offset+i;assert(!occupied.has(p),'Deux modifications écrivent au même endroit.');occupied.add(p)}rom.set(w.data,w.offset)}
 return {rom,count,changed:rom.reduce((n,b,i)=>n+(b!==doc.rom[i]),0),ips:makeIPS(doc.rom,rom)};
}
function makeIPS(a,b){assert(a.length===b.length&&b.length<0x1000000,'Taille non prise en charge par IPS.');const parts=[utf8('PATCH')];let i=0;
 while(i<a.length){if(a[i]===b[i]){i++;continue}let start=i;while(i<a.length&&a[i]!==b[i]&&i-start<65535)i++;const n=i-start;parts.push(Uint8Array.from([start>>16,(start>>8)&255,start&255,n>>8,n&255]),b.slice(start,i))}
 parts.push(utf8('EOF'));return concat(parts);
}
function applyIPS(base,patch){assert(new TextDecoder().decode(patch.slice(0,5))==='PATCH','En-tête IPS invalide.');const out=base.slice();let i=5;
 while(i<patch.length){assert(i+3<=patch.length,'IPS tronqué.');if(patch[i]===69&&patch[i+1]===79&&patch[i+2]===70){assert(i+3===patch.length,'Fin IPS invalide.');return out}assert(i+5<=patch.length,'IPS tronqué.');const p=patch[i]*65536+patch[i+1]*256+patch[i+2],n=patch[i+3]*256+patch[i+4];i+=5;if(n){assert(i+n<=patch.length&&p+n<=out.length,'IPS hors limites.');out.set(patch.slice(i,i+n),p);i+=n}else{assert(i+3<=patch.length,'IPS RLE tronqué.');const repeat=patch[i]*256+patch[i+1];assert(p+repeat<=out.length,'IPS hors limites.');out.fill(patch[i+2],p,p+repeat);i+=3}}throw new Error('Fin IPS manquante.');
}
function toBase64(b){let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return root.btoa(s)}
function fromBase64(s){assert(typeof s==='string'&&s.length<4000000,'ROM du projet invalide.');return Uint8Array.from(root.atob(s),c=>c.charCodeAt(0))}
function project(doc,name){return {format:'FF7FR',version:1,profile:doc.manifest.profile,name,baseHash:doc.hash,rom:toBase64(doc.rom),edits:Array.from(doc.edits,([id,text])=>({id,text}))}}
function restoreEdits(doc,edits,allowInvalid=false){assert(Array.isArray(edits)&&edits.length<=doc.entries.length,'Liste de modifications invalide.');const result=new Map();for(const x of edits){assert(x&&typeof x.id==='string'&&typeof x.text==='string'&&x.text.length<=20000,'Modification invalide.');assert(!result.has(x.id),'ID en double.');const e=doc.entries.find(e=>e.id===x.id);assert(e,'Entrée inconnue : '+x.id);assert(!e.locked,'Entrée protégée : '+x.id);const r=evaluate(doc,e,x.text);if(!allowInvalid)assert(r.ok,x.id+' : '+r.error);result.set(x.id,x.text)}doc.edits=result}
async function openProject(p,m){assert(p?.format==='FF7FR'&&p.version===1&&p.profile===m.profile,'Format de projet incompatible.');const doc=await loadROM(fromBase64(p.rom),m);assert(doc.hash===p.baseHash,'La ROM du projet a été altérée.');restoreEdits(doc,p.edits,true);return doc}
function exportCatalog(doc){return {format:'FF7FR_TEXTS',version:1,baseHash:doc.hash,entries:doc.entries.map(e=>({id:e.id,category:e.category,offset:'0x'+e.offset.toString(16),original:e.original,text:doc.edits.get(e.id)??e.original,editable:!e.locked,note:e.reason||''}))}}
function importCatalog(doc,p){assert(p?.format==='FF7FR_TEXTS'&&p.version===1&&p.baseHash===doc.hash,'Catalogue issu d’une autre ROM.');assert(Array.isArray(p.entries),'Catalogue invalide.');const edits=new Map(doc.edits),ids=new Set();for(const row of p.entries){assert(!ids.has(row.id),'ID en double.');ids.add(row.id);const e=doc.entries.find(e=>e.id===row.id);assert(e&&typeof row.text==='string','Entrée invalide : '+row.id);if(row.text!==e.original){const r=evaluate(doc,e,row.text);assert(r.ok,e.id+' : '+r.error);edits.set(e.id,row.text)}else edits.delete(e.id)}doc.edits=edits}
// Stored ZIP records, interoperable with Explorer; no bundled ZIP dependency.
const CRC_TABLE=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xEDB88320^(n>>>1):n>>>1;return n>>>0});
function crc32(b){let n=0xFFFFFFFF;for(const v of b)n=CRC_TABLE[(n^v)&255]^(n>>>8);return (n^0xFFFFFFFF)>>>0}
function zip(files){let chunks=[],central=[],offset=0;for(const {name,data} of files){const n=utf8(name),crc=crc32(data),h=new Uint8Array(30),v=new DataView(h.buffer);v.setUint32(0,0x04034B50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);chunks.push(h,n,data);
 const c=new Uint8Array(46),cv=new DataView(c.buffer);cv.setUint32(0,0x02014B50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);central.push(c,n);offset+=h.length+n.length+data.length}
 const cent=concat(central),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054B50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,cent.length,true);v.setUint32(16,offset,true);return concat([...chunks,cent,end])}
root.FF7={decode,encode,hash,maskROM,loadROM,evaluate,build,makeIPS,applyIPS,readGraphic,graphicPixels,project,openProject,restoreEdits,exportCatalog,importCatalog,zip,utf8,toBase64,fromBase64,crc32};if(typeof module!=='undefined')module.exports=root.FF7;
})(typeof globalThis!=='undefined'?globalThis:this);

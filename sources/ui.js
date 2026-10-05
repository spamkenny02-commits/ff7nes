'use strict';
const $=id=>document.getElementById(id);let doc=null,selected=null,filtered=[],page=0,filename='FF7_FR',dirty=false,autosaveTimer;
const errorMessage=e=>e instanceof Error?e.message:String(e);
function toast(s){$('toast').textContent=s;$('toast').classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.add('hidden'),6500)}
async function action(fn){try{$('busy').textContent='…';await fn()}catch(e){toast(errorMessage(e))}finally{$('busy').textContent=''}}
function download(name,bytes,type='application/octet-stream'){const u=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
function jsonDownload(name,obj){download(name,JSON.stringify(obj,null,2),'application/json')}
function value(e){return doc.edits.get(e.id)??e.original}
function flat(s){return s.replace(/\{(?:P:)?[0-9A-Fa-f]{2}\}/g,'').replace(/\n/g,' ').trim()}
function normalize(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function localDraft(){if(!doc)return;clearTimeout(autosaveTimer);const snapshot={baseHash:doc.hash,edits:Array.from(doc.edits,([id,text])=>({id,text}))};autosaveTimer=setTimeout(()=>{try{localStorage.setItem('ff7-editor-v01-'+snapshot.baseHash,JSON.stringify(snapshot))}catch(_){toast('Le brouillon local n’a pas pu être conservé. Enregistre le fichier projet.')}},500)}
function totals(){if(!doc)return;let invalid=0;for(const [id,text] of doc.edits){const e=doc.entries.find(e=>e.id===id);if(!FF7.evaluate(doc,e,text).ok)invalid++}
 $('changeSummary').textContent=doc.edits.size+' modification'+(doc.edits.size!==1?'s':'')+(invalid?' · '+invalid+' à corriger':'');$('export').disabled=invalid>0;
}
async function useDoc(d,name,restore=true){doc=d;filename=(name||'FF7_FR').replace(/\.(nes|ff7fr|json)$/i,'').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,90)||'FF7_FR';page=0;dirty=false;
 if(restore){try{const saved=JSON.parse(localStorage.getItem('ff7-editor-v01-'+doc.hash));if(saved?.baseHash===doc.hash){FF7.restoreEdits(doc,saved.edits,true);if(doc.edits.size)toast('Brouillon retrouvé : '+doc.edits.size+' modification(s).')}}catch(_){}}
 $('welcome').classList.add('hidden');$('workspace').classList.remove('hidden');$('romInfo').textContent=(name||'ROM du projet')+' · '+doc.rom.length.toLocaleString('fr-FR')+' octets · profil v22';
 for(const id of ['saveProject','catalog','importCatalog','export'])$(id).disabled=false;
 const cats=[...new Set(doc.entries.map(e=>e.category))];$('category').replaceChildren(new Option('Toutes les catégories',''));for(const cat of cats)$('category').add(new Option(cat,cat));$('search').value='';$('onlyChanged').checked=false;
 selected=doc.entries.find(e=>doc.edits.has(e.id))||doc.entries.find(e=>e.category==='Dialogues'&&!e.locked)||doc.entries[0];renderList();showEntry(selected);totals();
}
function renderList(){if(!doc)return;const q=normalize($('search').value.trim()),cat=$('category').value,changed=$('onlyChanged').checked;
 filtered=doc.entries.filter(e=>(!cat||e.category===cat)&&(!changed||doc.edits.has(e.id))&&(!q||normalize(e.id+' '+e.offset.toString(16)+' '+e.label+' '+e.original+' '+value(e)).includes(q)));
 $('count').textContent=filtered.length.toLocaleString('fr-FR')+' entrée(s) · '+doc.entries.length.toLocaleString('fr-FR')+' reconnues';
 const fragment=document.createDocumentFragment();for(const e of filtered){const b=document.createElement('button');b.className='row'+(e.id===selected?.id?' selected':'');b.dataset.id=e.id;b.setAttribute('role','listitem');
 const top=document.createElement('div');top.className='row-title';const id=document.createElement('span');id.textContent=e.id+' · '+(e.kind==='graphic'?'Tiles':e.category==='Dialogues'?'Dialogue':e.category);const mark=document.createElement('span');mark.className='dot';mark.textContent=e.locked?'Protégé':doc.edits.has(e.id)?'●':'';top.append(id,mark);
 const text=document.createElement('div');text.className='row-text';text.textContent=flat(value(e))||(e.custom?'Bitmap personnalisé':e.label||'Sans texte');b.append(top,text);b.addEventListener('click',()=>showEntry(e));fragment.append(b)}
 if(!filtered.length){const p=document.createElement('p');p.className='sub';p.style.padding='18px';p.textContent='Aucune entrée. Essaie un mot plus court.';fragment.append(p)}$('list').replaceChildren(fragment);
}
function showEntry(e){selected=e;page=0;for(const row of $('list').children)row.classList.toggle('selected',row.dataset.id===e.id);
 $('entryTitle').textContent=e.kind==='graphic'?(e.label+' · menu graphique'):e.category;$('meta').textContent=e.id+' · ROM 0x'+e.offset.toString(16).toUpperCase().padStart(6,'0')+(e.kind==='text'?' · '+e.references.length+' référence(s) · bloc '+e.block:' · '+e.width+' pixels');
 $('original').textContent=e.custom?'Bitmap personnalisé présent dans cette ROM. L’aperçu montre ses pixels ; saisir un libellé pour le remplacer.':e.original;
 $('editor').value=value(e);$('editor').disabled=e.locked;$('undo').disabled=e.locked;$('wrap').disabled=e.locked||e.kind==='graphic';$('columns').value=e.category==='Dialogues'?18:28;refreshEditor();
}
function refreshEditor(){if(!selected)return;const text=$('editor').value;let r=selected.locked?{ok:true,warnings:[],used:selected.kind==='text'?FF7.encode(text).length:selected.width,max:selected.kind==='text'?selected.end-selected.offset:selected.width}:FF7.evaluate(doc,selected,text);
 $('status').className='status'+(!r.ok?' invalid':'');$('status').textContent=selected.locked?selected.reason:!r.ok?r.error:((selected.kind==='graphic'?'Libellé valide · '+selected.width+' pixels.':r.used+' / '+r.max+' octets · '+(r.max-r.used)+' disponibles.')+(r.warnings.length?'\n'+r.warnings.join(' '):''));
 $('meter').style.width=r.ok?Math.min(100,100*r.used/r.max)+'%':'100%';$('meter').style.background=r.ok?'var(--good)':'var(--bad)';renderPreview(r);totals();
}
function edited(){if(!doc||!selected||selected.locked)return;const s=$('editor').value;if(s===selected.original)doc.edits.delete(selected.id);else doc.edits.set(selected.id,s);dirty=true;page=0;
 const row=Array.from($('list').children).find(x=>x.dataset.id===selected.id);if(row){row.querySelector('.row-text').textContent=flat(s);row.querySelector('.dot').textContent=doc.edits.has(selected.id)?'●':''}refreshEditor();localDraft();
}
function glyph(code,x,y,ctx){if(code>135||code<32){ctx.strokeStyle='#d5e7ff';ctx.strokeRect(x+2,y+2,4,4);return}const rows=doc.rom.slice(MANIFEST.fontBase+code*16,MANIFEST.fontBase+code*16+8);ctx.fillStyle='#f8f8f8';for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)if(rows[yy]&(128>>xx))ctx.fillRect(x+xx,y+yy,1,1)}
function previewLines(s){let bytes;try{bytes=FF7.encode(s)}catch(_){bytes=FF7.encode(s.replace(/[^\x20-\x7a\nàéèêçÇÉâù‥]/g,'?').replace(/[\\#*<>\[\]^_`@]/g,'?'))}
 const lines=[[]];for(let i=0;i<bytes.length;i++){if(i===0&&bytes[i]===64){i++;continue}if(bytes[i]===92)lines.push([]);else{let v=bytes[i];if(v===192&&i+1<bytes.length){v=bytes[++i]}lines[lines.length-1].push(v)}}return lines;
}
function renderPreview(validation){if(!doc||!selected)return;const canvas=$('preview'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#091121';ctx.fillRect(0,0,256,240);
 // Simple neutral backdrop deliberately avoids inventing a game scene.
 ctx.fillStyle='#101e34';for(let y=16;y<90;y+=16)for(let x=16;x<250;x+=16)ctx.fillRect(x,y,1,1);
 ctx.fillStyle='#18325d';ctx.fillRect(8,100,240,132);ctx.strokeStyle='#e6edf8';ctx.strokeRect(8.5,100.5,239,131);ctx.strokeStyle='#58779d';ctx.strokeRect(10.5,102.5,235,127);
 if(selected.kind==='graphic'){
  let p=validation?.ok&&doc.edits.has(selected.id)?validation.pixels:FF7.readGraphic(doc.rom,selected);
  if(!p)p=FF7.readGraphic(doc.rom,selected);const scale=selected.width>80?1:2;const x0=Math.floor((256-selected.width*scale)/2),y0=158;
  ctx.fillStyle='#fff';for(let y=0;y<8;y++)for(let x=0;x<selected.width;x++)if(p[y][x])ctx.fillRect(x0+x*scale,y0+y*scale,scale,scale);
  $('pageInfo').textContent='Libellé graphique';$('pageBack').disabled=true;$('pageNext').disabled=true;$('columns').disabled=true;$('lines').disabled=true;return;
 }
 $('columns').disabled=false;$('lines').disabled=false;
 const columns=Math.max(8,Math.min(28,parseInt($('columns').value)||18)),perPage=Math.max(1,Math.min(8,parseInt($('lines').value)||4));
 const raw=previewLines($('editor').value),pages=Math.max(1,Math.ceil(raw.length/perPage));page=Math.max(0,Math.min(page,pages-1));const x0=24,y0=122;
 raw.slice(page*perPage,(page+1)*perPage).forEach((line,y)=>{for(let x=0;x<Math.min(line.length,28);x++){glyph(line[x],x0+x*8,y0+y*12,ctx);if(x>=columns){ctx.fillStyle='#ff776866';ctx.fillRect(x0+x*8,y0+y*12,8,8)}}});
 if(raw.slice(page*perPage,(page+1)*perPage).some(s=>s.length>28)){ctx.fillStyle='#ff9a90';ctx.fillRect(235,216,4,4)}
 $('pageInfo').textContent='Page '+(page+1)+' / '+pages;$('pageBack').disabled=page===0;$('pageNext').disabled=page===pages-1;
}
function navigate(d){if(!filtered.length)return;const i=filtered.findIndex(e=>e.id===selected?.id);showEntry(filtered[(i+d+filtered.length)%filtered.length]);const el=Array.from($('list').children).find(x=>x.dataset.id===selected.id);el?.scrollIntoView({block:'nearest'})}
function wrapText(){if(!selected||selected.kind!=='text')return;const n=Math.max(8,Math.min(28,parseInt($('columns').value)||18));const input=$('editor').value;const prefix=input.match(/^(?:\{(?:P:)?[0-9A-Fa-f]{2}\})+/)?.[0]||'';const paras=input.slice(prefix.length).split('\n');const output=[];
 for(const para of paras){const words=para.split(/ +/);let line='';for(const w of words){if(line&&line.length+1+w.length>n){output.push(line);line=w}else line+=(line?' ':'')+w}output.push(line)}$('editor').value=prefix+output.join('\n');edited();
}
$('openRom').onclick=$('start').onclick=()=>$('romFile').click();$('openProject').onclick=$('resume').onclick=()=>$('projectFile').click();
$('romFile').onchange=()=>action(async()=>{const f=$('romFile').files[0];$('romFile').value='';if(!f)return;const d=await FF7.loadROM(new Uint8Array(await f.arrayBuffer()),MANIFEST);await useDoc(d,f.name)});
$('projectFile').onchange=()=>action(async()=>{const f=$('projectFile').files[0];$('projectFile').value='';if(!f)return;if(f.size>6000000)throw new Error('Projet trop volumineux.');const d=await FF7.openProject(JSON.parse(await f.text()),MANIFEST);await useDoc(d,f.name,false);localDraft();toast('Projet chargé : '+doc.edits.size+' modification(s).')});
$('search').oninput=()=>{clearTimeout(renderList.timer);renderList.timer=setTimeout(renderList,120)};$('category').onchange=$('onlyChanged').onchange=renderList;$('editor').oninput=edited;
$('undo').onclick=()=>{doc.edits.delete(selected.id);$('editor').value=selected.original;dirty=true;refreshEditor();renderList();localDraft()};$('wrap').onclick=wrapText;$('previous').onclick=()=>navigate(-1);$('next').onclick=()=>navigate(1);
$('columns').oninput=$('lines').oninput=()=>refreshEditor();$('pageBack').onclick=()=>{page--;renderPreview()};$('pageNext').onclick=()=>{page++;renderPreview()};
$('saveProject').onclick=()=>action(()=>{if(!doc)return;jsonDownload(filename+'.ff7fr',FF7.project(doc,filename));dirty=false;toast('Projet enregistré avec '+doc.edits.size+' modification(s).')});
$('catalog').onclick=()=>action(()=>{jsonDownload(filename+'_textes.json',FF7.exportCatalog(doc));toast('Textes extraits dans le catalogue JSON.')});$('importCatalog').onclick=()=>$('catalogFile').click();
$('catalogFile').onchange=()=>action(async()=>{const f=$('catalogFile').files[0];$('catalogFile').value='';if(!f)return;if(f.size>10000000)throw new Error('Catalogue trop volumineux.');FF7.importCatalog(doc,JSON.parse(await f.text()));dirty=true;renderList();showEntry(selected);localDraft();toast('Catalogue importé : '+doc.edits.size+' modification(s).')});
$('export').onclick=()=>action(async()=>{const out=FF7.build(doc);const resultHash=await FF7.hash(out.rom);const info={version:'0.1',profile:MANIFEST.profile,baseSHA256:doc.hash,resultSHA256:resultHash,size:out.rom.length,modifiedEntries:out.count,changedBytes:out.changed,edits:Array.from(doc.edits,([id,text])=>({id,text}))};
 const readme='FF7 NES French Editor — export\n\nOuvrir FF7_FR.nes dans FCEUX.\nLe patch FF7_FR.ips s’applique uniquement à la ROM de départ.\nSHA-256 de départ : '+doc.hash+'\nSHA-256 du résultat : '+resultHash+'\n'+out.count+' entrée(s) modifiée(s), '+out.changed+' octet(s) changé(s).\nTaille : '+out.rom.length+' octets.\n\nTester les scènes modifiées en jeu. Les états .fcs restaurent aussi les anciens graphismes.\n';
 const pack=FF7.zip([{name:'FF7_FR.nes',data:out.rom},{name:'FF7_FR.ips',data:out.ips},{name:'BILAN.json',data:FF7.utf8(JSON.stringify(info,null,2))},{name:'LISEZ_MOI.txt',data:FF7.utf8(readme)}]);
 download(filename+'_export.zip',pack,'application/zip');toast('ROM exportée : '+out.count+' entrée(s), '+out.changed+' octet(s) changé(s).')});
$('png').onclick=()=>$('preview').toBlob(blob=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=selected.id+'_apercu.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)},'image/png');
$('help').onclick=()=>$('guide').showModal();$('closeGuide').onclick=()=>$('guide').close();
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&doc){e.preventDefault();$('saveProject').click()}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
// The same entry points are available to the automated integration tests.
window.ff7App={getDocument:()=>doc,getSelected:()=>selected,useDoc,showEntry,renderList,refreshEditor};

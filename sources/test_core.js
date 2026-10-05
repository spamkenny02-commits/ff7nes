'use strict';const fs=require('fs'),assert=require('assert');
const C=require('./core.js'),M=JSON.parse(fs.readFileSync(__dirname+'/manifest.json')),ROM=new Uint8Array(fs.readFileSync(fs.existsSync(__dirname+'/ff7_v22_base.nes')?__dirname+'/ff7_v22_base.nes':__dirname+'/../ff7_v22_base.nes'));
(async()=>{
 const doc=await C.loadROM(ROM,M);assert.equal(doc.entries.length,2913);assert.deepEqual(C.build(doc).rom,ROM);
 let round=0;for(const e of doc.entries.filter(e=>e.kind==='text')){
  const bs=C.encode(e.original),span=ROM.slice(e.offset,e.end);const padded=new Uint8Array(span.length).fill(32);padded.set(bs);
  assert.deepEqual(padded,span,'Round trip '+e.id);round++;
 }
 const e=doc.entries.find(e=>e.category==='Dialogues'&&!e.locked&&e.original.includes('Kotch'));
 const text=e.original.replace('Kotch','Don  ');assert(C.evaluate(doc,e,text).ok);doc.edits.set(e.id,text);
 const out=C.build(doc);assert(out.changed>0);assert.equal(out.rom.length,ROM.length);assert.deepEqual(C.applyIPS(ROM,out.ips),out.rom);
 for(let i=0;i<ROM.length;i++)if(ROM[i]!==out.rom[i])assert(i>=e.offset&&i<e.end);
 assert(!C.evaluate(doc,e,'x'.repeat(e.end-e.offset+1)).ok);assert(!C.evaluate(doc,e,'漢').ok);assert(C.evaluate(doc,e,'élève').ok);
 const portrait=doc.entries.find(e=>e.original.startsWith('{P:'));assert(!C.evaluate(doc,portrait,portrait.original.replace(/^\{P:..\}/,'')).ok);
 const locked=doc.entries.find(e=>e.locked);assert(!C.evaluate(doc,locked,'test').ok);
 const damaged=ROM.slice();damaged[100]^=1;await assert.rejects(C.loadROM(damaged,M));
 const p=C.project(doc,'Essai');const restored=await C.openProject(p,M);assert.deepEqual(C.build(restored).rom,out.rom);
 const bad=JSON.parse(JSON.stringify(p));bad.edits[0].text='x'.repeat(3000);const badDraft=await C.openProject(bad,M);assert.throws(()=>C.build(badDraft));
 const cat=C.exportCatalog(doc);const d2=await C.loadROM(ROM,M);C.importCatalog(d2,cat);assert.deepEqual(C.build(d2).rom,out.rom);
 const reopened=await C.loadROM(out.rom,M);assert.equal(reopened.entries.find(x=>x.id===e.id).original,text);
 const graphic=doc.entries.find(e=>e.id==='Gcombat0');doc.edits.set(graphic.id,'FRAPPE');assert(C.evaluate(doc,graphic,'FRAPPE').ok);assert(!C.evaluate(doc,graphic,'INTERMINABLE').ok);
 const g=C.build(doc);assert.deepEqual(C.readGraphic(g.rom,graphic),C.graphicPixels('FRAPPE',graphic,ROM,M));assert.deepEqual(C.applyIPS(ROM,g.ips),g.rom);
 const again=await C.loadROM(g.rom,M);assert(again.entries.find(e=>e.id===graphic.id).custom);
 fs.writeFileSync(__dirname+'/../edited_test.nes',g.rom);fs.writeFileSync(__dirname+'/../edited_test.zip',C.zip([{name:'FF7_FR.nes',data:g.rom},{name:'FF7_FR.ips',data:g.ips}]));
 console.log(JSON.stringify({roundTrips:round,entries:doc.entries.length,dialogueTest:e.id,tests:'passed',editedROMHash:await C.hash(g.rom)},null,2));
})().catch(e=>{console.error(e);process.exit(1)});

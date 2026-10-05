const fs=require('fs'),path=require('path'),assert=require('assert');const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');const root=__dirname,appRoot=fs.existsSync(path.join(root,'FF7_NES_EDITOR.html'))?root:path.resolve(root,'..');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.FF7_TEST_BROWSER,headless:true,args:['--no-sandbox','--single-process','--no-zygote','--disable-gpu'],env:{...process.env,LD_LIBRARY_PATH:process.env.FF7_TEST_LIBS||process.env.LD_LIBRARY_PATH||''}});
 const ctx=await b.newContext({viewport:{width:1480,height:1000},acceptDownloads:true}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto('file://'+path.join(appRoot,'FF7_NES_EDITOR.html'));await p.locator('#romFile').setInputFiles(path.join(appRoot,'ff7_v22_base.nes'));await p.waitForFunction(()=>window.ff7App?.getDocument()?.entries.length===2913);
 await p.locator('#search').fill('Biggs:Waouh');await p.waitForTimeout(200);assert.equal(await p.locator('#list .row').count(),1);await p.locator('#list .row').click();
 const original=await p.locator('#editor').inputValue();assert(original.includes('Waouh'));await p.locator('#editor').fill(original.replace('Waouh','Salut'));assert.equal(await p.locator('#export').isDisabled(),false);assert((await p.locator('#status').innerText()).includes('octets'));
 const before=await p.locator('#preview').screenshot();await p.screenshot({path:path.resolve(root,'../EDITOR_SCREENSHOT.png'),fullPage:true});
 const projectDownload=p.waitForEvent('download');await p.locator('#saveProject').click();const project=await projectDownload;await project.saveAs(path.resolve(root,'../ui_test.ff7fr'));
 const exportDownload=p.waitForEvent('download');await p.locator('#export').click();const exported=await exportDownload;await exported.saveAs(path.resolve(root,'../ui_export.zip'));
 // Overflow blocks ROM export while preserving a recoverable project draft.
 await p.locator('#editor').fill('{P:38}'+'X'.repeat(3000));assert(await p.locator('#export').isDisabled());assert((await p.locator('#status').innerText()).includes('trop long'));
 await p.locator('#editor').fill('{P:');assert(await p.locator('#export').isDisabled());await p.locator('#editor').fill(original.replace('Waouh','Salut'));
 await p.locator('#projectFile').setInputFiles(path.resolve(root,'../ui_test.ff7fr'));await p.waitForFunction(()=>document.getElementById('romInfo').textContent.includes('.ff7fr'));assert.equal(await p.evaluate(()=>ff7App.getDocument().edits.size),1);assert((await p.locator('#editor').inputValue()).includes('Salut'));
 const catDown=p.waitForEvent('download');await p.locator('#catalog').click();const cat=await catDown;await cat.saveAs(path.resolve(root,'../ui_catalog.json'));const catalog=JSON.parse(fs.readFileSync(path.resolve(root,'../ui_catalog.json')));assert.equal(catalog.entries.length,2913);
 await p.locator('#catalogFile').setInputFiles(path.resolve(root,'../ui_catalog.json'));await p.waitForTimeout(200);
 await p.locator('#category').selectOption('Menus graphiques');await p.locator('#search').fill('combat0');await p.waitForTimeout(200);await p.locator('#list .row').click();await p.locator('#editor').fill('FRAPPE');assert(!await p.locator('#export').isDisabled());
 const after=await p.locator('#preview').screenshot();assert(!before.equals(after));await p.screenshot({path:path.resolve(root,'../EDITOR_MENU_SCREENSHOT.png'),fullPage:true});
 await p.locator('#search').fill('continuer');await p.waitForTimeout(200);await p.locator('#list .row').click();assert(await p.locator('#editor').isDisabled());
 await p.locator('#help').click();assert(await p.locator('#guide').isVisible());await p.locator('#closeGuide').click();
 await p.setViewportSize({width:1000,height:850});await p.screenshot({path:path.resolve(root,'../EDITOR_SMALL_SCREENSHOT.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:'Chromium',UI:'passed',pageErrors:errors,downloadedProject:true,downloadedROMAndIPS:true,overflowBlocked:true,protectedEntries:true},null,2));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

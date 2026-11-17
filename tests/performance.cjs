'use strict'
const {_electron:electron}=require('@playwright/test')
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const {spawn}=require('node:child_process'),{performance}=require('node:perf_hooks')
const root=path.resolve(__dirname,'..'),data=process.env.PERF_DATA_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tangtang-performance-'))
if(path.dirname(path.resolve(data))!==path.resolve(os.tmpdir())||!path.basename(data).startsWith('tangtang-performance-'))throw new Error('Performance data must be an isolated tangtang-performance-* temporary directory')
const output=path.join(root,'test-results','performance.json'),db=path.join(data,'development-db','tangtang.sqlite')
const env={...process.env,TANGTANG_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;delete env.TANGTANG_DEV_URL
let app
const report={passed:false,dataset:{orders:100000,items:1000000,fields:8},measurements:{},memory:[],caveats:['Real built Electron UI with native SQLite; no mocked backend.','UI phase run after print stress completed, with no other planned heavy tasks.','OS file cache is warm from seeding; measurements include actual user event to rendered DOM, not physical display scanout.','App working set is sampled across getAppMetrics processes; sums can double-count shared pages and are not continuous peaks.']}
function stats(values){const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,medianMs:+((sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2).toFixed(2),p95Ms:+sorted[Math.ceil(sorted.length*.95)-1].toFixed(2),maxMs:+sorted[sorted.length-1].toFixed(2),samplesMs:values.map(v=>+v.toFixed(2))}}
function seed(){return new Promise((resolve,reject)=>{const child=spawn(require('electron'),[path.join(root,'tools','benchmark.cjs')],{cwd:root,env:{...env,ELECTRON_RUN_AS_NODE:'1',BENCH_ORDERS:'100000',BENCH_KEEP_PATH:db},windowsHide:true});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error('Seeding exceeded 120 seconds'))},120000);child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code)reject(new Error(stderr||'Seed failed'));else{report.seed=JSON.parse(stdout);resolve()}})})}
async function memory(label){const processes=await app.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,pid:p.pid,workingSetKiB:p.memory.workingSetSize})));report.memory.push({label,totalWorkingSetMiB:+(processes.reduce((sum,p)=>sum+p.workingSetKiB,0)/1024).toFixed(2),processes})}
async function main(){
 if(process.env.PERF_DATA_DIR){assert.ok(fs.existsSync(db));report.seed={reusedTemporaryDatabase:db}}else await seed()
 const started=performance.now();app=await electron.launch({args:[root],cwd:root,env,timeout:120000})
 const page=await app.firstWindow();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.locator('.calculator-content .input-panel h2').waitFor()
 report.measurements.launchToCalculatorMs=+(performance.now()-started).toFixed(2)
 assert.equal((await page.evaluate(()=>window.tangtang.getStatus())).ready,true)
 await page.evaluate(()=>{document.addEventListener('click',()=>window.__perfClick=performance.now(),true);document.addEventListener('input',()=>window.__perfInput=performance.now(),true)})
 // Inline polling avoids Playwright waitForFunction's internal eval under strict CSP.
 const ready=async id=>page.evaluate(expected=>new Promise((resolve,reject)=>{const start=performance.now();function check(){if(document.querySelectorAll('.summary-item').length===100&&document.querySelector('.summary-item b')?.textContent===expected&&document.querySelector('.history-detail .document-number')?.textContent.includes(expected)&&document.querySelectorAll('.history-detail .document-line').length>0)resolve(true);else if(performance.now()-start>120000)reject(new Error('History render timeout'));else requestAnimationFrame(check)}check()}),id)
 await page.getByRole('button',{name:'历史记录',exact:false}).click();await ready('000000099999')
 report.measurements.historyFirstRenderMs=await page.evaluate(()=>performance.now()-window.__perfClick)
 await memory('history-first')
 const pages=[],clickWall=[];let maxSummaries=0,maxDetailRows=0
 for(let i=0;i<20;i++){
   const before=await page.locator('.summary-item b').first().innerText(),start=performance.now()
   await page.locator('.history-list .el-pagination .btn-next').click()
   const expected=String(99999-100*(i+1)).padStart(12,'0');await ready(expected)
   pages.push(await page.evaluate(()=>performance.now()-window.__perfClick));clickWall.push(performance.now()-start)
   assert.notEqual(await page.locator('.summary-item b').first().innerText(),before)
   maxSummaries=Math.max(maxSummaries,await page.locator('.summary-item').count());maxDetailRows=Math.max(maxDetailRows,await page.locator('.history-detail .document-line').count())
 }
 report.measurements.nextPageEventToRender=stats(pages);report.measurements.nextPageAutomationWall=stats(clickWall)
 assert.equal(maxSummaries,100);assert.equal(maxDetailRows,10)
 report.renderBounds={maxSummaries,maxDetailRows,selectedOrderRows:10}
 await memory('after-20-pages')
 report.measurements.lastPageBridge=await page.evaluate(async()=>{const start=performance.now(),result=await window.tangtang.listOrders({page:1000,pageSize:100,search:''});return {ms:performance.now()-start,returned:result.items.length,total:result.total,first:result.items[0].orderId}})
 assert.equal(report.measurements.lastPageBridge.first,'000000000099')
 const input=page.getByLabel('搜索订单')
 await input.fill('客');await ready('000000099999')
 report.measurements.commonSearchIncludingDebounceMs=await page.evaluate(()=>performance.now()-window.__perfInput)
 assert.equal((await page.locator('.history-tools .count').innerText()).trim(),'100000')
 await input.fill('不存在的客户');await page.getByText('没有匹配的订单',{exact:true}).waitFor()
 report.measurements.noHitIncludingDebounceMs=await page.evaluate(()=>performance.now()-window.__perfInput)
 assert.equal(await page.locator('.summary-item').count(),0)
 assert.equal((await page.locator('.history-tools .count').innerText()).trim(),'0')
 // Start a real expensive search, then type while its DB worker is still searching.
 const responsiveness=[]
 await input.fill('首轮不存在')
 for(let i=0;i<20;i++){
   await page.waitForTimeout(330)
   const value='不存在的客户'+i;await input.fill(value)
   const sample=await page.evaluate(expected=>new Promise(resolve=>requestAnimationFrame(()=>resolve({ms:performance.now()-window.__perfInput,value:document.querySelector('.history-tools input').value===expected}))),value)
   assert.equal(sample.value,true);responsiveness.push(sample.ms)
 }
 await page.waitForTimeout(350)
 await page.getByText('没有匹配的订单',{exact:true}).waitFor()
 report.measurements.inputToNextFrameDuringSearch=stats(responsiveness)
 await memory('after-searches')
 report.runtime=await app.evaluate(()=>process.versions)
 assert.deepEqual(errors,[]);report.pageErrors=errors
 report.targets={firstHistoryBelow1500ms:report.measurements.historyFirstRenderMs<1500,nextPageP95Below300ms:report.measurements.nextPageEventToRender.p95Ms<300,searchIncludingDebounceBelow1500ms:Math.max(report.measurements.commonSearchIncludingDebounceMs,report.measurements.noHitIncludingDebounceMs)<1500,inputP95Below100ms:report.measurements.inputToNextFrameDuringSearch.p95Ms<100}
 report.passed=true
}
main().catch(error=>{report.error=error.stack;process.exitCode=1}).finally(async()=>{
 if(app)await app.close().catch(error=>{report.closeError=error.message;process.exitCode=1})
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2))
 const resolved=path.resolve(data),temporary=path.resolve(os.tmpdir())
 if(report.passed&&path.dirname(resolved)===temporary&&path.basename(resolved).startsWith('tangtang-performance-'))fs.rmSync(resolved,{recursive:true,force:true})
 else console.error('Retained test data:',data)
 console.log(JSON.stringify({output,passed:report.passed,targets:report.targets,error:report.error}))
})

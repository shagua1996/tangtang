'use strict'
const fs=require('fs'),os=require('os'),path=require('path')
const {performance}=require('perf_hooks')
const {Repository}=require('../desktop/database.cjs')
const count=Number(process.env.BENCH_ORDERS||100000)
if(!Number.isSafeInteger(count)||count<1)throw new Error('BENCH_ORDERS must be a positive integer')
const keepPath=process.env.BENCH_KEEP_PATH
if(keepPath&&(!path.isAbsolute(keepPath)||fs.existsSync(keepPath)))throw new Error('BENCH_KEEP_PATH must be an absolute path that does not exist')
const dir=keepPath?path.dirname(keepPath):fs.mkdtempSync(path.join(os.tmpdir(),'tangtang-benchmark-'))
fs.mkdirSync(dir,{recursive:true})
const dbPath=keepPath||path.join(dir,'benchmark.sqlite')
let repo
const timings=[]
let peakRss=process.memoryUsage().rss
const round=value=>Number(value.toFixed(2))
function measure(name,fn){
  const elapsed=[],returned=[],totals=[]
  for(let i=0;i<20;i++){
    const start=performance.now(),result=fn()
    elapsed.push(performance.now()-start);returned.push(result.items.length);totals.push(result.total)
    peakRss=Math.max(peakRss,process.memoryUsage().rss)
  }
  const sorted=[...elapsed].sort((a,b)=>a-b)
  timings.push({name,samples:20,medianMs:round((sorted[9]+sorted[10])/2),p95Ms:round(sorted[18]),maxMs:round(sorted[19]),returnedMin:Math.min(...returned),returnedMax:Math.max(...returned),totalMin:Math.min(...totals),totalMax:Math.max(...totals),samplesMs:elapsed.map(round)})
}
try {
  repo=new Repository(dbPath)
  const start=performance.now()
  const seed=repo.db.transaction((first,last)=>{for(let i=first;i<last;i++)repo.createOrder({orderId:String(i).padStart(12,'0'),createAt:1700000000000+i,orderForm:{no:String(i).padStart(12,'0'),dealerName:'经销商'+i%100,call:'13800138000',dealerAddress:'上海市经销地址',clientName:i%10?'常见客户':'其他客户',clientAddress:'上海市客户地址',deliveryDate:new Date(1700000000000+i),orderNote:'按订单尺寸生产'},totalPrice:1230,sizeList:Array.from({length:10},(_,j)=>({createDate:1700000000000+i*10+j,holeSize:'900*2100*160',doorSize:'820*2060',woodSize:{hengFang:'760*4',shufang:'1930*2'},coverSize:{widthOne:'100*827*1',widthTwo:'100*2063*2',heightOne:950,heightTwo:2135},singlePrice:123,number:1,price:123}))})})
  for(let i=0;i<count;i+=1000){seed(i,Math.min(count,i+1000));peakRss=Math.max(peakRss,process.memoryUsage().rss)}
  const seedMs=performance.now()-start
  repo.close();repo=new Repository(dbPath,{readonly:true})
  measure('empty-first',()=>repo.listOrders({page:1}))
  measure('empty-last',()=>repo.listOrders({page:Math.ceil(count/100)}))
  measure('common-single-char',()=>repo.listOrders({search:'客',page:1}))
  measure('common-last',()=>repo.listOrders({search:'客',page:Math.ceil(count/100)}))
  measure('no-hit',()=>repo.listOrders({search:'不存在的客户'}))
  measure('items',()=>repo.listOrderItems({orderId:'000000000000',limit:500}))
  console.log(JSON.stringify({orders:count,items:count*10,orderFormFields:8,seedMs:Math.round(seedMs),timings,peakSampledRssMiB:round(peakRss/1048576),memoryMiB:Object.fromEntries(Object.entries(process.memoryUsage()).map(([k,v])=>[k,round(v/1048576)])),memoryCaveat:'RSS sampled after each seed batch and query; not a continuous peak measurement. Includes this Node process only, not renderer/main/other workers.',timingCaveat:'Repository query and count only; excludes IPC/rendering. SQLite connection reopened after seeding; OS cache not cleared. P95 uses nearest rank of 20 samples.',dbMiB:round(fs.statSync(dbPath).size/1048576),retainedDatabase:keepPath||null,runtime:process.versions},null,2))
}finally{if(repo)repo.close();if(!keepPath)fs.rmSync(dir,{recursive:true,force:true})}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import http from 'node:http';
const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
const start=source.indexOf("const aiParser = express.json(");
const end=source.indexOf('// ============================================================================',start);
assert.ok(start>0&&end>start,'Production parser extraction boundary exists');
const parserSource=source.slice(start,end);
function appFactory(){
 const app=express();const logs=[];
 vm.runInNewContext(parserSource,{express,app,SyntaxError,console:{error:(...args)=>logs.push(args)}});
 app.post('/api/ai/fixture',(_req,res)=>res.json({ok:true}));app.post('/api/rezept/fixture',(_req,res)=>res.json({ok:true}));app.post('/api/normal',(_req,res)=>res.json({ok:true}));
 app.use((err,_req,res,_next)=>{logs.push(String(err));res.status(err.status || 500).json({leaked:true});});return {app,logs};
}
async function send(app,path,payload){
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{return await new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(payload)}},res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));});req.on('error',reject);req.end(payload);
 });}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('Production scoped parser returns fixed 400 for malformed AI and recipe JSON with zero downstream logs',async()=>{
 for(const path of ['/api/ai/fixture','/api/rezept/fixture']) {
  const {app,logs}=appFactory();const res=await send(app,path,'{"broken":"PATIENT_SENTINEL');assert.equal(res.status,400);assert.equal(res.body.error,'Ungültiges Datenformat');assert.equal(logs.length,0);assert.ok(!JSON.stringify(res).includes('PATIENT_SENTINEL'));
 }
});
test('Production scoped parser returns fixed 413 for oversized AI and recipe bodies',async()=>{
 for(const path of ['/api/ai/fixture','/api/rezept/fixture']) {
  const {app,logs}=appFactory();const res=await send(app,path,JSON.stringify({data:'PATIENT_SENTINEL'+'x'.repeat(16*1024*1024)}));assert.equal(res.status,413);assert.equal(res.body.error,'Datenmenge zu groß');assert.equal(logs.length,0);
 }
});
test('Production parser accepts normal valid requests and preserves non-AI smaller body limit',async()=>{
 const {app}=appFactory();assert.equal((await send(app,'/api/ai/fixture','{}')).status,200);
 const res=await send(app,'/api/normal',JSON.stringify({data:'x'.repeat(300*1024)}));assert.equal(res.status,413); // downstream app handler owns non-AI parser errors
});
test('Actual OCR upload handler stays closed before binary decode or storage, barcode routes remain',async()=>{
 const {app,logs}=appFactory();const start=source.indexOf("app.post('/api/rezept/upload'");const end=source.indexOf("app.post('/api/rezept/confirm'",start);
 const routeSource=source.slice(start,end);assert.ok(!routeSource.includes('Buffer.from'));assert.ok(!routeSource.includes('.storage'));assert.ok(source.includes("app.post('/api/rezept/save'"));
 vm.runInNewContext(routeSource,{app,requireAuthAI:(_req,_res,next)=>next()});
 const res=await send(app,'/api/rezept/upload',JSON.stringify({image_base64:'PATIENT_SENTINEL'}));assert.equal(res.status,503);assert.equal(res.body.code,'AI_OCR_DISABLED');assert.equal(logs.length,0);assert.ok(!JSON.stringify(res).includes('PATIENT_SENTINEL'));
});

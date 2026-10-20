import {z} from "zod";
import {describe,it,expect} from "vitest";
import {loadEnvConfig,processEnv} from "@next/env";
import {readFileSync,existsSync} from "node:fs";
import {mkdir,writeFile,unlink} from "node:fs/promises";
import {runPipeline} from "../src/lib/diagnostic/pipeline";
import {createStageCall,createUsage} from "../src/lib/diagnostic/client";
import {qualityCases} from "./quality-cases";
import {solutionPolicyErrors,publicSolutionContent,calculationControl} from "../src/lib/diagnostic/solution-policy";
import {diagnosisSchema} from "../src/lib/diagnostic/schemas";
import {evaluateQuality} from "./quality-evaluator";
const enabled=process.env.RGS_LIVE==="1";
if(enabled){loadEnvConfig(process.cwd());if(existsSync(".env.local"))processEnv([{path:".env.local",contents:readFileSync(".env.local","utf8"),env:{}}],process.cwd(),undefined,true);}
// Diagnóstico opt-in do provedor: somente códigos e headers de limite, nunca mensagens ou requisições.
if(enabled && process.env.RGS_CAPTURE_RATE==="1"){
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(...args)=>{
  const response=await originalFetch(...args);
  if(response.status===429){
   const body=await response.clone().json().catch(()=>({}));
   const safe=(v:unknown)=>typeof v==="string" && /^[a-z0-9_.-]{1,90}$/i.test(v)?v:null;
   const rate={status:429,code:safe(body.error?.code),type:safe(body.error?.type),retryAfter:response.headers.get("retry-after"),remainingTokens:response.headers.get("x-ratelimit-remaining-tokens"),resetTokens:response.headers.get("x-ratelimit-reset-tokens")};
   await mkdir(resultsDir,{recursive:true});
   await writeFile("tests/results-refinamento/LIMITE-PROVEDOR.json",JSON.stringify(rate,null,2));
  }
  return response;
 };
}
const resultsDir=process.env.RGS_RESULTS_DIR||"tests/results-refinamento";
const selected=(process.env.RGS_LIVE_CASES||"Atendimento,Financeiro,Marketing,Vendas,RH,Operacoes").split(",");
describe.skipIf(!enabled)("avaliação semântica real, opt-in com chave",()=>{
 for(const sample of qualityCases.filter(s=>selected.includes(s.id)))it(sample.id,async()=>{
  expect(Boolean(process.env.OPENAI_API_KEY),"É necessária chave configurada.").toBe(true);
  const started=Date.now();let calls=0;
  const usage=createUsage();const call=createStageCall(AbortSignal.timeout(270000),usage);
  try{
   const result=await runPipeline(async(...args)=>{calls++;return call(...args);},sample.input);
   const evaluation=evaluateQuality(sample,result);
   await mkdir(resultsDir,{recursive:true});
   await writeFile(resultsDir+"/"+sample.id+".json",JSON.stringify({caso:sample.id,modelos:{analise:process.env.OPENAI_ANALYSIS_MODEL||process.env.OPENAI_MODEL,auditoria:process.env.OPENAI_AUDIT_MODEL||process.env.OPENAI_MODEL},chamadas:calls,duracaoMs:Date.now()-started,tokens:usage,saida:result,avaliacao:evaluation},null,2));
   if(evaluation.length)throw Object.assign(new Error("quality_evaluation_failed"),{evaluation});
   await unlink(resultsDir+"/"+sample.id+"-failure.json").catch(()=>{});
  }catch(e){
   const message=typeof e==="object" && e!==null && "message" in e && typeof e.message==="string"?e.message:"";
   const reason=e instanceof z.ZodError?"schema_"+e.issues.map(i=>i.code+"_"+i.path.join("_")).join("_").slice(0,200):/^(stage_|invalid_|missing_|candidate_|unsupported_|quality_|ungrounded_facts)/.test(message)?message.replace(/[^A-Za-z0-9_]/g,"_").slice(0,240):"provider_or_validation_failure";
   await mkdir(resultsDir,{recursive:true});
   await writeFile(resultsDir+"/"+sample.id+"-failure.json",JSON.stringify({caso:sample.id,chamadas:calls,duracaoMs:Date.now()-started,tokens:usage,status:"O caso não passou na validação final do teste.",codigo:reason,avaliacao:typeof e==="object" && e!==null && "evaluation" in e?e.evaluation:[]}));
   throw new Error(reason);
  }
 },300000);
});
describe.skipIf(process.env.RGS_RECHECK_RESULTS!=="1")("revalidação das seis saídas reais salvas",()=>{
 const ids=["Atendimento","Financeiro","Marketing","Vendas","RH","Operacoes"];
 for(const id of ids)it(id,()=>{
  const sample=qualityCases.find(s=>s.id===id)!;
  const report=JSON.parse(readFileSync("tests/results-refinamento/"+id+".json","utf8"));
  expect(report.saida.needs_clarification).toBe(false);
  diagnosisSchema.parse(report.saida.diagnostico);
  expect(evaluateQuality(sample,report.saida)).toEqual([]);
 });
 it("valida a geração financeira real pela rota HTTP",()=>{
  const response=JSON.parse(readFileSync("tests/results-refinamento/Financeiro-rota.json","utf8").replace(/^\uFEFF/,""));
  expect(response.needs_clarification).toBe(false);
  const d=diagnosisSchema.parse(response.diagnostico);
  expect(solutionPolicyErrors(publicSolutionContent(d))).toEqual([]);
  expect(d.funcionamento.some(s=>s.includes(calculationControl))).toBe(true);
  expect(["Análise de dados","Apoio à decisão","Detecção de padrões / anomalias"]).toContain(d.familias.principal);
 });
 it("produz recomendações distintas entre áreas",()=>{
  const outputs=ids.map(id=>JSON.parse(readFileSync("tests/results-refinamento/"+id+".json","utf8")).saida.diagnostico);
  expect(new Set(outputs.map(d=>d.familias.principal)).size).toBeGreaterThanOrEqual(5);
  expect(new Set(outputs.map(d=>d.recomendacao.texto)).size).toBe(6);
 });
});

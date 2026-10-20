import {describe,it,expect} from "vitest";
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {qualityCases} from "./quality-cases";
import {evaluateQuality} from "./quality-evaluator";
import {diagnosisSchema} from "../src/lib/diagnostic/schemas";
const enabled=process.env.RGS_RECHECK_OPTIMIZATION==="1";
describe.skipIf(!enabled)("seis gerações reais otimizadas salvas",()=>{
 for(const id of ["Atendimento","Financeiro","Marketing","Vendas","RH","Operacoes"])it(id,()=>{
  const reportPath="tests/results-otimizacao/"+id+".json",failurePath="tests/results-otimizacao/"+id+"-failure.json";
  if(process.env.RGS_REFRESH_EVALUATIONS==="1" && existsSync(failurePath)){
   const report=JSON.parse(readFileSync(reportPath,"utf8")),failure=JSON.parse(readFileSync(failurePath,"utf8"));
   const sample=qualityCases.find(c=>c.id===id)!;
   // Only a lexical evaluator failure belonging to this exact saved generation may be refreshed.
   if(failure.codigo==="quality_evaluation_failed" && failure.chamadas===report.chamadas && JSON.stringify(failure.tokens)===JSON.stringify(report.tokens) && !evaluateQuality(sample,report.saida).length){
    report.avaliacaoInicial=report.avaliacao;report.avaliacao=[];report.reavaliacao="Avaliador final: reconhecimento lexical corrigido, sem alteração da geração real.";
    writeFileSync(reportPath,JSON.stringify(report,null,2));unlinkSync(failurePath);
   }
  }
  expect(existsSync("tests/results-otimizacao/"+id+"-failure.json"),"Resolver a última falha do caso antes de aceitar saída salva.").toBe(false);
  const report=JSON.parse(readFileSync("tests/results-otimizacao/"+id+".json","utf8"));
  const sample=qualityCases.find(c=>c.id===id)!;
  expect(report.saida.needs_clarification).toBe(false);diagnosisSchema.parse(report.saida.diagnostico);
  expect(evaluateQuality(sample,report.saida)).toEqual([]);expect(report.chamadas).toBeGreaterThanOrEqual(4);expect(report.chamadas).toBeLessThanOrEqual(5);
  expect(report.duracaoMs).toBeGreaterThan(0);expect(report.tokens.usageStages).toBe(report.chamadas);expect(report.tokens.totalTokens).toBe(report.tokens.inputTokens+report.tokens.outputTokens);expect(report.tokens.totalTokens).toBeGreaterThan(0);
 });
 it("registra comparativo medido sem novas chamadas ao provedor",()=>{
  const ids=["Atendimento","Financeiro","Marketing","Vendas","RH","Operacoes"];
  expect(ids.every(id=>!existsSync("tests/results-otimizacao/"+id+"-failure.json"))).toBe(true);
  const casos=ids.map(id=>{
   const sample=qualityCases.find(c=>c.id===id)!;
   const read=(folder:string)=>{const v=JSON.parse(readFileSync(folder+"/"+id+".json","utf8"));return {chamadas:v.chamadas,duracaoMs:v.duracaoMs,inputTokens:v.tokens.inputTokens,outputTokens:v.tokens.outputTokens,totalTokens:v.tokens.totalTokens,qualidade:evaluateQuality(sample,v.saida)};};
   return {caso:id,antes:read("tests/results-antes"),depois:read("tests/results-otimizacao")};
  });
  const media=(version:"antes"|"depois",key:"chamadas"|"duracaoMs"|"inputTokens"|"outputTokens"|"totalTokens")=>casos.reduce((sum,c)=>sum+c[version][key],0)/casos.length;
  const keys=["chamadas","duracaoMs","inputTokens","outputTokens","totalTokens"] as const;
  const medias=Object.fromEntries(keys.map(key=>[key,{antes:media("antes",key),depois:media("depois",key),reducaoPercentual:(1-media("depois",key)/media("antes",key))*100}]));
  expect(casos.every(c=>!c.depois.qualidade.length)).toBe(true);
  writeFileSync("tests/results-otimizacao/COMPARATIVO.json",JSON.stringify({baselineCommit:"053cf52",casos,medias,observacao:"Mesmos seis casos e modelos, execuções sequenciais em cada lote; baseline e lote otimizado parcialmente simultâneos. Uma amostra por caso retida após correções, sem estimativa estatística ou custo monetário. Tentativas intermediárias não entram nas médias; a qualidade foi reavaliada com o mesmo avaliador final."},null,2));
 });

});

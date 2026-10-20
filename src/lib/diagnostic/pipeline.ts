import {needsBasicFacts,basicQuestions} from "./input-readiness";
import type {FormInput} from "../form";
import type {StageCall} from "./client";
import type {Completion,Sources,Question} from "./schemas";
import {analyzeProcess,solutionsSelection} from "./consolidated";
import {reviseDiagnosis} from "./revise-diagnosis";
import {finalDiagnosis} from "./final-diagnosis";
import {qualityGate,validateQuestions} from "./quality-gate";
import {reviewClarificationsDetailed} from "./clarification-gate";
export const initialDirection="Com base no que você informou, já é possível identificar uma direção inicial. Alguns pontos ainda precisam ser validados antes de dimensionar a implementação.";
export async function runPipeline(call:StageCall,input:FormInput,additional:Sources={},perguntasContexto:Sources={}):Promise<Completion> {
 if(needsBasicFacts(input,additional))return {needs_clarification:true,perguntas:basicQuestions};
 const fontes:Sources=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,Array.isArray(v)?v.join("; "):v]));
 Object.assign(fontes,additional);
 const lacunasNaoBloqueantes:string[]=[];
 function record(questions:Question[]){
  if(!questions.length)return;
  for(const line of [initialDirection,...questions.map(q=>"Ponto ainda a validar: "+q.pergunta)])if(!lacunasNaoBloqueantes.includes(line))lacunasNaoBloqueantes.push(line);
 }
 async function review(questions:Question[],correcoes:string[]=[]){
  const checked=await reviewClarificationsDetailed(call,fontes,questions,perguntasContexto,correcoes);
  record(questions.filter(q=>!checked.criticalQuestions.some(n=>n.id===q.id)));
  return checked;
 }
 async function critical(questions:Question[]){return (await review(questions)).criticalQuestions;}

 const unknown=/^(não sei|não tenho|não se aplica|não consigo informar)\b/i;
 for(const [key,answer] of Object.entries(additional))if(unknown.test(answer.trim())){
  record([{id:"q1",pergunta:perguntasContexto[key]||"Detalhamento adicional não informado; validar no piloto.",mudaRecomendacao:"Avaliar junto aos fatos originais, sem reprovação automática."}]);
 }
 const analyzed=await analyzeProcess(call,fontes,perguntasContexto);
 let fatos=analyzed.fatos;let aderencia=analyzed.aderencia;
 validateQuestions(aderencia.needs_clarification,aderencia.perguntas);
 if(aderencia.needs_clarification){
  const needed=await critical(aderencia.perguntas);
  if(needed.length)return {needs_clarification:true,perguntas:needed};
  aderencia={...aderencia,needs_clarification:false,perguntas:[]};
 }
 if(!aderencia.familiasAvaliadas.some(f=>f.aderencia!=="Baixa")){
  const reassessed=await analyzeProcess(call,fontes,perguntasContexto);
  fatos=reassessed.fatos;aderencia=reassessed.aderencia;
  validateQuestions(aderencia.needs_clarification,aderencia.perguntas);
  if(aderencia.needs_clarification){const needed=await critical(aderencia.perguntas);if(needed.length)return {needs_clarification:true,perguntas:needed};}
 }
 if(!aderencia.familiasAvaliadas.some(f=>f.aderencia!=="Baixa")){
  const needed=await critical(basicQuestions);
  if(needed.length)return {needs_clarification:true,perguntas:needed};
  throw new Error("quality_gate_no_supported_opportunity");
 }
 const solutions=await solutionsSelection(call,fatos,aderencia);
 const candidatos=solutions.candidatos;let selecao=solutions.selecao;
 validateQuestions(selecao.needs_clarification,selecao.perguntas);
 if(selecao.needs_clarification){
  const needed=await critical(selecao.perguntas);
  if(needed.length)return {needs_clarification:true,perguntas:needed};
  selecao={...selecao,needs_clarification:false,perguntas:[]};
 }
 const context={fontes,perguntasContexto,fatos,aderencia,candidatos,selecao,lacunasNaoBloqueantes};
 const draft=await finalDiagnosis(call,context);
 const gate=await qualityGate(call,context,draft);let allowUnchanged=false;
 if(gate.approved)return {needs_clarification:false,diagnostico:draft};
 if(gate.audit.status==="NEEDS_CLARIFICATION"){
  const checked=await review(gate.audit.perguntas,gate.audit.correcoes);
  if(checked.criticalQuestions.length)return {needs_clarification:true,perguntas:checked.criticalQuestions};
  allowUnchanged=checked.correctionsOnlyContext && !gate.errors.length && Object.entries(gate.audit.verificacoes).every(([k,v])=>v.ok || k==="bloqueioDimensionamento");
  // Additional caveats were checked independently. Submit the actual augmented draft to the revision auditor.
  draft.validacoes=[...new Set([...lacunasNaoBloqueantes,...draft.validacoes])].slice(0,15);
 }
 const findings=[...gate.errors,...gate.audit.correcoes,...Object.entries(gate.audit.verificacoes).filter(([,v])=>!v.ok).map(([k,v])=>k+": "+v.observacao)];
 if(gate.audit.status==="NEEDS_CLARIFICATION")findings.push("Não bloquear por dimensionamento; registrar lacunas e avaliar direção com ressalvas.");
 const revised=await reviseDiagnosis(call,context,draft,findings,allowUnchanged);
 return {needs_clarification:false,diagnostico:revised};
}

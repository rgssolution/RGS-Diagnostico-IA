import {needsBasicFacts,basicQuestions} from "./input-readiness";
import type {FormInput} from "../form";
import type {StageCall} from "./client";
import type {Completion,Sources,Question} from "./schemas";
import {extractFacts} from "./extract-facts";
import {assessAiFit} from "./assess-ai-fit";
import {generateCandidates} from "./generate-candidates";
import {selectSolution} from "./select-solution";
import {finalDiagnosis} from "./final-diagnosis";
import {qualityGate,validateQuestions,isApproved} from "./quality-gate";
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
 const fatos=await extractFacts(call,fontes,perguntasContexto);
 let aderencia=await assessAiFit(call,fatos);
 validateQuestions(aderencia.needs_clarification,aderencia.perguntas);
 if(aderencia.needs_clarification){
  const needed=await critical(aderencia.perguntas);
  if(needed.length)return {needs_clarification:true,perguntas:needed};
  aderencia={...aderencia,needs_clarification:false,perguntas:[]};
 }
 if(!aderencia.familiasAvaliadas.some(f=>f.aderencia!=="Baixa")){
  // Reavaliar a capacidade já sustentada antes de exigir mais dados ou exemplos de decisão.
  aderencia=await assessAiFit(call,fatos,["Reavalie usando os fatos existentes. Falta de exemplo de decisão, volume, custo ou profundidade não elimina a oportunidade de análise/interpretação. Identifique uma direção útil com ressalvas quando houver suporte, sem inventar IA."]);
  validateQuestions(aderencia.needs_clarification,aderencia.perguntas);
  if(aderencia.needs_clarification){const needed=await critical(aderencia.perguntas);if(needed.length)return {needs_clarification:true,perguntas:needed};}
  if(!aderencia.familiasAvaliadas.some(f=>f.aderencia!=="Baixa")){
   const needed=await critical(basicQuestions);
   if(needed.length)return {needs_clarification:true,perguntas:needed};
   throw new Error("quality_gate_no_supported_opportunity");
  }
  aderencia={...aderencia,needs_clarification:false,perguntas:[]};
 }
 let candidatos=await generateCandidates(call,fatos,aderencia);
 let selecao=await selectSolution(call,fatos,aderencia,candidatos);
 validateQuestions(selecao.needs_clarification,selecao.perguntas);
 if(selecao.needs_clarification){
  const needed=await critical(selecao.perguntas);
  if(needed.length)return {needs_clarification:true,perguntas:needed};
  selecao={...selecao,needs_clarification:false,perguntas:[]};
 }
 const context={fontes,perguntasContexto,fatos,aderencia,candidatos,selecao,lacunasNaoBloqueantes};
 let draft=await finalDiagnosis(call,context);
 let evaluation:string[]=[];
 for(let attempt=0;attempt<2;attempt++){
  const gate=await qualityGate(call,context,draft);
  if(gate.audit.status==="NEEDS_CLARIFICATION"){
   const checked=await review(gate.audit.perguntas,gate.audit.correcoes);
   const needed=checked.criticalQuestions;
   if(needed.length)return {needs_clarification:true,perguntas:needed};
   // A revisão independente invalidou somente o pedido de contexto; nenhum outro defeito pode ser ignorado.
   const onlyQuestions=!gate.errors.length && checked.correctionsOnlyContext && Object.entries(gate.audit.verificacoes).every(([key,v])=>v.ok || key==="bloqueioDimensionamento");
   if(attempt>0 && onlyQuestions && lacunasNaoBloqueantes.every(g=>draft.validacoes.includes(g))){
    gate.audit.status="APPROVED";gate.audit.perguntas=[];gate.audit.correcoes=[];
    gate.audit.verificacoes.bloqueioDimensionamento={ok:true,observacao:"Perguntas auditadas como não bloqueantes; lacunas já registradas no conteúdo reavaliado."};
    if(isApproved(gate.audit,gate.errors))return {needs_clarification:false,diagnostico:draft};
   }
   gate.audit.status="REVISE";gate.audit.perguntas=[];
   gate.audit.correcoes.push("O pedido de esclarecimento não muda a natureza da solução. Continue com a direção inicial e as lacunas em validacoes; não bloquear por dimensionamento ou falta de exemplo contextual.");
  }
  evaluation=[...gate.errors,...gate.audit.correcoes,...Object.entries(gate.audit.verificacoes).filter(([,v])=>!v.ok).map(([key,v])=>key+": "+v.observacao)];
  if(gate.approved)return {needs_clarification:false,diagnostico:draft};
  if(attempt===0){
   const findings=[...gate.errors,...gate.audit.correcoes,...Object.values(gate.audit.verificacoes).filter(v=>!v.ok).map(v=>v.observacao)];
   candidatos=await generateCandidates(call,fatos,aderencia,findings);
   selecao=await selectSolution(call,fatos,aderencia,candidatos);
   validateQuestions(selecao.needs_clarification,selecao.perguntas);
   if(selecao.needs_clarification){
    const needed=await critical(selecao.perguntas);
    if(needed.length)return {needs_clarification:true,perguntas:needed};
    selecao={...selecao,needs_clarification:false,perguntas:[]};
   }
   context.candidatos=candidatos;context.selecao=selecao;
   draft=await finalDiagnosis(call,context,findings.length?findings:["Reavalie a especificidade e a cadeia de evidências."],draft);
  }
 }
 throw Object.assign(new Error("quality_gate_rejected"),{evaluation});
}

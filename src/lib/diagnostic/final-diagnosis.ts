import {recommendationPlanSchema,workflowPlanSchema,measurementPlanSchema,recommendationText,measurementText} from "./precision-plan";
import {z} from "zod";
import {diagnosisSchema,text,family,displayFamily,type Facts,type Fit,type Candidates,type Selection,type Sources,type Diagnosis} from "./schemas";
import {calculationControl} from "./solution-policy";
import {FINAL} from "./prompts";
import type {StageCall} from "./client";
export type Context={fontes:Sources;perguntasContexto?:Sources;fatos:Facts;aderencia:Fit;candidatos:Candidates;selecao:Selection;lacunasNaoBloqueantes?:string[]};
export async function finalDiagnosis(call:StageCall,context:Context,correcoes:string[]=[],anterior:Diagnosis|null=null) {
 const ids=context.fatos.evidencias.map(e=>e.id) as [string,...string[]];
 const prose=Object.values(context.fontes).some(v=>/\d/.test(v))?text:text.regex(/^[^0-9]*$/);
 const list=z.array(prose).max(15);
 const metric=measurementPlanSchema;
 const schema=diagnosisSchema.extend({
  operacao:z.object({fatos:list}).strict(),
  oportunidade:diagnosisSchema.shape.oportunidade.extend({parteProcesso:prose,capacidadeNecessaria:prose,beneficioPotencial:prose}),
  familias:z.object({principal:family,complementares:z.array(family).max(2),justificativa:prose}).strict(),
  solucoes:z.array(diagnosisSchema.shape.solucoes.element.extend({solucao:prose,observacao:prose,familias:z.array(family).min(1).max(3)})).min(2).max(3),
  recomendacao:recommendationPlanSchema.extend({candidatoId:z.literal(context.selecao.candidatoId)}),
  funcionamento:workflowPlanSchema.extend({validacaoEstrutural:context.fatos.exigeCalculoExato?prose:prose.nullable(),deterministica:context.fatos.exigeCalculoExato?prose:prose.nullable()}),preRequisitos:z.array(prose).min(1).max(15),validacoes:list,
  gargalos:z.array(z.object({problema:prose,consequencia:prose,evidenciaId:z.enum(ids)}).strict()).min(1).max(3),
  metricas:z.object({principal:metric.extend({finalidade:z.literal("Resultado do negócio")}),secundarias:z.array(metric.extend({gargaloIndice:z.number().int().min(0).max(2)})).max(2)}).strict()
 });
 const raw=await call("final_diagnosis",schema,FINAL,{...context,correcoes,anterior});
 const gargalos=raw.gargalos.map(g=>({problema:g.problema,consequencia:g.consequencia,evidencia:context.fatos.evidencias.find(e=>e.id===g.evidenciaId)!.trecho}));
 const solucoes=raw.solucoes.map(s=>{
  const c=context.candidatos.candidatos.find(c=>c.id===s.id);
  return c?{...s,solucao:c.solucao,problema:c.problema,capacidadeIA:c.capacidadeIA,familias:(c.id===context.selecao.candidatoId?[raw.familias.principal,...raw.familias.complementares]:s.familias).map(displayFamily),impactoPotencial:c.impactoPotencial,esforco:c.esforco}:s;
 });
 const metricas={
  principal:{nome:raw.metricas.principal.nome,comoMedir:measurementText(raw.metricas.principal),gargalo:gargalos[0].problema},
  secundarias:raw.metricas.secundarias.map(m=>{
   if(!gargalos[m.gargaloIndice])throw new Error("invalid_metric_reference");
   return {nome:m.nome,comoMedir:measurementText(m),gargalo:gargalos[m.gargaloIndice].problema};
  })
 };
 const chosen=context.candidatos.candidatos.find(c=>c.id===raw.recomendacao.candidatoId);
 if(!chosen)throw new Error("invalid_recommendation");
 const plan=raw.funcionamento;
 const funcionamento=[plan.entrada,plan.validacaoEstrutural,plan.deterministica?(context.fatos.exigeCalculoExato?plan.deterministica+" "+calculationControl:plan.deterministica):null,plan.inteligencia,plan.entrega,chosen.escopoInicial.consultaEssencial?plan.consultaLinguagemNatural:null,plan.validacaoHumana].filter((v):v is string=>v!==null);
 const recomendacao={candidatoId:chosen.id,texto:recommendationText(chosen.solucao,raw.recomendacao,chosen.escopoInicial)};
 const operacao={resumo:context.fatos.processo,fatos:raw.operacao.fatos,workflow:context.fatos.workflowAtual};
 const lacunas=context.lacunasNaoBloqueantes||[];
 const validacoes=[...new Set([...lacunas,...raw.validacoes])].slice(0,15);
 const familias={...raw.familias,principal:displayFamily(raw.familias.principal),complementares:raw.familias.complementares.map(displayFamily)};
 return diagnosisSchema.parse({...raw,familias,validacoes,operacao,gargalos,solucoes,metricas,funcionamento,recomendacao});
}

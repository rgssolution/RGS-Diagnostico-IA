import {z} from "zod";
import {factsSchema,fitSchema,dimensions,families,family,text,selectionSchema,type Facts,type Fit,type Sources} from "./schemas";
import {criticalCalculations} from "./solution-policy";
import {validateFacts} from "./extract-facts";
import {assessAiFit} from "./assess-ai-fit";
import {solutionSchema,validateCandidates,groundedConsultation} from "./generate-candidates";
import {selectSolution} from "./select-solution";
import {ANALYZE,SOLUTIONS} from "./prompts";
import type {StageCall} from "./client";
export const compactFitSchema=fitSchema.omit({dimensoes:true,familiasAvaliadas:true}).extend({
 dimensoes:z.array(z.object({dimensao:z.enum(dimensions),classificacao:z.enum(["forte","moderada","fraca"]),evidencias:z.array(text).min(1).max(4),justificativa:text.max(160)}).strict()).max(15),
 familiasAvaliadas:z.array(z.object({familia:family,aderencia:z.enum(["Média","Alta"]),evidencias:z.array(text).min(1).max(4),justificativa:text.max(160)}).strict()).max(20)
}).strict();
export const processSchema=z.object({fatos:factsSchema.omit({evidencias:true}),aderencia:compactFitSchema}).strict();
export function compactFit(f:Fit){return {...f,dimensoes:Object.entries(f.dimensoes).filter(([,v])=>v.classificacao!=="não evidenciada").map(([dimensao,v])=>({dimensao,...v})),familiasAvaliadas:f.familiasAvaliadas.filter(f=>f.aderencia!=="Baixa")};}
export function analysisContext(fatos:Facts,aderencia:Fit){
 const {evidencias,...resumo}=fatos;
 return {fatos:resumo,evidencias,aderencia:compactFit(aderencia)};
}
export async function analyzeProcess(call:StageCall,fontes:Sources,perguntasContexto:Sources){
 const evidencias:Facts["evidencias"]=[];
 for(const [campo,value] of Object.entries(fontes))for(let offset=0;offset<value.length;offset+=1400)evidencias.push({id:"F"+(evidencias.length+1),campo,trecho:value.slice(offset,offset+1400)});
 const ref=z.enum(evidencias.map(e=>e.id) as [string,...string[]]);
 const refs=z.array(ref).min(1).max(4);
 const fitForSources=compactFitSchema.extend({
  dimensoes:z.array(compactFitSchema.shape.dimensoes.element.extend({evidencias:refs})).max(15),
  familiasAvaliadas:z.array(compactFitSchema.shape.familiasAvaliadas.element.extend({evidencias:refs})).max(20),
  consultaLinguagemNatural:groundedConsultation(ref)
 });
 const raw=await call("analyze_process",processSchema.extend({aderencia:fitForSources}),ANALYZE,{evidencias,perguntasContexto,dimensoes:dimensions,familias:families});
 const fatos=factsSchema.parse({...raw.fatos,evidencias,exigeCalculoExato:raw.fatos.exigeCalculoExato || criticalCalculations(fontes)});
 validateFacts(fatos,fontes);
 if(new Set(raw.aderencia.dimensoes.map(d=>d.dimensao)).size!==raw.aderencia.dimensoes.length || new Set(raw.aderencia.familiasAvaliadas.map(f=>f.familia)).size!==raw.aderencia.familiasAvaliadas.length)throw new Error("duplicate_assessment");
 const expanded={...raw.aderencia,
  dimensoes:Object.fromEntries(dimensions.map(d=>{const entry=raw.aderencia.dimensoes.find(v=>v.dimensao===d);return [d,entry?{classificacao:entry.classificacao,evidencias:entry.evidencias,justificativa:entry.justificativa}:{classificacao:"não evidenciada",evidencias:[],justificativa:"Sem evidência nas fontes."}];})),
  familiasAvaliadas:Object.fromEntries(families.map(f=>{const entry=raw.aderencia.familiasAvaliadas.find(v=>v.familia===f);return [f,entry?{aderencia:entry.aderencia,evidencias:entry.evidencias,justificativa:entry.justificativa}:{aderencia:"Baixa",evidencias:[],justificativa:"Sem aderência sustentada nas fontes."}];}))};
 // Reuse the evidence checks; this adapter is purely local and never invokes the provider.
 const aderencia=await assessAiFit(async(_stage,schema)=>schema.parse(expanded),fatos);
 return {fatos,aderencia};
}
export async function solutionsSelection(call:StageCall,fatos:Facts,aderencia:Fit){
 const schema=z.object({candidatos:solutionSchema(fatos,aderencia).shape.candidatos,selecao:selectionSchema}).strict();
 const raw=await call("solutions_selection",schema,SOLUTIONS,{analysisContext:analysisContext(fatos,aderencia)});
 const candidatos={candidatos:raw.candidatos};validateCandidates(candidatos,fatos,aderencia);
 const selecao=await selectSolution(async(_stage,s)=>s.parse(raw.selecao),fatos,aderencia,candidatos);
 return {candidatos,selecao};
}

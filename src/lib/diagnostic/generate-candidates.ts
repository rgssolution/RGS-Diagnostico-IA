import {z} from "zod";
import {candidatesSchema,candidateSchema,text,type Facts,type Fit,type Candidates} from "./schemas";
import {CANDIDATES} from "./prompts";
import type {StageCall} from "./client";
export function validateCandidates(data:Candidates,facts:Facts,fit:Fit) {
 const ids=new Set(data.candidatos.map(c=>c.id)),known=new Set(facts.evidencias.map(e=>e.id));
 if(ids.size!==data.candidatos.length)throw new Error("duplicate_candidates");
 for(const c of data.candidatos){
  if(!c.evidencias.length || c.evidencias.some(id=>!known.has(id)))throw new Error("candidate_evidence");
  const query=c.engenharia.consultaLinguagemNatural;
  if(query.evidencias.some(id=>!known.has(id)) || (query.adequada && (!query.evidencias.length || !query.usoProposto)))throw new Error("candidate_consultation_evidence");
  if(c.escopoInicial.consultaEssencial && !query.adequada)throw new Error("candidate_consultation_scope");
  if(!c.familias.length)throw new Error("candidate_type");
  if(new Set(c.familias).size!==c.familias.length)throw new Error("duplicate_family");
  if(c.familias.some(f=>!fit.familiasAvaliadas.some(a=>a.familia===f && a.aderencia!=="Baixa")))throw new Error("unsupported_candidate_family");
 }
}
export async function generateCandidates(call:StageCall,fatos:Facts,aderencia:Fit,correcoes:string[]=[]) {
 const supported=aderencia.familiasAvaliadas.filter(a=>a.aderencia!=="Baixa").map(a=>a.familia);
 const ref=z.enum(fatos.evidencias.map(e=>e.id) as [string,...string[]]);
 const prose=fatos.evidencias.some(e=>/\d/.test(e.trecho))?text:text.regex(/^[^0-9]*$/);
 const list=z.array(prose).max(15);
 const base=candidateSchema.extend({
  evidencias:z.array(ref).min(1).max(20),solucao:prose.max(110),problema:prose,coberturaDaDor:prose,justificativaImpacto:prose,
  dependencias:list,risco:prose,velocidadeDeTeste:prose,dadosDisponiveis:prose,facilidadeDeMedir:prose,integracao:prose,maturidade:prose
 });
 if(!supported.length)throw new Error("unsupported_ai_opportunity");
 const candidate=base.extend({tipo:z.literal("IA"),familias:z.array(z.enum(supported as [typeof supported[number],...typeof supported[number][]])).min(1).max(4),engenharia:candidateSchema.shape.engenharia.extend({calculosCriticos:z.literal(fatos.exigeCalculoExato?"Separados do modelo de linguagem":"Ausentes no escopo")})});
 const schema=candidatesSchema.extend({candidatos:z.array(candidate).min(2).max(4)});
 const data=await call("generate_candidates",schema,CANDIDATES,{fatos,aderencia,familiasSustentadas:supported,correcoes});
 validateCandidates(data,fatos,aderencia);return data;
}
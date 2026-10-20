import {z} from "zod";
import {fitSchema,dimensions,families,text,type Facts,type Fit} from "./schemas";
import {ASSESS} from "./prompts";
import type {StageCall} from "./client";
export function assessmentSchema(fatos:Facts) {
 const ids=fatos.evidencias.map(e=>e.id) as [string,...string[]];
 const ref=z.enum(ids);
 // Impor na geração a diferença entre sinal fraco comprovado e informação ausente.
 const dimension=z.union([
  z.object({classificacao:z.literal("não evidenciada"),evidencias:z.array(ref).max(0),justificativa:text}).strict(),
  z.object({classificacao:z.enum(["forte","moderada","fraca"]),evidencias:z.array(ref).min(1).max(20),justificativa:text}).strict()
 ]);
 const familyAssessment=z.union([
  z.object({aderencia:z.literal("Baixa"),evidencias:z.array(ref).max(20),justificativa:text}).strict(),
  z.object({aderencia:z.enum(["Média","Alta"]),evidencias:z.array(ref).min(1).max(20),justificativa:text}).strict()
 ]);
 const dimShape=Object.fromEntries(dimensions.map(d=>[d,dimension])) as Record<typeof dimensions[number],typeof dimension>;
 const familyShape=Object.fromEntries(families.map(f=>[f,familyAssessment])) as Record<typeof families[number],typeof familyAssessment>;
 const schema=fitSchema.extend({dimensoes:z.object(dimShape).strict(),familiasAvaliadas:z.object(familyShape).strict()});
 return schema;
}
export async function assessAiFit(call:StageCall,fatos:Facts,correcoes:string[]=[]) {
 const ids=fatos.evidencias.map(e=>e.id);
 const raw=await call("assess_ai_fit",assessmentSchema(fatos),ASSESS,{fatos,correcoes});
 const fit:Fit={...raw,familiasAvaliadas:families.map(familia=>({familia,...raw.familiasAvaliadas[familia]}))};
 const known=new Set(ids);
 if(fit.consultaLinguagemNatural.evidencias.some(id=>!known.has(id)) || (fit.consultaLinguagemNatural.adequada && (!fit.consultaLinguagemNatural.evidencias.length || !fit.consultaLinguagemNatural.usoProposto)))throw new Error("invalid_consultation_evidence");
 if(new Set(fit.familiasAvaliadas.map(f=>f.familia)).size!==families.length)throw new Error("missing_families");
 for(const d of dimensions){
  const entry=fit.dimensoes[d];
  if(entry.evidencias.some(id=>!known.has(id)))throw new Error("invalid_dimension_evidence_"+d+"_unknown_ref");
  if(entry.classificacao!=="não evidenciada" && !entry.evidencias.length)throw new Error("invalid_dimension_evidence_"+d+"_missing_ref");
  if(entry.classificacao==="não evidenciada" && entry.evidencias.length)throw new Error("invalid_dimension_evidence_"+d+"_unsupported_ref");
 }
 for(const f of fit.familiasAvaliadas)if(f.evidencias.some(id=>!known.has(id)) || (f.aderencia!=="Baixa" && !f.evidencias.length))throw new Error("invalid_family_evidence");
 return fit;
}
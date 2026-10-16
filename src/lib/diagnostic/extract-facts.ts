import {factsSchema,type Sources,type Facts} from "./schemas";
import {criticalCalculations} from "./solution-policy";
import {EXTRACT} from "./prompts";
import type {StageCall} from "./client";
export function validateFacts(facts:Facts,sources:Sources) {
 const ids=new Set(facts.evidencias.map(e=>e.id));
 if(ids.size!==facts.evidencias.length || facts.evidencias.some(e=>!sources[e.campo]?.includes(e.trecho)))throw new Error("ungrounded_facts");
}
export async function extractFacts(call:StageCall,fontes:Sources,perguntasContexto:Sources={}) {
 // Proveniência não depende da habilidade do modelo de copiar citações.
 const evidencias:Facts["evidencias"]=[];
 for(const [campo,value] of Object.entries(fontes)){
  for(let offset=0;offset<value.length;offset+=1400)evidencias.push({id:"F"+(evidencias.length+1),campo,trecho:value.slice(offset,offset+1400)});
 }
 const extracted=await call("extract_facts",factsSchema.omit({evidencias:true}),EXTRACT,{fontes,evidencias,perguntasContexto});
 const facts=factsSchema.parse({...extracted,evidencias,exigeCalculoExato:extracted.exigeCalculoExato || criticalCalculations(fontes)});
 validateFacts(facts,fontes);
 return facts;
}
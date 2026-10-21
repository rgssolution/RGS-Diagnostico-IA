import {calculationControl} from "./solution-policy";
import {z} from "zod";
import {diagnosisSchema,text,type Diagnosis} from "./schemas";
import {AUDIT} from "./prompts";
import {auditContext,compactAuditSchema,expandAudit,deterministicChecks,isApproved} from "./quality-gate";
import type {Context} from "./final-diagnosis";
import type {StageCall} from "./client";
// Only existing text may be corrected against original sources; candidate, family and literal evidence stay fixed.
export function editablePaths(d:Diagnosis){
 const paths:string[]=[];
 function visit(v:unknown,path:string){if(typeof v==="string")paths.push(path);else if(v && typeof v==="object")for(const [k,x] of Object.entries(v))visit(x,path?path+"."+k:k);}
 for(const key of ["operacao","oportunidade","funcionamento","preRequisitos","validacoes","metricas"] as const)visit(d[key],key);
 paths.push("recomendacao.texto","familias.justificativa");
 for(let i=0;i<d.gargalos.length;i++)paths.push(`gargalos.${i}.consequencia`);
 for(let i=0;i<d.solucoes.length;i++)paths.push(`solucoes.${i}.observacao`);
 return paths.filter(p=>!p.endsWith(".gargalo"));
}
export async function reviseDiagnosis(call:StageCall,context:Context,draft:Diagnosis,findings:string[],allowUnchanged=false){
 const paths=editablePaths(draft) as [string,...string[]];
 const sourceHasNumbers=Object.values(context.fontes).some(v=>/\d/.test(v));
 const prose=sourceHasNumbers?text:text.regex(/^[^0-9]*$/);
 const protectedPaths=draft.funcionamento.flatMap((line,i)=>line.includes(calculationControl)?["funcionamento."+i]:[]);
 const normalPaths=paths.filter(p=>!protectedPaths.includes(p)) as [string,...string[]];
 const normalPatch=z.object({campo:z.enum(normalPaths),valor:prose}).strict();
 const controlPattern=new RegExp(calculationControl.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
 // Uma única expressão preserva ambas as restrições sem gerar allOf incompatível com o SDK.
 const protectedProse=text.regex(sourceHasNumbers?controlPattern:new RegExp("^[^0-9]*"+controlPattern.source+"[^0-9]*$"));
 const patchSchema=protectedPaths.length?z.union([normalPatch,z.object({campo:z.enum(protectedPaths as [string,...string[]]),valor:protectedProse}).strict()]):normalPatch;
 const schema=z.object({alteracoes:z.array(patchSchema).max(12),auditoria:compactAuditSchema}).strict();
 const raw=await call("revise_diagnosis",schema,AUDIT+`
REVISOR AUDITOR INDEPENDENTE DO REDATOR. Você recebe o diagnóstico existente e os defeitos específicos. Corrija só campos necessários com valores diferentes dos atuais; omita patches idênticos. Não regenere candidatos, seleção ou diagnóstico. Preserve conteúdo correto. Não cite códigos F/C, sobrescritos ou caracteres invisíveis no texto público. Preserve literalmente a frase obrigatória de separação de regras/IA, inclusive ao corrigir a etapa que a contém. Não altere trechos corretos por preferência estilística. Os patches serão aplicados literalmente e constituem a resposta final exata que você deve avaliar novamente em TODOS os critérios. Audite o resultado dos patches, não a versão antiga, e certifique em auditoria; verificacoes são booleanos, motivos só em correcoes. Não declare APPROVED se não puder atestar integralmente a versão corrigida. Se o defeito exigir trocar solução, família, evidências ou arquitetura essencial fora dos campos editáveis, REVISE; jamais maquie uma escolha inadequada. Não invente fatos. Em operacao corrija apenas a descrição factual com as fontes originais: sem adicionar etapas futuras ou capacidades ainda não implantadas. Não transforme muitos em alto volume; qualificadores de volume só podem repetir literalmente os termos das fontes. Prefira descrição factual sem classificar. As lacunas não bloqueantes já estão em validacoes; preserve-as. Não produza novo pedido de dimensionamento.`,{...auditContext(context,draft),problemas:findings,camposEditaveis:paths});
 // Validate every patch before consolidation, including overwritten entries.
 const validated=schema.parse(raw);
 const patches=new Map<string,(typeof validated.alteracoes)[number]>();
 for(const patch of validated.alteracoes){patches.delete(patch.campo);patches.set(patch.campo,patch);}
 const revised=structuredClone(draft);
 let changes=0;
 for(const patch of patches.values()){
  const parts=patch.campo.split(".");let node:Record<string,unknown>=revised as unknown as Record<string,unknown>;
  for(const p of parts.slice(0,-1))node=node[p] as Record<string,unknown>;
  if(node[parts.at(-1)!]===patch.valor)continue;
  node[parts.at(-1)!]=patch.valor;changes++;
 }
 if(!changes && findings.length && !allowUnchanged)throw new Error("quality_gate_rejected");
 const result=diagnosisSchema.parse(revised);
 const audit=expandAudit(raw.auditoria),errors=deterministicChecks(result,context);
 // Nonblocking caveats and the server-controlled exact-calculation separator cannot disappear in a patch.
 if((context.lacunasNaoBloqueantes||[]).some(g=>!result.validacoes.includes(g)))errors.push("Lacunas não bloqueantes removidas.");
 if(!isApproved(audit,errors))throw Object.assign(new Error("quality_gate_rejected"),{evaluation:[...errors,...audit.correcoes]});
 return result;
}

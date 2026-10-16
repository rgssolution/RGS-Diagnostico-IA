import {solutionPolicyErrors,publicSolutionContent,unprovidedNumbers,calculationControl,precisionErrors,incrementalErrors} from "./solution-policy";
import {auditSchema,auditChecks,displayFamily,families,type Audit,type Diagnosis,type Question} from "./schemas";
import {AUDIT} from "./prompts";
import type {StageCall} from "./client";
import type {Context} from "./final-diagnosis";
export function validateQuestions(needs:boolean,questions:Question[]) {
 if(questions.length>2 || needs!==Boolean(questions.length) || new Set(questions.map(q=>q.id)).size!==questions.length)throw new Error("invalid_clarification");
}
export function deterministicChecks(d:Diagnosis,c:Context):string[] {
 const errors:string[]=[];
 const selected=c.candidatos.candidatos.find(x=>x.id===d.recomendacao.candidatoId);
 if(!selected)errors.push("Candidato recomendado inexistente.");
 const shown=d.solucoes.map(s=>s.id);
 if(new Set(shown).size!==shown.length || !shown.includes(d.recomendacao.candidatoId))errors.push("Alternativas duplicadas ou recomendação ausente.");
 for(const s of d.solucoes){
  const source=c.candidatos.candidatos.find(x=>x.id===s.id);
  if(!source || s.solucao!==source.solucao || s.problema!==source.problema || s.capacidadeIA!==source.capacidadeIA || s.impactoPotencial!==source.impactoPotencial || s.esforco!==source.esforco || s.familias.length>3 || new Set(s.familias).size!==s.familias.length || s.familias.some(f=>!source.familias.map(displayFamily).includes(f)))errors.push("Solução pública diverge da alternativa avaliada.");
 }
 if(selected){
  if(!d.solucoes.find(s=>s.id===selected.id)?.familias.includes(d.familias.principal))errors.push("Família principal ausente da solução exibida.");
  if(selected.engenharia.consultaLinguagemNatural.adequada && selected.escopoInicial.consultaEssencial && !d.funcionamento.some(s=>/linguagem natural|perguntas? sobre|consult(?:a|ar).*(?:dados|documentos|resultados)/i.test(s)))errors.push("Consulta analítica adequada não incorporada ao workflow.");
  if((!d.familias.principal || !selected.familias.map(displayFamily).includes(d.familias.principal)))errors.push("Família principal incompatível com candidato.");
  if(d.familias.complementares.length>2 || d.familias.complementares.some(f=>!selected.familias.map(displayFamily).includes(f) || f===d.familias.principal) || new Set(d.familias.complementares).size!==d.familias.complementares.length)errors.push("Famílias complementares incoerentes.");
 }
 if(!d.recomendacao.texto.startsWith("Com base no que você descreveu, a iniciativa com melhor relação entre impacto potencial e viabilidade é"))errors.push("Abertura da recomendação incorreta.");
 for(const g of d.gargalos)if(!Object.values(c.fontes).some(v=>v.includes(g.evidencia)))errors.push("Evidência de gargalo não encontrada nas fontes.");
 if(!d.gargalos.some(g=>g.problema===d.metricas.principal.gargalo))errors.push("Métrica principal não referencia um gargalo identificado.");
 for(const m of d.metricas.secundarias)if(!d.gargalos.some(g=>g.problema===m.gargalo))errors.push("Métrica secundária desconectada.");
 errors.push(...solutionPolicyErrors(publicSolutionContent(d)),...precisionErrors(d,c.fontes),...incrementalErrors(d,c.fontes));
 if(c.fatos.exigeCalculoExato && (!d.funcionamento.some(s=>s.includes(calculationControl)) || selected?.engenharia.calculosCriticos!=="Separados do modelo de linguagem"))errors.push("Cálculos críticos sem separação e conferência.");
 for(const n of unprovidedNumbers(d,c.fontes))errors.push("Número não informado nas fontes: "+n);
 return [...new Set(errors)];
}
export function isApproved(a:Audit,errors:string[]) {
 return a.status==="APPROVED" && auditChecks.every(k=>a.verificacoes[k].ok) && !a.correcoes.length && !a.perguntas.length && !errors.length;
}
export async function qualityGate(call:StageCall,context:Context,diagnostico:Diagnosis) {
 const errors=deterministicChecks(diagnostico,context);
 const audit=await call("quality_gate",auditSchema,AUDIT,{fontes:context.fontes,perguntasContexto:context.perguntasContexto,lacunasNaoBloqueantes:context.lacunasNaoBloqueantes,familiasDeExibicao:Object.fromEntries(families.map(f=>[f,displayFamily(f)])),candidatos:context.candidatos,diagnostico,errosDeterministicos:errors});
 validateQuestions(audit.status==="NEEDS_CLARIFICATION",audit.perguntas);
 return {audit,errors,approved:isApproved(audit,errors)};
}
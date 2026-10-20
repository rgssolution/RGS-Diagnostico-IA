import {displayFamily} from "../src/lib/diagnostic/schemas";
import {solutionPolicyErrors,publicSolutionContent,unprovidedNumbers,calculationControl,precisionErrors,incrementalErrors} from "../src/lib/diagnostic/solution-policy";
import type {Completion} from "../src/lib/diagnostic/schemas";
import type {QualityCase} from "./quality-cases";
export function evaluateQuality(sample:QualityCase,result:Completion):string[]{
 const errors:string[]=[];
 if(sample.clarify){
  if(!result.needs_clarification)errors.push("Deveria pedir esclarecimento.");
  else if(result.perguntas.length<1 || result.perguntas.length>2)errors.push("Quantidade de perguntas inválida.");
  return errors;
 }
 if(result.needs_clarification)return ["Pediu esclarecimento apesar de fatos suficientes para a natureza da oportunidade."];
 const d=result.diagnostico,chosen=[d.familias.principal,...d.familias.complementares].filter(Boolean);
 if(sample.expected.length && !sample.expected.some(f=>chosen.includes(displayFamily(f))))errors.push("Família esperada ausente.");
 if(!d.oportunidade.parteProcesso.trim() || !d.oportunidade.capacidadeNecessaria.trim() || !d.oportunidade.beneficioPotencial.trim() || d.funcionamento.length<3 || !d.preRequisitos.length || !d.gargalos.length)errors.push("Cadeia metodológica incompleta.");
 const recommended=d.solucoes.find(s=>s.id===d.recomendacao.candidatoId);
 if(!recommended || !recommended.familias.includes(d.familias.principal))errors.push("Família principal diverge da solução recomendada.");
 const intelligence=/interpret|an[aá]lis|analis|classific|recomend|previs|prever|estim|gera|s[ií]ntese|resum|sem[aâ]ntic|padr(?:ão|ões|ao|oes)|anomali|extra|compreend|explic|produz.*(?:imag|texto|conte[uú]do|v[ií]deo|[aá]udio)|busca.*(?:context|cat[aá]logo|font|informa)|adapt.*(?:resposta|context)|respostas?.*linguagem natural|consulta.*cat[aá]logo.*(?:pergunt|respost)|respond.*(?:linguagem natural|perguntas)|identifica.*(?:inten[cç]|negocia[cç]|exce[cç]|desvio|tend[eê]nc|textos?.chave)/i;
 if(!intelligence.test(d.oportunidade.capacidadeNecessaria) || d.solucoes.some(s=>!intelligence.test(s.capacidadeIA)))errors.push("Capacidade inteligente não descrita.");
 const relevance:Record<string,RegExp>={Atendimento:/d[uú]vid|atend|respost|cat[aá]logo/i,Financeiro:/varia|indicador|fechamento|desvio|financeir/i,Marketing:/rascunh|texto|imagem|conte[uú]do/i,Vendas:/lead|comercia|prior|cliente/i,RH:/curr[ií]culo|vaga|qualifica/i,Operacoes:/ocorr[eê]ncia|incidente|relato/i,Compras:/proposta|fornecedor|cota[cç][aã]o|compra/i,Documentos:/document|campo|extra[cç][aã]o|nota fiscal/i,Conhecimento:/busca|fonte|procedimento|pol[ií]tica/i,Anomalias:/anomali|transa[cç]|padr[aã]o|desvio/i,Previsao:/previs|demanda|estoque|reposi[cç]/i,Logistica:/estoque|ruptura|reposi[cç]|demanda/i,Multimodal:/texto|imagem|v[ií]deo|m[ií]dia/i};
 const proposed=[d.oportunidade.parteProcesso,d.oportunidade.capacidadeNecessaria,...d.funcionamento].join(" ");
 if(relevance[sample.id] && !relevance[sample.id].test(proposed))errors.push("Proposta sem contexto reconhecível do caso.");
 if(sample.query && !/linguagem natural|perguntas? sobre|consult(?:a|ar).*(?:dados|resultados)/i.test([...d.funcionamento,d.recomendacao.texto].join(" ")))errors.push("Consulta analítica complementar ausente.");
 if(sample.id==="Financeiro"){
  const intelligenceText=[recommended?.capacidadeIA,d.recomendacao.texto,...d.funcionamento].join(" ");
  for(const [label,pattern] of [["variações/anomalias",/anomali|desvio|varia[cç]/i],["tendências",/tend[eê]ncia|per[ií]odo|m[eê]s|meses/i],["síntese executiva",/s[ií]ntese|resum|executiv/i]] as const)if(!pattern.test(intelligenceText))errors.push("Capacidade financeira não explicada: "+label);
 }
 const considered=[...chosen,...d.solucoes.flatMap(s=>s.familias)];
 // Reconhecer todas as capacidades da dor não obriga escolhê-las juntas como a única primeira iniciativa.
 for(const f of sample.required||[])if(!considered.includes(displayFamily(f)))errors.push("Capacidade necessária ausente: "+f);
 if(sample.forbidden.some(f=>d.familias.principal===displayFamily(f)))errors.push("Família principal inadequada.");
 if(!sample.metric.test(d.metricas.principal.nome+" "+d.metricas.principal.comoMedir))errors.push("Métrica sem vínculo reconhecível com a dor.");
 if(!d.gargalos.some(g=>g.problema===d.metricas.principal.gargalo))errors.push("Métrica não referencia gargalo.");
 const sourceFields=Object.values(sample.input).map(v=>Array.isArray(v)?v.join("; "):v);

 for(const g of d.gargalos)if(!sourceFields.some(v=>v.includes(g.evidencia)))errors.push("Evidência inventada.");
 if(sample.human && !/human|recrutador|pessoa|analista|revis[aã]o/i.test([...d.funcionamento,...d.preRequisitos,d.recomendacao.texto].join(" ")))errors.push("Revisão humana ausente.");
 errors.push(...solutionPolicyErrors(publicSolutionContent(d)),...precisionErrors(d,Object.fromEntries(sourceFields.map((v,i)=>[String(i),v]))),...incrementalErrors(d,Object.fromEntries(sourceFields.map((v,i)=>[String(i),v]))));
 if(d.solucoes.some(s=>!s.familias.length || !s.capacidadeIA.trim() || !s.problema.trim()))errors.push("Alternativa sem capacidade de IA.");
 if(sample.exactMath && !d.funcionamento.some(s=>s.includes(calculationControl)))errors.push("Cálculos sem controle explícito.");
 if(unprovidedNumbers(d,Object.fromEntries(sourceFields.map((v,i)=>[String(i),v]))).length)errors.push("Número não fornecido.");
 return errors;
}
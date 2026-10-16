import {displayFamily} from "../src/lib/diagnostic/schemas";
import {calculationControl} from "../src/lib/diagnostic/solution-policy";
import {describe,it,expect} from "vitest";
import {qualityCases} from "./quality-cases";
import {evaluateQuality} from "./quality-evaluator";
import {fixture,question} from "./fixture";
import type {Completion,Diagnosis} from "../src/lib/diagnostic/schemas";
// Testes offline verificam o avaliador e bloqueios de regressão, não simulam prova de competência do modelo.
// Gerações semânticas reais usam os mesmos casos e o mesmo avaliador em live.test.ts.
describe("casos sintéticos globais: critérios comportamentais",()=>{
 for(const sample of qualityCases)it(sample.id+": aceita contrato coerente e detecta regressão",()=>{
  if(sample.clarify){
   expect(evaluateQuality(sample,{needs_clarification:true,perguntas:[question]})).toEqual([]);
   expect(evaluateQuality(sample,{needs_clarification:false,diagnostico:fixture})).not.toEqual([]);return;
  }
  const d:Diagnosis=structuredClone(fixture);
  d.familias={principal:displayFamily(sample.expected[0]),complementares:(sample.required||[]).filter(f=>f!==sample.expected[0]).map(displayFamily),justificativa:"Conexão com sinais fornecidos."};
  const proposedFamilies=[d.familias.principal,...d.familias.complementares];
  d.oportunidade={parteProcesso:sample.input.tempo,capacidadeNecessaria:"Interpretação e análise de contexto: "+sample.input.repeticoes,beneficioPotencial:sample.input.melhoria};
  d.solucoes=d.solucoes.map((s,i)=>({...s,solucao:"Assistente inteligente de "+sample.id+(i?" com revisão guiada":""),familias:proposedFamilies,problema:sample.input.tempo,capacidadeIA:"Interpretar informações para apoiar: "+sample.input.decisoes}));
  d.funcionamento=["Receber informações autorizadas do processo.","IA interpreta o contexto e apoia: "+sample.input.repeticoes,"Pessoa revisa as sugestões e encaminha exceções."];
  if(sample.query)d.funcionamento.push("Usuário consulta os resultados em linguagem natural, com fontes e limites de acesso.");
  if(sample.id==="Financeiro")d.funcionamento.push("Analisar variações e anomalias entre meses, identificar tendências e produzir síntese executiva para revisão.");
  if(sample.exactMath)d.funcionamento.splice(1,0,calculationControl);
  d.gargalos[0].evidencia=sample.input.processo;
  d.metricas.principal={nome:sample.input.tempo,comoMedir:"Comparar o tempo da atividade no mesmo período antes e depois.",gargalo:d.gargalos[0].problema};
  const result:Completion={needs_clarification:false,diagnostico:d};
  expect(evaluateQuality(sample,result)).toEqual([]);
  const wrong=structuredClone(d);
  wrong.familias={principal:"Geração de áudio",complementares:[],justificativa:"Sem conexão com a dor."};
  expect(evaluateQuality(sample,{needs_clarification:false,diagnostico:wrong})).not.toEqual([]);
  const invented=structuredClone(d);invented.recomendacao.texto+=" Ganho de 97%.";
  expect(evaluateQuality(sample,{needs_clarification:false,diagnostico:invented})).toContain("Número não fornecido.");
 });
});
it("distingue famílias necessárias entre áreas, sem catálogo único",()=>{
 const cases=["Atendimento","Financeiro","Marketing","Vendas","RH","Operacoes"].map(id=>qualityCases.find(c=>c.id===id)!);
 expect(new Set(cases.map(c=>c.expected.join("|"))).size).toBe(6);
 for(const c of cases)expect(evaluateQuality(c,{needs_clarification:false,diagnostico:fixture})).not.toEqual([]);
});

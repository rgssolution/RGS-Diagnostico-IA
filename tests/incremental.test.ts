import {stageResult} from "./fixture";
import {describe,it,expect} from "vitest";
import {diagnosisSchema,families,family,publicFamily,displayFamily} from "../src/lib/diagnostic/schemas";
import {incrementalErrors} from "../src/lib/diagnostic/solution-policy";
import {recommendationText} from "../src/lib/diagnostic/precision-plan";
import {isApproved} from "../src/lib/diagnostic/quality-gate";
import {runPipeline} from "../src/lib/diagnostic/pipeline";
import type {Stage,StageCall} from "../src/lib/diagnostic/client";
import {fixture,input,candidates,fit,fitForApi,stageValues,approved} from "./fixture";
function scripted(overrides:Partial<Record<Stage,unknown>>={}){
 const call:StageCall=async(stage,schema)=>schema.parse(stageResult(stage,overrides));return call;
}
describe("primeira implementação enxuta e linguagem de negócio",()=>{
 it("mantém vinte famílias internas e traduz rótulos técnicos na saída",()=>{
  expect(families).toHaveLength(20);expect(family.safeParse("Automação agentic").success).toBe(true);
  expect(displayFamily("Automação agentic")).toBe("Execução de tarefas com IA");
  expect(publicFamily.safeParse("Automação agentic").success).toBe(false);
  expect(displayFamily("Busca inteligente / RAG")).not.toContain("RAG");
 });
 it("limita a duas famílias complementares e três por alternativa",()=>{
  const d=structuredClone(fixture);d.familias.complementares=["Análise de dados","Personalização","Geração de texto"];
  expect(diagnosisSchema.safeParse(d).success).toBe(false);
  const s=structuredClone(fixture);s.solucoes[0].familias=["Análise de dados","Personalização","Geração de texto","Geração de imagem"];
  expect(diagnosisSchema.safeParse(s).success).toBe(false);
 });
 it("preserva capacidades internas sem exibir todas as famílias técnicas",async()=>{
  const internal=["Recomendação / scoring / next best action","Classificação / roteamento","Resumo / síntese","Análise de dados"] as const;
  const adjusted={...fit,familiasAvaliadas:fit.familiasAvaliadas.map(f=>({...f,aderencia:internal.some(x=>x===f.familia)?"Alta" as const:"Baixa" as const,evidencias:internal.some(x=>x===f.familia)?["F1"]:[]}))};
  const c={candidatos:candidates.candidatos.map(x=>({...x,familias:[...internal]}))};
  const raw={...stageValues.final_diagnosis,familias:{...stageValues.final_diagnosis.familias,complementares:["Classificação / roteamento","Resumo / síntese"]},solucoes:stageValues.final_diagnosis.solucoes.map(s=>({...s,familias:internal.slice(0,3)}))};
  const r=await runPipeline(scripted({assess_ai_fit:fitForApi(adjusted),generate_candidates:c,final_diagnosis:raw}),input);
  expect(r.needs_clarification).toBe(false);if(!r.needs_clarification){expect(r.diagnostico.familias.complementares).toHaveLength(2);expect(r.diagnostico.familias.complementares).not.toContain("Análise de dados");expect(r.diagnostico.solucoes[0].familias).toHaveLength(3);}
 });
 it("consulta útil e painel adicional ficam na evolução quando não essenciais",async()=>{
  const c={candidatos:candidates.candidatos.map(x=>({...x,escopoInicial:{...x.escopoInicial,evolucoes:["Painel analítico para acompanhar tendências.","Consultar os resultados em linguagem natural."],consultaEssencial:false},engenharia:{...x.engenharia,consultaLinguagemNatural:{adequada:true,motivo:"Pode aprofundar consultas depois da validação inicial.",evidencias:["F1"],usoProposto:"Consultar o histórico autorizado."}}}))};
  const raw={...stageValues.final_diagnosis,funcionamento:{...stageValues.final_diagnosis.funcionamento,consultaLinguagemNatural:"Consultar os resultados em linguagem natural."}};
  const r=await runPipeline(scripted({generate_candidates:c,final_diagnosis:raw}),input);expect(r.needs_clarification).toBe(false);
  if(!r.needs_clarification){expect(r.diagnostico.recomendacao.texto).toContain("Evolução possível após validação inicial:");expect(r.diagnostico.recomendacao.texto).toContain("Painel analítico");expect(r.diagnostico.funcionamento.join(" ")).not.toContain("Consultar os resultados");expect(r.diagnostico.funcionamento.join(" ")).not.toContain("Painel analítico");}
 });
 it("a composição não troca silenciosamente a solução escolhida por outra mais ampla",async()=>{
  await expect(runPipeline(scripted({final_diagnosis:{...stageValues.final_diagnosis,recomendacao:{...stageValues.final_diagnosis.recomendacao,candidatoId:"C2"}}}),input)).rejects.toThrow();
 });
 for(const label of ["alto volume","baixo volume","grande quantidade","pouca demanda"])
 it("rejeita "+label+" sem referência, mesmo com uma contagem isolada",()=>{
  const d=structuredClone(fixture);d.oportunidade.beneficioPotencial="Atender "+label+" de contatos.";
  expect(incrementalErrors(d,{processo:"A empresa informou 250 contatos por mês, sem comparação de capacidade."})).toContain("Classificação de volume sem referência nas fontes.");
 });
 it("aceita descrição factual ou classificação explicitamente relatada",()=>{
  const d=structuredClone(fixture);d.oportunidade.beneficioPotencial="Apoiar contatos recorrentes também fora do horário.";
  expect(incrementalErrors(d,{processo:"Contatos recorrentes também ocorrem fora do horário."})).toEqual([]);
  d.oportunidade.beneficioPotencial="Apoiar o alto volume relatado pela equipe.";
  expect(incrementalErrors(d,{processo:"A equipe relatou alto volume na operação."})).toEqual([]);
 });
 for(const term of ["automação agentic","pipeline","acervo","lógica estruturada","casos não estruturados","orquestração"])
 it("simplifica jargão público: "+term,()=>{const d=structuredClone(fixture);d.solucoes[0].observacao="Usa "+term+" na solução.";expect(incrementalErrors(d,{processo:input.processo})).toContain("Linguagem técnica desnecessária na proposta pública.");});
 for(const metric of ["Tokens por atendimento","Chamadas ao modelo","Latência do modelo","Respostas geradas pela IA"])
 it("não aceita atividade técnica como métrica principal: "+metric,()=>{const d=structuredClone(fixture);d.metricas.principal.nome=metric;expect(incrementalErrors(d,{processo:input.processo})).toContain("Métrica principal mede atividade da tecnologia, não resultado da dor.");});
 it("permite métricas técnicas secundárias sem substituir o resultado de negócio",()=>{const d=structuredClone(fixture);d.metricas.secundarias=[{...d.metricas.principal,nome:"Latência do modelo"}];expect(incrementalErrors(d,{processo:input.processo})).toEqual([]);});
 it("exige finalidade de negócio na métrica principal do plano",async()=>{const raw={...stageValues.final_diagnosis,metricas:{...stageValues.final_diagnosis.metricas,principal:{...stageValues.final_diagnosis.metricas.principal,finalidade:"Funcionamento da tecnologia"}}};await expect(runPipeline(scripted({final_diagnosis:raw}),input)).rejects.toThrow();});
 it("detecta repetição de justificativa entre seções, sem proibir termos curtos em comum",()=>{
  const d=structuredClone(fixture);const same="Interpretar necessidades comerciais em texto livre para orientar prioridades e permitir a revisão fundamentada pela equipe responsável.";
  d.oportunidade.capacidadeNecessaria=same;d.familias.justificativa=same;
  expect(incrementalErrors(d,{processo:input.processo})).toContain("Argumento repetido entre seções sem informação nova.");
  d.oportunidade.capacidadeNecessaria="Interpretar dados";d.familias.justificativa="Interpretar dados";expect(incrementalErrors(d,{processo:input.processo})).toEqual([]);
 });
 for(const check of ["escopoNecessario","alternativaEnxuta","metricaNegocio","volumeSustentado","linguagemEmpresario","semRedundancia"] as const)
 it("novo critério reprovado exige revisão: "+check,()=>{expect(isApproved({...approved,verificacoes:{...approved.verificacoes,[check]:{ok:false,observacao:"Revisar a proposta antes da entrega."}}},[])).toBe(false);});
 it("mantém a recomendação concisa mesmo com evolução e campos nos limites",()=>{
  const p={candidatoId:"C1",porQue:"a".repeat(160),valorIA:"b".repeat(160),arquiteturaDeterministica:"c".repeat(180),resultadoPotencial:"d".repeat(140)};
  const result=recommendationText("n".repeat(110),p,{descricao:"e".repeat(180),validacaoInicial:"Validar resultado.",evolucoes:["f".repeat(100),"g".repeat(100)],consultaEssencial:false});
  expect(result.length).toBeLessThanOrEqual(1600);
 });
});

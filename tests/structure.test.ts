import {stageResult} from "./fixture";
import {describe,it,expect} from "vitest";
import {candidateSchema,diagnosisSchema,families,auditChecks} from "../src/lib/diagnostic/schemas";
import {solutionPolicyErrors,publicSolutionContent,criticalCalculations,calculationControl} from "../src/lib/diagnostic/solution-policy";
import {deterministicChecks,isApproved} from "../src/lib/diagnostic/quality-gate";
import {runPipeline} from "../src/lib/diagnostic/pipeline";
import type {StageCall} from "../src/lib/diagnostic/client";
import {input,facts,fit,candidates,selection,fixture,stageValues,approved,fitForApi} from "./fixture";
const context={fontes:{processo:input.processo},fatos:facts,aderencia:fit,candidatos:candidates,selecao:selection};
describe("contrato global de oportunidades de IA",()=>{
 it("exige família e capacidade; não aceita tipo legado ou família nula",()=>{
  expect(candidateSchema.safeParse({...candidates.candidatos[0],tipo:"legado"}).success).toBe(false);
  expect(candidateSchema.safeParse({...candidates.candidatos[0],familias:[]}).success).toBe(false);
  expect(diagnosisSchema.safeParse({...fixture,familias:{...fixture.familias,principal:null}}).success).toBe(false);
  expect(candidateSchema.safeParse({...candidates.candidatos[0],capacidadeIA:""}).success).toBe(false);
 });
 it("cobre vinte famílias distintas e trinta e um critérios",()=>{expect(new Set(families).size).toBe(20);expect(new Set(auditChecks).size).toBe(31);});
 for(const tool of ["Make","n8n","Zapier","script","macro","Python","API","webhook","banco de dados","cron","ferramenta de orquestração"])
 it("bloqueia infraestrutura como recomendação: "+tool,()=>{expect(solutionPolicyErrors("Implantar "+tool)).not.toHaveLength(0);});
 it("preserva citações técnicas reais, mas bloqueia recomendá-las",()=>{
  const d=structuredClone(fixture);d.operacao.fatos=["Usamos API com Python."];d.gargalos[0].evidencia="Usamos API com Python.";
  expect(solutionPolicyErrors(publicSolutionContent(d))).toEqual([]);
  d.recomendacao.texto+=" Usar Python.";expect(solutionPolicyErrors(publicSolutionContent(d))).not.toHaveLength(0);
 });
 it("bloqueia IA só no nome pelo auditor semântico",()=>{expect(isApproved({...approved,verificacoes:{...approved.verificacoes,iaSubstantiva:{ok:false,observacao:"Só copia campos, sem interpretação."}}},[])).toBe(false);});
 it("pede contexto inteligente quando nenhuma família é sustentada",async()=>{
  const low={...fit,familiasAvaliadas:fit.familiasAvaliadas.map(f=>({...f,aderencia:"Baixa" as const,evidencias:[]}))};let count=0;
  const call:StageCall=async(stage,schema)=>{count++;return schema.parse(stageResult(stage,stage==="clarification_gate"?{clarification_gate:{revisoes:[...stageValues.clarification_gate.revisoes,{...stageValues.clarification_gate.revisoes[0],id:"q2"}]}}:{assess_ai_fit:fitForApi(low)}));};
  const result=await runPipeline(call,input);expect(count).toBe(3);expect(result.needs_clarification).toBe(true);expect(result).not.toHaveProperty("diagnostico");
 });
 it("detecta cálculo crítico e exige conferência antes da interpretação",()=>{
  expect(criticalCalculations({processo:"Calcular margens no fechamento financeiro."})).toBe(true);
  const c={...context,fatos:{...facts,exigeCalculoExato:true}};
  expect(deterministicChecks(fixture,c)).toContain("Cálculos críticos sem separação e conferência.");
  const d={...fixture,funcionamento:[...fixture.funcionamento,calculationControl]};
  const secured={...c,candidatos:{candidatos:candidates.candidatos.map(x=>({...x,engenharia:{...x.engenharia,calculosCriticos:"Separados do modelo de linguagem" as const}}))}};
  expect(deterministicChecks(d,secured)).toEqual([]);
 });
 it("insere a etapa conferida no conteúdo exato submetido ao auditor",async()=>{
  let audited=false;
  const call:StageCall=async(stage,schema,_prompt,data)=>{
   if(stage==="quality_gate"){
    const d=(data as {diagnostico:typeof fixture}).diagnostico;
    audited=d.funcionamento.some(s=>s.includes(calculationControl));
   }
   const v=stage==="solutions_selection"?{selecao:selection,candidatos:candidates.candidatos.map(c=>({...c,engenharia:{...c.engenharia,calculosCriticos:"Separados do modelo de linguagem"}}))}:stage==="final_diagnosis"?{...stageValues.final_diagnosis,funcionamento:{...stageValues.final_diagnosis.funcionamento,validacaoEstrutural:"Validar estrutura e consistência dos dados.",deterministica:"Calcular margens por regras conferidas."}}:stageResult(stage);
   return schema.parse(v);
  };
  const result=await runPipeline(call,{...input,processo:input.processo+" Também precisamos calcular margens."});
  expect(audited).toBe(true);expect(result.needs_clarification).toBe(false);
  if(!result.needs_clarification)expect(result.diagnostico.funcionamento.some(s=>s.includes(calculationControl))).toBe(true);
 });
 it("não exibe uma capacidade pública diferente da candidata avaliada",()=>{
  const d=structuredClone(fixture);d.solucoes[0].capacidadeIA="Copiar campos.";
  expect(deterministicChecks(d,context)).toContain("Solução pública diverge da alternativa avaliada.");
 });

 it("bloqueia artefatos invisíveis e referências internas sem bloquear ids estruturados",()=>{
  expect(solutionPolicyErrors(publicSolutionContent(fixture))).toEqual([]);
  for(const artifact of ["C¹","C1","C-2","texto"+"\u2060".repeat(50)])expect(solutionPolicyErrors("Recomendar "+artifact)).not.toHaveLength(0);
 });

});

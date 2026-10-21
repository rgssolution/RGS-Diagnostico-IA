import {describe,it,expect,vi} from "vitest";
import {reviseDiagnosis} from "../src/lib/diagnostic/revise-diagnosis";
import {calculationControl} from "../src/lib/diagnostic/solution-policy";
import {fixture,facts,fit,candidates,selection,stageValues} from "./fixture";
import type {StageCall} from "../src/lib/diagnostic/client";
const context={fontes:{processo:facts.processo},fatos:facts,aderencia:fit,candidatos:candidates,selecao:selection};
type Patch={campo:string;valor:string};
function scripted(alteracoes:Patch[],auditoria=stageValues.quality_gate){
 const spy=vi.fn(async()=>({alteracoes,auditoria}));
 return {call:spy as StageCall,spy};
}
const path="solucoes.0.observacao";
describe("normalização segura de patches",()=>{
 for(const count of [2,3])it(count+" patches: último prevalece em uma única chamada",async()=>{
  const patches=Array.from({length:count},(_,i)=>({campo:path,valor:["Revisão assistida.","Validação humana mantida.","Equipe decide o encaminhamento."][i]}));
  const {call,spy}=scripted(patches),before=structuredClone(fixture);
  const result=await reviseDiagnosis(call,context,fixture,["Corrigir observação."]);
  expect(result.solucoes[0].observacao).toBe(patches.at(-1)!.valor);expect(spy).toHaveBeenCalledTimes(1);expect(fixture).toEqual(before);
 });
 it("preserva outros campos entre duplicatas",async()=>{
  const {call}=scripted([{campo:path,valor:"Versão intermediária."},{campo:"familias.justificativa",valor:"Capacidade ligada aos sinais relatados."},{campo:path,valor:"Revisão humana antes do uso."}]);
  const result=await reviseDiagnosis(call,context,fixture,["Corrigir textos."]);
  expect(result.familias.justificativa).toBe("Capacidade ligada aos sinais relatados.");expect(result.solucoes[0].observacao).toBe("Revisão humana antes do uso.");
 });
 it("remove retorno ao original sem perder outra correção",async()=>{
  const {call}=scripted([{campo:path,valor:"Intermediário."},{campo:path,valor:fixture.solucoes[0].observacao},{campo:"familias.justificativa",valor:"Capacidade aderente aos fatos informados."}]);
  const result=await reviseDiagnosis(call,context,fixture,["Corrigir justificativa."]);
  expect(result.solucoes[0].observacao).toBe(fixture.solucoes[0].observacao);expect(result.familias.justificativa).toBe("Capacidade aderente aos fatos informados.");
 });
 it("somente no-ops com finding real continuam rejeitados",async()=>{
  const {call}=scripted([{campo:path,valor:"Intermediário."},{campo:path,valor:fixture.solucoes[0].observacao}]);
  await expect(reviseDiagnosis(call,context,fixture,["Defeito real."])).rejects.toThrow("quality_gate_rejected");
 });
 it("sem finding permite no-op somente após auditoria e controles",async()=>{
  const {call}=scripted([{campo:path,valor:fixture.solucoes[0].observacao}]);expect(await reviseDiagnosis(call,context,fixture,[])).toEqual(fixture);
 });
 it("allowUnchanged não contorna defeito determinístico",async()=>{
  const draft=structuredClone(fixture);draft.solucoes[0].observacao="Cobre toda a dor.";
  await expect(reviseDiagnosis(scripted([]).call,context,draft,["Promessa absoluta."],true)).rejects.toThrow("quality_gate_rejected");
 });
 it("protectedPath conserva a frase de controle ao consolidar duplicatas",async()=>{
  const draft=structuredClone(fixture);draft.funcionamento[0]="Conferir dados. "+calculationControl;
  const final="Validar regras antes da análise. "+calculationControl;
  const {call}=scripted([{campo:"funcionamento.0",valor:"Conferência inicial. "+calculationControl},{campo:"funcionamento.0",valor:final}]);
  const result=await reviseDiagnosis(call,context,draft,["Esclarecer validação."]);expect(result.funcionamento[0]).toBe(final);
 });
 it("patch protegido inválido não é ocultado por duplicata posterior válida",async()=>{
  const draft=structuredClone(fixture);draft.funcionamento[0]=calculationControl;
  await expect(reviseDiagnosis(scripted([{campo:"funcionamento.0",valor:"Remover controle."},{campo:"funcionamento.0",valor:"Conferir dados. "+calculationControl}]).call,context,draft,["Corrigir."])).rejects.toThrow();
 });
 it("campo proibido continua inválido antes da normalização",async()=>{
  await expect(reviseDiagnosis(scripted([{campo:"recomendacao.candidatoId",valor:"C2"},{campo:"recomendacao.candidatoId",valor:"C1"}]).call,context,fixture,["Corrigir."])).rejects.toThrow();
 });
 it("número não suportado não pode ser encoberto por duplicata",async()=>{
  await expect(reviseDiagnosis(scripted([{campo:path,valor:"Reduz tempo em 99%."},{campo:path,valor:"Revisão humana."}]).call,context,fixture,["Corrigir."])).rejects.toThrow();
 });
 it("valor final reprovado nos controles continua rejeitado",async()=>{
  await expect(reviseDiagnosis(scripted([{campo:path,valor:"Benefício sujeito a piloto."},{campo:path,valor:"Cobre toda a dor."}]).call,context,fixture,["Corrigir."])).rejects.toThrow("quality_gate_rejected");
 });
 it("auditoria final reprovada continua bloqueando",async()=>{
  const audit:typeof stageValues.quality_gate={...stageValues.quality_gate,verificacoes:{...stageValues.quality_gate.verificacoes,causalidadeBeneficio:false},status:"REVISE",correcoes:["Benefício incompatível."]};
  await expect(reviseDiagnosis(scripted([{campo:path,valor:"Revisão assistida."},{campo:path,valor:"Gestor decide."}],audit).call,context,fixture,["Corrigir."])).rejects.toThrow("quality_gate_rejected");
 });
 it("lacuna não bloqueante não pode desaparecer",async()=>{
  const draft=structuredClone(fixture);draft.validacoes[0]="Validar o esforço no piloto.";
  const c={...context,lacunasNaoBloqueantes:[draft.validacoes[0]]};
  await expect(reviseDiagnosis(scripted([{campo:"validacoes.0",valor:"Verificar permissões."},{campo:"validacoes.0",valor:"Verificar acesso aos dados."}]).call,c,draft,["Corrigir."])).rejects.toThrow("quality_gate_rejected");
 });
});

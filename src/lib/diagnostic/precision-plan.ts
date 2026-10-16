import {z} from "zod";
import {text,scopeSchema} from "./schemas";
export const recommendationPlanSchema=z.object({
 candidatoId:z.string().max(20),porQue:text.max(160),valorIA:text.max(160),arquiteturaDeterministica:text.max(180),resultadoPotencial:text.max(140)
}).strict();
export const workflowPlanSchema=z.object({entrada:text,validacaoEstrutural:text.nullable(),deterministica:text.nullable(),inteligencia:text,entrega:text,consultaLinguagemNatural:text.nullable(),validacaoHumana:text}).strict();
export const measurementPlanSchema=z.object({nome:text.max(180),registro:text.max(220),calculo:text.max(240),comparacao:text.max(200),unidade:text.max(60),finalidade:z.enum(["Resultado do negócio","Funcionamento da tecnologia"])}).strict();
export function recommendationText(name:string,p:z.infer<typeof recommendationPlanSchema>,scope:z.infer<typeof scopeSchema>){
 const evolution=scope.evolucoes.length?"\n\nEvolução possível após validação inicial: "+scope.evolucoes.join("; "):"";
 return `Com base no que você descreveu, a iniciativa com melhor relação entre impacto potencial e viabilidade é… ${name}.\n\nPrimeira implementação: ${scope.descricao}\n\nPor que essa solução: ${p.porQue}\n\nComo a IA agrega valor: ${p.valorIA}\n\nComo a arquitetura deve funcionar: ${p.arquiteturaDeterministica}\n\nResultado potencial: ${p.resultadoPotencial}${evolution}`;
}
export function measurementText(m:z.infer<typeof measurementPlanSchema>){return `${m.registro} ${m.calculo} ${m.comparacao} Unidade: ${m.unidade}.`;}

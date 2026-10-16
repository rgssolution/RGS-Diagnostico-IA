import type {FormInput} from "../form";
import type {Question,Sources} from "./schemas";
function explicitlyUnknown(value:string){
 const normalized=value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
 return /^(ainda\s+)?nao\s+(sei|consigo\s+(explicar|descrever)|tenho\s+(informacoes|dados)|identifico)/.test(normalized);
}
export function needsBasicFacts(input:FormInput,additional:Sources){
 // Não é regra por setor: impede transformar declarações explícitas de desconhecimento em uma operação inventada.
 const coreUnknown=[input.tempo,input.repeticoes,input.decisoes].filter(explicitlyUnknown).length;
 return explicitlyUnknown(input.processo) && coreUnknown>=2 && (Object.keys(additional).length===0 || Object.values(additional).every(explicitlyUnknown));
}
export const basicQuestions:Question[]=[
 {id:"q1",pergunta:"Qual atividade concreta você quer analisar, do início ao fim?",mudaRecomendacao:"Identifica a natureza da operação e a capacidade de IA eventualmente aderente."},
 {id:"q2",pergunta:"Qual dificuldade ou resultado você quer melhorar nessa atividade?",mudaRecomendacao:"Distingue dor real de suposição e muda a solução candidata."},
];
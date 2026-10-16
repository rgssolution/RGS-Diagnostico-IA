import { z } from "zod";
export const areas = ["Vendas","Atendimento","Financeiro","Marketing","Operações","RH","Administrativo","Logística","Compras","Outro"] as const;
export const participantes = ["Somente eu","Eu e uma pequena equipe","Várias áreas da empresa","Fornecedores ou parceiros externos","Outro"] as const;
export const ferramentas = ["WhatsApp","E-mail","Excel / Google Sheets","CRM","ERP","Sistema próprio","Papel / controles manuais","ChatGPT / IA","Outro"] as const;
export const dificuldades = ["Muito trabalho manual","Demora","Retrabalho","Erros","Informação espalhada","Tarefas repetitivas","Falta de acompanhamento","Falta de dados para decidir","Dependência de uma pessoa","Dificuldade de atender clientes","Não sei identificar","Outro"] as const;
const short = z.string().trim().min(3, "Descreva com pelo menos 3 caracteres.").max(300);
const multi = <T extends readonly [string, ...string[]]>(items:T) => z.array(z.enum(items)).min(1).max(items.length).refine(v => new Set(v).size === v.length);
export const formSchema = z.object({
 area:z.enum(areas), objetivo:short, processo:z.string().trim().min(30,"Conte um pouco mais: use pelo menos 30 caracteres.").max(5000),
 participantes:z.enum(participantes), ferramentas:multi(ferramentas), dificuldades:multi(dificuldades),
 tempo:short, repeticoes:z.string().trim().min(3).max(1500), decisoes:z.string().trim().min(3).max(1500), melhoria:short
}).strict();
export type FormInput = z.infer<typeof formSchema>;
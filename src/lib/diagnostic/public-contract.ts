import {z} from "zod";
export const clarificationResponseSchema=z.object({
 needs_clarification:z.literal(true),
 perguntas:z.array(z.object({id:z.string().regex(/^q[1-2]$/),pergunta:z.string().min(5).max(350)}).strict()).min(1).max(2),
 token:z.string().min(1).max(5000)
}).strict();
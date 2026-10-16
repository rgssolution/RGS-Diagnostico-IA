import {selectionSchema,type Facts,type Fit,type Candidates} from "./schemas";
import {SELECT} from "./prompts";
import type {StageCall} from "./client";
export async function selectSolution(call:StageCall,fatos:Facts,aderencia:Fit,candidatos:Candidates) {
 const selection=await call("select_solution",selectionSchema,SELECT,{fatos,aderencia,candidatos});
 const ids=new Set(candidatos.candidatos.map(c=>c.id));
 if(!ids.has(selection.candidatoId) || selection.alternativas.length<1 || selection.alternativas.length>2 || new Set(selection.alternativas).size!==selection.alternativas.length || selection.alternativas.some(id=>id===selection.candidatoId || !ids.has(id)))throw new Error("invalid_selection");
 return selection;
}
"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { areas, participantes, ferramentas, dificuldades, formSchema, type FormInput } from "@/lib/form";
import { diagnosticoSchema, type Diagnostico } from "@/lib/diagnostico";
function Field({name,label,help,long=false,max=300,min=3}:{name:string;label:string;help?:string;long?:boolean;max?:number;min?:number}) {
 return <div className="field"><label htmlFor={name}>{label}</label>{help && <p id={name+"-help"} className="help">{help}</p>}{long ? <textarea id={name} name={name} required minLength={name==="processo"?30:min} maxLength={max} rows={name==="processo"?6:3} aria-describedby={help?name+"-help":undefined}/> : <input id={name} name={name} required minLength={min} maxLength={max} aria-describedby={help?name+"-help":undefined}/>}</div>
}
function Choices({name,label,options,multiple=false}:{name:string;label:string;options:readonly string[];multiple?:boolean}) {
 return <fieldset className="field"><legend>{label}</legend><div className="choices">{options.map(option=><label className="choice" key={option}><input type={multiple?"checkbox":"radio"} name={name} value={option} required={!multiple}/><span>{option}</span></label>)}</div>{multiple && <p className="help">Selecione uma ou mais opções.</p>}</fieldset>
}
function Result({data}:{data:Diagnostico}) {
 return <article className="report" aria-labelledby="report-title">
 <div className="report-heading"><span className="eyebrow">DO PROCESSO À MELHORIA</span><h2 id="report-title">Seu Diagnóstico RGS IA</h2><p>Um ponto de partida para validar melhorias na sua operação.</p></div>
 <section><h3>1. O que entendemos da sua operação</h3><p>{data.operacao.resumo}</p><ul>{data.operacao.fatos.map((f,i)=><li key={i}>{f}</li>)}</ul><p>{data.operacao.workflow.join(" → ")}</p></section>
 <section><h3>2. Principal gargalo identificado</h3><div className="result-grid">{data.gargalos.map((g,i)=><div className="result-card" key={i}><span className="number">0{i+1}</span><h4>{g.problema}</h4><p><strong>Consequência:</strong> {g.consequencia}</p><p><strong>Evidência informada:</strong> {g.evidencia}</p></div>)}</div></section>
 <section><h3>3. Onde a IA pode gerar resultado</h3><p>{data.oportunidade.parteProcesso}</p><p>{data.oportunidade.capacidadeNecessaria}</p><p>{data.oportunidade.beneficioPotencial}</p></section>
 <section><h3>4. Família de IA mais adequada</h3><h4>{data.familias.principal}</h4>{data.familias.complementares.length>0 && <p><strong>Complementares:</strong> {data.familias.complementares.join("; ")}</p>}<p>{data.familias.justificativa}</p></section>
 <section><h3>5. Soluções de IA consideradas</h3><div className="result-grid">{data.solucoes.map(s=><div className="result-card" key={s.id}><h4>{s.solucao}</h4><p><strong>Família:</strong> {s.familias.join("; ")}</p><p>{s.problema}</p><p>{s.capacidadeIA}</p><p><strong>Impacto potencial:</strong> {s.impactoPotencial}</p><p><strong>Esforço:</strong> {s.esforco}</p><p>{s.observacao}</p></div>)}</div></section>
 <section className="spotlight"><span className="eyebrow">SEU PONTO DE PARTIDA</span><h3>6. Recomendação principal</h3><p>{data.recomendacao.texto}</p></section>
 <section><h3>7. Como funcionaria na prática</h3><ol className="steps">{data.funcionamento.map((step,i)=><li key={i}><span className="number">0{i+1}</span><p>{step}</p></li>)}</ol></section>
 <section><h3>8. Pré-requisitos para implementar</h3><ul>{data.preRequisitos.map((p,i)=><li key={i}>{p}</li>)}</ul></section>
 <section><h3>9. O que ainda precisa ser validado</h3><ul>{data.validacoes.map((v,i)=><li key={i}>{v}</li>)}</ul></section>
 <section className="metric"><span className="eyebrow">ACOMPANHE O QUE IMPORTA</span><h3>10. Como medir resultado</h3><h4>{data.metricas.principal.nome}</h4><p>{data.metricas.principal.comoMedir}</p>{data.metricas.secundarias.map((m,i)=><div key={i}><strong>{m.nome}</strong><p>{m.comoMedir}</p></div>)}</section>
 </article>
}
export default function Home() {
 const [loading,setLoading] = useState(false);
 const [error,setError] = useState("");
 const [result,setResult] = useState<Diagnostico|null>(null);
 const [clarification,setClarification] = useState<{perguntas:{id:string;pergunta:string}[];token:string}|null>(null);
 const [snapshot,setSnapshot] = useState<FormInput|null>(null);
 const [logoFailed,setLogoFailed] = useState(false);
 const resultRef = useRef<HTMLDivElement>(null);
 async function send(input:FormInput,esclarecimentos?:{token:string;respostas:{id:string;resposta:string}[]}) {
  setLoading(true); setError(""); setResult(null);
  try {
   const response = await fetch("/api/analisar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,...(esclarecimentos?{esclarecimentos}:{})}),signal:AbortSignal.timeout(285000)});
   const body = await response.json();
   if(!response.ok) throw new Error(typeof body.error==="string"?body.error:"Não foi possível concluir a análise.");
   if(body.needs_clarification===true){
    const {clarificationResponseSchema}=await import("@/lib/diagnostic/public-contract");
    const pending=clarificationResponseSchema.parse(body);
    setClarification({perguntas:pending.perguntas,token:pending.token});
   }else{
    setResult(diagnosticoSchema.parse(body.diagnostico));setClarification(null);
   }
   setTimeout(()=>{resultRef.current?.focus();resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"});},50);
  } catch(e) {setError(e instanceof Error && e.name==="Error" && !(e instanceof SyntaxError)?e.message:"Não foi possível concluir a análise. Suas respostas foram preservadas; tente novamente.");}
  finally {setLoading(false);}
 }
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();if(loading)return;
  const values=new FormData(event.currentTarget);
  const raw=Object.fromEntries(values.entries());
  const parsed=formSchema.safeParse({...raw,ferramentas:values.getAll("ferramentas"),dificuldades:values.getAll("dificuldades")});
  setError("");setResult(null);
  if(!parsed.success){setError("Revise os campos e selecione ao menos uma ferramenta e uma dificuldade. Descreva o processo com pelo menos 30 caracteres.");return;}
  setSnapshot(parsed.data);setClarification(null);
  await send(parsed.data);
 }
 async function clarify(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(loading || !clarification || !snapshot)return;
  const values=new FormData(event.currentTarget);
  await send(snapshot,{token:clarification.token,respostas:clarification.perguntas.map(q=>({id:q.id,resposta:String(values.get(q.id)||"")}))});
 }
 return <main className="shell">
 <header className="topbar"><div>{!logoFailed ? <Image unoptimized width={145} height={56} className="logo" src="/logo-rgs.png" alt="RGS Solution" onError={()=>setLogoFailed(true)}/> : <span className="brand">RGS <span>Solution</span></span>}</div><span className="top-label">CLAREZA ANTES DA TECNOLOGIA</span></header>
 <div className="hero"><span className="eyebrow">UM NOVO OLHAR PARA SUA OPERAÇÃO</span><h1>Diagnóstico <span>RGS IA</span></h1><h2>Descubra onde a IA realmente pode gerar resultado na sua operação.</h2><p>Escolha um processo da sua empresa, conte como ele funciona hoje e receba um diagnóstico com gargalos, oportunidades, prioridades e possíveis aplicações de IA.</p><div className="trust"><span aria-hidden="true">✓</span> Sem cadastro. Sem venda. Sem precisar entender de tecnologia.</div><div className="principle">Processo <span>→</span> Gargalo <span>→</span> Causa <span>→</span> Impacto <span>→</span> Melhoria <span>→</span> IA <span>→</span> Métrica</div></div>
 <form onSubmit={submit} onChange={()=>{setClarification(null);setSnapshot(null);}}>
 <section className="form-card"><div className="section-title"><span className="number">01</span><div><span className="eyebrow">O PONTO DE PARTIDA</span><h2>Sobre o processo</h2></div></div>
 <div className="field"><label htmlFor="area">1. Qual área ou processo você quer analisar?</label><select name="area" id="area" required defaultValue=""><option value="" disabled>Selecione uma área</option>{areas.map(a=><option key={a}>{a}</option>)}</select></div>
 <Field name="objetivo" label="2. Qual é o principal objetivo desse processo?" help="Ex.: transformar leads em clientes, fechar o mês financeiro, atender solicitações, aprovar pagamentos."/>
 <Field name="processo" label="3. Descreva como esse processo funciona hoje, do início ao fim." help="Este é o campo mais importante. Explique desde o momento em que o processo começa até sua conclusão." long max={5000}/>
 </section>
 <section className="form-card"><div className="section-title"><span className="number">02</span><div><span className="eyebrow">A ROTINA REAL</span><h2>Como ele funciona hoje</h2></div></div>
 <Choices name="participantes" label="4. Quem participa desse processo?" options={participantes}/>
 <Choices name="ferramentas" label="5. Quais ferramentas vocês usam nesse processo?" options={ferramentas} multiple/>
 <Choices name="dificuldades" label="6. Onde você percebe mais dificuldade hoje?" options={dificuldades} multiple/>
 </section>
 <section className="form-card"><div className="section-title"><span className="number">03</span><div><span className="eyebrow">O QUE MERECE ATENÇÃO</span><h2>Onde estão as dificuldades</h2></div></div>
 <Field name="tempo" label="7. Qual atividade mais consome tempo nesse processo?"/>
 <Field name="repeticoes" label="8. Quais tarefas são repetidas com frequência?" long max={1500}/>
 <Field name="decisoes" label="9. Que decisões precisam ser tomadas ao longo desse processo?" help="Ex.: qual cliente priorizar, aprovar desconto, liberar pagamento, escalar atendimento." long max={1500}/>
 <Field name="melhoria" label="10. Se você pudesse melhorar apenas uma coisa nesse processo, qual seria?"/>
 </section>
 <div className="submit-area"><p>Todos os campos são obrigatórios.</p><button type="submit" disabled={loading}>{loading ? <><span className="spinner" aria-hidden="true"/> Analisando seu processo…</> : <>Gerar meu Diagnóstico <span aria-hidden="true">↗</span></>}</button><div role="status" aria-live="polite">{loading && "Analisando seu processo…"}</div>{error && <p className="error" role="alert">{error}</p>}</div>
 </form>
 <div ref={resultRef} tabIndex={-1} aria-busy={loading}>{clarification && <section className="form-card" aria-labelledby="clarification-title"><h2 id="clarification-title">Precisamos esclarecer alguns pontos</h2><form onSubmit={clarify}>{clarification.perguntas.map(q=><Field key={q.id} name={q.id} label={q.pergunta} long max={1000} min={1}/>)}<button type="submit" disabled={loading}>{loading?"Analisando seu processo…":"Concluir meu Diagnóstico"}</button></form></section>}{result && <Result data={result}/>}</div>
 <footer>RGS Solution <span>·</span> Primeiro, entenda o processo. Depois, escolha a melhoria.</footer>
 </main>
}
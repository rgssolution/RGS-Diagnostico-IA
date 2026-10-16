import {test,expect} from "@playwright/test";
import {fixture,input} from "./fixture";
for(const [name,width,height] of [["mobile",390,844],["tablet",768,1024],["desktop",1440,1000]] as const){
 test(name+": formulário, erro, loading e diagnóstico",async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Diagnóstico RGS IA");
  await page.getByRole("button",{name:"Gerar meu Diagnóstico"}).click();
  expect(await page.locator("#area").evaluate((e:HTMLSelectElement)=>e.validity.valid)).toBe(false);
  await page.selectOption("#area",input.area);
  for(const field of ["objetivo","processo","tempo","repeticoes","decisoes","melhoria"] as const)await page.locator("#"+field).fill(input[field]);
  await page.getByLabel(input.participantes,{exact:true}).check();
  for(const choice of [...input.ferramentas,...input.dificuldades])await page.getByLabel(choice,{exact:true}).check();
  await page.route("**/api/analisar",async route=>{await route.fulfill({status:502,json:{error:"Falha simulada. Tente novamente."}});});
  await page.getByRole("button",{name:"Gerar meu Diagnóstico"}).click();
  await expect(page.locator(".error[role=alert]")).toContainText("Falha simulada");
  await expect(page.locator("#processo")).toHaveValue(input.processo);
  await expect(page.getByLabel("E-mail",{exact:true})).toBeChecked();
  await page.unroute("**/api/analisar");
  await page.route("**/api/analisar",async route=>{await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({json:{diagnostico:fixture}});});
  await page.getByRole("button",{name:"Gerar meu Diagnóstico"}).click();
  await expect(page.getByRole("button",{name:"Analisando seu processo…"})).toBeDisabled();
  await expect(page.getByRole("heading",{name:"Seu Diagnóstico RGS IA",exact:true})).toBeVisible();
  await expect(page.locator(".report section")).toHaveCount(10);
  await expect(page.locator(".steps li")).toHaveCount(fixture.funcionamento.length);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/"+name+".png",fullPage:true});
 });
}
test("perguntas adicionais preservam formulário e concluem sem chat contínuo",async({page})=>{
 await page.goto("/");
 await page.selectOption("#area",input.area);
 for(const field of ["objetivo","processo","tempo","repeticoes","decisoes","melhoria"] as const)await page.locator("#"+field).fill(input[field]);
 await page.getByLabel(input.participantes,{exact:true}).check();
 for(const choice of [...input.ferramentas,...input.dificuldades])await page.getByLabel(choice,{exact:true}).check();
 await page.route("**/api/analisar",async route=>{
  const data=route.request().postDataJSON();
  if(data.esclarecimentos){
   expect(data.esclarecimentos.respostas).toEqual([{id:"q1",resposta:"0"}]);
   await route.fulfill({json:{needs_clarification:false,diagnostico:fixture}});
  }else await route.fulfill({json:{needs_clarification:true,token:"test-signed-ticket",perguntas:[{id:"q1",pergunta:"Qual volume de casos precisa de decisão?"}]}});
 });
 await page.getByRole("button",{name:"Gerar meu Diagnóstico"}).click();
 await expect(page.getByRole("heading",{name:"Precisamos esclarecer alguns pontos"})).toBeVisible();
 await expect(page.locator("#processo")).toHaveValue(input.processo);
 await page.locator("#q1").fill("0");
 await page.getByRole("button",{name:"Concluir meu Diagnóstico"}).click();
 await expect(page.getByRole("heading",{name:"Seu Diagnóstico RGS IA",exact:true})).toBeVisible();
 await expect(page.locator("#q1")).toHaveCount(0);
 await expect(page.locator(".submit-area > p")).toHaveText("Todos os campos são obrigatórios.");
 await expect(page.getByText("Ao gerar, suas respostas serão enviadas à OpenAI",{exact:false})).toHaveCount(0);
});
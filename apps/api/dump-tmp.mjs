import { z } from 'zod';
import * as sh from '@capaz/shared';
const tools = process.argv.slice(2);
const all = {};
for (const [k,v] of Object.entries(sh)) if (k.startsWith('contratosDe') && v && typeof v==='object') Object.assign(all, v);
for (const t of tools) {
  const c = all[t]; if(!c){console.log(t,'NO');continue}
  const schema = c.entrada ?? c.input ?? Object.values(c)[0];
  try { const j = z.toJSONSchema(schema,{io:'input',unrepresentable:'any'}); const props=j.properties||{}; console.log(t, '{'+Object.entries(props).map(([n,p])=>`${n}${(j.required||[]).includes(n)?'*':''}:${p.enum?p.enum.join('|'):(p.type||(p.anyOf?p.anyOf.map(x=>x.type).join('|'):'?'))}${p.minimum!==undefined?'>='+p.minimum:''}${p.format?'('+p.format+')':''}`).join(', ')+'}'); } catch(e){console.log(t,'ERR',e.message)}
}

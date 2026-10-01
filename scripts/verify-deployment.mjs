import assert from 'node:assert/strict';
const base=process.argv[2];
if(!base?.startsWith('https://')) throw new Error('Provide the deployed HTTPS URL.');
const get=async path=>{const r=await fetch(new URL(path,base));assert.equal(r.status,200,path);return r.json();};
const data=await get('/api/candidates?mode=demo');
assert.equal(data.mode,'demo');assert.equal(data.candidates.length,12);assert.equal(data.rubrics.length,2);
const selected=new Set();
for(const role of ['PM','SPM']) {
 const rankings=await get(`/api/rankings?mode=demo&role=${role}`);
 assert.equal(rankings.length,12);
 assert(rankings.every((c,i)=>c.rank===i+1 && (!i||rankings[i-1].overall_score>=c.overall_score)));
 for(const c of rankings.slice(0,5)){selected.add(c.id);assert.equal(c.briefs[role].match(/[.!?](?:\s|$)/g).length,3);}
}
for(const c of data.candidates) {
 assert.equal(c.evaluations.length,2);
 for(const r of data.rubrics){const e=c.evaluations.find(e=>e.role===r.role);const total=r.criteria.reduce((sum,criterion)=>sum+e.criteria.find(x=>x.criterion_id===criterion.id).score/10*criterion.weight,0);assert(Math.abs(total-e.overall_score)<1e-8);}
 assert.equal(c.email.type,selected.has(c.id)?'INVITATION':'REJECTION');assert.equal(c.email.status,'PENDING_REVIEW');
}
assert(data.candidates.some(c=>c.email.type==='REJECTION'));
const emails=await get('/api/emails?mode=demo');assert.equal(emails.length,12);
const home=await fetch(base);assert.equal(home.status,200);assert.equal(home.headers.get('x-content-type-options'),'nosniff');
const html=await home.text();assert(html.includes('Your next great hire'));assert(html.includes('Synthetic candidates'));
for(const path of ['/api/candidates','/api/candidates/00000000-0000-4000-8000-000000000001','/api/emails']){
 const r=await fetch(new URL(path,base));assert([401,403,503].includes(r.status),`Private endpoint is protected: ${path}`);
}
const send=await fetch(new URL('/api/emails/00000000-0000-4000-8000-000000000001/send',base),{method:'POST',headers:{Origin:new URL(base).origin,'Content-Type':'application/json'},body:JSON.stringify({approved:false})});
assert([401,403,503].includes(send.status));
console.log(JSON.stringify({url:base,candidates:12,bothRoleScores:true,rankings:true,topFive:true,threeSentenceBriefs:true,invitationAndRejectionDrafts:true,privateEndpointsProtected:true,unapprovedSendBlocked:true,homepageRendered:true,visualBrowserCheck:false}));

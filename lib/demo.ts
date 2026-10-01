import type { Candidate, DashboardData } from './domain';
import { rubrics } from './evaluation/rubrics';
import { calculateScore } from './evaluation/scoring';
import { shortlist } from './rankings/ranking';
import { createEmailDraft } from './emails/drafts';
const profiles = [
 ['Maya Kapoor','SPM',9.4,9.1,'Owned carrier allocation and customs exception handling for 600 monthly shipments.','Built a shipment triage workflow adopted by three regional teams.','Independently led a carrier system migration from discovery through training and rollout.','Stopped a low-adoption dashboard and redirected capacity after documenting its failure.','Reduced unresolved shipment exceptions by 38 percent over six months.'],
 ['Dev Malhotra','PM',9.2,8.1,'Worked alongside freight documentation teams on bill of lading corrections.','Created a document verification prototype used by 28 operations staff.','Owned customer discovery, engineering handoff and rollout for one product area.','Investigated a failed rollout and changed the validation rules based on the root cause.','Reduced document corrections by 31 percent and weekly support queries by 24 percent.'],
 ['Tara Mehra','SPM',8.8,8.7,'Managed port handoffs and carrier scheduling across two freight branches.','Initiated a carrier scorecard and trained branch leads to run it independently.','Led integration discovery and delivery across operations, engineering and customer teams.','Published a post-mortem for a tracking outage and closed every corrective action.','Reduced tracking delays by 42 percent across 14 customer accounts.'],
 ['Neil Arora','PM',8.6,7.5,'Handled daily customs documentation and warehouse dispatch exceptions.','Introduced same-day exception triage adopted across a 12-person team.','Owned an onboarding workflow from customer interviews through release measurement.','Retired an onboarding checklist after usage showed duplicate effort.','Reduced onboarding support requests by 26 percent.'],
 ['Ira Anand','SPM',8.3,8.4,'Coordinated dispatch scheduling with warehouse and transport teams.','Built a shared operations playbook adopted by two client sites.','Owned a multi-site workflow rollout without a senior product decision layer.','Documented a vendor integration failure and redesigned the fallback process.','Reduced failed handoffs by 29 percent across three sites.'],
 ['Avi Shah','PM',8.1,7.2,'Worked with transport coordinators on route and pickup exceptions.','Created a pickup visibility tool used daily by 16 coordinators.','Owned feature discovery and rollout with support from an engineering lead.','Changed a release plan after pilot customers rejected its workflow.','Reduced missed pickups by 18 percent over one quarter.'],
 ['Sara Khanna','SPM',7.5,7.7,'Mapped invoice dispute workflows with logistics finance teams.','Initiated a dispute queue adopted by customer operations.','Led delivery and training across finance, product and customer operations.','Ran a retrospective after a delayed pilot and changed the migration sequence.','Reduced average dispute closure time from eight days to five days.'],
 ['Zoya Sethi','PM',7.1,6.4,'Interviewed freight coordinators about shipment status handoffs.','Built a status dashboard used by one customer pilot team.','Managed specifications and release tracking with a senior PM.','Revised a feature after customers reported duplicate alerts.','Reduced alert-related tickets by 15 percent.'],
 ['Rian Das','SPM',6.7,6.3,'Interviewed enterprise software administrators about support workflows.','Proposed a support checklist adopted by the team.','Managed a release roadmap under a product director.','Reviewed adoption data after release and adjusted onboarding copy.','Improved account activation by 12 percent.'],
 ['Anika Rao','PM',6.2,5.4,'Observed warehouse receiving workflows during a customer study.','Built a reporting prototype for a small pilot.','Supported discovery and specifications for two features.','Recorded feedback from a pilot that did not proceed.','Reduced manual report preparation by two hours each week.'],
 ['Om Prakash','PM',5.3,4.5,'Conducted user interviews for an enterprise scheduling product.','Suggested improvements to an existing reporting process.','Supported a senior PM with release notes and user research synthesis.','Recorded customer feedback in the product backlog.','Reported adoption metrics for one feature.'],
 ['Leela Roy','SPM',4.8,4.1,'Managed analytics for an established enterprise platform.','Contributed to an existing quarterly reporting process.','Coordinated feature specifications within a structured product team.','Summarized release feedback for a product director.','Tracked feature usage after launch.'],
] as const;
export const demoCandidates: Candidate[] = profiles.map(([name,role,pm,spm,...evidence],i)=> {
 const id=`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
 const evaluations=rubrics.map(r=>{
  const base=r.role==='PM'?pm:spm;
  const criteria=r.criteria.map((c,j)=>({criterion_id:c.id,score:Math.min(10,Math.max(0,base+[-0.2,0.3,0.1,-0.4,0.2][j])),evidence:evidence[j],reasoning:`This synthetic example demonstrates ${c.name.toLowerCase()} through a specific action and scope. The ${r.role} calibration ${r.role==='SPM'?'emphasizes repeated independent ownership':'recognizes clear personal contribution'}.`,confidence:0.84}));
  return {role:r.role,rubric_version:r.version,criteria,overall_score:calculateScore(r,criteria,evidence.join('\n')),status:'COMPLETE'};
 });
 return {id,applied_role:role,status:'COMPLETE',created_at:`2026-09-${String(10+i).padStart(2,'0')}T09:00:00.000Z`,identity:{name,email:`candidate${i+1}@example.com`,phone:'Not provided'},evaluations,briefs:{},email:null};
});
const shortlisted=new Set<string>();
for(const role of ['PM','SPM'] as const) {
 for(const c of shortlist(demoCandidates.map(c=>({...c,overall_score:c.evaluations.find(e=>e.role===role)!.overall_score})))) {
  shortlisted.add(c.id);
  c.briefs[role]=`${c.evaluations.find(e=>e.role===role)!.criteria[0].evidence} This background matches the historical pattern of field-level workflow experience and independently adopted improvements. Investigate the candidate's personal decision-making role and how these results were measured.`;
 }
}
for(const c of demoCandidates) c.email={...createEmailDraft(c.identity.name,shortlisted.has(c.id)),type:shortlisted.has(c.id)?'INVITATION':'REJECTION',id:c.id,candidate_id:c.id,updated_at:c.created_at};
export function getDemoData(configured=false): DashboardData { return {candidates:structuredClone(demoCandidates),rubrics,mode:'demo',configured}; }

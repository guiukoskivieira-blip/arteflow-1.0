import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProductionEvent, ProductionJob, WorkflowStage } from '../types/domain';
import type { IProductionEventRepository, IProductionJobRepository, IWorkflowStageRepository } from '../types/repository';
import type { TransitionProductionJobStageInput } from '../services/jobService';

interface JobRow {
  id: string; organization_id: string; order_id: string; order_item_id: string; job_code: string;
  current_stage_id: string; artwork_gate: ProductionJob['artworkGate']; material_gate: ProductionJob['materialGate'];
  financial_gate: ProductionJob['financialGate']; priority: ProductionJob['priority']; assigned_user_id: string | null;
  assigned_user_name: string | null; assigned_user_email: string | null; deadline_at: string; version: number;
  created_at: string; updated_at: string;
  arteflow_orders: { order_number: string; customer_snapshot_id: string; customer_name: string; customer_document: string|null; customer_email: string|null; customer_phone: string|null; customer_contact_person: string|null; data_origin: 'demo'|'user' };
  arteflow_order_items: { product_name: string; sector: string; dimension_width: number|string|null; dimension_height: number|string|null; dimension_unit: 'mm'|'cm'|'m'|null; quantity: number|string; unit: string; finishings: string[]; technical_notes: string|null; data_origin: 'demo'|'user' };
}

const JOB_SELECT = `id, organization_id, order_id, order_item_id, job_code, current_stage_id,
 artwork_gate, material_gate, financial_gate, priority, assigned_user_id, assigned_user_name,
 assigned_user_email, deadline_at, version, created_at, updated_at,
 arteflow_orders!arteflow_production_jobs_order_fk(order_number,customer_snapshot_id,customer_name,customer_document,customer_email,customer_phone,customer_contact_person,data_origin),
 arteflow_order_items!arteflow_production_jobs_item_fk(product_name,sector,dimension_width,dimension_height,dimension_unit,quantity,unit,finishings,technical_notes,data_origin)`;

function mapJob(r: JobRow): ProductionJob {
  const item=r.arteflow_order_items; const order=r.arteflow_orders;
  const width=item.dimension_width===null?null:Number(item.dimension_width); const height=item.dimension_height===null?null:Number(item.dimension_height);
  return { id:r.id, jobCode:r.job_code, organizationId:r.organization_id, orderId:r.order_id, orderItemId:r.order_item_id,
    orderNumber:order.order_number, customer:{id:order.customer_snapshot_id,name:order.customer_name,document:order.customer_document??undefined,email:order.customer_email??undefined,phone:order.customer_phone??undefined,contactPerson:order.customer_contact_person??undefined},
    productName:item.product_name, sector:item.sector, dimensions:width!==null&&height!==null&&item.dimension_unit?{width,height,unit:item.dimension_unit}:undefined,
    quantity:Number(item.quantity),unit:item.unit,finishings:item.finishings??[],technicalNotes:item.technical_notes??undefined,
    stageId:r.current_stage_id,artworkGate:r.artwork_gate,materialGate:r.material_gate,financialGate:r.financial_gate,priority:r.priority,
    assignee:r.assigned_user_id?{id:r.assigned_user_id,name:r.assigned_user_name??'Usuário',email:r.assigned_user_email??undefined}:null,
    deadlineISO:r.deadline_at,createdAt:r.created_at,updatedAt:r.updated_at,version:r.version,dataOrigin:item.data_origin??order.data_origin };
}

export class SupabaseProductionJobRepository implements IProductionJobRepository {
  readonly serverManaged=true;
  constructor(private readonly supabase: SupabaseClient) {}
  private async one(organizationId:string,column:string,value:string):Promise<ProductionJob|null>{
    const {data,error}=await this.supabase.from('arteflow_production_jobs').select(JOB_SELECT).eq('organization_id',organizationId).eq(column,value).maybeSingle();
    if(error) throw new Error(`Não foi possível carregar a OP: ${error.message}`); return data?mapJob(data as unknown as JobRow):null;
  }
  getById(org:string,id:string){return this.one(org,'id',id)}
  getByJobCode(org:string,code:string){return this.one(org,'job_code',code)}
  async list(org:string){const {data,error}=await this.supabase.from('arteflow_production_jobs').select(JOB_SELECT).eq('organization_id',org).order('created_at');if(error)throw new Error(`Não foi possível carregar a produção: ${error.message}`);return (data??[]).map(x=>mapJob(x as unknown as JobRow));}
  async listByOrderId(org:string,id:string){return (await this.list(org)).filter(x=>x.orderId===id)}
  async listByStageId(org:string,id:string){return (await this.list(org)).filter(x=>x.stageId===id)}
  async save(org:string,job:ProductionJob):Promise<ProductionJob>{if(job.organizationId!==org)throw new Error('CROSS_TENANT_PRODUCTION_WRITE');throw new Error('Produção conectada só pode ser alterada pelas RPCs transacionais.');}
  async saveMany(org:string,jobs:ProductionJob[]){const out:ProductionJob[]=[];for(const job of jobs){const {data,error}=await this.supabase.rpc('arteflow_create_production_job',{p_organization_id:org,p_order_id:job.orderId,p_order_item_id:job.orderItemId,p_initial_stage_id:job.stageId,p_priority:job.priority,p_deadline_at:job.deadlineISO});if(error)throw new Error(`Não foi possível iniciar a produção: ${error.message}`);const saved=await this.getById(org,data as string);if(!saved)throw new Error('OP criada não pôde ser recarregada.');out.push(saved);}return out;}
  async moveAtomic(org:string,input:TransitionProductionJobStageInput,expectedVersion:number){const {data,error}=await this.supabase.rpc('arteflow_move_production_job',{p_organization_id:org,p_job_id:input.productionJobId,p_target_stage_id:input.targetStageId,p_expected_version:expectedVersion,p_method:input.method,p_reason:input.reversionReason??null});if(error)throw new Error(error.message.includes('PRODUCTION_CONFLICT')?'A OP foi alterada por outro operador. Recarregue e tente novamente.':error.message);const saved=await this.getById(org,data as string);if(!saved)throw new Error('OP movida não pôde ser recarregada.');return saved;}
  async updateAtomic(org:string,jobId:string,version:number,field:string,value:string,note?:string){const {data,error}=await this.supabase.rpc('arteflow_update_production_job',{p_organization_id:org,p_job_id:jobId,p_expected_version:version,p_field:field,p_value:value,p_note:note??null});if(error)throw new Error(error.message.includes('PRODUCTION_CONFLICT')?'A OP foi alterada por outro operador. Recarregue e tente novamente.':error.message);const saved=await this.getById(org,data as string);if(!saved)throw new Error('OP atualizada não pôde ser recarregada.');return saved;}
  async addNoteAtomic(org:string,jobId:string,note:string){const {error}=await this.supabase.rpc('arteflow_add_production_note',{p_organization_id:org,p_job_id:jobId,p_note:note});if(error)throw new Error(`Não foi possível registrar a nota: ${error.message}`);}
  async delete(_org:string,_id:string):Promise<boolean>{throw new Error('A exclusão de OP não está habilitada no modo conectado.')} async clear(_org:string):Promise<void>{throw new Error('A limpeza de produção não está habilitada no modo conectado.')}
}

export class SupabaseWorkflowStageRepository implements IWorkflowStageRepository {
  constructor(private readonly supabase:SupabaseClient){}
  async list(org:string){const {data,error}=await this.supabase.rpc('arteflow_get_production_stages',{p_organization_id:org});if(error)throw new Error(`Não foi possível carregar as etapas: ${error.message}`);return (data??[]).map((r:any):WorkflowStage=>({id:r.id,organizationId:r.organization_id,name:r.name,description:r.description,sequence:r.sequence,color:r.color,isInitial:r.is_initial,isFinal:r.is_final,isTerminal:r.is_terminal,dataOrigin:'user'}));}
  async getById(org:string,id:string){return (await this.list(org)).find((x:WorkflowStage)=>x.id===id)??null} async save(_org:string,_stage:WorkflowStage):Promise<WorkflowStage>{throw new Error('Etapas são gerenciadas pelo servidor.')} async saveMany(_org:string,_stages:WorkflowStage[]):Promise<WorkflowStage[]>{throw new Error('Etapas são gerenciadas pelo servidor.')} async clear(_org:string):Promise<void>{throw new Error('Etapas não podem ser limpas no modo conectado.')}
}

export class SupabaseProductionEventRepository implements IProductionEventRepository {
  constructor(private readonly supabase:SupabaseClient){}
  private map(r:any):ProductionEvent{return{id:r.id,jobId:r.job_id,organizationId:r.organization_id,eventType:r.event_type,fromValue:r.from_value??undefined,toValue:r.to_value??undefined,stageFromId:r.from_stage_id??undefined,stageToId:r.to_stage_id??undefined,method:r.method??undefined,description:r.description,reason:r.reason??undefined,authorId:r.actor_user_id,authorName:r.actor_name,timestamp:r.created_at,dataOrigin:'user'}}
  async listByJobId(org:string,id:string){const {data,error}=await this.supabase.from('arteflow_production_job_events').select('*').eq('organization_id',org).eq('job_id',id).order('created_at',{ascending:false});if(error)throw new Error(`Não foi possível carregar o histórico: ${error.message}`);return(data??[]).map(x=>this.map(x));}
  async listAll(org:string){const {data,error}=await this.supabase.from('arteflow_production_job_events').select('*').eq('organization_id',org).order('created_at',{ascending:false});if(error)throw new Error(`Não foi possível carregar o histórico: ${error.message}`);return(data??[]).map(x=>this.map(x));}
  async append(_org:string,event:ProductionEvent){if(event.eventType==='JOB_CREATED')return event;throw new Error('Histórico conectado só pode ser criado por RPC transacional.')} async appendMany(org:string,events:ProductionEvent[]){for(const e of events)await this.append(org,e);return events} async clear(_org:string):Promise<void>{throw new Error('Histórico é imutável no modo conectado.')}
}

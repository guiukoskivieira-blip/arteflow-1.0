import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '../types/domain';
import type { FinancialPayable, FinancialSettlement, IFinancialPayableRepository, IFinancialSettlementRepository, IReceivablePaymentRepository,IReceivableRepository, PaymentMethod } from '../types/financial';
import type { IProductionJobRepository } from '../types/repository';
import { FinancialService,type RegisterPaymentInput } from './financialService';
import type { JobService } from './jobService';
export class SupabaseFinancialService extends FinancialService{
 constructor(private readonly db:SupabaseClient,private readonly receivables:IReceivableRepository,private readonly payments:IReceivablePaymentRepository,jobs:IProductionJobRepository,jobService:JobService,private readonly payables?:IFinancialPayableRepository,private readonly settlements?:IFinancialSettlementRepository){super(receivables,payments,jobs,jobService);}
 private async rpc(name:string,args:Record<string,unknown>){const{data,error}=await this.db.rpc(name,args);if(error){const code=['FINANCE_MANAGE_DENIED','PAYMENT_EXCEEDS_REMAINING','TITLE_CANCELED','RECEIVABLE_NOT_FOUND'].find(x=>error.message.includes(x));throw new Error(code??error.message);}return data as string;}
 override async ensureAccountsForOrders(org:string,_orders:Order[]){return this.receivables.list(org);}
 override async registerPayment(org:string,input:RegisterPaymentInput){const id=await this.rpc('arteflow_settle_receivable',{p_organization_id:org,p_receivable_id:input.receivableId,p_amount_cents:input.amountCents,p_settled_at:new Date(input.paidAt).toISOString(),p_method:input.method,p_notes:input.notes??null,p_idempotency_key:input.idempotencyKey});const account=await this.receivables.getById(org,input.receivableId);const payment=await this.payments.getByIdempotencyKey(org,input.idempotencyKey);if(!account||!payment||payment.id!==id)throw new Error('Baixa não pôde ser recarregada.');return{account,payment};}
 async listPayables(org:string):Promise<FinancialPayable[]>{return this.payables?.list(org)??[];}
 async listSettlements(org:string):Promise<FinancialSettlement[]>{return this.settlements?.list(org)??[];}
 async settlePayable(org:string,input:{payableId:string;amountCents:number;settledAt:string;method:PaymentMethod;notes?:string;idempotencyKey:string}){const id=await this.rpc('arteflow_settle_payable',{p_organization_id:org,p_payable_id:input.payableId,p_amount_cents:input.amountCents,p_settled_at:new Date(input.settledAt).toISOString(),p_method:input.method,p_notes:input.notes??null,p_idempotency_key:input.idempotencyKey});const payable=await this.payables?.getById(org,input.payableId);const item=await this.settlements?.getByIdempotencyKey(org,input.idempotencyKey);if(!payable||!item||item.id!==id)throw new Error('Baixa não pôde ser recarregada.');return{payable,settlement:item};}
}

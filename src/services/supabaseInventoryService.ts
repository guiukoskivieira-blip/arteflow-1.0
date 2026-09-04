import type { SupabaseClient } from '@supabase/supabase-js';
import type { IProductionEventRepository, IProductionJobRepository, IMaterialRepository, IMovementRepository, IRequirementRepository, IReservationRepository } from '../types/repository';
import type { StockMovement, StockReservation } from '../types/inventory';
import { InventoryService, type AddRequirementInput, type AdjustStockInput, type CreateMaterialInput, type RecordReceiptInput, type ReserveRequirementInput, type UpdateMaterialInput } from './inventoryService';

const key = () => globalThis.crypto?.randomUUID?.() ?? `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class SupabaseInventoryService extends InventoryService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly materials: IMaterialRepository,
    private readonly requirements: IRequirementRepository,
    private readonly reservations: IReservationRepository,
    private readonly movements: IMovementRepository,
    jobs: IProductionJobRepository,
    events: IProductionEventRepository,
  ) { super(materials, requirements, reservations, movements, jobs, events); }

  private async rpc(name:string,args:Record<string,unknown>):Promise<string>{
    const {data,error}=await this.supabase.rpc(name,args);
    if(error) {
      const message = error.message.includes('INSUFFICIENT_STOCK') ? 'Saldo disponível insuficiente para concluir a operação.'
        : error.message.includes('DENIED') ? 'Você não possui permissão para gerenciar o estoque.' : error.message;
      throw new Error(message);
    }
    return data as string;
  }
  override async createMaterial(org:string,input:CreateMaterialInput){
    const id=await this.rpc('arteflow_create_inventory_item',{p_organization_id:org,p_sku:input.sku,p_name:input.name,p_category:input.category,p_unit:input.unit,p_initial_stock_milli:input.initialStockMilli??0,p_minimum_stock_milli:input.minimumStockMilli,p_unit_cost_cents:input.unitCostCents??0,p_supplier_name:input.supplierName??null,p_idempotency_key:key()});
    const material=await this.materials.getById(org,id); if(!material)throw new Error('Material criado não pôde ser recarregado.');
    const history=await this.movements.listByMaterialId(org,id); return {material,movement:history.at(-1)};
  }
  override async updateMaterial(org:string,id:string,input:UpdateMaterialInput){
    const current=await this.materials.getById(org,id); if(!current)throw new Error('Material não encontrado.');
    await this.rpc('arteflow_update_inventory_item',{p_organization_id:org,p_item_id:id,p_sku:input.sku??current.sku,p_name:input.name??current.name,p_category:input.category??current.category,p_unit:input.unit??current.unit,p_minimum_stock_milli:input.minimumStockMilli??current.minimumStockMilli,p_supplier_name:input.supplierName??current.supplierName??null,p_is_active:input.isActive??current.isActive});
    const updated=await this.materials.getById(org,id); if(!updated)throw new Error('Material atualizado não pôde ser recarregado.'); return updated;
  }
  override async recordReceipt(org:string,input:RecordReceiptInput){
    const id=await this.rpc('arteflow_record_inventory_movement',{p_organization_id:org,p_item_id:input.materialId,p_type:'RECEIPT',p_quantity_milli:input.quantityMilli,p_reason:input.reason?.trim()||'Entrada de mercadoria',p_unit_cost_cents:input.unitCostCents??null,p_total_cost_cents:input.totalCostCents??null,p_idempotency_key:key()});
    const material=await this.materials.getById(org,input.materialId); const movement=await this.movements.getById(org,id); if(!material||!movement)throw new Error('Entrada registrada não pôde ser recarregada.'); return {material,movement};
  }
  override async adjustStock(org:string,input:AdjustStockInput){
    const id=await this.rpc('arteflow_record_inventory_movement',{p_organization_id:org,p_item_id:input.materialId,p_type:input.type,p_quantity_milli:input.quantityMilli,p_reason:input.reason,p_unit_cost_cents:null,p_total_cost_cents:null,p_idempotency_key:key()});
    const material=await this.materials.getById(org,input.materialId); const movement=await this.movements.getById(org,id); if(!material||!movement)throw new Error('Ajuste registrado não pôde ser recarregado.'); return {material,movement};
  }
  override async addRequirement(org:string,input:AddRequirementInput){
    const id=await this.rpc('arteflow_add_inventory_requirement',{p_organization_id:org,p_job_id:input.productionJobId,p_item_id:input.materialId,p_quantity_milli:input.requiredQuantityMilli});
    const result=await this.requirements.getById(org,id); if(!result)throw new Error('Requisito criado não pôde ser recarregado.'); return result;
  }
  override async reserveRequirement(org:string,input:ReserveRequirementInput){
    const id=await this.rpc('arteflow_reserve_inventory',{p_organization_id:org,p_requirement_id:input.requirementId,p_quantity_milli:input.quantityMilli,p_idempotency_key:key()});
    const result=await this.reservations.getById(org,id); if(!result)throw new Error('Reserva criada não pôde ser recarregada.'); return result;
  }
  override async releaseReservation(org:string,id:string,_user:{id:string;name:string}):Promise<StockReservation>{
    await this.rpc('arteflow_release_inventory_reservation',{p_organization_id:org,p_reservation_id:id}); const result=await this.reservations.getById(org,id); if(!result)throw new Error('Reserva liberada não pôde ser recarregada.'); return result;
  }
  override async consumeReservation(org:string,id:string,_user:{id:string;name:string}):Promise<{reservation:StockReservation;movement:StockMovement}>{
    const movementId=await this.rpc('arteflow_consume_inventory',{p_organization_id:org,p_reservation_id:id,p_idempotency_key:key()});
    const reservation=await this.reservations.getById(org,id); const movement=await this.movements.getById(org,movementId); if(!reservation||!movement)throw new Error('Consumo registrado não pôde ser recarregado.'); return {reservation,movement};
  }
}

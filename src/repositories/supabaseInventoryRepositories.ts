import type { SupabaseClient } from '@supabase/supabase-js';
import type { InventoryMaterial, ProductionMaterialRequirement, StockMovement, StockReservation } from '../types/inventory';
import type { IMaterialRepository, IMovementRepository, IRequirementRepository, IReservationRepository } from '../types/repository';

const safe = (value: unknown, field: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Quantidade insegura recebida em ${field}.`);
  return parsed;
};

export class SupabaseInventoryRepository {
  readonly serverManaged = true;
  constructor(readonly supabase: SupabaseClient) {}

  private material(row: any): InventoryMaterial {
    return { id: row.id, organizationId: row.organization_id, sku: row.sku, name: row.name, category: row.category,
      unit: row.unit, stockOnHandMilli: safe(row.stock_on_hand_milli, 'stock_on_hand_milli'), minimumStockMilli: safe(row.minimum_stock_milli, 'minimum_stock_milli'),
      averageCostCents: safe(row.average_cost_cents, 'average_cost_cents'), supplierName: row.supplier_name ?? undefined,
      isActive: row.is_active, dataOrigin: 'user', createdAt: row.created_at, updatedAt: row.updated_at };
  }
  private requirement(row: any): ProductionMaterialRequirement {
    return { id: row.id, organizationId: row.organization_id, productionJobId: row.production_job_id, materialId: row.inventory_item_id,
      materialSnapshot: { sku: row.material_sku, name: row.material_name, unit: row.material_unit, averageCostCents: safe(row.material_average_cost_cents, 'material_average_cost_cents') },
      requiredQuantityMilli: safe(row.required_quantity_milli, 'required_quantity_milli'), createdAt: row.created_at, dataOrigin: 'user' };
  }
  private reservation(row: any): StockReservation {
    return { id: row.id, organizationId: row.organization_id, productionJobId: row.production_job_id, requirementId: row.requirement_id,
      materialId: row.inventory_item_id, reservedQuantityMilli: safe(row.reserved_quantity_milli, 'reserved_quantity_milli'), status: row.status,
      createdAt: row.created_at, updatedAt: row.updated_at, releasedAt: row.released_at ?? undefined, consumedAt: row.consumed_at ?? undefined,
      userId: row.created_by, userName: row.actor_name ?? 'Usuário' };
  }
  private movement(row: any): StockMovement {
    const type = row.movement_type === 'OPENING_BALANCE' ? 'POSITIVE_ADJUSTMENT' : row.movement_type === 'REVERSAL' ? 'RETURN' : row.movement_type;
    return { id: row.id, organizationId: row.organization_id, materialId: row.inventory_item_id, type,
      quantityMilli: safe(row.quantity_milli, 'quantity_milli'), previousBalanceMilli: safe(row.previous_balance_milli, 'previous_balance_milli'),
      resultingBalanceMilli: safe(row.resulting_balance_milli, 'resulting_balance_milli'), unitCostCents: row.unit_cost_cents == null ? undefined : safe(row.unit_cost_cents, 'unit_cost_cents'),
      totalCostCents: row.total_cost_cents == null ? undefined : safe(row.total_cost_cents, 'total_cost_cents'), productionJobId: row.production_job_id ?? undefined,
      reservationId: row.reservation_id ?? undefined, reason: row.reason, createdAt: row.created_at, userId: row.created_by, userName: row.actor_name, dataOrigin: 'user' } as StockMovement;
  }
  private async rows(table: string, org: string, filters: Record<string,string> = {}) {
    let query = this.supabase.from(table).select('*').eq('organization_id', org);
    for (const [key,value] of Object.entries(filters)) query = query.eq(key,value);
    const { data,error } = await query.order('created_at');
    if (error) throw new Error(`Não foi possível carregar o estoque: ${error.message}`);
    return data ?? [];
  }

  async getById(org:string,id:string):Promise<any>{
    const material = (await this.rows('arteflow_inventory_items',org,{id}))[0];
    if (material) return this.material(material);
    const requirement = (await this.rows('arteflow_inventory_requirements',org,{id}))[0];
    if (requirement) return this.requirement(requirement);
    const reservation = (await this.rows('arteflow_inventory_reservations',org,{id}))[0];
    if (reservation) return this.reservation(reservation);
    const movement = (await this.rows('arteflow_inventory_movements',org,{id}))[0];
    return movement ? this.movement(movement) : null;
  }
  async getBySku(org:string,sku:string){const rows=await this.rows('arteflow_inventory_items',org,{sku:sku.toUpperCase()});return rows[0]?this.material(rows[0]):null;}
  async list(org:string){return (await this.rows('arteflow_inventory_items',org)).map(r=>this.material(r));}
  async listAll(org:string):Promise<any[]>{ return this.list(org); }
  async listByJobId(org:string,id:string):Promise<any[]>{
    const requirements=await this.rows('arteflow_inventory_requirements',org,{production_job_id:id});
    if(requirements.length) return requirements.map(r=>this.requirement(r));
    return (await this.rows('arteflow_inventory_reservations',org,{production_job_id:id})).map(r=>this.reservation(r));
  }
  async listByMaterialId(org:string,id:string):Promise<any[]>{
    const reservations=await this.rows('arteflow_inventory_reservations',org,{inventory_item_id:id});
    const movements=await this.rows('arteflow_inventory_movements',org,{inventory_item_id:id});
    return movements.length ? movements.map(r=>this.movement(r)) : reservations.map(r=>this.reservation(r));
  }
  save():Promise<any>{return Promise.reject(new Error('Estoque conectado só pode ser alterado por RPC transacional.'));}
  saveMany():Promise<any[]>{return Promise.reject(new Error('Estoque conectado só pode ser alterado por RPC transacional.'));}
  append():Promise<any>{return Promise.reject(new Error('Ledger conectado é imutável e só pode ser alterado por RPC transacional.'));}
  appendMany():Promise<any[]>{return Promise.reject(new Error('Ledger conectado é imutável e só pode ser alterado por RPC transacional.'));}
  delete():Promise<boolean>{return Promise.reject(new Error('Exclusão de estoque não habilitada no modo conectado.'));}
  clear():Promise<void>{return Promise.reject(new Error('Limpeza de estoque não habilitada no modo conectado.'));}

  async listRequirements(org:string){return (await this.rows('arteflow_inventory_requirements',org)).map(r=>this.requirement(r));}
  async getRequirement(org:string,id:string){const r=(await this.rows('arteflow_inventory_requirements',org,{id}))[0];return r?this.requirement(r):null;}
  async listRequirementsByJob(org:string,id:string){return (await this.rows('arteflow_inventory_requirements',org,{production_job_id:id})).map(r=>this.requirement(r));}
  async listReservations(org:string){return (await this.rows('arteflow_inventory_reservations',org)).map(r=>this.reservation(r));}
  async getReservation(org:string,id:string){const r=(await this.rows('arteflow_inventory_reservations',org,{id}))[0];return r?this.reservation(r):null;}
  async listReservationsByJob(org:string,id:string){return (await this.rows('arteflow_inventory_reservations',org,{production_job_id:id})).map(r=>this.reservation(r));}
  async listReservationsByMaterial(org:string,id:string){return (await this.rows('arteflow_inventory_reservations',org,{inventory_item_id:id})).map(r=>this.reservation(r));}
  async listMovements(org:string){return (await this.rows('arteflow_inventory_movements',org)).map(r=>this.movement(r));}
  async getMovement(org:string,id:string){const r=(await this.rows('arteflow_inventory_movements',org,{id}))[0];return r?this.movement(r):null;}
  async listMovementsByMaterial(org:string,id:string){return (await this.rows('arteflow_inventory_movements',org,{inventory_item_id:id})).map(r=>this.movement(r));}
}

export function createSupabaseInventoryRepositories(supabase: SupabaseClient): {
  core: SupabaseInventoryRepository; material: IMaterialRepository; requirement: IRequirementRepository;
  reservation: IReservationRepository; movement: IMovementRepository;
} {
  const core = new SupabaseInventoryRepository(supabase);
  const deny = () => Promise.reject(new Error('Estoque conectado só pode ser alterado por RPC transacional.'));
  return {
    core,
    material: { getById:(o,i)=>core.getById(o,i), getBySku:(o,s)=>core.getBySku(o,s), list:o=>core.list(o), save:deny, saveMany:deny, delete:deny, clear:deny },
    requirement: { getById:(o,i)=>core.getRequirement(o,i), listByJobId:(o,i)=>core.listRequirementsByJob(o,i), listAll:o=>core.listRequirements(o), save:deny, saveMany:deny, delete:deny, clear:deny },
    reservation: { getById:(o,i)=>core.getReservation(o,i), listByJobId:(o,i)=>core.listReservationsByJob(o,i), listByMaterialId:(o,i)=>core.listReservationsByMaterial(o,i), listAll:o=>core.listReservations(o), save:deny, saveMany:deny, clear:deny },
    movement: { getById:(o,i)=>core.getMovement(o,i), listByMaterialId:(o,i)=>core.listMovementsByMaterial(o,i), listAll:o=>core.listMovements(o), append:deny, appendMany:deny, clear:deny },
  };
}

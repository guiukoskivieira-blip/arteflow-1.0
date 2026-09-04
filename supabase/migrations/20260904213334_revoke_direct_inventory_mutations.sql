revoke all on public.arteflow_inventory_items, public.arteflow_inventory_requirements,
  public.arteflow_inventory_reservations, public.arteflow_inventory_movements from authenticated;
grant select on public.arteflow_inventory_items, public.arteflow_inventory_requirements,
  public.arteflow_inventory_reservations, public.arteflow_inventory_movements to authenticated;

create policy arteflow_order_sequences_deny_direct_access
on public.arteflow_order_sequences
as restrictive
for all
to authenticated
using (false)
with check (false);

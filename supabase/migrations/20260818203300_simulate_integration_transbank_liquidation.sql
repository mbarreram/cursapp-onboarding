create or replace function public.simulate_integration_transbank_liquidation(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada' using errcode = '42501';
  end if;

  if not private.has_course_role(p_course_id, array['presidente'::text,'tesorero'::text]) then
    raise exception 'Sin permisos para este curso' using errcode = '42501';
  end if;

  update public.pagos p
     set liquidacion_estado = 'liquidado',
         liquidado_at = coalesce(p.liquidado_at, now())
   where p.curso_id = p_course_id
     and lower(coalesce(p.estado,'')) in ('pagado','paid')
     and lower(coalesce(p.canal_recaudacion,'')) = 'transbank'
     and lower(coalesce(p.liquidacion_estado,'')) = 'confirmado'
     and exists (
       select 1
         from public.transbank_transactions t
        where t.pago_id = p.id
          and lower(coalesce(t.environment,'')) = 'integration'
          and upper(coalesce(t.status,'')) = 'APPROVED'
          and coalesce(t.committed_at,t.updated_at,t.created_at) <= now() - interval '2 minutes'
     );

  get diagnostics v_count = row_count;
  return jsonb_build_object('liquidated', v_count, 'simulation_delay_minutes', 2);
end;
$$;

revoke all on function public.simulate_integration_transbank_liquidation(uuid) from public;
revoke all on function public.simulate_integration_transbank_liquidation(uuid) from anon;
grant execute on function public.simulate_integration_transbank_liquidation(uuid) to authenticated;

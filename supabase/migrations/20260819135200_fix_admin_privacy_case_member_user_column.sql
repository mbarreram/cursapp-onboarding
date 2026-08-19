create or replace function public.admin_privacy_case_detail(p_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c public.privacy_compliance_cases%rowtype; result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into c from public.privacy_compliance_cases where id=p_case_id;
  if not found then raise exception 'case_not_found'; end if;
  select jsonb_build_object(
    'case',to_jsonb(c),
    'subject',(select to_jsonb(x) from (select id,email,nombre,telefono,estado,created_at from public.usuarios where id=c.subject_user_id) x),
    'request',(select to_jsonb(r) from public.privacy_rights_requests r where r.id=c.privacy_request_id),
    'consents',coalesce((select jsonb_agg(to_jsonb(z) order by z.fecha_aceptacion desc) from (select id,version,privacidad_aceptada,terminos_aceptados,mercado_aceptado,fecha_aceptacion,created_at from public.consentimientos_usuario where usuario_id=c.subject_user_id order by fecha_aceptacion desc limit 10) z),'[]'::jsonb),
    'memberships',coalesce((select jsonb_agg(to_jsonb(m)) from (select mc.id,mc.curso_id,mc.rol,mc.nombre_alumno,mc.estado,mc.created_at,cu.course_key,cu.nivel,cu.letra,cu.jornada,co.nombre as colegio from public.miembros_curso mc left join public.cursos cu on cu.id=mc.curso_id left join public.colegios co on co.id=cu.colegio_id where mc.usuario_id=c.subject_user_id) m),'[]'::jsonb),
    'data_inventory',jsonb_build_object(
      'memberships',(select count(*) from public.miembros_curso where usuario_id=c.subject_user_id),
      'payments',(select count(*) from public.pagos p join public.miembros_curso mc on mc.id=p.miembro_id where mc.usuario_id=c.subject_user_id),
      'consents',(select count(*) from public.consentimientos_usuario where usuario_id=c.subject_user_id),
      'notifications',(select count(*) from public.notifications where user_id=c.subject_user_id),
      'privacy_requests',(select count(*) from public.privacy_rights_requests where user_id=c.subject_user_id)
    ),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.privacy_audit_log a where a.case_id=c.id),'[]'::jsonb)
  ) into result;
  insert into public.privacy_audit_log(case_id,privacy_request_id,subject_user_id,event_type,entity_type,entity_id,event_summary,metadata)
  values(c.id,c.privacy_request_id,c.subject_user_id,'case_viewed','privacy_compliance_case',c.id::text,'Expediente consultado por administrador','{}'::jsonb);
  return result;
end;
$$;
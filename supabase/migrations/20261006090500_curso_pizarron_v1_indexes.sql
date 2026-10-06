-- MiCursoX · índices adicionales Pizarrón V1
create index if not exists idx_curso_pizarron_posts_autor_miembro
  on public.curso_pizarron_posts(autor_miembro_id);
create index if not exists idx_curso_pizarron_colab_colegio
  on public.curso_pizarron_colaboraciones(colegio_id);
create index if not exists idx_curso_pizarron_colab_asignado_miembro
  on public.curso_pizarron_colaboraciones(asignado_miembro_id);

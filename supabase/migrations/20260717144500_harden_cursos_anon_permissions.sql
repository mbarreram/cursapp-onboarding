drop policy if exists dev_all_cursos on public.cursos;
revoke update, delete on public.cursos from anon;

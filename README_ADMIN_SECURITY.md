# Admin seguro · Bloque 1

La consola administrativa requiere una sesión válida de Supabase Auth y un registro activo en `public.admin_users`.

Los tickets, respuestas, alertas globales y banners administrativos se persisten en Supabase. Los módulos seguros no almacenan datos de negocio en `localStorage`; una verificación automática protege esta regla.

Las tablas heredadas se mantienen temporalmente y no se eliminan en este bloque.

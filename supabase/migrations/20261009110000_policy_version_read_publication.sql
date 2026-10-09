-- Lectura de documentos publicados solamente. Sin modificaciones a consentimientos.
DROP POLICY IF EXISTS politicas_publicadas_lectura_autenticada ON public.politicas_versiones;
CREATE POLICY politicas_publicadas_lectura_autenticada ON public.politicas_versiones FOR SELECT TO authenticated USING (vigente = true);

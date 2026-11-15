-- 0012 · pg_trgm para capaz_app. La extensión vive en `public` y 0000 revoca todo de PUBLIC sobre ese
-- esquema, así que `similarity()` y el operador `%` fallaban con «permission denied for schema public».
-- Solo `usage` (nunca `create`); capaz_sistema y capaz_auth no reciben nada. La extensión no se mueve.
grant usage on schema public to capaz_app;

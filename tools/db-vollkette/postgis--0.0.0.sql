-- TEST STUB ONLY: provides names the baseline references, no PostGIS semantics.
CREATE DOMAIN @extschema@.geography AS text;
CREATE TABLE @extschema@.spatial_ref_sys (srid integer PRIMARY KEY, auth_name varchar(256), auth_srid integer, srtext varchar(2048), proj4text varchar(2048));
CREATE VIEW @extschema@.geography_columns AS SELECT NULL::name AS f_table_name WHERE false;
CREATE VIEW @extschema@.geometry_columns AS SELECT NULL::name AS f_table_name WHERE false;

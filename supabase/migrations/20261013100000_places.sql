-- Places: countries → cities → districts → neighbourhoods.
--
-- * All of Madrid is loaded (21 districts, 131 neighbourhoods) so listings can say exactly
--   where they are, but only some places have a group chat. New groups are opened by the
--   team when enough people show interest (see public.moderation_area_interest).
-- * Neighbourhoods use the names people actually say (Malasaña, Chueca, Lavapiés…),
--   with the official name kept alongside (Universidad, Justicia, Embajadores…).
-- * Listings now point to places (area_ids) instead of to chat groups.

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2}$'),
  name_es text not null,
  name_en text not null,
  sort_order integer not null default 0
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries (id) on delete cascade,
  slug text not null unique,
  name text not null,
  -- Only active cities appear in the app.
  is_active boolean not null default false,
  photo_credit text,
  sort_order integer not null default 0
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  -- Neighbourhoods belong to a district; districts have no parent.
  parent_id uuid references public.areas (id) on delete cascade,
  kind text not null check (kind in ('district', 'neighbourhood')),
  code text,
  slug text not null,
  name text not null,
  official_name text not null,
  sort_order integer not null default 0,
  unique (city_id, slug),
  check ((kind = 'district') = (parent_id is null))
);

create index areas_city_id_parent_id_idx on public.areas (city_id, parent_id);

alter table public.countries enable row level security;
alter table public.cities enable row level security;
alter table public.areas enable row level security;

create policy "Logged-in users can view countries" on public.countries for select to authenticated using (true);
create policy "Logged-in users can view cities" on public.cities for select to authenticated using (true);
create policy "Logged-in users can view areas" on public.areas for select to authenticated using (true);

-- Data ------------------------------------------------------------------------

insert into public.countries (code, name_es, name_en) values ('ES', 'España', 'Spain');

insert into public.cities (country_id, slug, name, is_active, photo_credit)
select id, 'madrid', 'Madrid', true, 'Foto: Cristina Pérez Chocano · CC BY-SA 3.0 ES'
from public.countries where code = 'ES';

insert into public.areas (city_id, kind, code, slug, name, official_name, sort_order)
select c.id, 'district', d.code, d.slug, d.name, d.official_name, d.sort_order
from public.cities c,
(values
  ('1', 'centro', 'Centro', 'Centro', 1),
  ('2', 'arganzuela', 'Arganzuela', 'Arganzuela', 2),
  ('3', 'retiro', 'Retiro', 'Retiro', 3),
  ('4', 'salamanca', 'Salamanca', 'Salamanca', 4),
  ('5', 'chamartin', 'Chamartín', 'Chamartín', 5),
  ('6', 'tetuan', 'Tetuán', 'Tetuán', 6),
  ('7', 'chamberi', 'Chamberí', 'Chamberí', 7),
  ('8', 'fuencarral-el-pardo', 'Fuencarral-El Pardo', 'Fuencarral-El Pardo', 8),
  ('9', 'moncloa-aravaca', 'Moncloa-Aravaca', 'Moncloa-Aravaca', 9),
  ('10', 'latina', 'Latina', 'Latina', 10),
  ('11', 'carabanchel', 'Carabanchel', 'Carabanchel', 11),
  ('12', 'usera', 'Usera', 'Usera', 12),
  ('13', 'puente-de-vallecas', 'Puente de Vallecas', 'Puente de Vallecas', 13),
  ('14', 'moratalaz', 'Moratalaz', 'Moratalaz', 14),
  ('15', 'ciudad-lineal', 'Ciudad Lineal', 'Ciudad Lineal', 15),
  ('16', 'hortaleza', 'Hortaleza', 'Hortaleza', 16),
  ('17', 'villaverde', 'Villaverde', 'Villaverde', 17),
  ('18', 'villa-de-vallecas', 'Villa de Vallecas', 'Villa de Vallecas', 18),
  ('19', 'vicalvaro', 'Vicálvaro', 'Vicálvaro', 19),
  ('20', 'san-blas-canillejas', 'San Blas-Canillejas', 'San Blas-Canillejas', 20),
  ('21', 'barajas', 'Barajas', 'Barajas', 21)
) as d (code, slug, name, official_name, sort_order)
where c.slug = 'madrid';

insert into public.areas (city_id, parent_id, kind, code, slug, name, official_name, sort_order)
select c.id, parent.id, 'neighbourhood', n.code, n.slug, n.name, n.official_name, n.sort_order
from public.cities c
cross join (values
  ('1', '11', 'la-latina', 'La Latina', 'Palacio', 11),
  ('1', '12', 'lavapies', 'Lavapiés', 'Embajadores', 12),
  ('1', '13', 'huertas', 'Huertas', 'Cortes', 13),
  ('1', '14', 'chueca', 'Chueca', 'Justicia', 14),
  ('1', '15', 'malasana', 'Malasaña', 'Universidad', 15),
  ('1', '16', 'sol', 'Sol', 'Sol', 16),
  ('2', '21', 'imperial', 'Imperial', 'Imperial', 21),
  ('2', '22', 'acacias', 'Acacias', 'Acacias', 22),
  ('2', '23', 'chopera', 'Chopera', 'Chopera', 23),
  ('2', '24', 'legazpi', 'Legazpi', 'Legazpi', 24),
  ('2', '25', 'delicias', 'Delicias', 'Delicias', 25),
  ('2', '26', 'palos-de-la-frontera', 'Palos de la Frontera', 'Palos de la Frontera', 26),
  ('2', '27', 'atocha', 'Atocha', 'Atocha', 27),
  ('3', '31', 'pacifico', 'Pacífico', 'Pacífico', 31),
  ('3', '32', 'adelfas', 'Adelfas', 'Adelfas', 32),
  ('3', '33', 'estrella', 'Estrella', 'Estrella', 33),
  ('3', '34', 'ibiza', 'Ibiza', 'Ibiza', 34),
  ('3', '35', 'jeronimos', 'Jerónimos', 'Jerónimos', 35),
  ('3', '36', 'nino-jesus', 'Niño Jesús', 'Niño Jesús', 36),
  ('4', '41', 'recoletos', 'Recoletos', 'Recoletos', 41),
  ('4', '42', 'goya', 'Goya', 'Goya', 42),
  ('4', '43', 'fuente-del-berro', 'Fuente del Berro', 'Fuente del Berro', 43),
  ('4', '44', 'la-guindalera', 'La Guindalera', 'La Guindalera', 44),
  ('4', '45', 'lista', 'Lista', 'Lista', 45),
  ('4', '46', 'castellana', 'Castellana', 'Castellana', 46),
  ('5', '51', 'el-viso', 'El Viso', 'El Viso', 51),
  ('5', '52', 'prosperidad', 'Prosperidad', 'Prosperidad', 52),
  ('5', '53', 'ciudad-jardin', 'Ciudad Jardín', 'Ciudad Jardín', 53),
  ('5', '54', 'hispanoamerica', 'Hispanoamérica', 'Hispanoamérica', 54),
  ('5', '55', 'nueva-espana', 'Nueva España', 'Nueva España', 55),
  ('5', '56', 'castilla', 'Castilla', 'Castilla', 56),
  ('6', '61', 'bellas-vistas', 'Bellas Vistas', 'Bellas Vistas', 61),
  ('6', '62', 'cuatro-caminos', 'Cuatro Caminos', 'Cuatro Caminos', 62),
  ('6', '63', 'castillejos', 'Castillejos', 'Castillejos', 63),
  ('6', '64', 'almenara', 'Almenara', 'Almenara', 64),
  ('6', '65', 'valdeacederas', 'Valdeacederas', 'Valdeacederas', 65),
  ('6', '66', 'berruguete', 'Berruguete', 'Berruguete', 66),
  ('7', '71', 'gaztambide', 'Gaztambide', 'Gaztambide', 71),
  ('7', '72', 'arapiles', 'Arapiles', 'Arapiles', 72),
  ('7', '73', 'trafalgar', 'Trafalgar', 'Trafalgar', 73),
  ('7', '74', 'almagro', 'Almagro', 'Almagro', 74),
  ('7', '75', 'rios-rosas', 'Ríos Rosas', 'Ríos Rosas', 75),
  ('7', '76', 'vallehermoso', 'Vallehermoso', 'Vallehermoso', 76),
  ('8', '81', 'el-pardo', 'El Pardo', 'El Pardo', 81),
  ('8', '82', 'fuentelarreina', 'Fuentelarreina', 'Fuentelarreina', 82),
  ('8', '83', 'penagrande', 'Peñagrande', 'Peñagrande', 83),
  ('8', '84', 'el-pilar', 'El Pilar', 'El Pilar', 84),
  ('8', '85', 'la-paz', 'La Paz', 'La Paz', 85),
  ('8', '86', 'valverde', 'Valverde', 'Valverde', 86),
  ('8', '87', 'mirasierra', 'Mirasierra', 'Mirasierra', 87),
  ('8', '88', 'el-goloso', 'El Goloso', 'El Goloso', 88),
  ('9', '91', 'casa-de-campo', 'Casa de Campo', 'Casa de Campo', 91),
  ('9', '92', 'arguelles', 'Argüelles', 'Argüelles', 92),
  ('9', '93', 'ciudad-universitaria', 'Ciudad Universitaria', 'Ciudad Universitaria', 93),
  ('9', '94', 'valdezarza', 'Valdezarza', 'Valdezarza', 94),
  ('9', '95', 'valdemarin', 'Valdemarín', 'Valdemarín', 95),
  ('9', '96', 'el-plantio', 'El Plantío', 'El Plantío', 96),
  ('9', '97', 'aravaca', 'Aravaca', 'Aravaca', 97),
  ('10', '101', 'los-carmenes', 'Los Cármenes', 'Los Cármenes', 101),
  ('10', '102', 'puerta-del-angel', 'Puerta del Ángel', 'Puerta del Ángel', 102),
  ('10', '103', 'lucero', 'Lucero', 'Lucero', 103),
  ('10', '104', 'aluche', 'Aluche', 'Aluche', 104),
  ('10', '105', 'campamento', 'Campamento', 'Campamento', 105),
  ('10', '106', 'cuatro-vientos', 'Cuatro Vientos', 'Cuatro Vientos', 106),
  ('10', '107', 'las-aguilas', 'Las Águilas', 'Las Águilas', 107),
  ('11', '111', 'comillas', 'Comillas', 'Comillas', 111),
  ('11', '112', 'opanel', 'Opañel', 'Opañel', 112),
  ('11', '113', 'san-isidro', 'San Isidro', 'San Isidro', 113),
  ('11', '114', 'vista-alegre', 'Vista Alegre', 'Vista Alegre', 114),
  ('11', '115', 'puerta-bonita', 'Puerta Bonita', 'Puerta Bonita', 115),
  ('11', '116', 'buenavista', 'Buenavista', 'Buenavista', 116),
  ('11', '117', 'abrantes', 'Abrantes', 'Abrantes', 117),
  ('12', '121', 'orcasitas', 'Orcasitas', 'Orcasitas', 121),
  ('12', '122', 'orcasur', 'Orcasur', 'Orcasur', 122),
  ('12', '123', 'san-fermin', 'San Fermín', 'San Fermín', 123),
  ('12', '124', 'almendrales', 'Almendrales', 'Almendrales', 124),
  ('12', '125', 'moscardo', 'Moscardó', 'Moscardó', 125),
  ('12', '126', 'zofio', 'Zofío', 'Zofío', 126),
  ('12', '127', 'pradolongo', 'Pradolongo', 'Pradolongo', 127),
  ('13', '131', 'entrevias', 'Entrevías', 'Entrevías', 131),
  ('13', '132', 'san-diego', 'San Diego', 'San Diego', 132),
  ('13', '133', 'palomeras-bajas', 'Palomeras Bajas', 'Palomeras Bajas', 133),
  ('13', '134', 'palomeras-sureste', 'Palomeras Sureste', 'Palomeras Sureste', 134),
  ('13', '135', 'portazgo', 'Portazgo', 'Portazgo', 135),
  ('13', '136', 'numancia', 'Numancia', 'Numancia', 136),
  ('14', '141', 'pavones', 'Pavones', 'Pavones', 141),
  ('14', '142', 'horcajo', 'Horcajo', 'Horcajo', 142),
  ('14', '143', 'marroquina', 'Marroquina', 'Marroquina', 143),
  ('14', '144', 'media-legua', 'Media Legua', 'Media Legua', 144),
  ('14', '145', 'fontarron', 'Fontarrón', 'Fontarrón', 145),
  ('14', '146', 'vinateros', 'Vinateros', 'Vinateros', 146),
  ('15', '151', 'ventas', 'Ventas', 'Ventas', 151),
  ('15', '152', 'pueblo-nuevo', 'Pueblo Nuevo', 'Pueblo Nuevo', 152),
  ('15', '153', 'quintana', 'Quintana', 'Quintana', 153),
  ('15', '154', 'concepcion', 'Concepción', 'Concepción', 154),
  ('15', '155', 'san-pascual', 'San Pascual', 'San Pascual', 155),
  ('15', '156', 'san-juan-bautista', 'San Juan Bautista', 'San Juan Bautista', 156),
  ('15', '157', 'colina', 'Colina', 'Colina', 157),
  ('15', '158', 'atalaya', 'Atalaya', 'Atalaya', 158),
  ('15', '159', 'costillares', 'Costillares', 'Costillares', 159),
  ('16', '161', 'palomas', 'Palomas', 'Palomas', 161),
  ('16', '162', 'piovera', 'Piovera', 'Piovera', 162),
  ('16', '163', 'canillas', 'Canillas', 'Canillas', 163),
  ('16', '164', 'pinar-del-rey', 'Pinar del Rey', 'Pinar del Rey', 164),
  ('16', '165', 'apostol-santiago', 'Apóstol Santiago', 'Apóstol Santiago', 165),
  ('16', '166', 'valdefuentes', 'Valdefuentes', 'Valdefuentes', 166),
  ('17', '171', 'villaverde-alto', 'Villaverde Alto', 'Villaverde Alto', 171),
  ('17', '172', 'san-cristobal', 'San Cristóbal', 'San Cristóbal', 172),
  ('17', '173', 'butarque', 'Butarque', 'Butarque', 173),
  ('17', '174', 'los-rosales', 'Los Rosales', 'Los Rosales', 174),
  ('17', '175', 'los-angeles', 'Los Ángeles', 'Los Ángeles', 175),
  ('18', '181', 'casco-historico-de-vallecas', 'Casco Histórico de Vallecas', 'Casco Histórico de Vallecas', 181),
  ('18', '182', 'santa-eugenia', 'Santa Eugenia', 'Santa Eugenia', 182),
  ('18', '183', 'ensanche-de-vallecas', 'Ensanche de Vallecas', 'Ensanche de Vallecas', 183),
  ('19', '191', 'casco-historico-de-vicalvaro', 'Casco Histórico de Vicálvaro', 'Casco Histórico de Vicálvaro', 191),
  ('19', '192', 'valdebernardo', 'Valdebernardo', 'Valdebernardo', 192),
  ('19', '193', 'valderrivas', 'Valderrivas', 'Valderrivas', 193),
  ('19', '194', 'el-canaveral', 'El Cañaveral', 'El Cañaveral', 194),
  ('20', '201', 'simancas', 'Simancas', 'Simancas', 201),
  ('20', '202', 'hellin', 'Hellín', 'Hellín', 202),
  ('20', '203', 'amposta', 'Amposta', 'Amposta', 203),
  ('20', '204', 'arcos', 'Arcos', 'Arcos', 204),
  ('20', '205', 'rosas', 'Rosas', 'Rosas', 205),
  ('20', '206', 'rejas', 'Rejas', 'Rejas', 206),
  ('20', '207', 'canillejas', 'Canillejas', 'Canillejas', 207),
  ('20', '208', 'salvador', 'Salvador', 'Salvador', 208),
  ('21', '211', 'alameda-de-osuna', 'Alameda de Osuna', 'Alameda de Osuna', 211),
  ('21', '212', 'aeropuerto', 'Aeropuerto', 'Aeropuerto', 212),
  ('21', '213', 'casco-historico-de-barajas', 'Casco Histórico de Barajas', 'Casco Histórico de Barajas', 213),
  ('21', '214', 'timon', 'Timón', 'Timón', 214),
  ('21', '215', 'corralejos', 'Corralejos', 'Corralejos', 215)
) as n (district_code, code, slug, name, official_name, sort_order)
join public.areas parent on parent.city_id = c.id and parent.kind = 'district' and parent.code = n.district_code
where c.slug = 'madrid';

-- Chat groups belong to a city, and (except the city-wide one) to one place ----------

alter table public.chat_groups
  add column city_id uuid references public.cities (id) on delete cascade,
  add column area_id uuid unique references public.areas (id) on delete set null;

update public.chat_groups set city_id = (select id from public.cities where slug = 'madrid');

update public.chat_groups g
set area_id = a.id
from public.areas a
where a.city_id = g.city_id
  and a.slug = case g.slug
    when 'malasana' then 'malasana'
    when 'lavapies' then 'lavapies'
    when 'chamberi' then 'chamberi'
    when 'arguelles-moncloa' then 'moncloa-aravaca'
    when 'chueca' then 'chueca'
    when 'la-latina' then 'la-latina'
    when 'salamanca' then 'salamanca'
    when 'retiro' then 'retiro'
    when 'tetuan' then 'tetuan'
    when 'arganzuela' then 'arganzuela'
  end;

alter table public.chat_groups alter column city_id set not null;

-- Listings point to places ---------------------------------------------------------

alter table public.listings
  add column city_id uuid references public.cities (id) on delete cascade,
  add column area_ids uuid[];

update public.listings set city_id = (select id from public.cities where slug = 'madrid');

-- Old listings: translate their chat groups into places (plus the district of a neighbourhood).
update public.listings l
set area_ids = (
  select array_agg(distinct x)
  from (
    select g.area_id as x from public.chat_groups g where g.id = any (l.district_ids) and g.area_id is not null
    union
    select a.parent_id from public.chat_groups g join public.areas a on a.id = g.area_id
    where g.id = any (l.district_ids) and a.parent_id is not null
  ) places
);
-- Listings that were only in the city-wide group get the Centro district as a fallback.
update public.listings
set area_ids = array[(select id from public.areas where slug = 'centro')]
where area_ids is null or cardinality(area_ids) = 0;

alter table public.listings drop column district_ids;
alter table public.listings alter column city_id set not null;
alter table public.listings alter column area_ids set not null;
alter table public.listings
  add constraint listings_area_count check (cardinality(area_ids) between 1 and 8),
  -- A room or flat is in one district (and optionally one of its neighbourhoods).
  add constraint listings_single_place check (type = 'seeking_room' or cardinality(area_ids) <= 2);

create index listings_area_ids_idx on public.listings using gin (area_ids);
create index listings_city_id_idx on public.listings (city_id);

-- Every place must exist and be in the listing's city; a neighbourhood's district is added
-- automatically, so filtering by district also finds listings in its neighbourhoods.
create function public.listings_check_areas()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  found integer;
begin
  select count(*) into found
  from public.areas
  where id = any (new.area_ids) and city_id = new.city_id;
  if found <> cardinality(array(select distinct unnest(new.area_ids))) then
    raise exception 'invalid_area';
  end if;

  new.area_ids := array(
    select distinct x from (
      select unnest(new.area_ids) as x
      union
      select parent_id from public.areas where id = any (new.area_ids) and parent_id is not null
    ) places
  );
  return new;
end;
$$;

create trigger listings_check_areas
before insert or update of area_ids, city_id on public.listings
for each row execute function public.listings_check_areas();

-- Interest in places that don't have a group yet ------------------------------------

create table public.area_interest (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, area_id)
);

alter table public.area_interest enable row level security;

create policy "Users can see their own interests" on public.area_interest for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users can add interests" on public.area_interest for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users can remove interests" on public.area_interest for delete to authenticated
using ((select auth.uid()) = user_id);

-- For the team: which places without a group have the most interest (and listings).
--   select * from public.moderation_area_interest;
create view public.moderation_area_interest
with (security_invoker = true)
as
select
  a.name,
  a.official_name,
  a.kind,
  parent.name as district,
  a.slug,
  (select count(*) from public.area_interest i where i.area_id = a.id) as interested_people,
  (select count(*) from public.listings l where a.id = any (l.area_ids) and l.status = 'active' and l.expires_at > now()) as active_listings
from public.areas a
left join public.areas parent on parent.id = a.parent_id
where not exists (select 1 from public.chat_groups g where g.area_id = a.id)
order by interested_people desc, active_listings desc, a.name;

revoke all on public.moderation_area_interest from public, anon, authenticated;

-- For the team: open a group chat for a place.
--   select public.open_area_group('madrid', 'ciudad-universitaria', 'CU');
create function public.open_area_group(city_slug text, area_slug text, short_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  place public.areas;
  new_group uuid;
  group_slug text;
begin
  select a.* into place
  from public.areas a join public.cities c on c.id = a.city_id
  where c.slug = city_slug and a.slug = area_slug;
  if place.id is null then
    raise exception 'Place not found: % / %', city_slug, area_slug;
  end if;

  group_slug := case
    when exists (select 1 from public.chat_groups where slug = area_slug) then city_slug || '-' || area_slug
    else area_slug
  end;

  insert into public.chat_groups (slug, name, short_code, is_city_wide, sort_order, city_id, area_id)
  values (
    group_slug,
    place.name,
    upper(short_code),
    false,
    (select coalesce(max(sort_order), 0) + 1 from public.chat_groups),
    place.city_id,
    place.id
  )
  returning id into new_group;

  -- Everyone who asked for this place joins the new group automatically.
  insert into public.group_members (group_id, user_id)
  select new_group, user_id from public.area_interest where area_id = place.id
  on conflict do nothing;
  delete from public.area_interest where area_id = place.id;

  return new_group;
end;
$$;

revoke execute on function public.open_area_group(text, text, text) from public, anon, authenticated;

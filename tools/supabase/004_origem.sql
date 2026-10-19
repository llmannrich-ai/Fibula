-- Fibula · origem do que se negocia na Feira (e venda direto do saco)
-- Depende do 002 e do 003. Pode rodar de novo sem estrago. Sem nenhum comando
-- de apagar: o conector do Supabase não aplica migração que tenha um.
--
-- Decisão do Leonardo, 19/10/2026: só se anuncia o que o jogador tem no cofre
-- ou no saco, e o banco confere de onde veio cada peça e cada moeda.
--
-- O save é gravado pelo cliente, então o saldo dele (cofre, itens) prova
-- pouco: quem edita o JSON cria ouro e peças. A ORIGEM (mercado_lastro) é um
-- segundo saldo, que só o banco mexe, e só por caminhos que ele registra:
--   - extração de uma caçada aberta com caca_comecar e fechada com caca_fim;
--   - negócio na Feira (o que se compra, o que se recebe por venda, devolução);
--   - venda ao Banco (lastro_banco: a peça vira o ouro que o Banco paga);
--   - anistia: o que cada conta já tinha quando esta migração entrou.
-- Anunciar exige os dois saldos: a venda do cofre precisa da peça no save E na
-- origem, a compra precisa do ouro no cofre E na origem. Gasto no Mercador
-- não passa pelo banco: a origem pode ficar maior que o cofre, e vale o menor.
--
-- O saco: na caçada, o jogador pode anunciar a venda de uma peça do saco
-- (escolha do Leonardo: livre, mesmo que depois morra). O cliente manda o saco
-- que tem e a caçada aberta; o banco confere contra limites de plausibilidade,
-- porque não roda a masmorra (isso é o servidor da F2):
--   - a caçada é do jogador, está aberta e começou há pelo menos 20 s;
--   - no máximo 30 peças por caçada (vendidas do saco + extraídas);
--   - no máximo 60 peças com origem em caçada por jogador em 24 h;
--   - extração só depois de 85 s de caçada (o portal abre aos 90 s);
--   - no máximo 20.000 de ouro por caçada (5.000 do Selo na morte).
-- Não é anti-trapaça completo: quem forjar chamadas ainda tira até esses
-- limites. Fecha o caminho fácil (editar o save) e põe teto no difícil.

create table if not exists public.mercado_lastro (
  jogador uuid primary key references public.jogadores (id) on delete cascade,
  ouro    bigint not null default 0 check (ouro >= 0),
  itens   jsonb not null default '{}'::jsonb
);
comment on table public.mercado_lastro is 'Ouro e peças cuja origem o banco registrou: o limite do que se anuncia na Feira.';

create table if not exists public.cacadas (
  id       bigint generated always as identity primary key,
  jogador  uuid not null references public.jogadores (id) on delete cascade,
  inicio   timestamptz not null default now(),
  fim      timestamptz,
  desfecho text,
  vendido  jsonb not null default '{}'::jsonb,
  pecas    integer not null default 0,
  ouro     bigint not null default 0
);
create index if not exists cacadas_jogador on public.cacadas (jogador, inicio desc);
comment on table public.cacadas is 'Caçadas registradas para dar origem ao loot: o que saiu do saco e o que foi extraído.';

create table if not exists public.fibula_marcos (
  nome   text primary key,
  quando timestamptz not null default now()
);
comment on table public.fibula_marcos is 'Passos de migração que só podem rodar uma vez.';

alter table public.mercado_lastro enable row level security;
alter table public.cacadas enable row level security;
alter table public.fibula_marcos enable row level security;
revoke all on public.mercado_lastro, public.cacadas, public.fibula_marcos from anon, authenticated;

-- Anistia, uma vez só: o que cada conta tem hoje (cofre, peças guardadas e
-- vestidas) ganha origem. Conta criada depois começa do zero.
do $$
begin
  if exists (select 1 from public.fibula_marcos where nome = 'anistia_lastro') then return; end if;
  insert into public.fibula_marcos (nome) values ('anistia_lastro');
  insert into public.mercado_lastro (jogador, ouro, itens)
  select s.jogador,
    case when jsonb_typeof(s.dados -> 'cofre') = 'number' then greatest(floor((s.dados ->> 'cofre')::numeric), 0)::bigint else 0 end,
    coalesce((select jsonb_object_agg(x.item, x.q) from (
      select p.item, sum(p.q)::integer q from (
        select e.key item, floor((e.value #>> '{}')::numeric)::integer q
          from jsonb_each(case when jsonb_typeof(s.dados -> 'itens') = 'object' then s.dados -> 'itens' else '{}'::jsonb end) e
         where jsonb_typeof(e.value) = 'number'
        union all
        select eq.value #>> '{}', 1
          from jsonb_each(case when jsonb_typeof(s.dados -> 'chars') = 'object' then s.dados -> 'chars' else '{}'::jsonb end) c,
               jsonb_each(case when jsonb_typeof(c.value -> 'equip') = 'object' then c.value -> 'equip' else '{}'::jsonb end) eq
         where jsonb_typeof(eq.value) = 'string'
      ) p where p.q > 0 and p.item ~ '^[a-z0-9_]{1,24}$' group by p.item) x), '{}'::jsonb)
  from public.saves_jogador s
  on conflict (jogador) do nothing;
end;
$$;

-- a linha de origem do jogador, travada para alterar
create or replace function public._lastro(p_j uuid)
returns public.mercado_lastro
language plpgsql
security definer
set search_path = ''
as $$
declare r public.mercado_lastro;
begin
  insert into public.mercado_lastro (jogador) values (p_j) on conflict (jogador) do nothing;
  select * into r from public.mercado_lastro l where l.jogador = p_j for update;
  return r;
end;
$$;

-- soma (ou tira, com número negativo) ouro e peças na origem
create or replace function public._lastro_soma(p_j uuid, p_ouro bigint, p_item text, p_n integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._lastro(p_j);
  update public.mercado_lastro l
     set ouro = greatest(l.ouro + p_ouro, 0),
         itens = case when p_item is null then l.itens else public._mercado_soma(l.itens, p_item, p_n) end
   where l.jogador = p_j;
end;
$$;

-- peças (só os valores inteiros positivos) de um saco mandado pelo cliente
create or replace function public._saco_pecas(p_saco jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(greatest(floor((e.value #>> '{}')::numeric), 0)), 0)::integer
    from jsonb_each(case when jsonb_typeof(p_saco) = 'object' then p_saco else '{}'::jsonb end) e
   where jsonb_typeof(e.value) = 'number';
$$;

-- peças com origem em caçada nas últimas 24 h
create or replace function public._pecas_do_dia(p_j uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.pecas), 0)::integer from public.cacadas c
   where c.jogador = p_j and c.inicio > now() - interval '1 day';
$$;

-- abre uma caçada; fecha sem crédito a que tiver ficado aberta
create or replace function public.caca_comecar(p_token text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid := public._fibula_dono(p_token); r bigint;
begin
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  update public.cacadas c set fim = now(), desfecho = 'abandonou' where c.jogador = j and c.fim is null;
  insert into public.cacadas (jogador) values (j) returning id into r;
  return r;
end;
$$;

-- fecha a caçada: na extração, as peças que sobraram no saco e o ouro ganham
-- origem; na morte, só o ouro que o Selo de resguardo guardou
create or replace function public.caca_fim(p_token text, p_id bigint, p_desfecho text, p_saco jsonb, p_ouro bigint)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid := public._fibula_dono(p_token); c public.cacadas; n integer; o bigint; k text; v jsonb; pec jsonb := '{}'::jsonb;
begin
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('fibula_mercado'));
  select * into c from public.cacadas x where x.id = p_id and x.jogador = j for update;
  if c.id is null or c.fim is not null then raise exception 'caca' using errcode = 'P0001'; end if;
  o := least(greatest(coalesce(p_ouro, 0), 0), 20000);
  if p_desfecho = 'extraiu' then
    if now() - c.inicio < interval '85 seconds' then
      -- fecha sem crédito; erro em vez de exceção, que desfaria o fechamento
      update public.cacadas x set fim = now(), desfecho = 'cedo' where x.id = c.id;
      return json_build_object('pecas', 0, 'ouro', 0, 'erro', 'caca_curta');
    end if;
    for k, v in select * from jsonb_each(case when jsonb_typeof(p_saco) = 'object' then p_saco else '{}'::jsonb end) loop
      if k ~ '^[a-z0-9_]{1,24}$' and jsonb_typeof(v) = 'number' and floor((v #>> '{}')::numeric) > 0 then
        pec := public._mercado_soma(pec, k, floor((v #>> '{}')::numeric)::integer);
      end if;
    end loop;
    n := public._saco_pecas(pec);
    if c.pecas + n > 30 or public._pecas_do_dia(j) + n > 60 then
      update public.cacadas x set fim = now(), desfecho = 'limite' where x.id = c.id;
      return json_build_object('pecas', 0, 'ouro', 0, 'erro', 'saco_limite');
    end if;
    for k, v in select * from jsonb_each(pec) loop
      perform public._lastro_soma(j, 0, k, (v #>> '{}')::integer);
    end loop;
  else
    n := 0;
    o := least(o, 5000);
  end if;
  perform public._lastro_soma(j, o, null, 0);
  update public.cacadas x set fim = now(), desfecho = coalesce(p_desfecho, 'morreu'), pecas = x.pecas + n, ouro = o where x.id = c.id;
  return json_build_object('pecas', n, 'ouro', o);
end;
$$;

-- venda de uma peça ao Banco: a peça sai da origem e o ouro que o Banco paga entra
create or replace function public.lastro_banco(p_token text, p_item text, p_val integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid := public._fibula_dono(p_token); l public.mercado_lastro;
begin
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  if p_item is null or p_item !~ '^[a-z0-9_]{1,24}$' then return; end if;
  l := public._lastro(j);
  if coalesce((l.itens ->> p_item)::integer, 0) < 1 then return; end if;
  perform public._lastro_soma(j, least(greatest(coalesce(p_val, 0), 0), 500), p_item, -1);
end;
$$;

-- o livro, agora com a origem do jogador
create or replace function public.mercado_livro(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare j uuid := public._fibula_dono(p_token);
begin
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  return json_build_object(
    'taxa', 2,
    'itens', coalesce((
      select json_object_agg(i.item, json_build_object(
        'venda', coalesce((select json_agg(json_build_array(x.preco, x.q) order by x.preco)
          from (select o.preco, sum(o.resta)::integer q from public.mercado_ordens o
                where o.fechado is null and o.item = i.item and o.lado = 'venda'
                group by o.preco order by o.preco limit 5) x), '[]'),
        'compra', coalesce((select json_agg(json_build_array(x.preco, x.q) order by x.preco desc)
          from (select o.preco, sum(o.resta)::integer q from public.mercado_ordens o
                where o.fechado is null and o.item = i.item and o.lado = 'compra'
                group by o.preco order by o.preco desc limit 5) x), '[]'),
        'ultimo', (select n.preco from public.mercado_negocios n where n.item = i.item order by n.id desc limit 1),
        'dia', (select coalesce(sum(n.qtd), 0) from public.mercado_negocios n
                where n.item = i.item and n.quando > now() - interval '1 day')))
      from (select distinct o.item from public.mercado_ordens o where o.fechado is null
            union select distinct n.item from public.mercado_negocios n where n.quando > now() - interval '30 days') i
    ), '{}'),
    'minhas', coalesce((
      select json_agg(json_build_object('id', o.id, 'lado', o.lado, 'item', o.item, 'preco', o.preco, 'qtd', o.qtd, 'resta', o.resta) order by o.id desc)
      from public.mercado_ordens o where o.jogador = j and o.fechado is null), '[]'),
    'caixa', (select json_build_object('ouro', c.ouro, 'itens', c.itens) from public.mercado_caixa c where c.jogador = j),
    'lastro', coalesce((select json_build_object('ouro', l.ouro, 'itens', l.itens) from public.mercado_lastro l where l.jogador = j),
                       json_build_object('ouro', 0, 'itens', '{}'::json))
  );
end;
$$;

-- anuncia do cofre (p_caca null) ou do saco de uma caçada aberta (p_caca e
-- p_saco); casa na hora o que der; o resto fica no livro
create or replace function public.mercado_anunciar(p_token text, p_lado text, p_item text, p_preco integer, p_qtd integer, p_caca bigint, p_saco jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  j uuid; d jsonb; rec jsonb; o public.mercado_ordens; l public.mercado_lastro; c public.cacadas; n integer; q integer;
  meu bigint; falta integer := p_qtd; feitos integer := 0; ouro bigint := 0; taxa bigint := 0; total bigint;
begin
  if p_lado is null or p_lado not in ('compra', 'venda') then raise exception 'lado' using errcode = 'P0001'; end if;
  if p_item is null or p_item !~ '^[a-z0-9_]{1,24}$' then raise exception 'item' using errcode = 'P0001'; end if;
  if p_preco is null or p_preco not between 1 and 1000000 then raise exception 'preco' using errcode = 'P0001'; end if;
  if p_qtd is null or p_qtd not between 1 and 100 then raise exception 'qtd' using errcode = 'P0001'; end if;
  if p_caca is not null and p_lado <> 'venda' then raise exception 'lado' using errcode = 'P0001'; end if;
  select x.j, x.d, x.recebido into j, d, rec from public._mercado_inicio(p_token) x;
  if (select count(*) from public.mercado_ordens m where m.jogador = j and m.fechado is null) >= 10 then
    raise exception 'limite' using errcode = 'P0001';
  end if;
  l := public._lastro(j);

  -- custódia: o que se oferece sai do save (ou do saco) e da origem agora
  if p_lado = 'compra' then
    if (d ->> 'cofre')::bigint < p_preco::bigint * p_qtd then raise exception 'sem_ouro' using errcode = 'P0001'; end if;
    if l.ouro < p_preco::bigint * p_qtd then raise exception 'sem_origem' using errcode = 'P0001'; end if;
    d := jsonb_set(d, '{cofre}', to_jsonb((d ->> 'cofre')::bigint - p_preco::bigint * p_qtd));
    perform public._lastro_soma(j, -(p_preco::bigint * p_qtd), null, 0);
  elsif p_caca is null then
    if coalesce((d -> 'itens' ->> p_item)::integer, 0) < p_qtd then raise exception 'sem_peca' using errcode = 'P0001'; end if;
    if coalesce((l.itens ->> p_item)::integer, 0) < p_qtd then raise exception 'sem_origem' using errcode = 'P0001'; end if;
    d := jsonb_set(d, '{itens}', public._mercado_soma(d -> 'itens', p_item, -p_qtd));
    perform public._lastro_soma(j, 0, p_item, -p_qtd);
  else
    -- do saco: a caçada é deste jogador, está aberta e o saco é plausível
    select * into c from public.cacadas x where x.id = p_caca and x.jogador = j for update;
    if c.id is null or c.fim is not null or c.inicio < now() - interval '6 hours' then raise exception 'caca' using errcode = 'P0001'; end if;
    if c.inicio > now() - interval '20 seconds' then raise exception 'caca_cedo' using errcode = 'P0001'; end if;
    if jsonb_typeof(p_saco -> p_item) is distinct from 'number' or floor((p_saco ->> p_item)::numeric) < p_qtd then
      raise exception 'sem_peca' using errcode = 'P0001';
    end if;
    if c.pecas + p_qtd > 30 or public._pecas_do_dia(j) + p_qtd > 60 then raise exception 'saco_limite' using errcode = 'P0001'; end if;
    update public.cacadas x set vendido = public._mercado_soma(x.vendido, p_item, p_qtd), pecas = x.pecas + p_qtd where x.id = c.id;
  end if;
  insert into public.mercado_ordens (jogador, lado, item, preco, qtd, resta)
  values (j, p_lado, p_item, p_preco, p_qtd, p_qtd) returning id into meu;

  -- match: melhor preço primeiro, no mesmo preço a mais antiga; nunca consigo mesmo
  for o in
    select * from public.mercado_ordens m
    where m.fechado is null and m.item = p_item and m.jogador <> j
      and m.lado = case when p_lado = 'compra' then 'venda' else 'compra' end
      and case when p_lado = 'compra' then m.preco <= p_preco else m.preco >= p_preco end
    order by case when p_lado = 'compra' then m.preco else -m.preco end, m.id
    for update
  loop
    exit when falta = 0;
    q := least(falta, o.resta);
    total := o.preco::bigint * q;
    falta := falta - q; feitos := feitos + q;
    update public.mercado_ordens m set resta = m.resta - q, fechado = case when m.resta - q = 0 then now() end where m.id = o.id;
    if p_lado = 'compra' then
      -- comprei pelo preço da venda: a peça vem para mim, a diferença volta
      d := jsonb_set(d, '{itens}', public._mercado_soma(d -> 'itens', p_item, q));
      d := jsonb_set(d, '{cofre}', to_jsonb((d ->> 'cofre')::bigint + (p_preco - o.preco)::bigint * q));
      perform public._lastro_soma(j, (p_preco - o.preco)::bigint * q, p_item, q);
      ouro := ouro + total;
      n := public._mercado_taxa(total)::integer;
      perform public._mercado_caixa(o.jogador, total - n, null, 0);
      perform public._lastro_soma(o.jogador, total - n, null, 0);
      insert into public.mercado_negocios (item, preco, qtd, vendedor, comprador) values (p_item, o.preco, q, o.jogador, j);
    else
      -- vendi pelo preço da compra: o ouro dela já estava preso, a peça vai para a caixa de quem comprou
      n := public._mercado_taxa(total)::integer;
      d := jsonb_set(d, '{cofre}', to_jsonb((d ->> 'cofre')::bigint + total - n));
      perform public._lastro_soma(j, total - n, null, 0);
      ouro := ouro + total - n; taxa := taxa + n;
      perform public._mercado_caixa(o.jogador, 0, p_item, q);
      perform public._lastro_soma(o.jogador, 0, p_item, q);
      insert into public.mercado_negocios (item, preco, qtd, vendedor, comprador) values (p_item, o.preco, q, j, o.jogador);
    end if;
  end loop;
  update public.mercado_ordens m set resta = falta, fechado = case when falta = 0 then now() end where m.id = meu;

  return public._mercado_fim(j, d, rec, jsonb_build_object(
    'ordem', case when falta > 0 then meu end, 'feitos', feitos, 'resta', falta, 'ouro', ouro, 'taxa', taxa));
end;
$$;

-- a assinatura antiga (cliente com cache de antes desta migração): do cofre
create or replace function public.mercado_anunciar(p_token text, p_lado text, p_item text, p_preco integer, p_qtd integer)
returns json
language sql
security definer
set search_path = ''
as $$ select public.mercado_anunciar(p_token, p_lado, p_item, p_preco, p_qtd, null::bigint, null::jsonb); $$;

-- cancelar devolve ao cofre e à origem (a venda do saco volta para o cofre)
create or replace function public.mercado_cancelar(p_token text, p_id bigint)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid; d jsonb; rec jsonb; o public.mercado_ordens;
begin
  select x.j, x.d, x.recebido into j, d, rec from public._mercado_inicio(p_token) x;
  select * into o from public.mercado_ordens m where m.id = p_id and m.jogador = j and m.fechado is null for update;
  if o.id is null then raise exception 'ordem' using errcode = 'P0001'; end if;
  update public.mercado_ordens set fechado = now() where id = o.id;
  if o.lado = 'compra' then
    d := jsonb_set(d, '{cofre}', to_jsonb((d ->> 'cofre')::bigint + o.preco::bigint * o.resta));
    perform public._lastro_soma(j, o.preco::bigint * o.resta, null, 0);
  else
    d := jsonb_set(d, '{itens}', public._mercado_soma(d -> 'itens', o.item, o.resta));
    perform public._lastro_soma(j, 0, o.item, o.resta);
  end if;
  return public._mercado_fim(j, d, rec, null);
end;
$$;

revoke all on function public._lastro(uuid) from public, anon, authenticated;
revoke all on function public._lastro_soma(uuid, bigint, text, integer) from public, anon, authenticated;
revoke all on function public._saco_pecas(jsonb) from public, anon, authenticated;
revoke all on function public._pecas_do_dia(uuid) from public, anon, authenticated;
grant execute on function public.caca_comecar(text) to anon, authenticated;
grant execute on function public.caca_fim(text, bigint, text, jsonb, bigint) to anon, authenticated;
grant execute on function public.lastro_banco(text, text, integer) to anon, authenticated;
grant execute on function public.mercado_livro(text) to anon, authenticated;
grant execute on function public.mercado_anunciar(text, text, text, integer, integer, bigint, jsonb) to anon, authenticated;
grant execute on function public.mercado_anunciar(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.mercado_cancelar(text, bigint) to anon, authenticated;

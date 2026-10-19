-- Fibula · mercado entre jogadores (livro de ofertas com match automático)
-- Depende do 002_login_simples.sql (jogadores, sessoes, saves_jogador,
-- _fibula_dono). Pode rodar de novo sem estrago: "if not exists" / "or replace".
--
-- O que é: cada jogador anuncia COMPRA ou VENDA de uma peça do cofre a um preço
-- por unidade. Ao anunciar, o banco procura a oferta oposta que casa (venda com
-- preço <= ao da compra, compra com preço >= ao da venda), da melhor para a
-- pior e, no mesmo preço, da mais antiga para a mais nova. O negócio sai pelo
-- preço de quem já estava no livro. O que não casa fica anunciado até alguém
-- casar ou o dono cancelar.
--
-- Quem decide é o banco, nunca o navegador: as funções abaixo leem e alteram o
-- save que está na nuvem (saves_jogador) na mesma transação em que mexem no
-- livro, e devolvem o cofre e as peças que valem dali em diante. O que se
-- anuncia sai do save na hora (custódia): o ouro de uma compra e as peças de
-- uma venda ficam presos na oferta e só voltam se ela for cancelada.
--
-- A outra ponta de um negócio pode estar offline, ou no meio de uma incursão,
-- e o save dela não pode ser reescrito por baixo (o aparelho dela sobrescreveria
-- com o que tem). Por isso o que ela recebe vai para mercado_caixa, e entra no
-- save dela na próxima vez que ela abrir o mercado.
--
-- mkt: cada operação soma 1 em dados.mkt do save. save_gravar passa a recusar
-- um save com mkt menor que o da nuvem ('mercado'): um aparelho com save velho
-- não devolve peça vendida nem ouro preso numa compra. O cliente, ao ouvir
-- 'mercado', relê a nuvem.
--
-- Ralo (pilar 5): a venda paga 2% de taxa, arredondada para cima, e esse ouro
-- some. Limites contra abuso: 10 ofertas abertas por jogador, preço de 1 a
-- 1.000.000, quantidade de 1 a 100.
--
-- Limite conhecido: o save continua gravado inteiro pelo cliente (mesma dívida
-- do 001 e do 002). Quem editar o JSON do próprio save cria ouro e peças, e
-- agora pode gastá-los com outros jogadores. Fechar isso é o servidor
-- autoritativo da F2 (D-M3 do plano do multiplayer).

create table if not exists public.mercado_ordens (
  id      bigint generated always as identity primary key,
  jogador uuid not null references public.jogadores (id) on delete cascade,
  lado    text not null check (lado in ('compra', 'venda')),
  item    text not null check (item ~ '^[a-z0-9_]{1,24}$'),
  preco   integer not null check (preco between 1 and 1000000),
  qtd     integer not null check (qtd between 1 and 100),
  resta   integer not null,
  criado  timestamptz not null default now(),
  fechado timestamptz,
  constraint mercado_ordens_resta check (resta between 0 and qtd)
);
create index if not exists mercado_ordens_livro on public.mercado_ordens (item, lado, preco, id) where fechado is null;
create index if not exists mercado_ordens_dono on public.mercado_ordens (jogador) where fechado is null;
comment on table public.mercado_ordens is 'Ofertas do mercado entre jogadores; fechado null = ainda no livro.';

create table if not exists public.mercado_negocios (
  id        bigint generated always as identity primary key,
  item      text not null,
  preco     integer not null,
  qtd       integer not null,
  vendedor  uuid references public.jogadores (id) on delete set null,
  comprador uuid references public.jogadores (id) on delete set null,
  quando    timestamptz not null default now()
);
create index if not exists mercado_negocios_item on public.mercado_negocios (item, id desc);
comment on table public.mercado_negocios is 'Negócios fechados no mercado: o histórico de preços.';

create table if not exists public.mercado_caixa (
  jogador uuid primary key references public.jogadores (id) on delete cascade,
  ouro    bigint not null default 0 check (ouro >= 0),
  itens   jsonb not null default '{}'::jsonb
);
comment on table public.mercado_caixa is 'O que um jogador recebeu no mercado e ainda não entrou no save dele.';

alter table public.mercado_ordens enable row level security;
alter table public.mercado_negocios enable row level security;
alter table public.mercado_caixa enable row level security;
revoke all on public.mercado_ordens, public.mercado_negocios, public.mercado_caixa from anon, authenticated;

-- soma n unidades de uma peça em um objeto {item: qtd}; zero ou menos some
create or replace function public._mercado_soma(p_itens jsonb, p_item text, p_n integer)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when coalesce((p_itens ->> p_item)::integer, 0) + p_n > 0
    then jsonb_set(p_itens, array[p_item], to_jsonb(coalesce((p_itens ->> p_item)::integer, 0) + p_n))
    else p_itens - p_item end;
$$;

-- credita na caixa de quem está do outro lado de um negócio
create or replace function public._mercado_caixa(p_jogador uuid, p_ouro bigint, p_item text, p_n integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mercado_caixa (jogador) values (p_jogador) on conflict (jogador) do nothing;
  update public.mercado_caixa
     set ouro = ouro + p_ouro,
         itens = case when p_item is null then itens else public._mercado_soma(itens, p_item, p_n) end
   where jogador = p_jogador;
end;
$$;

-- taxa da venda, em ouro: 2% arredondado para cima
create or replace function public._mercado_taxa(p_total bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$ select ceil(p_total * 2 / 100.0)::bigint; $$;

-- Começo de toda operação: serializa o mercado, confere o token, trava o save
-- da nuvem e passa a caixa para dentro dele. Devolve o save já com a caixa;
-- quem chama altera, e _mercado_fim grava.
create or replace function public._mercado_inicio(p_token text, out j uuid, out d jsonb, out recebido jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare cx public.mercado_caixa; k text; v jsonb;
begin
  -- poucas operações por segundo: uma fila só é mais simples e não trava em ciclo
  perform pg_advisory_xact_lock(hashtext('fibula_mercado'));
  j := public._fibula_dono(p_token);
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  select s.dados into d from public.saves_jogador s where s.jogador = j for update;
  if d is null then raise exception 'sem_save' using errcode = 'P0001'; end if;
  if jsonb_typeof(d -> 'itens') is distinct from 'object' then d := jsonb_set(d, '{itens}', '{}'::jsonb); end if;
  if jsonb_typeof(d -> 'cofre') is distinct from 'number' then d := jsonb_set(d, '{cofre}', '0'::jsonb); end if;
  d := jsonb_set(d, '{cofre}', to_jsonb(greatest(floor((d ->> 'cofre')::numeric), 0)::bigint));
  -- zera a caixa em vez de apagar a linha: o conector do Supabase não aplica
  -- migração que contenha comando de apagar (ver CLAUDE.md)
  select * into cx from public.mercado_caixa c where c.jogador = j for update;
  recebido := jsonb_build_object('ouro', coalesce(cx.ouro, 0), 'itens', coalesce(cx.itens, '{}'::jsonb));
  if cx.jogador is not null and (cx.ouro > 0 or cx.itens <> '{}'::jsonb) then
    update public.mercado_caixa c set ouro = 0, itens = '{}'::jsonb where c.jogador = j;
    d := jsonb_set(d, '{cofre}', to_jsonb((d ->> 'cofre')::bigint + cx.ouro));
    for k, v in select * from jsonb_each(cx.itens) loop
      d := jsonb_set(d, '{itens}', public._mercado_soma(d -> 'itens', k, (v #>> '{}')::integer));
    end loop;
  end if;
end;
$$;

-- grava o save alterado (mkt + 1, em = agora) e monta a resposta
create or replace function public._mercado_fim(p_j uuid, p_d jsonb, p_recebido jsonb, p_extra jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare d jsonb := p_d;
begin
  d := jsonb_set(d, '{mkt}', to_jsonb(coalesce((d ->> 'mkt')::bigint, 0) + 1));
  d := jsonb_set(d, '{em}', to_jsonb((extract(epoch from clock_timestamp()) * 1000)::bigint));
  update public.saves_jogador set dados = d, atualizado = now() where jogador = p_j;
  return (jsonb_build_object('cofre', d -> 'cofre', 'itens', d -> 'itens', 'mkt', d -> 'mkt', 'recebido', p_recebido)
    || coalesce(p_extra, '{}'::jsonb))::json;
end;
$$;

-- o livro inteiro numa chamada: as 5 melhores de cada lado por peça, o último
-- preço e o volume do dia, as ofertas do jogador e o que espera na caixa dele
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
    'caixa', (select json_build_object('ouro', c.ouro, 'itens', c.itens) from public.mercado_caixa c where c.jogador = j)
  );
end;
$$;

-- anuncia e casa na hora o que der; o resto fica no livro
create or replace function public.mercado_anunciar(p_token text, p_lado text, p_item text, p_preco integer, p_qtd integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  j uuid; d jsonb; rec jsonb; o public.mercado_ordens; n integer; q integer;
  meu bigint; falta integer := p_qtd; feitos integer := 0; ouro bigint := 0; taxa bigint := 0; total bigint;
begin
  if p_lado is null or p_lado not in ('compra', 'venda') then raise exception 'lado' using errcode = 'P0001'; end if;
  if p_item is null or p_item !~ '^[a-z0-9_]{1,24}$' then raise exception 'item' using errcode = 'P0001'; end if;
  if p_preco is null or p_preco not between 1 and 1000000 then raise exception 'preco' using errcode = 'P0001'; end if;
  if p_qtd is null or p_qtd not between 1 and 100 then raise exception 'qtd' using errcode = 'P0001'; end if;
  select x.j, x.d, x.recebido into j, d, rec from public._mercado_inicio(p_token) x;
  if (select count(*) from public.mercado_ordens m where m.jogador = j and m.fechado is null) >= 10 then
    raise exception 'limite' using errcode = 'P0001';
  end if;

  -- custódia: o que se oferece sai do save agora
  if p_lado = 'compra' then
    if (d ->> 'cofre')::bigint < p_preco::bigint * p_qtd then raise exception 'sem_ouro' using errcode = 'P0001'; end if;
    d := jsonb_set(d, '{cofre}', to_jsonb((d ->> 'cofre')::bigint - p_preco::bigint * p_qtd));
  else
    if coalesce((d -> 'itens' ->> p_item)::integer, 0) < p_qtd then raise exception 'sem_peca' using errcode = 'P0001'; end if;
    d := jsonb_set(d, '{itens}', public._mercado_soma(d -> 'itens', p_item, -p_qtd));
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
      ouro := ouro + total;
      perform public._mercado_caixa(o.jogador, total - public._mercado_taxa(total), null, 0);
      insert into public.mercado_negocios (item, preco, qtd, vendedor, comprador) values (p_item, o.preco, q, o.jogador, j);
    else
      -- vendi pelo preço da compra: o ouro dela já estava preso, a peça vai para a caixa de quem comprou
      n := public._mercado_taxa(total)::integer;
      d := jsonb_set(d, '{cofre}', to_jsonb((d ->> 'cofre')::bigint + total - n));
      ouro := ouro + total - n; taxa := taxa + n;
      perform public._mercado_caixa(o.jogador, 0, p_item, q);
      insert into public.mercado_negocios (item, preco, qtd, vendedor, comprador) values (p_item, o.preco, q, j, o.jogador);
    end if;
  end loop;
  update public.mercado_ordens m set resta = falta, fechado = case when falta = 0 then now() end where m.id = meu;

  return public._mercado_fim(j, d, rec, jsonb_build_object(
    'ordem', case when falta > 0 then meu end, 'feitos', feitos, 'resta', falta, 'ouro', ouro, 'taxa', taxa));
end;
$$;

-- tira a oferta do livro e devolve o que estava preso nela
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
  else
    d := jsonb_set(d, '{itens}', public._mercado_soma(d -> 'itens', o.item, o.resta));
  end if;
  return public._mercado_fim(j, d, rec, null);
end;
$$;

-- só passa a caixa para o save (ao abrir o mercado)
create or replace function public.mercado_coletar(p_token text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid; d jsonb; rec jsonb;
begin
  select x.j, x.d, x.recebido into j, d, rec from public._mercado_inicio(p_token) x;
  return public._mercado_fim(j, d, rec, null);
end;
$$;

-- save_gravar do 002, agora recusando save mais velho que a última operação do mercado
create or replace function public.save_gravar(p_token text, p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid := public._fibula_dono(p_token);
begin
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  if coalesce((p_dados ->> 'mkt')::bigint, 0) <
     coalesce((select (s.dados ->> 'mkt')::bigint from public.saves_jogador s where s.jogador = j), 0) then
    raise exception 'mercado' using errcode = 'P0001';
  end if;
  insert into public.saves_jogador (jogador, dados) values (j, p_dados)
  on conflict (jogador) do update set dados = excluded.dados, atualizado = now();
end;
$$;

revoke all on function public._mercado_soma(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public._mercado_caixa(uuid, bigint, text, integer) from public, anon, authenticated;
revoke all on function public._mercado_taxa(bigint) from public, anon, authenticated;
revoke all on function public._mercado_inicio(text) from public, anon, authenticated;
revoke all on function public._mercado_fim(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.mercado_livro(text) to anon, authenticated;
grant execute on function public.mercado_anunciar(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.mercado_cancelar(text, bigint) to anon, authenticated;
grant execute on function public.mercado_coletar(text) to anon, authenticated;
grant execute on function public.save_gravar(text, jsonb) to anon, authenticated;

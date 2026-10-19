-- 006: a Feira não aceita mais venda do saco durante a caçada.
-- Decisão do Leonardo em 19/10/2026 (era a pendência P7, pilar 4): o que está
-- na mochila só fica a salvo saindo pela porta. A 0.43.2 tirou a venda do
-- cliente; aqui o banco recusa quem chama a função direto com p_caca ('caca').
-- A assinatura de 7 argumentos fica, para o cliente com cache não quebrar;
-- p_saco é ignorado. Idempotente: só create or replace.

-- anuncia do cofre; p_caca preenchido é recusado
create or replace function public.mercado_anunciar(p_token text, p_lado text, p_item text, p_preco integer, p_qtd integer, p_caca bigint, p_saco jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  j uuid; d jsonb; rec jsonb; o public.mercado_ordens; l public.mercado_lastro; n integer; q integer;
  meu bigint; falta integer := p_qtd; feitos integer := 0; ouro bigint := 0; taxa bigint := 0; total bigint;
begin
  if p_lado is null or p_lado not in ('compra', 'venda') then raise exception 'lado' using errcode = 'P0001'; end if;
  if p_item is null or p_item !~ '^[a-z0-9_]{1,24}$' then raise exception 'item' using errcode = 'P0001'; end if;
  if p_preco is null or p_preco not between 1 and 1000000 then raise exception 'preco' using errcode = 'P0001'; end if;
  if p_qtd is null or p_qtd not between 1 and 100 then raise exception 'qtd' using errcode = 'P0001'; end if;
  -- sem venda do saco durante a caçada (decisão do Leonardo, 19/10/2026): só do cofre
  if p_caca is not null then raise exception 'caca' using errcode = 'P0001'; end if;
  select x.j, x.d, x.recebido into j, d, rec from public._mercado_inicio(p_token) x;
  if (select count(*) from public.mercado_ordens m where m.jogador = j and m.fechado is null) >= 10 then
    raise exception 'limite' using errcode = 'P0001';
  end if;
  l := public._lastro(j);

  -- custódia: o que se oferece sai do save e da origem agora
  if p_lado = 'compra' then
    if (d ->> 'cofre')::bigint < p_preco::bigint * p_qtd then raise exception 'sem_ouro' using errcode = 'P0001'; end if;
    if l.ouro < p_preco::bigint * p_qtd then raise exception 'sem_origem' using errcode = 'P0001'; end if;
    d := jsonb_set(d, '{cofre}', to_jsonb((d ->> 'cofre')::bigint - p_preco::bigint * p_qtd));
    perform public._lastro_soma(j, -(p_preco::bigint * p_qtd), null, 0);
  else
    if coalesce((d -> 'itens' ->> p_item)::integer, 0) < p_qtd then raise exception 'sem_peca' using errcode = 'P0001'; end if;
    if coalesce((l.itens ->> p_item)::integer, 0) < p_qtd then raise exception 'sem_origem' using errcode = 'P0001'; end if;
    d := jsonb_set(d, '{itens}', public._mercado_soma(d -> 'itens', p_item, -p_qtd));
    perform public._lastro_soma(j, 0, p_item, -p_qtd);
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

grant execute on function public.mercado_anunciar(text, text, text, integer, integer, bigint, jsonb) to anon, authenticated;

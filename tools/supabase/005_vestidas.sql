-- Fibula: peça vestida na caçada ganha origem também na morte.
--
-- Desde a 0.26.0 o jogador veste no meio da caçada uma peça do saco (como no
-- Tibia): ela vai para o corpo e não cai na morte. Até aqui, a caca_fim só
-- dava origem na extração, e quem vestia e morria ficava com a peça sem poder
-- anunciá-la na Feira ('sem_origem'). Agora, na morte (ou no desabamento), o
-- cliente manda em p_saco só as peças vestidas do saco que ainda estão no
-- corpo, e o banco dá origem a no máximo 3 (as casas de equipamento), dentro
-- dos mesmos limites da extração: 30 peças por caçada, 60 por dia. Passar do
-- limite não desfaz a morte: o ouro do Selo entra, as peças não.
--
-- Idempotente: só troca o corpo da função, mesma assinatura.

create or replace function public.caca_fim(p_token text, p_id bigint, p_desfecho text, p_saco jsonb, p_ouro bigint)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid := public._fibula_dono(p_token); c public.cacadas; n integer := 0; o bigint; k text; v jsonb; pec jsonb := '{}'::jsonb; ext boolean := p_desfecho = 'extraiu';
begin
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('fibula_mercado'));
  select * into c from public.cacadas x where x.id = p_id and x.jogador = j for update;
  if c.id is null or c.fim is not null then raise exception 'caca' using errcode = 'P0001'; end if;
  o := least(greatest(coalesce(p_ouro, 0), 0), 20000);
  if ext and now() - c.inicio < interval '85 seconds' then
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
  if ext then
    if c.pecas + n > 30 or public._pecas_do_dia(j) + n > 60 then
      update public.cacadas x set fim = now(), desfecho = 'limite' where x.id = c.id;
      return json_build_object('pecas', 0, 'ouro', 0, 'erro', 'saco_limite');
    end if;
  else
    -- na morte, só o que está vestido: no máximo uma peça por casa
    o := least(o, 5000);
    if n > 3 or c.pecas + n > 30 or public._pecas_do_dia(j) + n > 60 then n := 0; pec := '{}'::jsonb; end if;
  end if;
  for k, v in select * from jsonb_each(pec) loop
    perform public._lastro_soma(j, 0, k, (v #>> '{}')::integer);
  end loop;
  perform public._lastro_soma(j, o, null, 0);
  update public.cacadas x set fim = now(), desfecho = coalesce(p_desfecho, 'morreu'), pecas = x.pecas + n, ouro = o where x.id = c.id;
  return json_build_object('pecas', n, 'ouro', o);
end;
$$;

-- Fibula · telemetria mínima (F1)
-- Depende do 002. Pode rodar de novo sem estrago. Sem nenhum delete: o
-- conector do Supabase não aplica migração que tenha um.
--
-- Decisão do Leonardo, 19/10/2026: medir o jogo com dado de jogador antes de
-- mexer em balanceamento, retenção ou custo da morte. Os eventos são os da
-- Parte 2 do CLAUDE.md: sessao_inicio, caca_inicio, caca_fim, compra,
-- nivel_up e erro_cliente.
--
-- Sem dado pessoal: quem manda é um APARELHO (um uuid sorteado no navegador e
-- guardado no localStorage dele, sem relação com nome, e-mail ou IP) e, se
-- houver conta, o id do jogador, tirado do token aqui dentro. O IP não é
-- gravado. Quem joga sem conta também conta, porque retenção se mede por
-- aparelho.
--
-- O navegador não toca na tabela: chama só telemetria_gravar, que confere o
-- nome do evento, o tamanho e o ritmo. Não é anti-trapaça (quem quiser manda
-- evento falso); é medida, e os limites só impedem que um aparelho encha a
-- tabela. O painel são as views tel_*, que só o dono lê (SQL do painel ou o
-- conector), nunca o anon.

create table if not exists public.telemetria (
  id       bigint generated always as identity primary key,
  em       timestamptz not null default now(),
  quando   timestamptz not null,
  aparelho uuid not null,
  jogador  uuid references public.jogadores (id) on delete set null,
  versao   text not null default '',
  evento   text not null check (evento in ('sessao_inicio','caca_inicio','caca_fim','compra','nivel_up','erro_cliente')),
  dados    jsonb not null default '{}'::jsonb
);
create index if not exists telemetria_aparelho on public.telemetria (aparelho, quando);
create index if not exists telemetria_evento on public.telemetria (evento, quando);
comment on table public.telemetria is 'Eventos do jogo para medir retenção, ritmo e erros: por aparelho anônimo, sem dado pessoal.';

alter table public.telemetria enable row level security;
revoke all on public.telemetria from anon, authenticated;

-- p_eventos: [{"e":"caca_fim","t":<ms do aparelho>,"d":{...}}, ...]
-- No máximo 50 por chamada e 1.000 por aparelho por hora; evento
-- desconhecido ou dado acima de 2 KB fica de fora, sem erro. O horário do
-- aparelho só vale se estiver a menos de 7 dias do relógio do banco (a fila
-- do aparelho guarda o que não subiu sem rede).
create or replace function public.telemetria_gravar(p_aparelho uuid, p_token text, p_versao text, p_eventos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid; n int; ev jsonb; t timestamptz;
begin
  if p_aparelho is null or jsonb_typeof(p_eventos) <> 'array' then return; end if;
  select count(*) into n from public.telemetria
    where aparelho = p_aparelho and em > now() - interval '1 hour';
  if n >= 1000 then return; end if;
  if p_token is not null and p_token <> '' then j := public._fibula_dono(p_token); end if;
  for ev in select x from jsonb_array_elements(p_eventos) with ordinality a(x, i) where i <= 50 loop
    continue when jsonb_typeof(ev) <> 'object'
      or not (coalesce(ev->>'e', '') = any (array['sessao_inicio','caca_inicio','caca_fim','compra','nivel_up','erro_cliente']))
      or (ev ? 'd' and jsonb_typeof(ev->'d') <> 'object')
      or octet_length(coalesce(ev->'d', '{}'::jsonb)::text) > 2000;
    t := now();
    if jsonb_typeof(ev->'t') = 'number' and (ev->>'t')::numeric between 0 and 1e14 then
      t := to_timestamp((ev->>'t')::numeric / 1000);
      if t < now() - interval '7 days' or t > now() + interval '1 hour' then t := now(); end if;
    end if;
    insert into public.telemetria (quando, aparelho, jogador, versao, evento, dados)
    values (t, p_aparelho, j, left(coalesce(p_versao, ''), 16), ev->>'e', coalesce(ev->'d', '{}'::jsonb));
  end loop;
end;
$$;
grant execute on function public.telemetria_gravar(uuid, text, text, jsonb) to anon, authenticated;

-- ---------- o painel ----------
-- O create or replace de view só aceita coluna nova no fim e o mesmo tipo nas
-- de antes; drop view não passa pelo conector.
-- Número do JSON sempre por case when jsonb_typeof(..) = 'number': o case
-- garante que o cast só roda em número.
-- Dia em horário de Brasília. security_invoker: quem lê precisa poder ler a
-- tabela, e o anon não pode.

-- por dia: aparelhos ativos, sessões, caçadas, saída viva, duração da caçada.
-- Quem fecha o jogo no meio da caçada deixa um caca_inicio sem caca_fim: a
-- saída viva e a duração contam só as caçadas que terminaram (largadas mostra
-- quantas não). As views leem só número de verdade do JSON (jsonb_typeof),
-- para um evento forjado com texto no lugar do número não derrubar o painel.
create or replace view public.tel_dia with (security_invoker = true) as
select (quando at time zone 'America/Sao_Paulo')::date as dia,
  count(distinct aparelho) as ativos,
  count(*) filter (where evento = 'sessao_inicio') as sessoes,
  count(*) filter (where evento = 'caca_fim') as cacadas,
  round(100.0 * count(*) filter (where evento = 'caca_fim' and dados->>'fim' = 'extraiu')
    / nullif(count(*) filter (where evento = 'caca_fim' and dados->>'fim' in ('extraiu','morreu')), 0), 1) as saida_viva_pct,
  round((percentile_cont(0.5) within group (order by case when jsonb_typeof(dados->'dur') = 'number' then (dados->'dur')::numeric end)
    filter (where evento = 'caca_fim'))::numeric / 60, 1) as caca_mediana_min,
  count(*) filter (where evento = 'erro_cliente') as erros,
  greatest(0, count(*) filter (where evento = 'caca_inicio') - count(*) filter (where evento = 'caca_fim')) as largadas
from public.telemetria group by 1 order by 1 desc;

-- retenção por turma (o primeiro dia de cada aparelho): voltou no dia 1, 7, 30
create or replace view public.tel_retencao with (security_invoker = true) as
with d as (select distinct aparelho, (quando at time zone 'America/Sao_Paulo')::date as dia from public.telemetria),
  p as (select aparelho, min(dia) as dia0 from d group by 1)
select p.dia0 as turma, count(*) as aparelhos,
  round(100.0 * count(*) filter (where exists (select 1 from d where d.aparelho = p.aparelho and d.dia = p.dia0 + 1)) / count(*), 1) as d1_pct,
  round(100.0 * count(*) filter (where exists (select 1 from d where d.aparelho = p.aparelho and d.dia = p.dia0 + 7)) / count(*), 1) as d7_pct,
  round(100.0 * count(*) filter (where exists (select 1 from d where d.aparelho = p.aparelho and d.dia = p.dia0 + 30)) / count(*), 1) as d30_pct
from p group by 1 order by 1 desc;

-- sessões: eventos do mesmo aparelho com menos de 30 min entre eles
create or replace view public.tel_sessoes with (security_invoker = true) as
with e as (select aparelho, quando,
    case when lag(quando) over w is null or quando - lag(quando) over w > interval '30 minutes' then 1 else 0 end as nova
  from public.telemetria window w as (partition by aparelho order by quando)),
  s as (select aparelho, quando, sum(nova) over (partition by aparelho order by quando) as n from e)
select aparelho, n as sessao, min(quando) as inicio,
  round(extract(epoch from max(quando) - min(quando)) / 60, 1) as minutos, count(*) as eventos
from s group by aparelho, n order by inicio desc;

-- o pilar 3: horas de caçada (soma das caca_fim antes) até cada nível, por classe
create or replace view public.tel_niveis with (security_invoker = true) as
with v as (select aparelho, dados->>'classe' as classe, quando,
    case when jsonb_typeof(dados->'nivel') = 'number' then (dados->'nivel')::numeric end as nivel
    from public.telemetria where evento = 'nivel_up'),
  n as (select aparelho, classe, nivel, min(quando) as quando from v where nivel between 1 and 10000 group by 1, 2, 3),
  h as (select n.classe, n.nivel, (select coalesce(sum(case when jsonb_typeof(c.dados->'dur') = 'number' then (c.dados->'dur')::numeric end), 0)
      from public.telemetria c
      where c.aparelho = n.aparelho and c.evento = 'caca_fim' and c.dados->>'classe' = n.classe and c.quando <= n.quando) / 3600 as horas from n)
select classe, nivel::int as nivel, count(*) as personagens,
  round((percentile_cont(0.5) within group (order by horas))::numeric, 2) as horas_mediana
from h group by 1, 2 order by 1, 2;

-- erros do cliente, agrupados pela mensagem
create or replace view public.tel_erros with (security_invoker = true) as
select dados->>'msg' as msg, dados->>'onde' as onde, versao, count(*) as vezes,
  count(distinct aparelho) as aparelhos, max(quando) as ultimo
from public.telemetria where evento = 'erro_cliente'
group by 1, 2, 3 order by ultimo desc;

revoke all on public.tel_dia, public.tel_retencao, public.tel_sessoes, public.tel_niveis, public.tel_erros from anon, authenticated;

-- Fibula · save na nuvem (F1 do PRD)
-- Rodar uma vez no SQL Editor do projeto bpwljbualdjlwmzcryzl.
-- Pode rodar de novo sem estrago: tudo é "if not exists" / "or replace".
--
-- Um save por conta. "dados" é o mesmo JSON que o jogo guarda no localStorage
-- na chave masmorra-runas-v2. O navegador só fala com o banco usando a chave
-- pública (publishable); quem decide o que cada jogador pode ler ou gravar são
-- as regras RLS abaixo: cada um só enxerga e escreve a própria linha.
--
-- Limite conhecido: o cliente ainda escreve o save inteiro, então um jogador
-- que edite o JSON consegue trapacear no próprio save. Isso só se resolve com o
-- servidor autoritativo da F2; aqui a regra garante apenas que ninguém mexa no
-- save de outra pessoa.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  dados      jsonb not null,
  atualizado timestamptz not null default now(),
  constraint saves_dados_objeto check (jsonb_typeof(dados) = 'object'),
  constraint saves_dados_tamanho check (pg_column_size(dados) < 65536)
);

comment on table public.saves is 'Save do Fibula por conta (mesmo formato da chave masmorra-runas-v2).';

-- o horário de gravação é do servidor, não do cliente
create or replace function public.saves_toca_atualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado := now();
  return new;
end;
$$;

drop trigger if exists saves_atualizado on public.saves;
create trigger saves_atualizado
  before insert or update on public.saves
  for each row execute function public.saves_toca_atualizado();

alter table public.saves enable row level security;

-- quem não entrou na conta não lê nem escreve nada
revoke all on public.saves from anon;
grant select, insert, update on public.saves to authenticated;

drop policy if exists "saves: dono lê" on public.saves;
create policy "saves: dono lê" on public.saves
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "saves: dono cria" on public.saves;
create policy "saves: dono cria" on public.saves
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "saves: dono atualiza" on public.saves;
create policy "saves: dono atualiza" on public.saves
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- sem política de delete de propósito: apagar a conta (auth.users) apaga o
-- save pela cascata; o jogo nunca apaga progresso sozinho.

-- Fibula · login simples com usuário e senha (fase de teste)
-- Aplicado no projeto bpwljbualdjlwmzcryzl pelo conector do Supabase.
-- Pode rodar de novo sem estrago: tudo é "if not exists" / "or replace".
--
-- Por que não o Supabase Auth: o link mágico depende de e-mail, e o SMTP
-- padrão só entrega para membros da organização. Para a fase de teste o
-- Leonardo pediu um login sem e-mail: qualquer nome de usuário, qualquer senha.
--
-- Como funciona: o navegador nunca toca nas tabelas. Só chama as funções
-- abaixo (POST /rest/v1/rpc/<nome>) com a chave publishable. As tabelas têm
-- RLS ligada e nenhuma política, então anon e authenticated não leem nem
-- escrevem nada direto; as funções rodam como dono (security definer) e
-- conferem a senha ou o token antes de qualquer coisa.
--
-- A senha fica só como hash bcrypt (pgcrypto). O token de sessão é aleatório
-- (32 bytes) e o banco guarda só o sha256 dele, então um vazamento da tabela
-- de sessões não abre conta nenhuma.
--
-- Limites conhecidos, aceitos para a fase de teste:
-- - sem limite de tentativas: senha curta pode ser adivinhada por força bruta;
-- - sem recuperação de senha: esqueceu, perdeu a conta;
-- - o cliente ainda grava o save inteiro (mesma dívida do 001).
-- A tabela public.saves do 001 fica, sem uso, para quando o login com e-mail
-- voltar.

create table if not exists public.jogadores (
  id      uuid primary key default gen_random_uuid(),
  usuario text not null,
  senha   text not null,
  criado  timestamptz not null default now(),
  constraint jogadores_usuario_tamanho check (char_length(usuario) between 1 and 24)
);
create unique index if not exists jogadores_usuario_unico on public.jogadores (lower(usuario));
comment on table public.jogadores is 'Contas do login simples da fase de teste (usuário e senha, sem e-mail).';

create table if not exists public.sessoes (
  token_hash text primary key,
  jogador    uuid not null references public.jogadores (id) on delete cascade,
  criado     timestamptz not null default now(),
  expira     timestamptz not null default now() + interval '180 days'
);
create index if not exists sessoes_jogador on public.sessoes (jogador);

create table if not exists public.saves_jogador (
  jogador    uuid primary key references public.jogadores (id) on delete cascade,
  dados      jsonb not null,
  atualizado timestamptz not null default now(),
  constraint saves_jogador_objeto check (jsonb_typeof(dados) = 'object'),
  constraint saves_jogador_tamanho check (pg_column_size(dados) < 65536)
);
comment on table public.saves_jogador is 'Save do Fibula por jogador do login simples (mesmo formato da chave masmorra-runas-v2).';

alter table public.jogadores enable row level security;
alter table public.sessoes enable row level security;
alter table public.saves_jogador enable row level security;
revoke all on public.jogadores, public.sessoes, public.saves_jogador from anon, authenticated;

-- abre uma sessão nova e devolve o token em claro (a única vez que ele existe)
create or replace function public._fibula_sessao(p_jogador uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.sessoes (token_hash, jogador)
  values (encode(extensions.digest(t, 'sha256'), 'hex'), p_jogador);
  return t;
end;
$$;

-- quem é o dono deste token; null se o token não existe ou venceu
create or replace function public._fibula_dono(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.jogador from public.sessoes s
  where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expira > now();
$$;

create or replace function public.conta_criar(p_usuario text, p_senha text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare u text := btrim(coalesce(p_usuario, '')); j uuid;
begin
  if char_length(u) < 1 or char_length(u) > 24 then
    raise exception 'usuario_invalido' using errcode = 'P0001';
  end if;
  if coalesce(p_senha, '') = '' or octet_length(p_senha) > 72 then
    raise exception 'senha_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.jogadores where lower(usuario) = lower(u)) then
    raise exception 'usuario_existe' using errcode = 'P0001';
  end if;
  insert into public.jogadores (usuario, senha)
  values (u, extensions.crypt(p_senha, extensions.gen_salt('bf', 8)))
  returning id into j;
  return json_build_object('token', public._fibula_sessao(j), 'id', j, 'usuario', u);
end;
$$;

create or replace function public.conta_entrar(p_usuario text, p_senha text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare r public.jogadores;
begin
  select * into r from public.jogadores where lower(usuario) = lower(btrim(coalesce(p_usuario, '')));
  -- mesma resposta para usuário inexistente e senha errada
  if r.id is null or r.senha <> extensions.crypt(coalesce(p_senha, ''), r.senha) then
    raise exception 'credenciais' using errcode = 'P0001';
  end if;
  return json_build_object('token', public._fibula_sessao(r.id), 'id', r.id, 'usuario', r.usuario);
end;
$$;

create or replace function public.conta_sair(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.sessoes
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- devolve o save do dono do token, ou null se ainda não há save
create or replace function public.save_ler(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare j uuid := public._fibula_dono(p_token);
begin
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  return (select dados from public.saves_jogador where jogador = j);
end;
$$;

create or replace function public.save_gravar(p_token text, p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare j uuid := public._fibula_dono(p_token);
begin
  if j is null then raise exception 'sessao' using errcode = 'P0001'; end if;
  insert into public.saves_jogador (jogador, dados) values (j, p_dados)
  on conflict (jogador) do update set dados = excluded.dados, atualizado = now();
end;
$$;

-- as auxiliares não são chamáveis de fora; as cinco públicas, sim
revoke all on function public._fibula_sessao(uuid) from public, anon, authenticated;
revoke all on function public._fibula_dono(text) from public, anon, authenticated;
grant execute on function public.conta_criar(text, text) to anon, authenticated;
grant execute on function public.conta_entrar(text, text) to anon, authenticated;
grant execute on function public.conta_sair(text) to anon, authenticated;
grant execute on function public.save_ler(text) to anon, authenticated;
grant execute on function public.save_gravar(text, jsonb) to anon, authenticated;

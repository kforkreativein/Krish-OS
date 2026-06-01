-- Vector similarity RPC for memory search.
create or replace function public.match_memory_chunks(
  p_user_id uuid,
  p_query vector(1536),
  p_limit int default 20
)
returns table (
  id uuid,
  text text,
  source_type text,
  source_id uuid,
  created_at timestamptz,
  distance double precision
)
language sql stable as $$
  select id, text, source_type, source_id, created_at, (embedding <=> p_query) as distance
  from public.memory_chunks
  where user_id = p_user_id and embedding is not null
  order by embedding <=> p_query
  limit p_limit;
$$;

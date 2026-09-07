create or replace function public.ciao_external_cron_token()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, ciao_private
as $$
  select value
  from ciao_private.external_runtime_secrets
  where key = 'cron_token'
$$;

revoke all on function public.ciao_external_cron_token() from public, anon, authenticated;
grant execute on function public.ciao_external_cron_token() to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'ciao-external-predictions-sync'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'ciao-external-predictions-sync',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-external-predictions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-ciao-cron-token', (
          select value
          from ciao_private.external_runtime_secrets
          where key = 'cron_token'
        )
      ),
      body := '{"action":"sync_due"}'::jsonb,
      timeout_milliseconds := 20000
    )
    where exists (
      select 1
      from public.cp_feature_flags
      where key = 'external_predictions_v1'
        and enabled = true
    );
  $cron$
);

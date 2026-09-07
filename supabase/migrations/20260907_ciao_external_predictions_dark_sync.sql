do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'ciao-external-predictions-sync'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
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
    );
  $cron$
);

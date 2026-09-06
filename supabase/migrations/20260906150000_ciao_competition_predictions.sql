CREATE TABLE IF NOT EXISTS public.cp_competition_predictions (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES public.cp_users(id) ON DELETE CASCADE,
  match_id text NOT NULL,
  competition text NOT NULL CHECK (competition IN ('coppa_italia','ucl','uel','uecl')),
  season text NOT NULL,
  predicted_home smallint NOT NULL CHECK (predicted_home BETWEEN 0 AND 20),
  predicted_away smallint NOT NULL CHECK (predicted_away BETWEEN 0 AND 20),
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  locked_at timestamp with time zone NOT NULL,
  points integer,
  result_type text,
  final_home smallint CHECK (final_home BETWEEN 0 AND 20),
  final_away smallint CHECK (final_away BETWEEN 0 AND 20),
  result_fingerprint text,
  scored_at timestamp with time zone,
  UNIQUE (user_id, match_id),
  CHECK (match_id LIKE competition || ':%')
);

CREATE INDEX IF NOT EXISTS cp_competition_predictions_user_competition_idx
  ON public.cp_competition_predictions (user_id, competition);

CREATE INDEX IF NOT EXISTS cp_competition_predictions_competition_match_idx
  ON public.cp_competition_predictions (competition, match_id);

CREATE INDEX IF NOT EXISTS cp_competition_predictions_competition_points_idx
  ON public.cp_competition_predictions (competition, points DESC NULLS LAST);

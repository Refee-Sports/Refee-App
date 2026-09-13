-- =============================================================
-- REFEE — MIGRATION 0009: RATING CATEGORIES
-- Directors rate refs on three objective-leaning categories.
-- Overall `rating` = average of the three (computed by trigger),
-- feeding the existing recompute_ref_rating() aggregate.
-- =============================================================

alter table public.ratings
  add column if not exists on_time smallint check (on_time between 1 and 5),
  add column if not exists professionalism smallint check (professionalism between 1 and 5),
  add column if not exists game_management smallint check (game_management between 1 and 5);

-- When category scores are provided, derive the overall rating from them
create or replace function derive_overall_rating()
returns trigger as $$
begin
  if new.on_time is not null and new.professionalism is not null and new.game_management is not null then
    new.rating := round((new.on_time + new.professionalism + new.game_management) / 3.0);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_derive_overall_rating
  before insert or update on public.ratings
  for each row execute function derive_overall_rating();

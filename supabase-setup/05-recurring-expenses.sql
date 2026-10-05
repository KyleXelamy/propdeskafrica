-- ============================================================
-- 05-recurring-expenses.sql
-- Recurring expense templates + auto-create on schedule
-- ============================================================
--
-- Recurring expenses are stored on the `expenses` table itself, with
-- `is_recurring = TRUE` and a `recurring_frequency` of monthly/quarterly/yearly.
-- The original row acts as the "template" — its `expense_date` is the
-- anchor. The cron function below creates a NEW expense row for each
-- period due, copying the template's details. The template is left
-- untouched and serves as the source of truth.

-- 1) ensure required columns exist -----------------------------------------
alter table public.expenses
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurring_frequency text
    check (recurring_frequency in ('monthly','quarterly','yearly')),
  add column if not exists next_occurrence date,
  add column if not exists parent_recurring_id uuid references public.expenses(id) on delete set null;

create index if not exists expenses_is_recurring_idx on public.expenses (user_id, is_recurring);
create index if not exists expenses_next_occurrence_idx on public.expenses (next_occurrence)
  where is_recurring = true and next_occurrence is not null;

-- 2) function: generate due recurring expenses -----------------------------
-- Idempotent. Re-runs within the same period are no-ops.

create or replace function public.run_recurring_expenses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  inserted integer := 0;
  next_date date;
  exists_already uuid;
begin
  for rec in
    select e.*
    from public.expenses e
    where e.is_recurring = true
      and e.recurring_frequency is not null
      and (
        (e.next_occurrence is not null and e.next_occurrence <= current_date)
        or (e.next_occurrence is null and e.expense_date::date <= current_date)
      )
  loop
    loop
      -- determine next date
      if rec.recurring_frequency = 'monthly' then
        next_date := (coalesce(rec.next_occurrence, rec.expense_date::date) + interval '1 month')::date;
      elsif rec.recurring_frequency = 'quarterly' then
        next_date := (coalesce(rec.next_occurrence, rec.expense_date::date) + interval '3 months')::date;
      else
        next_date := (coalesce(rec.next_occurrence, rec.expense_date::date) + interval '1 year')::date;
      end if;

      exit when next_date > current_date;

      -- de-dup: skip if a generated child with the same parent + date exists
      select id into exists_already
      from public.expenses
      where parent_recurring_id = rec.id
        and expense_date::date = next_date
      limit 1;

      if exists_already is null then
        insert into public.expenses (
          user_id, property_id, category, amount, description,
          expense_date, vendor, is_recurring, notes, parent_recurring_id
        ) values (
          rec.user_id, rec.property_id, rec.category, rec.amount,
          rec.description, next_date, rec.vendor, false, rec.notes, rec.id
        );
        inserted := inserted + 1;
      end if;
    end loop;

    -- advance the template's next_occurrence
    update public.expenses
    set next_occurrence =
      case
        when recurring_frequency = 'monthly' then (coalesce(next_occurrence, expense_date::date) + interval '1 month')::date
        when recurring_frequency = 'quarterly' then (coalesce(next_occurrence, expense_date::date) + interval '3 months')::date
        else (coalesce(next_occurrence, expense_date::date) + interval '1 year')::date
      end
    where id = rec.id;
  end loop;

  return inserted;
end;
$$;

-- 3) schedule via pg_cron ---------------------------------------------------
do $$
declare
  existing bigint;
begin
  select jobid into existing from cron.job where jobname = 'recurring_expenses_daily';
  if existing is not null then perform cron.unschedule(existing); end if;
end $$;

select cron.schedule(
  'recurring_expenses_daily',
  '5 7 * * *',  -- 5 minutes after lease scan
  $$ select public.run_recurring_expenses(); $$
);

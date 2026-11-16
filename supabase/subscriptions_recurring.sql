-- =============================================================================
-- Подписка Pro: срок оплаты и автопродление (Robokassa Recurring)
-- =============================================================================
-- Справочная копия SQL, который нужно применить вручную в Supabase Dashboard →
-- SQL Editor (проект wxzwyirrqophfnltsapj). Автоматически не выполняется.
--
-- Зачем это нужно:
--   1. вебхук Robokassa (app/api/payments/robokassa/result/route.ts) после
--      оплаты продлевает подписку: пишет срок в subscriptions.expires_at и
--      ставит статус active. Без этой колонки запрос вернёт 42703;
--   2. продление идёт от текущего срока, а не от «сейчас»: если человек платит
--      заранее, оставшиеся дни не сгорают;
--   3. автопродление приходит тем же уведомлением с новым InvId. Повторный
--      InvId обрабатывается идемпотентно через уникальный purchases.inv_id,
--      поэтому вторая покупка и вторые 30 дней не появляются;
--   4. lib/subscription.ts читает expires_at вместе с trial_ends_at: доступ к
--      Конструктору и Профилям есть, пока дата в будущем.
--
-- Пока миграция не применена, сайт работает по-старому: доступ решает статус
-- подписки и purchases.expires_at, а вебхук отвечает Robokassa OK (иначе
-- Robokassa повторяла бы уведомление, а оно всё равно не записалось бы).
--
-- Проверить после применения:
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'subscriptions';
--   select indexname from pg_indexes where tablename = 'subscriptions';
-- =============================================================================

-- 1. Срок оплаченной подписки. null — бессрочного доступа у подписки нет:
--    если дата в прошлом, доступ закрыт.
alter table public.subscriptions
  add column if not exists expires_at timestamptz;

-- 2. Поиск «у кого скоро закончится подписка» — для ручных напоминаний и
--    проверки перед отключением автопродления.
create index if not exists subscriptions_expires_at_idx
  on public.subscriptions (expires_at);

-- 3. Права и RLS менять не нужно (см. grants_and_policies.sql): authenticated
--    читает только свои строки, а пишет подписку service_role из вебхука.
--    Новая колонка политик не требует — RLS работает по строкам.

-- =============================================================================
-- Атомарное продление подписки из вебхука Robokassa
-- =============================================================================
-- Два разных InvId могут прийти одновременно. Раньше вебхук читал текущий срок
-- до вставки покупки, оба запроса видели одну дату и оба добавляли 30 дней от
-- неё — пользователь платил дважды, а получал 30 дней. Функция сериализует
-- обработку по user_id, блокирует строку подписки через `select ... for update`
-- и считает новый срок от `max(now(), current_expires_at) + 30 дней` внутри
-- одной транзакции.
--
-- Purchase и subscriptions пишутся вместе: если обновление подписки сорвётся,
-- откатится и покупка, и Robokassa повторит уведомление. Повторный InvId
-- возвращает уже сохранённый срок и второй период не добавляет. Возврат
-- (expires_at в прошлом) повторным уведомлением не восстанавливается.
-- =============================================================================

create or replace function public.apply_pro_subscription_purchase(
  p_inv_id bigint,
  p_user_id uuid,
  p_course_id text,
  p_amount numeric,
  p_period_days integer
) returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.purchases%rowtype;
  v_subscription record;
  v_latest_id uuid;
  v_latest_expires timestamptz;
  v_purchase_max timestamptz;
  v_base timestamptz := now();
  v_expires timestamptz;
  v_inserted_expires timestamptz;
begin
  if p_inv_id is null or p_inv_id <= 0 then
    raise exception 'invalid InvId: %', p_inv_id using errcode = '22023';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22023';
  end if;

  if p_course_id <> 'pro-subscription' then
    raise exception 'invalid subscription course: %', p_course_id
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid amount: %', p_amount using errcode = '22023';
  end if;

  if p_period_days is null or p_period_days < 1 or p_period_days > 366 then
    raise exception 'invalid period: %', p_period_days using errcode = '22023';
  end if;

  -- Блокировка на пользователя, а не на таблицу: подписки разных людей не
  -- ждут друг друга. Advisory lock нужен и когда строки subscriptions ещё нет:
  -- `for update` по пустому набору параллельную вставку не остановит.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into v_existing
    from public.purchases
   where inv_id = p_inv_id;

  if found then
    if v_existing.user_id <> p_user_id
       or v_existing.course_id <> p_course_id then
      raise exception 'InvId % belongs to another purchase', p_inv_id
        using errcode = '22000';
    end if;

    -- Повтор уведомления: срок уже записан, второй период не добавляем.
    return v_existing.expires_at;
  end if;

  -- Блокируем все строки подписки пользователя и берём самый поздний срок.
  for v_subscription in
    select id, expires_at, trial_ends_at
      from public.subscriptions
     where user_id = p_user_id
     for update
  loop
    if v_latest_id is null
       or coalesce(v_subscription.expires_at, '-infinity'::timestamptz)
          > coalesce(v_latest_expires, '-infinity'::timestamptz) then
      v_latest_id := v_subscription.id;
      v_latest_expires := v_subscription.expires_at;
    end if;

    v_base := greatest(
      v_base,
      coalesce(v_subscription.expires_at, v_base),
      coalesce(v_subscription.trial_ends_at, v_base)
    );
  end loop;

  -- Старые покупки могли быть записаны до появления subscriptions.expires_at:
  -- их оставшиеся дни тоже не должны сгореть.
  select max(expires_at)
    into v_purchase_max
    from public.purchases
   where user_id = p_user_id
     and course_id = 'pro-subscription';

  v_base := greatest(v_base, coalesce(v_purchase_max, v_base));
  v_expires := v_base + make_interval(days => p_period_days);

  insert into public.purchases (
    inv_id,
    user_id,
    course_id,
    amount,
    expires_at
  )
  values (
    p_inv_id,
    p_user_id,
    p_course_id,
    p_amount,
    v_expires
  )
  on conflict (inv_id) do nothing
  returning expires_at into v_inserted_expires;

  -- Параллельная вставка мимо функции: победил другой InvId — его срок и
  -- возвращаем, не добавляя второй период задним числом.
  if v_inserted_expires is null then
    select expires_at into v_inserted_expires
      from public.purchases
     where inv_id = p_inv_id;

    return v_inserted_expires;
  end if;

  if v_latest_id is null then
    insert into public.subscriptions (user_id, status, expires_at, updated_at)
    values (p_user_id, 'active', v_expires, now());
  else
    update public.subscriptions
       set status = 'active',
           expires_at = v_expires,
           updated_at = now()
     where id = v_latest_id;
  end if;

  return v_inserted_expires;
end;
$$;

comment on function public.apply_pro_subscription_purchase(bigint, uuid, text, numeric, integer) is
  'Атомарно записывает покупку подписки и продлевает срок от max(now(), expires_at); повторный InvId второй период не добавляет.';

revoke all on function public.apply_pro_subscription_purchase(bigint, uuid, text, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.apply_pro_subscription_purchase(bigint, uuid, text, numeric, integer)
  to service_role;

notify pgrst, 'reload schema';

-- =============================================================================
-- Как проверить оплату и продление без реальных денег
-- =============================================================================
-- а) В личном кабинете Robokassa включите тестовый режим (IsTest=1) и оплатите
--    подписку на /subscription. В логах Vercel будет строка
--    «[Robokassa] Покупка записана» с expiresAt.
--
-- б) Смотрим подписку:
--      select user_id, status, expires_at, trial_ends_at, updated_at
--        from public.subscriptions order by updated_at desc limit 5;
--
-- в) Смотрим покупки — у каждого платежа свой InvId:
--      select inv_id, user_id, course_id, amount, expires_at, created_at
--        from public.purchases where course_id = 'pro-subscription'
--       order by created_at desc limit 5;
--
-- г) Проверяем идемпотентность: пришлите то же уведомление повторно (кнопка
--    «Проверить» в настройках ResultURL или повтор запроса с тем же InvId) —
--    expires_at не должен сдвинуться на вторые 30 дней.
--
-- д) Выключить подписку вручную:
--      update public.subscriptions
--         set status = 'canceled', expires_at = now(), updated_at = now()
--       where user_id = '<UUID>';
-- =============================================================================

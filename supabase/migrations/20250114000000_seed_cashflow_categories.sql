-- Seed default cashflow categories (hierarchical up to 3 levels) for all users.
-- Safe to re-run: checks existence per user/name/type/level/parent before insert.

do $$
declare
  u record;
  food uuid;
  transport uuid;
  salary uuid;
  living uuid;
  coffee uuid;
  lunch uuid;
  ride uuid;
  grab uuid;
  bonus uuid;
  gift uuid;
begin
  for u in select id from auth.users loop
    -- Expense roots
    select id into food from public.categories where user_id = u.id and name = 'Food' and type = 'expense' and level = 0 limit 1;
    if food is null then
      insert into public.categories (user_id, name, type, level) values (u.id, 'Food', 'expense', 0) returning id into food;
    end if;

    select id into transport from public.categories where user_id = u.id and name = 'Transport' and type = 'expense' and level = 0 limit 1;
    if transport is null then
      insert into public.categories (user_id, name, type, level) values (u.id, 'Transport', 'expense', 0) returning id into transport;
    end if;

    select id into living from public.categories where user_id = u.id and name = 'Living' and type = 'expense' and level = 0 limit 1;
    if living is null then
      insert into public.categories (user_id, name, type, level) values (u.id, 'Living', 'expense', 0) returning id into living;
    end if;

    -- Income roots
    select id into salary from public.categories where user_id = u.id and name = 'Salary' and type = 'income' and level = 0 limit 1;
    if salary is null then
      insert into public.categories (user_id, name, type, level) values (u.id, 'Salary', 'income', 0) returning id into salary;
    end if;

    select id into bonus from public.categories where user_id = u.id and name = 'Bonus' and type = 'income' and level = 0 limit 1;
    if bonus is null then
      insert into public.categories (user_id, name, type, level) values (u.id, 'Bonus', 'income', 0) returning id into bonus;
    end if;

    select id into gift from public.categories where user_id = u.id and name = 'Gift' and type = 'income' and level = 0 limit 1;
    if gift is null then
      insert into public.categories (user_id, name, type, level) values (u.id, 'Gift', 'income', 0) returning id into gift;
    end if;

    -- Expense children under Food
    select id into coffee from public.categories where user_id = u.id and name = 'Coffee' and type = 'expense' and level = 1 and parent_id = food limit 1;
    if coffee is null then
      insert into public.categories (user_id, name, type, level, parent_id) values (u.id, 'Coffee', 'expense', 1, food) returning id into coffee;
    end if;

    select id into lunch from public.categories where user_id = u.id and name = 'Lunch' and type = 'expense' and level = 1 and parent_id = food limit 1;
    if lunch is null then
      insert into public.categories (user_id, name, type, level, parent_id) values (u.id, 'Lunch', 'expense', 1, food) returning id into lunch;
    end if;

    -- Expense children under Transport
    select id into ride from public.categories where user_id = u.id and name = 'Ride' and type = 'expense' and level = 1 and parent_id = transport limit 1;
    if ride is null then
      insert into public.categories (user_id, name, type, level, parent_id) values (u.id, 'Ride', 'expense', 1, transport) returning id into ride;
    end if;

    -- Grandchild under Ride
    select id into grab from public.categories where user_id = u.id and name = 'GrabBike' and type = 'expense' and level = 2 and parent_id = ride limit 1;
    if grab is null then
      insert into public.categories (user_id, name, type, level, parent_id) values (u.id, 'GrabBike', 'expense', 2, ride) returning id into grab;
    end if;
  end loop;
end $$;

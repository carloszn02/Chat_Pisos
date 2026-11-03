-- The city-wide group was called "Madrid · General"; it becomes "Todo Madrid" (plainer, and
-- without the middle dot). Only the name changes: the slug stays 'madrid', so links still work.

update public.chat_groups
set name = 'Todo Madrid'
where slug = 'madrid' and name = 'Madrid · General';

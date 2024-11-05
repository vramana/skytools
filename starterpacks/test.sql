.headers on

select
 DISTINCT(uri)
FROM (
  select
    'at://' || did || '/app.bsky.graph.starterpack/' || json_extract(message, '$.commit.rkey') as uri
  from
    starter_packs
);

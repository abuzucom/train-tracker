-- The 11 northwest corridor crossings, ordered northwest to southeast.
--
-- These values must match src/corridor.js exactly. tests/seed.test.js parses
-- this file and asserts the match, so an edit here without the matching edit
-- there fails the suite.
--
-- dot_code is the federal National Grade Crossing Inventory identifier and is
-- the only join key. Never match on street name: this feed contains a second
-- crossing named "Post Oak", 440652H, on a different corridor about 16 km
-- south. The corridor one is 743673P.
--
-- Re-runnable: the upsert leaves an already seeded row correct.

INSERT INTO crossing (dot_code, name, corridor_seq, lat, lon, arcgis_object_id)
VALUES
  ('743650H', 'Gessner',         1, 29.86154, -95.54447, 12),
  ('743653D', 'Campbell',        2, 29.85276, -95.53210, 45),
  ('743658M', 'Blalock',         3, 29.84723, -95.52431, 13),
  ('758656T', 'South Pinemont',  4, 29.84082, -95.51530, 29),
  ('743659U', 'Clay',            5, 29.83357, -95.50510, 46),
  ('743662C', 'Bingle',          6, 29.82560, -95.49399,  9),
  ('743668T', 'Kempwood',        7, 29.81820, -95.48355, 18),
  ('743267T', 'Antoine',         8, 29.81175, -95.47469, 43),
  ('743270B', 'Long Point',      9, 29.80304, -95.46272, 44),
  ('743673P', 'Post Oak',       10, 29.79814, -95.45603, 19),
  ('743677S', 'Hempstead',      11, 29.79039, -95.44491, 20)
ON CONFLICT(dot_code) DO UPDATE SET
  name = excluded.name,
  corridor_seq = excluded.corridor_seq,
  lat = excluded.lat,
  lon = excluded.lon,
  arcgis_object_id = excluded.arcgis_object_id;

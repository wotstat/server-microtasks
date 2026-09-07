# Comp7 division migration

Approved scope: persist API p1 as division, derive elite in ClickHouse, retain oldElite for rollback. Applies to WOT.Comp7Leaderboard and its rank copy; daily aggregates must reflect corrected history without replaying inserts through the source MVs.

## Execution plan

- [x] Discover actual tables, keys, MVs, dictionary and server version (26.4.2.10).
- [x] Save original DDL locally under ignored dev-data/comp7-division-migration/schema-before.json (contains dictionary credentials; do not commit).
- [x] Rehearse DEFAULT -> MATERIALIZED and oldElite preservation in an isolated test table.
- [x] Clone four tables to matching names suffixed BeforeDivision20260907.
- [x] Add division UInt8 DEFAULT 0 and oldElite Bool DEFAULT elite to the rank copy, then the source; materialize oldElite before changing elite.
- [ ] Deploy loader writing division, oldElite and transitional elite through main/CI. Verify source and rank-copy inserts.
- [ ] Record one boundary row per legacy Lesta snapshot; validate completeness and rounding against captured API. RU current launch starts 2026-09-02; RPT data starts 2026-08-04 with the new division scheme.
- [ ] Fill division=0 only. Historic WG/RU: oldElite ? 11 : 21. Current Lesta: legend boundaries rounded up at 1/3/5%, rating at least 3450; champion A/B/C starts at 3450/3050/2650. Confirm the minimum against live API and client evidence before backfill.
- [ ] Verify oldElite is physically stored, remove its dependency on elite, make elite DEFAULT division IN (11,12,13), recalculate incorrect historical elite.
- [ ] Rebuild affected daily groups from source into a staging table; preserve old aggregate data; replace affected groups without allowing min/max/argMax states from old data to survive.
- [ ] Rebuild historical daily rank results explicitly: the existing RMV is REFRESH ... APPEND and only reads recent data.
- [ ] Deploy final loader omitting elite, while retaining oldElite. Set elite MATERIALIZED in source/rank copy, adjust rank MV to omit elite and explicitly forward division/oldElite.
- [ ] Validate API snapshot, source, rank copy, daily results and dictionary; retain backups and migration report.

## Operational constraints

The application deploys automatically on pushes to main. No SSH is needed. The old and new application versions must both be accepted during each deployment. Before MATERIALIZED, a DEFAULT expression allows the final loader to omit elite without a coordinated pause.

The rank MV currently uses SELECT *, day. Daily MV uses explicit elite in argMin/argMax states and min/max. Changing source rows does not propagate to either incremental MV. The daily rank RMV appends only the latest recent snapshot and does not repair history. The dictionary contains only rating and does not need a schema change.

## Rollback

Keep oldElite physically stored and independent of elite. Keep the four BeforeDivision20260907 clones and original DDL. Restore the loader/elite compatibility before reverting expression or data. Roll back corrected daily aggregates from their backups; do not replay source INSERTs through incremental MVs. Backups are point-in-time copies: preserve post-backup inserts when restoring.

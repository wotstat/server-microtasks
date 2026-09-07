# Comp7 division migration

Approved scope: persist API p1 as division, derive elite in ClickHouse, retain oldElite for rollback. Applies to WOT.Comp7Leaderboard and its rank copy; daily aggregates must reflect corrected history without replaying inserts through the source MVs.

## Execution plan

- [x] Discover actual tables, keys, MVs, dictionary and server version (26.4.2.10).
- [x] Save original DDL locally under ignored dev-data/comp7-division-migration/schema-before.json (contains dictionary credentials; do not commit).
- [x] Rehearse DEFAULT -> MATERIALIZED and oldElite preservation in an isolated test table.
- [x] Clone four tables to matching names suffixed BeforeDivision20260907.
- [x] Add division UInt8 DEFAULT 0 and oldElite Bool DEFAULT elite to the rank copy, then the source; materialize oldElite before changing elite.
- [x] Deploy loader writing division, oldElite and transitional elite through main/CI. Verify source and rank-copy inserts.
- [x] Record one boundary row per legacy Lesta snapshot; validate completeness and rounding against captured API. RU current launch starts 2026-09-02; RPT data starts 2026-08-04 with the new division scheme.
- [x] Fill division=0 only. Historic WG/RU: oldElite ? 11 : 21. Current Lesta: legend boundaries rounded up at 1/3/5%, rating at least 3450; champion A/B/C starts at 3450/3050/2650. Confirm the minimum against live API and client evidence before backfill.
- [x] Verify oldElite is physically stored, remove its dependency on elite, make elite DEFAULT division IN (11,12,13), recalculate incorrect historical elite.
- [x] Rebuild affected daily groups from source into a staging table; preserve old aggregate data; replace affected groups without allowing min/max/argMax states from old data to survive.
- [x] Rebuild historical daily rank results explicitly: the existing RMV is REFRESH ... APPEND and only reads recent data.
- [x] Deploy final loader omitting elite, while retaining oldElite. Set elite MATERIALIZED in source/rank copy, adjust rank MV to omit elite and explicitly forward division/oldElite.
- [x] Validate API snapshot, source, rank copy, daily results and dictionary; retain backups and migration report.

## Operational constraints

The application deploys automatically on pushes to main. No SSH is needed. The old and new application versions must both be accepted during each deployment. Before MATERIALIZED, a DEFAULT expression allows the final loader to omit elite without a coordinated pause.

The rank MV currently uses SELECT *, day. Daily MV uses explicit elite in argMin/argMax states and min/max. Changing source rows does not propagate to either incremental MV. The daily rank RMV appends only the latest recent snapshot and does not repair history. The dictionary contains only rating and does not need a schema change.

## Rollback

Keep oldElite physically stored and independent of elite. Keep the four BeforeDivision20260907 clones and original DDL. Restore the loader/elite compatibility before reverting expression or data. Roll back corrected daily aggregates from their backups; do not replay source INSERTs through incremental MVs. Backups are point-in-time copies: preserve post-backup inserts when restoring.

## Completion report — 2026-09-07

Production deployment completed through main: `3b7e355` (transitional writer), then `6ff8da3` (final writer). Both CI/CD runs succeeded. The final writer sends `division` and `oldElite`, omits `elite`, and enables JSONEachRow default-expression evaluation explicitly.

Both source and rank copy now have:

```sql
division UInt8 DEFAULT 0,
oldElite Bool,
elite Bool MATERIALIZED division IN (11, 12, 13)
```

No zero divisions or incorrect elite flags remain in either table. Source historical corrections: 14,800 RU rows and 2,005 RPT rows. Other regions retained their flags. The backup comparison used deduplicated rows, per-region counts, elite counts and exact UInt64 checksum strings over account/time/flag; oldElite matched the original backup in every region.

The Daily replacement retained 1,553,172 logical groups with matching account, rank and rating control totals. The DailyByRank replacement retained 1,489,495 rows and a matching checksum over all non-elite fields. All 6,431 affected historical rank rows matched their original source snapshot. The four within-day elite fields were verified against cumulative snapshot windows; lastDayElite was separately verified against the previous day's final player state. All five fields had zero mismatches.

Real production inserts using the final loader succeeded after MATERIALIZED was enabled: RU 2,275 rows and EU 387 rows. Dependent view refreshes and dictionary reload succeeded. The dictionary was LOADED without exceptions. All six source/rank mutations finished without errors.

Tests and TypeScript checks passed. The existing ESLint/TypeScript 7 incompatibility remains unrelated to this change.

### Preserved artifacts

- Original table copies: WOT.Comp7LeaderboardBeforeDivision20260907, WOT.Comp7LeaderboardByRankBeforeDivision20260907, WOT.Comp7LeaderboardDailyBeforeDivision20260907, WOT.Comp7LeaderboardDailyByRankBeforeDivision20260907.
- Immediately preceding aggregate versions: WOT.Comp7LeaderboardDailyDivisionStaging and WOT.Comp7LeaderboardDailyByRankDivisionStaging. Despite their names, these now hold the swapped-out previous tables; do not reuse them as empty staging tables.
- Explicit reconstruction boundaries: WOT.Comp7DivisionMigrationBounds20260907. Snapshot validation inputs: WOT.Comp7DivisionMigrationSnapshotFlags.
- Credential-free schema references: `2026-09-07-comp7-schema-before.sql` and `2026-09-07-comp7-schema-after.sql` next to this document.
- Local execution scripts, captured API, bounds, journal and validation outputs: ignored `dev-data/comp7-division-migration/`. Original dictionary DDL there contains credentials and must remain uncommitted.

### Rollback procedure

Do not directly exchange the point-in-time backups into production: that would discard subsequent data. To restore historical flags while keeping new inserts:

1. Change elite on both source and rank copy from MATERIALIZED to `Bool DEFAULT oldElite`. The current loader already supplies oldElite, and the rank MV forwards it, so this is compatible with the running writer.
2. Run a targeted mutation on both tables setting `elite=oldElite WHERE elite!=oldElite`; wait for completion and verify zero mismatches.
3. Rebuild the affected Daily groups and DailyByRank elite fields from this restored source using fresh staging names and the same cumulative/as-of semantics described above. Preserve all non-elite fields. Retain the original DDL/backups as independent references.
4. Refresh the current RMV, reload the dictionary and verify a real loader insertion.

The completed migration used targeted one-time mutations, not repeated source INSERT SELECT backfills. Aggregate stages captured concurrent valid inserts via temporary MVs, then switched with EXCHANGE TABLES. This target-name behavior was rehearsed on isolated tables first. Temporary capture MVs were removed after the exchanges. Large aggregate-state copies were performed in 10,000-row blocks after the initial broad copy hit the 2 GB query limit; idempotent aggregate functions made its retry safe.

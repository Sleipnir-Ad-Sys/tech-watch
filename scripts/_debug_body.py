import sys
sys.path.insert(0, '.')
import duckdb

with duckdb.connect('data/warehouse.duckdb', read_only=True) as con:
    rows = con.execute('''
        SELECT name, tag, source, length(body_excerpt) as body_len, left(body_excerpt, 300) as sample
        FROM releases
        WHERE source = 'github' AND body_excerpt IS NOT NULL AND length(body_excerpt) > 200
        ORDER BY body_len DESC
        LIMIT 5
    ''').fetchall()
    for nm, tg, src, bl, smp in rows:
        print(nm, tg, "len=" + str(bl))
        print(" ", repr(smp))
        print()

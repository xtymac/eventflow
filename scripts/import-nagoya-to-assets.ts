/**
 * Import Nagoya Designated Roads into road_assets table
 *
 * This script copies data from nagoya_designated_roads into road_assets
 * so they become selectable in the map view.
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://mac@localhost:5432/nagoya_construction';

// Map source_layer to road_type
function mapRoadType(sourceLayer: string): string {
  if (sourceLayer.includes('2gou')) return 'collector';
  if (sourceLayer.includes('5gou')) return 'local';
  if (sourceLayer.includes('3gou')) return 'local';
  if (sourceLayer.includes('tokuteitsuuro')) return 'collector';
  return 'local';
}

// Map source_layer to display name
function mapSourceLayerName(sourceLayer: string): string {
  const names: Record<string, string> = {
    'shiteidouro_2gou_pl_web': '2号道路',
    'shiteidouro_5gou_pl_web': '5号道路',
    'shiteidouro_2kou_kobetsu_pl': '2項個別',
    'shiteidouro_2kou_kenchikusen_pl': '2項建築線',
    'shiteidouro_3gou_kobetsu_pl': '3号個別',
    'shiteidouro_3gou_syuji_pl': '3号修辞',
    'shiteidouro_tokuteitsuuro_2gou_pl': '特定通路2号',
    'shiteidouro_tokuteitsuuro_3gou_pl': '特定通路3号',
  };
  return names[sourceLayer] || sourceLayer;
}

async function importNagoyaRoads() {
  const client = new pg.Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check existing counts
    const countResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM nagoya_designated_roads) as nagoya_count,
        (SELECT COUNT(*) FROM road_assets WHERE data_source = 'nagoya_shiteidouro') as existing_imports
    `);

    const { nagoya_count, existing_imports } = countResult.rows[0];
    console.log(`Nagoya designated roads: ${nagoya_count}`);
    console.log(`Already imported: ${existing_imports}`);

    if (existing_imports > 0) {
      console.log('\nClearing existing Nagoya imports...');
      await client.query(`DELETE FROM road_assets WHERE data_source = 'nagoya_shiteidouro'`);
    }

    // Import in batches
    const BATCH_SIZE = 500;
    let offset = 0;
    let totalImported = 0;

    console.log('\nImporting Nagoya roads to road_assets...');

    while (true) {
      const result = await client.query(`
        SELECT
          id,
          source_layer,
          dedup_key,
          keycode,
          daicyo_ban,
          gid,
          encyo,
          fukuin,
          shitei_ymd,
          filename,
          geometry
        FROM nagoya_designated_roads
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [BATCH_SIZE, offset]);

      if (result.rows.length === 0) break;

      // Build batch insert
      const values: string[] = [];
      const params: (string | number | null)[] = [];
      let paramIndex = 1;

      for (const row of result.rows) {
        const roadType = mapRoadType(row.source_layer);
        const layerName = mapSourceLayerName(row.source_layer);

        // Generate name from available data
        let name = row.daicyo_ban
          ? `${layerName} (${row.daicyo_ban})`
          : `${layerName} #${row.gid || row.dedup_key}`;

        // Parse width from fukuin if available (e.g., "4.0m" -> 4.0)
        let width: number | null = null;
        if (row.fukuin) {
          const match = row.fukuin.match(/[\d.]+/);
          if (match) width = parseFloat(match[0]);
        }

        // Generate new ID (include layer prefix to ensure uniqueness)
        const layerPrefix = row.source_layer.replace('shiteidouro_', '').replace(/_pl.*/, '').substring(0, 6);
        const newId = `RA-NDR-${layerPrefix}-${row.gid || row.dedup_key.substring(0, 8)}`;

        values.push(`(
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          2,
          'two-way',
          'active',
          NOW(),
          'manual',
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++}::geometry
        )`);

        params.push(
          newId,
          name,
          name, // display_name
          roadType,
          row.source_layer, // source_version
          row.filename, // ref (PDF link)
          row.geometry
        );
      }

      // Execute batch insert
      await client.query(`
        INSERT INTO road_assets (
          id,
          name,
          display_name,
          road_type,
          lanes,
          direction,
          status,
          valid_from,
          data_source,
          source_version,
          ref,
          geometry
        ) VALUES ${values.join(', ')}
        ON CONFLICT (id) DO NOTHING
      `, params);

      totalImported += result.rows.length;
      offset += BATCH_SIZE;
      process.stdout.write(`\rImported: ${totalImported}/${nagoya_count}`);
    }

    console.log('\n\nImport completed!');

    // Verify
    const verifyResult = await client.query(`
      SELECT road_type, COUNT(*) as count
      FROM road_assets
      WHERE data_source = 'nagoya_shiteidouro'
      GROUP BY road_type
      ORDER BY count DESC
    `);

    console.log('\nImported by road type:');
    for (const row of verifyResult.rows) {
      console.log(`  ${row.road_type}: ${row.count}`);
    }

    const totalResult = await client.query(`SELECT COUNT(*) as total FROM road_assets`);
    console.log(`\nTotal road_assets: ${totalResult.rows[0].total}`);

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

importNagoyaRoads();

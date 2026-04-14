import 'dotenv/config';
import { clearMigrationTables } from '../src/bigquery/client';

console.log('Dropping and recreating BigQuery migration tables (movies, movie_features, movie_similarity)...');
clearMigrationTables()
  .then(() => console.log('Done. Tables are now empty and ready for re-migration.'))
  .catch(err => { console.error('Failed:', err); process.exit(1); });

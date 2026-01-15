const { Pool } = require('pg');
const config = require('../../config/config');

// Create connection pool
const pool = new Pool(config.database);

// Connection error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      console.warn('Slow query detected:', { text, duration, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    console.error('Database query error:', { text, params, error: error.message });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Monkey patch the query method to track query execution time
  client.query = async (...args) => {
    const start = Date.now();
    try {
      const res = await query(...args);
      const duration = Date.now() - start;

      if (duration > 1000) {
        console.warn('Slow query in transaction:', { duration, rows: res.rowCount });
      }

      return res;
    } catch (error) {
      console.error('Transaction query error:', error.message);
      throw error;
    }
  };

  // Monkey patch the release method to track connection usage
  client.release = () => {
    client.query = query;
    client.release = release;
    return release();
  };

  return client;
}

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Async function that receives client
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Graceful shutdown
 */
async function end() {
  await pool.end();
  console.log('Database pool has ended');
}

module.exports = {
  query,
  getClient,
  transaction,
  end,
  pool
};

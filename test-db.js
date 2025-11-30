const db = require('./db');

(async () => {
  try {
    const result = await db.query('SELECT NOW()');
    console.log('DB connected:', result.rows[0]);
  } catch (err) {
    console.error('DB connection error:', err);
  }
})();

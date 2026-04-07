const { pool } = require('../db');

const createNotification = async (userId, type, title, message, link) => {
  await pool.query(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1,$2,$3,$4,$5)',
    [userId, type, title, message, link]
  );
};

module.exports = { createNotification };

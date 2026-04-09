const crypto = require('crypto');
const { pool } = require('../db');

const REFRESH_TOKEN_DAYS = 30;

async function createRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
  return token;
}

async function invalidateAllUserTokens(userId) {
  await pool.query('DELETE FROM refresh_tokens WHERE user_id=$1', [userId]);
}

module.exports = { createRefreshToken, invalidateAllUserTokens, REFRESH_TOKEN_DAYS };

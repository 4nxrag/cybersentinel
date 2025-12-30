// test-vulnerable.js - Intentionally insecure code for testing

const express = require('express');
const mysql = require('mysql');
const app = express();

// VULNERABILITY 1: Hardcoded credentials
const API_KEY = "sk_live_1234567890abcdef";
const DB_PASSWORD = "admin123";

// VULNERABILITY 2: SQL Injection
app.get('/user', (req, res) => {
  const userId = req.query.id;
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  db.query(query, (err, results) => {
    res.json(results);
  });
});

// VULNERABILITY 3: No input validation
app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  
  // Direct password comparison (no hashing)
  if (password === DB_PASSWORD) {
    res.json({ token: generateToken(username) });
  }
});

// VULNERABILITY 4: Insecure random token
function generateToken(username) {
  return Math.random().toString(36);
}

// VULNERABILITY 5: No rate limiting
app.post('/api/data', (req, res) => {
  eval(req.body.code); // Code injection vulnerability
  res.send('OK');
});

// VULNERABILITY 6: Exposed sensitive endpoint
app.get('/admin/config', (req, res) => {
  res.json({
    dbHost: 'prod-db.company.com',
    apiKey: API_KEY,
    awsSecret: 'AKIAIOSFODNN7EXAMPLE'
  });
});

app.listen(3000);

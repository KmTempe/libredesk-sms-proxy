const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/logs
router.get('/', (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status || 'all';

    const offset = (page - 1) * limit;

    let totalQuery = 'SELECT COUNT(*) as count FROM logs';
    let dataQuery = 'SELECT * FROM logs';
    const params = [];

    if (status !== 'all') {
      totalQuery += ' WHERE status = ?';
      dataQuery += ' WHERE status = ?';
      params.push(status);
    }

    dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const totalRow = db.prepare(totalQuery).get(...params);
    const total = totalRow.count;

    const data = db.prepare(dataQuery).all(...params, limit, offset);

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/logs
router.delete('/', (req, res, next) => {
  try {
    db.prepare('DELETE FROM logs').run();
    res.json({ status: 'success', message: 'All logs cleared' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

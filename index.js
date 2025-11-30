const express = require("express");
const app = express();
app.use(express.json());

const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const db = require('./db');

const jwt = require('jsonwebtoken');
const JWT_SECRET = "supersecretkey-change-me";

// Hardcoded users for demo
const users = [
  { username: "admin1", password: "adminpass", role: "admin" },
  { username: "bank1", password: "bankpass", role: "bank" },
];

// Helper: create token
function createToken(user) {
  return jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// Middleware: require a certain role
function requireRole(role) {
  return (req, res, next) => {
    const auth = req.header("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Missing Bearer token" });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role !== role) {
        return res.status(403).json({ message: "Forbidden: wrong role" });
      }
      req.user = payload; // optional
      next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     summary: Health check for Tuition API
 *     responses:
 *       200:
 *         description: Returns OK status message.
 */
app.get("/api/v1/health", (req, res) => {
  res.send("Tuition API is running");
});

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login and receive a JWT token
 *     description: Use username and password to get a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns token
 *       401:
 *         description: Invalid credentials
 */
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = createToken(user);
  res.json({ token, role: user.role });
});

/**
 * @openapi
 * /api/v1/tuition/unpaid:
 *   get:
 *     summary: Get unpaid tuition status for a term (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: term
 *         required: true
 *         schema:
 *           type: string
 *         description: Academic term
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of unpaid tuition students
 *       400:
 *         description: Missing term parameter
 *       401:
 *         description: Unauthorized
 */
app.get('/api/v1/tuition/unpaid', requireRole('admin'), async (req, res) => {
  const { term, page = 1, limit = 10 } = req.query;

  if (!term) {
    return res.status(400).json({ message: "term is required" });
  }

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;

  try {
    const countResult = await db.query(
      'SELECT COUNT(*) FROM tuitions WHERE term = $1 AND tuition_total > amount_paid',
      [term]
    );
    const totalUnpaid = Number(countResult.rows[0].count);

    const listResult = await db.query(
      `SELECT student_no, term, tuition_total, amount_paid
       FROM tuitions
       WHERE term = $1 AND tuition_total > amount_paid
       ORDER BY student_no
       LIMIT $2 OFFSET $3`,
      [term, limitNum, offset]
    );

    res.json({
      term,
      totalUnpaid,
      page: pageNum,
      limit: limitNum,
      results: listResult.rows.map(r => ({
        studentNo: r.student_no,
        term: r.term,
        tuitionTotal: Number(r.tuition_total),
        amountPaid: Number(r.amount_paid),
      })),
    });
  } catch (err) {
    console.error('DB error (unpaid):', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @openapi
 * /api/v1/tuition/{studentNo}:
 *   get:
 *     summary: Query tuition for a given student
 *     parameters:
 *       - in: path
 *         name: studentNo
 *         required: true
 *         schema:
 *           type: string
 *         description: Student number
 *     responses:
 *       200:
 *         description: Tuition info and balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 studentNo:
 *                   type: string
 *                 term:
 *                   type: string
 *                 tuitionTotal:
 *                   type: number
 *                 balance:
 *                   type: number
 *       404:
 *         description: Student not found
 */
app.get('/api/v1/tuition/:studentNo', async (req, res) => {
  const { studentNo } = req.params;

  try {
    const result = await db.query(
      `SELECT student_no, term, tuition_total, amount_paid
       FROM tuitions
       WHERE student_no = $1
       ORDER BY term DESC
       LIMIT 1`,
      [studentNo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    const row = result.rows[0];
    const balance = Number(row.tuition_total) - Number(row.amount_paid);

    res.json({
      studentNo: row.student_no,
      term: row.term,
      tuitionTotal: Number(row.tuition_total),
      balance
    });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @openapi
 * /api/v1/bank/tuition/{studentNo}:
 *   get:
 *     summary: Query tuition for a given student (Banking App, JWT auth)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentNo
 *         required: true
 *         schema:
 *           type: string
 *         description: Student number
 *     responses:
 *       200:
 *         description: Tuition info and balance
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (wrong role)
 *       404:
 *         description: Student not found
 */
app.get('/api/v1/bank/tuition/:studentNo', requireRole('bank'), async (req, res) => {
  const { studentNo } = req.params;

  try {
    const result = await db.query(
      `SELECT student_no, term, tuition_total, amount_paid
       FROM tuitions
       WHERE student_no = $1
       ORDER BY term DESC
       LIMIT 1`,
      [studentNo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    const row = result.rows[0];
    const balance = Number(row.tuition_total) - Number(row.amount_paid);

    res.json({
      studentNo: row.student_no,
      term: row.term,
      tuitionTotal: Number(row.tuition_total),
      balance
    });
  } catch (err) {
    console.error("DB error (bank):", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @openapi
 * /api/v1/tuition:
 *   post:
 *     summary: Add tuition record for a student (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentNo:
 *                 type: string
 *               term:
 *                 type: string
 *               tuitionTotal:
 *                 type: number
 *     responses:
 *       201:
 *         description: Tuition record created
 *       400:
 *         description: Missing fields
 *       401:
 *         description: Unauthorized
 */
app.post('/api/v1/tuition', requireRole('admin'), async (req, res) => {
  const { studentNo, term, tuitionTotal } = req.body;

  if (!studentNo || !term || !tuitionTotal) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const result = await db.query(
      `INSERT INTO tuitions (student_no, term, tuition_total, amount_paid)
       VALUES ($1, $2, $3, 0)
       RETURNING id, student_no, term, tuition_total, amount_paid`,
      [studentNo, term, tuitionTotal]
    );

    const row = result.rows[0];

    res.status(201).json({
      message: "Tuition record created",
      data: {
        id: row.id,
        studentNo: row.student_no,
        term: row.term,
        tuitionTotal: Number(row.tuition_total),
        amountPaid: Number(row.amount_paid),
      }
    });
  } catch (err) {
    console.error('DB error (single add):', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @openapi
 * /api/v1/tuition/batch:
 *   post:
 *     summary: Add tuition records in batch (Admin)
 *     security:
 *       - bearerAuth: []
 *     description: Accepts a list of tuition records and inserts them all at once.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 studentNo:
 *                   type: string
 *                 term:
 *                   type: string
 *                 tuitionTotal:
 *                   type: number
 *     responses:
 *       201:
 *         description: Tuition records created
 *       400:
 *         description: Invalid body
 *       401:
 *         description: Unauthorized
 */
app.post('/api/v1/tuition/batch', requireRole('admin'), async (req, res) => {
  const records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res
      .status(400)
      .json({ message: "Request body must be a non-empty array" });
  }

  const created = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const item = records[i] || {};
    const { studentNo, term, tuitionTotal } = item;

    if (!studentNo || !term || !tuitionTotal) {
      errors.push({ index: i, message: "Missing fields", item });
      continue;
    }

    try {
      const result = await db.query(
        `INSERT INTO tuitions (student_no, term, tuition_total, amount_paid)
         VALUES ($1, $2, $3, 0)
         RETURNING id, student_no, term, tuition_total, amount_paid`,
        [studentNo, term, tuitionTotal]
      );
      const row = result.rows[0];
      created.push({
        id: row.id,
        studentNo: row.student_no,
        term: row.term,
        tuitionTotal: Number(row.tuition_total),
        amountPaid: Number(row.amount_paid),
      });
    } catch (err) {
      console.error('DB error (batch item', i, '):', err);
      errors.push({ index: i, message: "DB insert error", item });
    }
  }

  res.status(201).json({
    message: "Batch processed",
    createdCount: created.length,
    errorCount: errors.length,
    created,
    errors
  });
});

/**
 * @openapi
 * /api/v1/tuition/pay:
 *   post:
 *     summary: Pay tuition for a given student and term (Banking / Mobile)
 *     description: Records a payment. If amount is not complete, remaining balance is kept.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentNo:
 *                 type: string
 *               term:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payment processed
 *       400:
 *         description: Missing or invalid fields
 *       404:
 *         description: Tuition record not found
 */
app.post('/api/v1/tuition/pay', async (req, res) => {
  const { studentNo, term, amount } = req.body;

  if (!studentNo || !term || !amount || amount <= 0) {
    return res
      .status(400)
      .json({ message: "studentNo, term and positive amount are required" });
  }

  try {
    // Find tuition record
    const result = await db.query(
      `SELECT id, student_no, term, tuition_total, amount_paid
       FROM tuitions
       WHERE student_no = $1 AND term = $2
       LIMIT 1`,
      [studentNo, term]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Tuition record not found" });
    }

    const row = result.rows[0];
    const newAmountPaid = Math.min(
      Number(row.amount_paid) + Number(amount),
      Number(row.tuition_total)
    );

    const update = await db.query(
      `UPDATE tuitions
       SET amount_paid = $1
       WHERE id = $2
       RETURNING student_no, term, tuition_total, amount_paid`,
      [newAmountPaid, row.id]
    );

    const updated = update.rows[0];
    const remainingBalance =
      Number(updated.tuition_total) - Number(updated.amount_paid);

    res.json({
      paymentStatus: "Successful",
      studentNo: updated.student_no,
      term: updated.term,
      tuitionTotal: Number(updated.tuition_total),
      amountPaid: Number(updated.amount_paid),
      remainingBalance
    });
  } catch (err) {
    console.error('DB error (pay):', err);
    res.status(500).json({ message: "Internal server error" });
  }
});

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tuition Payment API",
      version: "1.0.0",
      description: "University Tuition Payment System APIs for SE4458 Group 2",
    },
    servers: [
      {
        url: "https://tuition-payment-api-ffcxa5dsbac0azf5.swedencentral-01.azurewebsites.net",
        description: "Azure production",
      },
      {
        url: "http://localhost:4000",
        description: "Local dev",
      },
    ],
  },
  apis: ["./index.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Running on port ${port}`));

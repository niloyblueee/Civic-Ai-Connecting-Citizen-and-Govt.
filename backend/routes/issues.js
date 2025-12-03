const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { createBan, durationUnitToMinutes, getUserBanStatus } = require('../services/ban-service');
const DEPARTMENT_ROLES = ['police', 'health', 'fire', 'water', 'electricity'];

// lightweight auth
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// helper to call OpenAI REST API
// Prefer Node's global fetch (Node >=18). If unavailable, lazy-load node-fetch.
const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const parseCoordinate = (coordinate) => {
  if (!coordinate) return null;
  const parts = String(coordinate).split(',').map((s) => s.trim());
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { latitude: lat, longitude: lon };
};

const parseAssignedDepartments = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
  } catch (_) {
    // fall through to comma split
  }
  const tokens = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return tokens.length ? tokens : null;
};

const toIssueDto = (row) => {
  const coords = parseCoordinate(row.coordinate);
  const assignedDepartments = parseAssignedDepartments(row.assigned_department);
  const validation = row.validation === 1 || row.validation === true || row.validation === '1';
  let collectionHeadId = row.same_collection ? Number(row.same_collection) : row.id;
  if (Number.isNaN(collectionHeadId) || collectionHeadId <= 0) {
    collectionHeadId = row.id;
  }
  return {
    id: row.id,
    phone_number: row.phone_number,
    description: row.description,
    photo: row.photo,
    emergency: !!row.emergency,
    status: row.status,
    assigned_departments: assignedDepartments,
    assigned_department: assignedDepartments ? assignedDepartments.join(', ') : null,
    description_pic_ai: row.description_pic_ai || null,
    validation,
    reason_text: row.reason_text || null,
    latitude: coords ? coords.latitude : null,
    longitude: coords ? coords.longitude : null,
    same_collection: row.same_collection ? String(row.same_collection) : null,
    created_at: row.createdAt || row.created_at || null,
    collection_head_id: collectionHeadId,
  };
};

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  // Default to GPT-5 mini unless overridden via env; the Responses API may require different model ids.
  let model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  if (!key) {
    // Graceful local fallback when AI is not configured
    return JSON.stringify({
      validated: 'unknown',
      confidence: 0,
      suggestions: [],
      explanation: 'AI disabled: OPENAI_API_KEY not configured on the server.'
    });
  }

  let resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 400,
      temperature: 0.0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    // try a model fallback if model appears invalid
    if (/model/i.test(txt) && model !== 'gpt-4o-mini') {
      model = 'gpt-4o-mini';
      console.warn('[issues.validate-ai] model fallback to gpt-4o-mini');
      resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          input: prompt,
          max_output_tokens: 400,
          temperature: 0.0,
          response_format: { type: 'json_object' },
        }),
      });
      if (!resp.ok) {
        const txt2 = await resp.text();
        throw new Error(`OpenAI error: ${resp.status} ${txt2}`);
      }
    } else {
      throw new Error(`OpenAI error: ${resp.status} ${txt}`);
    }
  }
  const data = await resp.json();
  // Attempt to extract the text from the response structure (Responses API)
  // Prefer output_text when available, else flatten output[].content[].text
  let out;
  if (typeof data.output_text === 'string' && data.output_text.length) {
    out = data.output_text;
  } else if (Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c && typeof c.text === 'string') parts.push(c.text);
        }
      }
    }
    out = parts.join('\n');
  } else {
    out = JSON.stringify(data);
  }
  return out;
}

// GET /api/issues - return issues with parsed coordinates
router.get('/', async (req, res) => {
  const db = req.db;
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 0, 0), 200); // cap at 200
    const status = req.query.status;
    const params = [];
    // Avoid selecting createdAt because older DBs may not have it yet, but include when available
    let sql = 'SELECT id, phone_number, coordinate, description, photo, emergency, status, assigned_department, description_pic_AI AS description_pic_ai, validation, REASON_TEXT AS reason_text, same_collection, createdAt FROM issues';
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    // Order by id DESC for recency without requiring createdAt
    sql += ' ORDER BY id DESC';
    if (limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    const [rows] = await db.query(sql, params);
    const parsed = rows.map(toIssueDto);
    res.json(parsed);
  } catch (err) {
    console.error('Error fetching issues:', err);
    res.status(500).json({ message: 'Failed to fetch issues' });
  }
});

// Departments list (static for now; can be DB driven later)
router.get('/meta/departments', (req, res) => {
  res.json({ departments: DEPARTMENT_ROLES });
});

// Get single issue
router.get('/:id', async (req, res) => {
  try {
    const issueId = Number(req.params.id);
    if (!issueId || Number.isNaN(issueId)) {
      return res.status(400).json({ message: 'Invalid issue id' });
    }

    const [rows] = await req.db.query(
      'SELECT id, phone_number, coordinate, description, photo, emergency, status, assigned_department, description_pic_AI AS description_pic_ai, validation, REASON_TEXT AS reason_text, same_collection, createdAt FROM issues WHERE id = ?',
      [issueId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Issue not found' });

    const currentRow = rows[0];
    const headId = currentRow.same_collection ? Number(currentRow.same_collection) : currentRow.id;

    const [groupRows] = await req.db.query(
      'SELECT id, phone_number, coordinate, description, photo, emergency, status, assigned_department, description_pic_AI AS description_pic_ai, validation, REASON_TEXT AS reason_text, same_collection, createdAt FROM issues WHERE id = ? OR same_collection = ? ORDER BY id ASC',
      [headId, String(headId)]
    );

    if (!groupRows.length) {
      return res.status(404).json({ message: 'Issue group not found' });
    }

    const headRow = groupRows.find((row) => row.id === headId) || currentRow;
    const mainIssue = toIssueDto(headRow);
    const relatedIssues = groupRows
      .filter((row) => row.id !== headRow.id)
      .map(toIssueDto);

    res.json({
      ...mainIssue,
      related_issues: relatedIssues,
      collection_head_id: headId,
    });
  } catch (err) {
    console.error('Error fetching issue:', err);
    res.status(500).json({ message: 'Failed to fetch issue' });
  }
});

router.post('/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const requesterRole = req.user?.role;
    if (!DEPARTMENT_ROLES.includes(requesterRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const issueId = Number(req.params.id);
    if (!issueId || Number.isNaN(issueId)) {
      return res.status(400).json({ message: 'Invalid issue id' });
    }

    const [rows] = await req.db.query(
      'SELECT id, phone_number, coordinate, description, photo, emergency, status, assigned_department, description_pic_AI AS description_pic_ai, validation, REASON_TEXT AS reason_text, same_collection, createdAt FROM issues WHERE id = ? LIMIT 1',
      [issueId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    const issueRow = rows[0];
    const assignedDepartments = parseAssignedDepartments(issueRow.assigned_department) || [];
    const normalizedDepartments = assignedDepartments.map((dept) => String(dept).toLowerCase());

    if (!normalizedDepartments.includes(requesterRole)) {
      return res.status(403).json({ message: 'Issue is not assigned to your department' });
    }

    if (issueRow.status === 'resolved') {
      return res.json({ message: 'Issue already resolved', issue: toIssueDto(issueRow) });
    }

    await req.db.execute('UPDATE issues SET status = ? WHERE id = ?', ['resolved', issueId]);

    const [[updatedRow]] = await req.db.query(
      'SELECT id, phone_number, coordinate, description, photo, emergency, status, assigned_department, description_pic_AI AS description_pic_ai, validation, REASON_TEXT AS reason_text, same_collection, createdAt FROM issues WHERE id = ? LIMIT 1',
      [issueId]
    );

    if (!updatedRow) {
      return res.status(404).json({ message: 'Issue not found after update' });
    }

    res.json({ message: 'Issue marked as resolved', issue: toIssueDto(updatedRow) });
  } catch (err) {
    console.error('Resolve issue error:', err);
    res.status(500).json({ message: 'Failed to resolve issue' });
  }
});

// Verify issue (approve/deny) and optionally assign department
router.post('/:id/verify', authenticateToken, async (req, res) => {
  try {
    if (!['govt_authority', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { action, department, ids } = req.body; // action: 'approve' or 'deny'
    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or deny' });
    }

    let newStatus = action === 'approve' ? 'in_progress' : 'rejected';
    let assignedValue = null;
    if (Array.isArray(department)) {
      const cleanArr = department.map(String).map(s => s.trim()).filter(Boolean);
      assignedValue = cleanArr.length ? JSON.stringify(cleanArr) : null;
    } else if (typeof department === 'string' && department.trim()) {
      assignedValue = JSON.stringify([department.trim()]);
    }

    const primaryId = Number(req.params.id);
    const targetIds = Array.isArray(ids) && ids.length
      ? ids.map((v) => Number(v)).filter((v) => !Number.isNaN(v))
      : [primaryId];

    if (!targetIds.length) {
      return res.status(400).json({ message: 'No valid issue ids provided' });
    }

    const placeholders = targetIds.map(() => '?').join(', ');
    const updateSql = `UPDATE issues SET status = ?, assigned_department = ? WHERE id IN (${placeholders})`;
    await req.db.execute(updateSql, [newStatus, assignedValue, ...targetIds]);

    const [updatedRows] = await req.db.query(
      `SELECT id, status, assigned_department FROM issues WHERE id IN (${placeholders})`,
      targetIds
    );

    if (!updatedRows.length) {
      return res.status(404).json({ message: 'Issue(s) not found after update' });
    }

    const transformed = updatedRows.map((row) => {
      const parsedAssigned = parseAssignedDepartments(row.assigned_department);
      return {
        id: row.id,
        status: row.status,
        assigned_departments: parsedAssigned,
        assigned_department: parsedAssigned ? parsedAssigned.join(', ') : null,
      };
    });

    const response = { message: 'Issues updated', issues: transformed };
    if (transformed.length === 1) {
      response.issue = transformed[0];
    }
    res.json(response);
  } catch (err) {
    console.error('Verify issue error:', err);
    res.status(500).json({ message: 'Failed to verify issue' });
  }
});

router.get('/:id/report-user/ban-summary', authenticateToken, async (req, res) => {
  try {
    if (!['govt_authority', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const issueId = Number(req.params.id);
    if (!issueId || Number.isNaN(issueId)) {
      return res.status(400).json({ message: 'Invalid issue id' });
    }

    const [[issueRow]] = await req.db.execute(
      `SELECT id, phone_number FROM issues WHERE id = ? LIMIT 1`,
      [issueId]
    );

    if (!issueRow) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    const phoneNumber = issueRow.phone_number ? String(issueRow.phone_number).trim() : '';
    if (!phoneNumber) {
      return res.status(404).json({ message: 'No reporter phone number found for this issue' });
    }

    const [[userRow]] = await req.db.execute(
      `SELECT id, firstName, lastName, email, phone_number
       FROM users
       WHERE phone_number = ?
       LIMIT 1`,
      [phoneNumber]
    );

    if (!userRow) {
      return res.status(404).json({ message: 'No registered user found for this phone number' });
    }

    const banStatus = await getUserBanStatus(req.db, userRow.id, { includeHistory: true });

    return res.json({
      user: {
        id: userRow.id,
        firstName: userRow.firstName,
        lastName: userRow.lastName,
        email: userRow.email,
        phone_number: userRow.phone_number,
      },
      banSummary: banStatus,
    });
  } catch (err) {
    console.error('Issue reporter ban summary error:', err);
    res.status(500).json({ message: 'Failed to fetch reporter ban summary' });
  }
});

router.post('/:id/ban', authenticateToken, async (req, res) => {
  try {
    if (!['govt_authority', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const issueId = Number(req.params.id);
    if (!issueId || Number.isNaN(issueId)) {
      return res.status(400).json({ message: 'Invalid issue id' });
    }

    const { durationValue, durationUnit, reason } = req.body || {};

    const [[issueRow]] = await req.db.execute(
      `SELECT id, phone_number FROM issues WHERE id = ? LIMIT 1`,
      [issueId]
    );

    if (!issueRow) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    const phoneNumber = issueRow.phone_number ? String(issueRow.phone_number).trim() : '';
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Issue does not have an associated phone number' });
    }

    const [[userRow]] = await req.db.execute(
      `SELECT id, phone_number, firstName, lastName FROM users WHERE phone_number = ? LIMIT 1`,
      [phoneNumber]
    );

    if (!userRow) {
      return res.status(404).json({ message: 'No registered user found for this phone number' });
    }

    const currentStatus = await getUserBanStatus(req.db, userRow.id, { includeHistory: true });
    if (currentStatus.isBlacklisted) {
      return res.status(200).json({
        message: 'User is already permanently blacklisted',
        banSummary: currentStatus,
      });
    }

    let durationNumeric = Number(durationValue);
    if (!Number.isFinite(durationNumeric) || durationNumeric < 0) {
      durationNumeric = 0;
    }
    const perUnit = durationUnitToMinutes(durationUnit);
    const durationMinutes = durationNumeric > 0 ? durationNumeric * perUnit : 0;
    const unitLabel = durationUnit ? String(durationUnit).toLowerCase() : 'hours';

    const cleanReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;

    const { banStatus, wasBlacklisted } = await createBan(req.db, {
      userId: userRow.id,
      phoneNumber: userRow.phone_number,
      issueId,
      reason: cleanReason,
      durationMinutes,
      bannedBy: req.user.id,
    });

    return res.json({
      message: wasBlacklisted
        ? 'User banned and permanently blacklisted due to repeated violations'
        : durationMinutes > 0
          ? `User banned for ${durationNumeric} ${unitLabel}`
          : 'User banned',
      banSummary: banStatus,
    });
  } catch (err) {
    console.error('Issue ban error:', err);
    res.status(500).json({ message: 'Failed to apply ban' });
  }
});

router.get('/:id/report-user/ban-summary', authenticateToken, async (req, res) => {
  try {
    if (!['govt_authority', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const issueId = Number(req.params.id);
    if (!issueId || Number.isNaN(issueId)) {
      return res.status(400).json({ message: 'Invalid issue id' });
    }

    const [[issueRow]] = await req.db.execute(
      `SELECT id, phone_number FROM issues WHERE id = ? LIMIT 1`,
      [issueId]
    );

    if (!issueRow) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    const phoneNumber = issueRow.phone_number ? String(issueRow.phone_number).trim() : '';
    if (!phoneNumber) {
      return res.status(404).json({ message: 'No reporter phone number associated with this issue' });
    }

    const [[userRow]] = await req.db.execute(
      `SELECT id, firstName, lastName, phone_number, email FROM users
       WHERE phone_number = ?
       LIMIT 1`,
      [phoneNumber]
    );

    if (!userRow) {
      return res.status(404).json({ message: 'Reporter not registered' });
    }

    const banStatus = await getUserBanStatus(req.db, userRow.id, { includeHistory: true });

    return res.json({
      user: {
        id: userRow.id,
        firstName: userRow.firstName,
        lastName: userRow.lastName,
        email: userRow.email,
        phone_number: userRow.phone_number,
      },
      banSummary: banStatus,
    });
  } catch (err) {
    console.error('Reporter ban summary error:', err);
    res.status(500).json({ message: 'Failed to fetch reporter ban summary' });
  }
});

// AI validation endpoint - returns suggested validation and two suggested departments + explanation
router.post('/:id/validate-ai', authenticateToken, async (req, res) => {
  try {
    if (!['govt_authority', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const id = req.params.id;
    const [rows] = await req.db.query('SELECT id, description, photo FROM issues WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Issue not found' });
    const issue = rows[0];

    // If AI key is missing, provide a heuristic fallback instead of failing
    if (!process.env.OPENAI_API_KEY) {
      const departmentsResp = ['police', 'health', 'fire', 'water', 'electricity'];
      const text = `${issue.description || ''} ${issue.photo || ''}`.toLowerCase();
      const suggestions = [];
      if (/accident|theft|crime|police|assault/.test(text)) suggestions.push('police');
      if (/injur|blood|ambulance|hospital|health|medical/.test(text)) suggestions.push('health');
      if (/fire|smoke|burn|flame/.test(text)) suggestions.push('fire');
      if (/water|leak|pipe|flood/.test(text)) suggestions.push('water');
      if (/electric|power|wire|shock|transformer/.test(text)) suggestions.push('electricity');
      const uniq = suggestions.filter((s, i, a) => a.indexOf(s) === i).filter(s => departmentsResp.includes(s)).slice(0, 2);
      return res.json({
        validated: 'unknown',
        confidence: 0,
        suggestions: uniq,
        explanation: 'AI is not configured on this server. Provided simple keyword-based suggestions.'
      });
    }

    // Build prompt for OpenAI
    const departmentsResp = ['police', 'health', 'fire', 'water', 'electricity'];
    const prompt = `You are given an incident report. Determine whether the incident appears to be a real/valid report based on the description and photo (photo is a textual URL, you should only reason from the description and image filename). Respond exactly in JSON with keys: validated ("yes" or "no"), confidence (0-1 decimal), suggestions (array of up to 2 department strings chosen from: ${departmentsResp.join(', ')}), explanation (short). Here is the report:\nDESCRIPTION:\n${issue.description || ''}\nPHOTO_URL:\n${issue.photo || ''}`;

    const aiText = await callOpenAI(prompt);

    // Try parse JSON from model output
    let parsed = null;
    try {
      const idx = aiText.indexOf('{');
      const jsonText = idx >= 0 ? aiText.slice(idx) : aiText;
      parsed = JSON.parse(jsonText);
    } catch (e) {
      // fallback: return raw text explanation and attempt heuristics
      return res.json({ validated: 'unknown', confidence: 0, suggestions: [], explanation: aiText });
    }

    // sanitize suggestions to known departments and pick up to 2
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(s => departmentsResp.includes(String(s).toLowerCase())).slice(0, 2) : [];
    const validated = parsed.validated === 'yes' ? 'validated' : (parsed.validated === 'no' ? 'not_validated' : 'unknown');
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

    res.json({ validated, confidence, suggestions, explanation: parsed.explanation || '' });
  } catch (err) {
    console.error('AI validate error:', err);
    res.status(500).json({ message: 'Failed to validate via AI', detail: String(err.message) });
  }
});

module.exports = router;

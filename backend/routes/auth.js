const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { body, validationResult } = require('express-validator');
const { getUserBanStatus } = require('../services/ban-service');
const router = express.Router();

/* Profile image upload setup */
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const PROFILE_DIR = path.join(__dirname, '..', 'uploads', 'profile');
if (!fs.existsSync(PROFILE_DIR)) {
    try { fs.mkdirSync(PROFILE_DIR, { recursive: true }); } catch { }
}

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, PROFILE_DIR),
    filename: (_, file, cb) => {
        const ext = path.extname(file.originalname || '.jpg').toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
});
const fileFilter = (_, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Only PNG/JPG/WEBP allowed'), ok);
};
const uploadProfileImage = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
}).single('profileImage');
/* End profile image upload setup */

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verify error:', err.name, err.message);
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Validation middleware
const ALLOWED_ROLES = ['citizen', 'govt_authority', 'police', 'health', 'fire', 'water', 'electricity'];
const AUTO_APPROVED_ROLES = ALLOWED_ROLES.filter(role => role !== 'govt_authority');

const validateRegistration = [
    body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
    body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('phone_number').trim().isLength({ min: 6 }).withMessage('Phone number is required'),
    body('national_id').trim().isLength({ min: 10 }).withMessage('National ID must be at least 10 characters long'),
    body('sex').isIn(['male', 'female', 'other']).withMessage('Invalid sex'),
    body('role').isIn(ALLOWED_ROLES).withMessage('Invalid role'),
    // govt_authority-only requirements
    body('department').if(body('role').equals('govt_authority')).trim().notEmpty().withMessage('Department is required for government authorities'),
    body('region').if(body('role').equals('govt_authority')).isIn(['dhaka_north', 'dhaka_south']).withMessage('Invalid region')
];

const validateLogin = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

// Register user with profile image upload support
router.post('/register', uploadProfileImage, validateRegistration, async (req, res) => {
    try {
        console.log('📥 Registration request received:', JSON.stringify(req.body, null, 2));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('❌ Validation errors:', errors.array());
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        let { firstName, lastName, email, password, confirmPassword, national_id, sex, phone_number, department, region, role } = req.body;

        // Remove confirmPassword from the data as it's not needed in the backend
        delete req.body.confirmPassword;

        // normalize inputs
        role = (role || 'citizen').toLowerCase();
        if (!ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        // department and region only required for government authorities
        if (role === 'govt_authority') {
            if (!department || !department.trim()) {
                return res.status(400).json({ message: 'Department is required for government authorities' });
            }
            if (!region) {
                return res.status(400).json({ message: 'Region is required for government authorities' });
            }
            department = department.trim();
        }

        // unique email check
        const [email_rows] = await req.db.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        if (email_rows.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // unique national_id check
        const [national_id_rows] = await req.db.execute(
            'SELECT id FROM users WHERE national_id = ?',
            [national_id]
        );
        if (national_id_rows.length > 0) {
            return res.status(400).json({ message: 'National ID must be unique' });
        }

        // hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Get relative path if user uploaded a profile image
        const relProfile = req.file ? `/uploads/profile/${req.file.filename}` : null;

        // Set status based on role
        const status = role === 'govt_authority' ? 'pending' : 'active';

        // Insert user into database with profile image
        const [result] = await req.db.execute(
            `INSERT INTO users (firstName, lastName, email, password, national_id, sex, phone_number, role, status, profileImage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [firstName, lastName, email, hashedPassword, national_id, sex, phone_number, role, status, relProfile]
        );

        // Insert government authority record if user is a government authority
        if (role === 'govt_authority') {
            await req.db.execute(
                `INSERT INTO govt_authorities (user_id, department, region) VALUES (?, ?, ?)`,
                [result.insertId, department, region]
            );
        } else if (role === 'citizen') {
            // Insert citizen record
            await req.db.execute(
                `INSERT INTO citizens (user_id) VALUES (?)`,
                [result.insertId]
            );
        }

        // Retrieve the created user with profile image
        const [[user]] = await req.db.execute(
            `SELECT 
                 u.id,
                 u.firstName,
                 u.lastName,
                 u.email,
                 u.national_id,
                 u.sex,
                 u.phone_number,
                 u.role,
                 u.status,
                 u.profileImage,
                 u.reward_point,
                 ga.department,
                 ga.region
             FROM users u
             LEFT JOIN govt_authorities ga ON ga.user_id = u.id
             WHERE u.id = ?`,
            [result.insertId]
        );

        // Generate JWT token for the user
        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Return success response with user data and token
        return res.status(201).json({
            message: role === 'govt_authority' ? 'Registration submitted for approval' : 'User registered successfully',
            token: AUTO_APPROVED_ROLES.includes(role) ? token : null,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                national_id: user.national_id,
                sex: user.sex,
                status: user.status,
                department: user.department ?? null,
                region: user.region ?? null,
                role: user.role,
                phone_number: user.phone_number,
                profileImage: user.profileImage || null,
                reward_points: user.reward_point ?? 0
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        // Handle common SQL errors with clearer messages
        if (error && error.code === 'ER_BAD_NULL_ERROR') {
            return res.status(400).json({ message: 'Missing required fields. Please fill all required inputs.' });
        }
        if (error && error.code === 'ER_DUP_ENTRY') {
            const msg = /users\.email/.test(error.message) ? 'Email already in use' : (/users\.national_id/.test(error.message) ? 'National ID already in use' : 'Duplicate entry');
            return res.status(400).json({ message: msg });
        }
        if (error && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
            return res.status(503).json({ message: 'Database temporarily unavailable. Please try again shortly.' });
        }
        return res.status(500).json({ message: 'Registration failed' });
    }
});


// Login user and return profile data
router.post('/login', async (req, res) => {
    try {
        const { email, phone_number, password } = req.body;
        if (!password || (!email && !phone_number)) {
            return res.status(400).json({ message: 'Email or phone number and password required' });
        }

        // Get user by email or phone_number
        const [rows] = await req.db.execute(
            `SELECT id, firstName, lastName, email, password, national_id, sex, phone_number, role, status, createdAt, profileImage, reward_point
       FROM users
       WHERE email = ? OR phone_number = ?`,
            [email || '', phone_number || '']
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = rows[0];

        // Check if user is active
        if (user.status !== 'active') {
            if (user.status === 'pending') {
                return res.status(401).json({ message: 'Your account is pending admin approval' });
            } else if (user.status === 'rejected') {
                return res.status(401).json({ message: 'Your account has been rejected' });
            }
        }

        // Verify password hash
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const banStatus = await getUserBanStatus(req.db, user.id, { includeHistory: false });
        if (banStatus.isBlacklisted) {
            return res.status(403).json({
                message: 'Your account has been permanently banned',
                ban: {
                    type: 'blacklisted',
                    reason: banStatus.blacklist?.reason || 'Exceeded ban limit',
                    since: banStatus.blacklist?.blacklisted_at || null,
                }
            });
        }

        if (banStatus.activeBan) {
            const until = banStatus.activeBan.banned_until;
            return res.status(403).json({
                message: until
                    ? `Your account is temporarily banned until ${until}`
                    : 'Your account is currently suspended',
                ban: {
                    type: 'temporary',
                    until,
                    reason: banStatus.activeBan.reason || null,
                }
            });
        }

        // Get department and region for government authorities
        let department = null;
        let region = null;
        if (user.role === 'govt_authority') {
            const [[deptRow]] = await req.db.execute(
                `SELECT department, region FROM govt_authorities WHERE user_id = ?`,
                [user.id]
            );
            if (deptRow) {
                department = deptRow.department;
                region = deptRow.region;
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Return user data without password
        return res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                national_id: user.national_id,
                sex: user.sex,
                phone_number: user.phone_number,
                status: user.status,
                department,
                region,
                role: user.role,
                profileImage: user.profileImage || null,
                reward_points: user.reward_point ?? 0
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Login failed' });
    }
});


// Google OAuth login
router.post('/google', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: 'Google token is required' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name, sub: googleId } = payload;

        // Check if user exists
        const [existingUsers] = await req.db.execute(
            'SELECT * FROM users WHERE email = ? OR googleId = ?',
            [email, googleId]
        );

        let user;

        if (existingUsers.length > 0) {
            user = existingUsers[0];
            if (!user.googleId) {
                await req.db.execute(
                    'UPDATE users SET googleId = ? WHERE id = ?',
                    [googleId, user.id]
                );
            }
        } else {
            // Create new user with Google ID
            const [result] = await req.db.execute(
                `INSERT INTO users (firstName, lastName, email, password, national_id, sex, role, googleId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [given_name, family_name, email, 'google_oauth', null, 'other', 'citizen', googleId]
            );

            const [[created]] = await req.db.execute(
                'SELECT * FROM users WHERE id = ?',
                [result.insertId]
            );
            user = created;
        }

        const banStatus = await getUserBanStatus(req.db, user.id, { includeHistory: false });
        if (banStatus.isBlacklisted) {
            return res.status(403).json({
                message: 'Your account has been permanently banned',
                ban: {
                    type: 'blacklisted',
                    reason: banStatus.blacklist?.reason || 'Exceeded ban limit',
                    since: banStatus.blacklist?.blacklisted_at || null,
                }
            });
        }

        if (banStatus.activeBan) {
            const until = banStatus.activeBan.banned_until;
            return res.status(403).json({
                message: until
                    ? `Your account is temporarily banned until ${until}`
                    : 'Your account is currently suspended',
                ban: {
                    type: 'temporary',
                    until,
                    reason: banStatus.activeBan.reason || null,
                }
            });
        }

        // Get department for govt_authority users (admins don't have departments)
        let department = null;
        if (user.role === 'govt_authority') {
            const [[deptRow]] = await req.db.execute(
                `SELECT department FROM govt_authorities WHERE user_id = ?`,
                [user.id]
            );
            department = deptRow ? deptRow.department : null;
        }

        const jwtToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            message: 'Google login successful',
            token: jwtToken,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                national_id: user.national_id,
                sex: user.sex,
                phone_number: user.phone_number || null,
                department,
                role: user.role,
                profileImage: user.profileImage || null,
                reward_points: user.reward_point ?? 0
            }
        });

    } catch (error) {
        console.error('Google login error:', error);
        return res.status(500).json({ message: 'Google login failed' });
    }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Get user data from database
        const [[user]] = await req.db.execute(
            `SELECT id, firstName, lastName, email, national_id, sex, phone_number, role, createdAt, profileImage, reward_point
       FROM users
       WHERE id = ?`,
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get department for govt_authority users (admins don't have departments)
        let department = null;
        if (user.role === 'govt_authority') {
            const [[deptRow]] = await req.db.execute(
                `SELECT department FROM govt_authorities WHERE user_id = ?`,
                [user.id]
            );
            department = deptRow ? deptRow.department : null;
        }

        return res.json({
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                national_id: user.national_id,
                sex: user.sex,
                phone_number: user.phone_number,
                department,
                role: user.role,
                createdAt: user.createdAt,
                profileImage: user.profileImage || null,
                reward_points: user.reward_point ?? 0
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        return res.status(500).json({ message: 'Failed to get user data' });
    }
});

router.get('/me/ban-summary', authenticateToken, async (req, res) => {
    try {
        const banStatus = await getUserBanStatus(req.db, req.user.id, { includeHistory: true });
        return res.json({
            banSummary: {
                banCount: banStatus.banCount,
                isBlacklisted: banStatus.isBlacklisted,
                activeBan: banStatus.activeBan,
                blacklist: banStatus.blacklist,
                history: banStatus.history,
            }
        });
    } catch (error) {
        console.error('Get ban summary error:', error);
        return res.status(500).json({ message: 'Failed to fetch ban summary' });
    }
});

router.get('/users/:userId/ban-summary', authenticateToken, async (req, res) => {
    try {
        if (!['govt_authority', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const userId = Number(req.params.userId);
        if (!userId || Number.isNaN(userId)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }

        const [[userRow]] = await req.db.execute(
            `SELECT id, firstName, lastName, phone_number, email
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [userId]
        );

        if (!userRow) {
            return res.status(404).json({ message: 'User not found' });
        }

        const banStatus = await getUserBanStatus(req.db, userId, { includeHistory: true });

        return res.json({
            user: {
                id: userRow.id,
                firstName: userRow.firstName,
                lastName: userRow.lastName,
                email: userRow.email,
                phone_number: userRow.phone_number,
            },
            banSummary: {
                banCount: banStatus.banCount,
                isBlacklisted: banStatus.isBlacklisted,
                activeBan: banStatus.activeBan,
                blacklist: banStatus.blacklist,
                history: banStatus.history,
            }
        });
    } catch (error) {
        console.error('Get user ban summary error:', error);
        return res.status(500).json({ message: 'Failed to fetch user ban summary' });
    }
});

// Change password
router.post('/change-password', authenticateToken, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        // Get current user with password
        const [users] = await req.db.execute(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await req.db.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedNewPassword, req.user.id]
        );

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Failed to change password' });
    }
});

// Get pending government authority registrations (admin only)
router.get('/pending-govt-authorities', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        const [pendingUsers] = await req.db.execute(
            `SELECT 
                u.id,
                u.firstName,
                u.lastName,
                u.email,
                u.national_id,
                u.sex,
                u.createdAt,
                ga.department,
                ga.region
            FROM users u
            JOIN govt_authorities ga ON ga.user_id = u.id
            WHERE u.role = 'govt_authority' AND u.status = 'pending'
            ORDER BY u.createdAt ASC`
        );

        return res.json({
            message: 'Pending government authorities retrieved successfully',
            pendingUsers
        });

    } catch (error) {
        console.error('Get pending govt authorities error:', error);
        return res.status(500).json({ message: 'Failed to retrieve pending government authorities' });
    }
});

// Approve or reject government authority registration (admin only)
router.post('/approve-govt-authority/:userId', authenticateToken, [
    body('action').isIn(['approve', 'reject']).withMessage('Action must be either approve or reject')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        const { userId } = req.params;
        const { action } = req.body;

        // Check if the user exists and is a pending government authority
        const [users] = await req.db.execute(
            'SELECT id, role, status FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        if (user.role !== 'govt_authority' || user.status !== 'pending') {
            return res.status(400).json({ message: 'User is not a pending government authority' });
        }

        // Update user status
        const newStatus = action === 'approve' ? 'active' : 'rejected';
        await req.db.execute(
            'UPDATE users SET status = ? WHERE id = ?',
            [newStatus, userId]
        );

        // If approved, update the govt_authorities table with approval info
        if (action === 'approve') {
            await req.db.execute(
                'UPDATE govt_authorities SET approved_by = ?, approved_at = NOW() WHERE user_id = ?',
                [req.user.id, userId]
            );
        }

        return res.json({
            message: `Government authority ${action}d successfully`,
            status: newStatus
        });

    } catch (error) {
        console.error('Approve govt authority error:', error);
        return res.status(500).json({ message: 'Failed to process government authority approval' });
    }
});

// Get all users (admin only)
router.get('/all-users', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        const [users] = await req.db.execute(
            `SELECT 
                u.id,
                u.firstName,
                u.lastName,
                u.email,
                u.national_id,
                u.sex,
                u.role,
                u.status,
                u.createdAt,
                u.profileImage,
                ga.department,
                ga.region
            FROM users u
            LEFT JOIN govt_authorities ga ON ga.user_id = u.id
            ORDER BY u.createdAt DESC`
        );

        return res.json({
            message: 'Users retrieved successfully',
            users
        });

    } catch (error) {
        console.error('Get all users error:', error);
        return res.status(500).json({ message: 'Failed to retrieve users' });
    }
});

// Get admin statistics (admin only)
router.get('/admin-stats', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        // Get total users
        const [totalUsersResult] = await req.db.execute('SELECT COUNT(*) as count FROM users');
        const totalUsers = totalUsersResult[0].count;

        // Get users by status
        const [activeUsersResult] = await req.db.execute('SELECT COUNT(*) as count FROM users WHERE status = "active"');
        const activeUsers = activeUsersResult[0].count;

        const [pendingUsersResult] = await req.db.execute('SELECT COUNT(*) as count FROM users WHERE status = "pending"');
        const pendingUsers = pendingUsersResult[0].count;

        const [rejectedUsersResult] = await req.db.execute('SELECT COUNT(*) as count FROM users WHERE status = "rejected"');
        const rejectedUsers = rejectedUsersResult[0].count;

        // Get users by role
        const [citizensResult] = await req.db.execute('SELECT COUNT(*) as count FROM users WHERE role = "citizen"');
        const totalCitizens = citizensResult[0].count;

        const [govtAuthResult] = await req.db.execute('SELECT COUNT(*) as count FROM users WHERE role = "govt_authority"');
        const totalGovtAuthorities = govtAuthResult[0].count;

        const [adminsResult] = await req.db.execute('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
        const totalAdmins = adminsResult[0].count;

        // Get recent registrations (last 10)
        const [recentRegistrations] = await req.db.execute(
            `SELECT 
                u.id,
                u.firstName,
                u.lastName,
                u.email,
                u.role,
                u.status,
                u.createdAt
            FROM users u
            ORDER BY u.createdAt DESC
            LIMIT 10`
        );

        return res.json({
            totalUsers,
            activeUsers,
            pendingUsers,
            rejectedUsers,
            totalCitizens,
            totalGovtAuthorities,
            totalAdmins,
            recentRegistrations
        });

    } catch (error) {
        console.error('Get admin stats error:', error);
        return res.status(500).json({ message: 'Failed to retrieve admin statistics' });
    }
});

// Delete user (admin only)
router.delete('/users/:userId', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        const { userId } = req.params;

        // Check if user exists
        const [users] = await req.db.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        // Prevent admin from deleting themselves
        if (user.id === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        // Prevent deletion of other admins (only allow deletion of citizens and govt_authorities)
        if (user.role === 'admin') {
            return res.status(400).json({ message: 'Cannot delete admin accounts' });
        }

        // Delete user (cascade will handle related records)
        await req.db.execute('DELETE FROM users WHERE id = ?', [userId]);

        return res.json({
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        return res.status(500).json({ message: 'Failed to delete user' });
    }
});

// Update user status (admin only)
router.put('/users/:userId/status', authenticateToken, [
    body('status').isIn(['active', 'pending', 'rejected']).withMessage('Invalid status')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        const { userId } = req.params;
        const { status } = req.body;

        // Check if user exists
        const [users] = await req.db.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        // Prevent admin from changing their own status
        if (user.id === req.user.id) {
            return res.status(400).json({ message: 'Cannot change your own status' });
        }

        // Update user status
        await req.db.execute('UPDATE users SET status = ? WHERE id = ?', [status, userId]);

        return res.json({
            message: 'User status updated successfully',
            status
        });

    } catch (error) {
        console.error('Update user status error:', error);
        return res.status(500).json({ message: 'Failed to update user status' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;

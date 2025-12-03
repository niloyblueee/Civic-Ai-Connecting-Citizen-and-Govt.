const BAN_BLACKLIST_THRESHOLD = 3;

const formatDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

const mapBanRow = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        reason: row.reason || null,
        banned_from: formatDate(row.banned_from),
        banned_until: formatDate(row.banned_until),
        issue_id: row.issue_id ? Number(row.issue_id) : null,
        banned_by: row.banned_by ? Number(row.banned_by) : null,
    };
};

const toMysqlDateTime = (date) => {
    if (!date) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
};

const durationUnitToMinutes = (unit) => {
    const normalized = String(unit || '').toLowerCase();
    if (normalized === 'minute' || normalized === 'minutes') return 1;
    if (normalized === 'day' || normalized === 'days') return 60 * 24;
    return 60; // default hours
};

async function getUserBanStatus(db, userId, options = {}) {
    const includeHistory = options.includeHistory === true;

    const [[blacklistRow]] = await db.execute(
        `SELECT id, reason, phone_number, blacklisted_at, blacklisted_by
         FROM blacklisted_users
         WHERE user_id = ?
         LIMIT 1`,
        [userId]
    );

    const [[banCountRow]] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM user_bans
         WHERE user_id = ?`,
        [userId]
    );

    let activeBanRow = null;
    if (!blacklistRow) {
        const [activeRows] = await db.execute(
            `SELECT id, reason, banned_from, banned_until, issue_id, banned_by
             FROM user_bans
             WHERE user_id = ?
               AND (banned_until IS NULL OR banned_until > NOW())
             ORDER BY banned_from DESC
             LIMIT 1`,
            [userId]
        );
        if (activeRows.length > 0) {
            activeBanRow = activeRows[0];
        }
    }

    let history = [];
    if (includeHistory) {
        const [historyRows] = await db.execute(
            `SELECT id, reason, banned_from, banned_until, issue_id, banned_by
             FROM user_bans
             WHERE user_id = ?
             ORDER BY banned_from DESC`,
            [userId]
        );
        history = historyRows.map(mapBanRow);
    }

    return {
        banCount: Number(banCountRow?.total || 0),
        isBlacklisted: !!blacklistRow,
        blacklist: blacklistRow
            ? {
                id: blacklistRow.id,
                reason: blacklistRow.reason || null,
                phone_number: blacklistRow.phone_number || null,
                blacklisted_at: formatDate(blacklistRow.blacklisted_at),
                blacklisted_by: blacklistRow.blacklisted_by ? Number(blacklistRow.blacklisted_by) : null,
            }
            : null,
        activeBan: mapBanRow(activeBanRow),
        history,
    };
}

async function addUserToBlacklist(db, { userId, phoneNumber, reason, blacklistedBy }) {
    await db.execute(
        `INSERT INTO blacklisted_users (user_id, phone_number, reason, blacklisted_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            reason = VALUES(reason),
            phone_number = VALUES(phone_number),
            blacklisted_by = VALUES(blacklisted_by),
            blacklisted_at = CURRENT_TIMESTAMP`,
        [userId, phoneNumber || null, reason || null, blacklistedBy || null]
    );
}

async function createBan(db, { userId, phoneNumber, issueId, reason, durationMinutes, bannedBy }) {
    const duration = Number(durationMinutes || 0);
    let bannedUntilValue = null;
    if (duration > 0) {
        const future = new Date(Date.now() + duration * 60 * 1000);
        bannedUntilValue = toMysqlDateTime(future);
    }

    await db.execute(
        `INSERT INTO user_bans (user_id, phone_number, issue_id, reason, banned_by, banned_until)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            userId,
            phoneNumber || null,
            issueId || null,
            reason || null,
            bannedBy || null,
            bannedUntilValue,
        ]
    );

    let status = await getUserBanStatus(db, userId, { includeHistory: true });
    let wasBlacklisted = false;

    if (status.banCount >= BAN_BLACKLIST_THRESHOLD && !status.isBlacklisted) {
        const blacklistReason = reason || 'Exceeded ban limit';
        await addUserToBlacklist(db, {
            userId,
            phoneNumber,
            reason: blacklistReason,
            blacklistedBy: bannedBy,
        });
        status = await getUserBanStatus(db, userId, { includeHistory: true });
        wasBlacklisted = true;
    }

    return { banStatus: status, wasBlacklisted };
}

module.exports = {
    getUserBanStatus,
    createBan,
    durationUnitToMinutes,
};

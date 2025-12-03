#!/usr/bin/env node
/*
 * Re-run AI analysis for existing issues and cleanup descriptions.
 * Usage: node scripts/backfill-issue-ai.js [--limit=N] [--only-missing] [--delay=MS]
 */

const path = require('path');
const mysql = require('mysql2/promise');
const { analyzeIssueWithAI } = require('../services/issue-ai');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const defaultOptions = {
    limit: 0,
    onlyMissing: false,
    delay: 250,
};

const argv = process.argv.slice(2).reduce((acc, arg) => {
    if (arg.startsWith('--limit=')) {
        acc.limit = Number(arg.split('=')[1]) || 0;
    } else if (arg === '--only-missing') {
        acc.onlyMissing = true;
    } else if (arg.startsWith('--delay=')) {
        acc.delay = Number(arg.split('=')[1]) || acc.delay;
    } else if (arg === '--help' || arg === '-h') {
        console.log('Usage: node scripts/backfill-issue-ai.js [--limit=N] [--only-missing] [--delay=MS]');
        process.exit(0);
    }
    return acc;
}, { ...defaultOptions });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildDbConfigFromEnv = () => {
    // Enforce internal/private connection string only
    const urlStr = process.env.MYSQL_URL;
    let cfg;

    if (urlStr) {
        try {
            const url = new URL(urlStr);
            cfg = {
                host: url.hostname,
                port: url.port ? Number(url.port) : 3306,
                user: decodeURIComponent(url.username),
                password: decodeURIComponent(url.password),
                database: url.pathname ? url.pathname.replace(/^\//, '') : undefined,
            };
        } catch (e) {
            throw new Error('[backfill] Invalid MYSQL_URL: ' + e.message);
        }
    } else {
        throw new Error('[backfill] MYSQL_URL is required and no public fallback is allowed.');
    }

    cfg.waitForConnections = true;
    cfg.connectionLimit = Number(process.env.DB_CONNECTION_LIMIT || 5);
    cfg.queueLimit = 0;
    cfg.connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT || 20000);

    if (String(process.env.DB_SSL).toLowerCase() === 'true') {
        const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
        cfg.ssl = { rejectUnauthorized };
    }

    return cfg;
};

const truncate = (value, len) => {
    if (typeof value !== 'string') return value;
    return value.length > len ? value.slice(0, len) : value;
};

const cleanDescription = (value) => {
    if (!value || typeof value !== 'string') return value;

    let text = value.replace(/\r\n/g, '\n').trim();

    if (/^user description:/i.test(text)) {
        text = text.replace(/^user description:\s*/i, '');
    }

    const descIdx = text.search(/\bDescription:\s*/i);
    if (descIdx > -1) {
        text = text.slice(0, descIdx).trim();
    }

    return text;
};

async function fetchIssues(db) {
    const conditions = [];
    if (argv.onlyMissing) {
        conditions.push('(description_pic_AI IS NULL OR description_pic_AI = \'\')');
    }

    let sql = 'SELECT id, description, photo FROM issues';
    if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY id ASC';
    if (argv.limit > 0) {
        sql += ' LIMIT ' + Number(argv.limit);
    }

    const [rows] = await db.query(sql);
    return rows;
}

async function main() {
    const db = await mysql.createPool(buildDbConfigFromEnv());
    console.log('🛠️  Backfill starting...');

    const issues = await fetchIssues(db);
    console.log(`🔍 Found ${issues.length} issue(s) to process`);

    let success = 0;
    let failures = 0;

    for (const issue of issues) {
        try {
            if (argv.delay > 0) {
                await delay(argv.delay);
            }

            const cleanedDescription = cleanDescription(issue.description || '');
            const aiResult = await analyzeIssueWithAI({ description: cleanedDescription, photo: issue.photo });
            const assignedValue = aiResult.assignedDepartments && aiResult.assignedDepartments.length
                ? JSON.stringify(aiResult.assignedDepartments)
                : null;

            await db.execute(
                'UPDATE issues SET description = ?, assigned_department = ?, description_pic_AI = ?, validation = ?, REASON_TEXT = ? WHERE id = ? LIMIT 1',
                [
                    cleanedDescription,
                    assignedValue,
                    truncate(aiResult.descriptionPicAI || '', 255),
                    aiResult.validation ? 1 : 0,
                    truncate(aiResult.reason || '', 255),
                    issue.id,
                ]
            );

            success += 1;
            const cleanedFlag = cleanedDescription !== (issue.description || '').trim() ? 'cleaned' : 'unchanged';
            console.log(`✅ Issue ${issue.id} updated (${aiResult.source || 'n/a'}) [${cleanedFlag}]`);
        } catch (err) {
            failures += 1;
            console.error(`❌ Issue ${issue.id} failed:`, err.message);
        }
    }

    await db.end();

    console.log('🏁 Backfill complete.');
    console.log(`   ✅ Success: ${success}`);
    console.log(`   ❌ Failed: ${failures}`);
}

main().catch((err) => {
    console.error('Backfill script crashed:', err);
    process.exit(1);
});

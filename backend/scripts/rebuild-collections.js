#!/usr/bin/env node
/*
 * Recompute issue collection assignments for existing records.
 * Usage: node scripts/rebuild-collections.js [--limit=N] [--dry-run] [--keep-existing]
 */

const path = require('path');
const mysql = require('mysql2/promise');
const { assignIssueToCollection } = require('../services/issue-collection');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const defaultOptions = {
    limit: 0,
    dryRun: false,
    keepExisting: false,
};

const argv = process.argv.slice(2).reduce((acc, arg) => {
    if (arg.startsWith('--limit=')) {
        acc.limit = Number(arg.split('=')[1]) || 0;
    } else if (arg === '--dry-run') {
        acc.dryRun = true;
    } else if (arg === '--keep-existing') {
        acc.keepExisting = true;
    } else if (arg === '--help' || arg === '-h') {
        console.log('Usage: node scripts/rebuild-collections.js [--limit=N] [--dry-run] [--keep-existing]');
        process.exit(0);
    }
    return acc;
}, { ...defaultOptions });

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
            throw new Error('[rebuild-collections] Invalid MYSQL_URL: ' + e.message);
        }
    } else {
        throw new Error('[rebuild-collections] MYSQL_URL is required and no public fallback is allowed.');
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

async function fetchIssueIds(db) {
    let sql = 'SELECT id FROM issues ORDER BY createdAt ASC, id ASC';
    if (argv.limit > 0) {
        sql += ' LIMIT ' + Number(argv.limit);
    }
    const [rows] = await db.query(sql);
    return rows.map((row) => row.id);
}

async function main() {
    const db = await mysql.createPool(buildDbConfigFromEnv());
    console.log('🔁 Rebuilding collections' + (argv.dryRun ? ' (dry run)' : ''));

    if (!argv.dryRun && !argv.keepExisting) {
        console.log('🧹 Clearing previous collection assignments...');
        await db.execute('UPDATE issues SET same_collection = NULL');
    } else if (argv.dryRun) {
        console.log('ℹ️ Dry run: existing collection values will not be changed.');
    } else {
        console.log('ℹ️ Keeping existing same_collection values; script will only fill missing ones.');
    }

    const issueIds = await fetchIssueIds(db);
    console.log(`🔍 Processing ${issueIds.length} issue(s)...`);

    let matched = 0;
    let skipped = 0;
    let failures = 0;

    for (const issueId of issueIds) {
        try {
            const result = await assignIssueToCollection(db, issueId, {
                dryRun: argv.dryRun,
                requireValidation: true,
            });

            if (result.matched) {
                matched += 1;
                console.log(`✅ Issue ${issueId} grouped with head ${result.headId}${argv.dryRun ? ' (dry run)' : ''}`);
            } else {
                skipped += 1;
                if (result.reason && result.reason !== 'no_match') {
                    console.log(`↷ Issue ${issueId} skipped (${result.reason})`);
                }
            }
        } catch (err) {
            failures += 1;
            console.error(`❌ Issue ${issueId} failed:`, err.message);
        }
    }

    await db.end();

    console.log('🏁 Rebuild complete.');
    console.log(`   🔗 Matched: ${matched}`);
    console.log(`   ➖ Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failures}`);
}

main().catch((err) => {
    console.error('Collection rebuild script crashed:', err);
    process.exit(1);
});

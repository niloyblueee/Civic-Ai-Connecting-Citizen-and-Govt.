import React, { useEffect, useState } from 'react';
import styles from './IssueVerification.module.css';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function IssueVerification() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();

    const [issue, setIssue] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [selectedDepts, setSelectedDepts] = useState([]);
    const [relatedIssues, setRelatedIssues] = useState([]);
    const [collectionHeadId, setCollectionHeadId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reportingUser, setReportingUser] = useState(null);
    const [banSummary, setBanSummary] = useState(null);
    const [banDurationValue, setBanDurationValue] = useState('');
    const [banDurationUnit, setBanDurationUnit] = useState('hours');
    const [banReason, setBanReason] = useState('');
    const [banRequesting, setBanRequesting] = useState(false);
    const [banFeedback, setBanFeedback] = useState('');
    const [banFeedbackType, setBanFeedbackType] = useState('');

    useEffect(() => {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const run = async () => {
            try {
                const [{ data: issueData }, { data: meta }] = await Promise.all([
                    axios.get(`${base}/api/issues/${id}`),
                    axios.get(`${base}/api/issues/meta/departments`),
                ]);
                setIssue(issueData);
                setSelectedDepts(Array.isArray(issueData.assigned_departments) ? issueData.assigned_departments : []);
                setRelatedIssues(Array.isArray(issueData.related_issues) ? issueData.related_issues : []);
                setCollectionHeadId(issueData.collection_head_id || issueData.id);
                setDepartments(meta.departments || []);

                try {
                    const { data } = await axios.get(`${base}/api/issues/${id}/report-user/ban-summary`);
                    setReportingUser(data.user);
                    setBanSummary(data.banSummary);
                } catch (banErr) {
                    if (banErr.response?.status === 404) {
                        setReportingUser(null);
                        setBanSummary(null);
                    } else if (banErr.response?.status === 403) {
                        console.warn('Ban summary access denied');
                    } else {
                        console.warn('Failed to fetch ban summary', banErr);
                    }
                }
            } catch (e) {
                setError(e.response?.data?.message || 'Failed to load issue');
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [id]);

    const formatDateTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString();
    };

    const handleBanSubmit = async (event) => {
        event.preventDefault();
        if (!issue) return;
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        setBanRequesting(true);
        setBanFeedback('');
        setBanFeedbackType('');
        try {
            const { data } = await axios.post(`${base}/api/issues/${issue.id}/ban`, {
                durationValue: banDurationValue,
                durationUnit: banDurationUnit,
                reason: banReason,
            });
            setBanSummary(data?.banSummary || null);
            setBanFeedback(data?.message || 'Ban applied');
            const isBlacklistedNow = data?.banSummary?.isBlacklisted;
            setBanFeedbackType(isBlacklistedNow ? 'warning' : 'success');
            setBanDurationValue('');
            setBanReason('');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to apply ban';
            setBanFeedback(message);
            setBanFeedbackType('error');
        } finally {
            setBanRequesting(false);
        }
    };

    const verify = async (action, idsOverride = null) => {
        try {
            const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const endpointId = collectionHeadId ? String(collectionHeadId) : id;
            const payload = {
                action,
                department: selectedDepts,
            };
            if (Array.isArray(idsOverride) && idsOverride.length) {
                payload.ids = idsOverride;
            }
            await axios.post(`${base}/api/issues/${endpointId}/verify`, payload);
            navigate('/govt-problem-page');
        } catch (e) {
            alert(e.response?.data?.message || 'Failed to update issue');
        }
    };

    const approveAll = () => {
        if (!issue) return;
        const groupIds = Array.from(new Set([issue.id, ...relatedIssues.map((ri) => ri.id)]));
        verify('approve', groupIds);
    };

    const denyAll = () => {
        if (!issue) return;
        const groupIds = Array.from(new Set([issue.id, ...relatedIssues.map((ri) => ri.id)]));
        verify('deny', groupIds);
    };

    const verifySingleRelated = (relatedId, action) => {
        verify(action, [relatedId]);
    };

    if (!isAuthenticated || (user && !['govt_authority', 'admin'].includes(user.role))) {
        return (
            <div className={styles.container}>
                <div className={styles.header}><div className={styles.title}>Access Denied</div></div>
                <p>You must be a government authority or admin to verify issues.</p>
            </div>
        );
    }

    if (loading) return <div className={styles.container}><div>Loading...</div></div>;
    if (error) return <div className={styles.container}><div style={{ color: 'red' }}>{error}</div></div>;
    if (!issue) return <div className={styles.container}><div>Issue not found</div></div>;

    const banFeedbackClass = banFeedbackType === 'error'
        ? styles.banFeedbackError
        : banFeedbackType === 'warning'
            ? styles.banFeedbackWarning
            : styles.banFeedbackSuccess;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.btnBack}`}
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </button>
                    <div className={styles.title}>Pending Verification</div>
                </div>
                <div className={styles.actions}>
                    <button className={`${styles.btn} ${styles.btnApprove}`} onClick={() => verify('approve', [issue.id])}>Approve</button>
                    <button className={`${styles.btn} ${styles.btnDeny}`} onClick={() => verify('deny', [issue.id])}>Deny</button>
                </div>
            </div>

            {/* AI suggestion box */}
            <div className={styles.aiBox}>
                <div><b>Photo:</b> {issue.photo ? 'Present' : 'Not provided'}</div>
                <div>
                    <b>Validation:</b>{' '}
                    {issue.photo ? (
                        issue.validation ? (
                            <span style={{ color: '#1e7c24', fontWeight: 600 }}>Validated</span>
                        ) : (
                            <span style={{ color: '#c62828', fontWeight: 600 }}>Not validated</span>
                        )
                    ) : (
                        'Cannot validate (no photo)'
                    )}
                </div>
                {issue.description_pic_ai && (
                    <div style={{ marginTop: 6 }}><b>Photo Summary:</b> {issue.description_pic_ai}</div>
                )}
                {issue.reason_text && (
                    <div style={{ marginTop: 6 }}><b>Reason:</b> {issue.reason_text}</div>
                )}
                {Array.isArray(issue.assigned_departments) && issue.assigned_departments.length > 0 && (
                    <div style={{ marginTop: 6 }}><b>Suggested Departments:</b> {issue.assigned_departments.map((dept) => dept.charAt(0).toUpperCase() + dept.slice(1)).join(', ')}</div>
                )}
                {relatedIssues.length > 0 && (
                    <div style={{ marginTop: 6 }}><b>Related Reports:</b> {relatedIssues.length}</div>
                )}
            </div>

            <div className={styles.panels}>
                <div className={styles.panel}>
                    <div className={styles.panelTitle}>All Departments</div>
                    <div className={styles.list}>
                        {departments.map(d => (
                            <label key={d} className={styles.radioRow}>
                                <input
                                    type="checkbox"
                                    name="dept"
                                    value={d}
                                    checked={selectedDepts.includes(d)}
                                    onChange={(e) => {
                                        const { checked, value } = e.target;
                                        setSelectedDepts((prev) => {
                                            if (checked) {
                                                if (prev.includes(value)) return prev;
                                                return [...prev, value];
                                            }
                                            return prev.filter((item) => item !== value);
                                        });
                                    }}
                                />
                                <span style={{ textTransform: 'capitalize' }}>{d}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className={styles.panel}>
                    <div className={styles.panelTitle}>Issue Details</div>
                    <div>
                        <div className={styles.metaRow}><span><b>Phone:</b> {issue.phone_number || 'N/A'}</span> <span><b>Status:</b> {issue.status}</span></div>
                        <div className={styles.metaRow}><span><b>Lat:</b> {issue.latitude ?? 'N/A'}</span> <span><b>Lon:</b> {issue.longitude ?? 'N/A'}</span></div>
                        <div style={{ marginTop: 8 }}><b>Description:</b><br />{issue.description || 'No description'}</div>
                        {Array.isArray(issue.assigned_departments) && issue.assigned_departments.length > 0 && (
                            <div style={{ marginTop: 8 }}><b>Current Departments:</b> {issue.assigned_departments.map((dept) => dept.charAt(0).toUpperCase() + dept.slice(1)).join(', ')}</div>
                        )}
                        {issue.photo && <img className={styles.image} src={issue.photo} alt="evidence" />}
                    </div>
                </div>

                <div className={styles.panel}>
                    <div className={styles.panelTitle}>Reporter & Ban Status</div>
                    {!reportingUser ? (
                        <div className={styles.mutedText}>No registered reporter linked to this phone number.</div>
                    ) : (
                        <>
                            <div className={styles.reporterInfo}>
                                <div><b>Name:</b> {reportingUser.firstName} {reportingUser.lastName}</div>
                                <div><b>Phone:</b> {reportingUser.phone_number}</div>
                                <div><b>Total bans:</b> {banSummary?.banCount ?? 0} (blacklist at 3)</div>
                                <div><b>Active ban:</b> {banSummary?.activeBan ? (banSummary.activeBan.banned_until ? formatDateTime(banSummary.activeBan.banned_until) : 'Indefinite') : 'None'}</div>
                            </div>
                            {banSummary?.isBlacklisted && (
                                <div className={styles.blacklistedBadge}>Permanently blacklisted</div>
                            )}
                            {banFeedback && (
                                <div className={`${styles.banFeedback} ${banFeedbackType ? banFeedbackClass : ''}`}>{banFeedback}</div>
                            )}
                            <form className={styles.banForm} onSubmit={handleBanSubmit}>
                                <label className={styles.banLabel}>Ban duration</label>
                                <div className={styles.banDurationRow}>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="Value"
                                        value={banDurationValue}
                                        onChange={(e) => setBanDurationValue(e.target.value)}
                                        disabled={banRequesting || banSummary?.isBlacklisted}
                                    />
                                    <select
                                        value={banDurationUnit}
                                        onChange={(e) => setBanDurationUnit(e.target.value)}
                                        disabled={banRequesting || banSummary?.isBlacklisted}
                                    >
                                        <option value="minutes">Minutes</option>
                                        <option value="hours">Hours</option>
                                        <option value="days">Days</option>
                                    </select>
                                </div>
                                <div className={styles.helperText}>Leave value empty or 0 for an immediate ban. Three bans trigger a permanent blacklist.</div>
                                <label className={styles.banLabel} htmlFor="ban-reason">Reason (optional)</label>
                                <textarea
                                    id="ban-reason"
                                    rows="3"
                                    placeholder="Provide context for this ban"
                                    value={banReason}
                                    onChange={(e) => setBanReason(e.target.value)}
                                    disabled={banRequesting || banSummary?.isBlacklisted}
                                />
                                <button
                                    type="submit"
                                    className={styles.btnBan}
                                    disabled={banRequesting || banSummary?.isBlacklisted}
                                >
                                    {banSummary?.isBlacklisted ? 'Blacklisted' : (banRequesting ? 'Applying...' : 'Apply Ban')}
                                </button>
                            </form>
                            <div className={styles.banHistory}>
                                <div className={styles.panelSubtitle}>Recent bans</div>
                                {banSummary?.history && banSummary.history.length > 0 ? (
                                    <ul className={styles.historyList}>
                                        {banSummary.history.slice(0, 5).map((entry) => (
                                            <li key={entry.id} className={styles.historyItem}>
                                                <div><b>From:</b> {formatDateTime(entry.banned_from)}</div>
                                                <div><b>Until:</b> {formatDateTime(entry.banned_until)}</div>
                                                {entry.reason && <div><b>Reason:</b> {entry.reason}</div>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className={styles.mutedText}>No previous bans recorded.</div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {relatedIssues.length > 0 && (
                <div className={styles.relatedSection}>
                    <div className={styles.relatedHeader}>
                        <div className={styles.panelTitle}>Additional Reports ({relatedIssues.length})</div>
                        <div className={styles.relatedActions}>
                            <button className={`${styles.btn} ${styles.btnApprove}`} onClick={approveAll}>Approve All</button>
                            <button className={`${styles.btn} ${styles.btnDeny}`} onClick={denyAll}>Deny All</button>
                        </div>
                    </div>
                    <div className={styles.relatedList}>
                        {relatedIssues.map((rel) => (
                            <div key={rel.id} className={styles.relatedCard}>
                                <div className={styles.relatedCardHeader}>
                                    <span><b>ID:</b> {rel.id}</span>
                                    <span><b>Status:</b> {rel.status}</span>
                                </div>
                                <div style={{ marginTop: 6 }}>
                                    <b>Description:</b>
                                    <br />
                                    {rel.description || 'No description'}
                                </div>
                                {rel.reason_text && (
                                    <div style={{ marginTop: 6 }}><b>Reason:</b> {rel.reason_text}</div>
                                )}
                                <div style={{ marginTop: 6 }}>
                                    <b>Validation:</b>{' '}
                                    {rel.validation ? (
                                        <span style={{ color: '#1e7c24', fontWeight: 600 }}>Validated</span>
                                    ) : (
                                        <span style={{ color: '#c62828', fontWeight: 600 }}>Not validated</span>
                                    )}
                                </div>
                                {Array.isArray(rel.assigned_departments) && rel.assigned_departments.length > 0 && (
                                    <div style={{ marginTop: 6 }}><b>Departments:</b> {rel.assigned_departments.map((dept) => dept.charAt(0).toUpperCase() + dept.slice(1)).join(', ')}</div>
                                )}
                                {rel.photo && (
                                    <img className={styles.image} src={rel.photo} alt={`evidence-${rel.id}`} />
                                )}
                                <div className={styles.relatedCardActions}>
                                    <button className={`${styles.btn} ${styles.btnApprove}`} onClick={() => verifySingleRelated(rel.id, 'approve')}>Approve</button>
                                    <button className={`${styles.btn} ${styles.btnDeny}`} onClick={() => verifySingleRelated(rel.id, 'deny')}>Deny</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

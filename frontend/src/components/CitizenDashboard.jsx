import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
    FiUser,
    FiMapPin,
    FiAlertTriangle,
    FiCheckCircle,
    FiClock,
    FiSettings,
    FiLogOut,
    FiMenu,
    FiSun,
    FiMoon,
    FiBell,
    FiSearch,
    FiFilter,
    FiEye,
    FiEdit,
    FiTrash2,
    FiPlus,
    FiCalendar,
    FiMessageSquare,
    FiFileText,
    FiShield,
    FiTarget,
    FiAward,
    FiActivity,
    FiCamera,
    FiVideo,
    FiUpload,
    FiHeart,
    FiStar,
    FiGift,
    FiUsers,
    FiHome,
    FiPhone,
    FiMail
} from 'react-icons/fi';
import './CitizenDashboard.css';

const CitizenDashboard = () => {
    const { user, logout, banSummary } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('darkMode') === 'true' || true;
    });

    useEffect(() => {
        localStorage.setItem('darkMode', darkMode);
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    const navigationItems = [
        { id: 'overview', label: 'Overview', icon: FiHome, color: 'primary' },
        { id: 'report', label: 'Report Issue', icon: FiAlertTriangle, color: 'warning' },
        { id: 'my-reports', label: 'My Reports', icon: FiFileText, color: 'info' },
        { id: 'events', label: 'Events', icon: FiCalendar, color: 'success' },
        { id: 'rewards', label: 'Rewards', icon: FiAward, color: 'secondary' },
        { id: 'cleanup', label: 'Cleanup Points', icon: FiTarget, color: 'purple' },
        { id: 'volunteer', label: 'Volunteer', icon: FiUsers, color: 'green' },
        { id: 'leaderboard', label: 'Leaderboard', icon: FiAward, color: 'gold' },
        { id: 'settings', label: 'Settings', icon: FiSettings, color: 'gray' }
    ];

    const stats = [
        {
            title: 'Issues Reported',
            value: '12',
            change: '+3 this week',
            changeType: 'positive',
            icon: FiAlertTriangle,
            color: 'warning'
        },
        {
            title: 'Issues Resolved',
            value: '8',
            change: '+2 this week',
            changeType: 'positive',
            icon: FiCheckCircle,
            color: 'success'
        },
        {
            title: 'Cleanup Points',
            value: '1,250',
            change: '+150 today',
            changeType: 'positive',
            icon: FiTarget,
            color: 'purple'
        },
        {
            title: 'Volunteer Hours',
            value: '24',
            change: '+4 this week',
            changeType: 'positive',
            icon: FiUsers,
            color: 'info'
        }
    ];

    const recentReports = [
        {
            id: 1,
            title: 'Broken Street Light',
            location: 'Dhanmondi, Dhaka',
            status: 'resolved',
            priority: 'medium',
            reportedAt: '2 days ago',
            resolvedAt: '1 day ago',
            category: 'Infrastructure'
        },
        {
            id: 2,
            title: 'Garbage Collection Issue',
            location: 'Gulshan, Dhaka',
            status: 'in_progress',
            priority: 'high',
            reportedAt: '1 day ago',
            category: 'Sanitation'
        },
        {
            id: 3,
            title: 'Road Pothole',
            location: 'Banani, Dhaka',
            status: 'pending',
            priority: 'low',
            reportedAt: '3 days ago',
            category: 'Infrastructure'
        }
    ];

    const upcomingEvents = [
        {
            id: 1,
            title: 'Community Cleanup Drive',
            date: 'Tomorrow',
            time: '9:00 AM',
            location: 'Dhanmondi Lake',
            participants: 45,
            type: 'cleanup'
        },
        {
            id: 2,
            title: 'Tree Planting Initiative',
            date: 'This Weekend',
            time: '8:00 AM',
            location: 'Ramna Park',
            participants: 32,
            type: 'environment'
        }
    ];

    const formatDateTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString();
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="overview-content">
                        <div className="welcome-section">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <h1>Welcome, {user.firstName}!</h1>
                                <p>Make a difference in your community today</p>
                            </motion.div>
                        </div>

                        <div className="stats-grid">
                            {stats.map((stat, index) => (
                                <motion.div
                                    key={stat.title}
                                    className={`stat-card stat-${stat.color}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + index * 0.1 }}
                                    whileHover={{ y: -5 }}
                                >
                                    <div className="stat-icon">
                                        <stat.icon />
                                    </div>
                                    <div className="stat-content">
                                        <h3>{stat.value}</h3>
                                        <p>{stat.title}</p>
                                        <div className={`stat-change ${stat.changeType}`}>
                                            <span>{stat.change}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {banSummary !== null && (
                            <div className="ban-status-card">
                                <div className="ban-status-header">
                                    <h2>Ban Status</h2>
                                </div>
                                <div className="ban-status-meta">
                                    <div className="ban-stat">
                                        <span className="ban-label">Total bans</span>
                                        <span className="ban-value">{banSummary?.banCount ?? 0}</span>
                                    </div>
                                    <div className="ban-stat">
                                        <span className="ban-label">Active ban</span>
                                        <span className="ban-value">{banSummary?.activeBan ? (banSummary.activeBan.banned_until ? formatDateTime(banSummary.activeBan.banned_until) : 'Indefinite') : 'None'}</span>
                                    </div>
                                    <div className="ban-stat">
                                        <span className="ban-label">Status</span>
                                        <span className={`ban-chip ${banSummary?.isBlacklisted ? 'danger' : 'ok'}`}>
                                            {banSummary?.isBlacklisted ? 'Blacklisted' : 'In good standing'}
                                        </span>
                                    </div>
                                </div>
                                {banSummary?.isBlacklisted && banSummary?.blacklist && (
                                    <div className="ban-blacklist-alert">
                                        <p>Your account is permanently blacklisted.</p>
                                        {banSummary.blacklist.reason && <p><strong>Reason:</strong> {banSummary.blacklist.reason}</p>}
                                        <p><strong>Since:</strong> {formatDateTime(banSummary.blacklist.blacklisted_at)}</p>
                                    </div>
                                )}
                                <div className="ban-history">
                                    <h3>Ban History</h3>
                                    {banSummary?.history && banSummary.history.length > 0 ? (
                                        <ul>
                                            {banSummary.history.slice(0, 5).map((entry) => (
                                                <li key={entry.id}>
                                                    <div><strong>From:</strong> {formatDateTime(entry.banned_from)}</div>
                                                    <div><strong>Until:</strong> {entry.banned_until ? formatDateTime(entry.banned_until) : 'Indefinite'}</div>
                                                    {entry.reason && <div><strong>Reason:</strong> {entry.reason}</div>}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="ban-empty">No bans recorded.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="content-grid">
                            <div className="recent-reports">
                                <div className="section-header">
                                    <h2>My Recent Reports</h2>
                                    <button className="view-all-btn">
                                        <FiEye />
                                        View All
                                    </button>
                                </div>
                                <div className="reports-list">
                                    {recentReports.map((report, index) => (
                                        <motion.div
                                            key={report.id}
                                            className="report-card"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.3 + index * 0.1 }}
                                            whileHover={{ x: 5 }}
                                        >
                                            <div className="report-header">
                                                <div className="report-title">
                                                    <h4>{report.title}</h4>
                                                    <span className={`priority-badge ${report.priority}`}>
                                                        {report.priority}
                                                    </span>
                                                </div>
                                                <span className={`status-badge ${report.status}`}>
                                                    {report.status}
                                                </span>
                                            </div>
                                            <div className="report-details">
                                                <p><FiMapPin /> {report.location}</p>
                                                <p><FiClock /> {report.reportedAt}</p>
                                                {report.resolvedAt && (
                                                    <p><FiCheckCircle /> Resolved {report.resolvedAt}</p>
                                                )}
                                            </div>
                                            <div className="report-actions">
                                                <button className="action-btn view-btn">
                                                    <FiEye />
                                                    View Details
                                                </button>
                                                {report.status === 'pending' && (
                                                    <button className="action-btn edit-btn">
                                                        <FiEdit />
                                                        Update
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            <div className="upcoming-events">
                                <div className="section-header">
                                    <h2>Upcoming Events</h2>
                                    <button className="view-all-btn">
                                        <FiCalendar />
                                        View All
                                    </button>
                                </div>
                                <div className="events-list">
                                    {upcomingEvents.map((event, index) => (
                                        <motion.div
                                            key={event.id}
                                            className="event-card"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.4 + index * 0.1 }}
                                            whileHover={{ x: -5 }}
                                        >
                                            <div className="event-header">
                                                <h4>{event.title}</h4>
                                                <span className={`event-type ${event.type}`}>
                                                    {event.type}
                                                </span>
                                            </div>
                                            <div className="event-details">
                                                <p><FiCalendar /> {event.date} at {event.time}</p>
                                                <p><FiMapPin /> {event.location}</p>
                                                <p><FiUsers /> {event.participants} participants</p>
                                            </div>
                                            <div className="event-actions">
                                                <button className="action-btn join-btn">
                                                    <FiUsers />
                                                    Join Event
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'report':
                return (
                    <div className="report-content">
                        <div className="content-header">
                            <h2>Report an Issue</h2>
                            <p>Help improve your community by reporting issues</p>
                        </div>
                        <div className="report-form">
                            <div className="form-section">
                                <h3>Issue Details</h3>
                                <div className="form-group">
                                    <label>Issue Type</label>
                                    <select>
                                        <option value="">Select issue type</option>
                                        <option value="infrastructure">Infrastructure</option>
                                        <option value="sanitation">Sanitation</option>
                                        <option value="safety">Safety</option>
                                        <option value="environment">Environment</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Priority Level</label>
                                    <select>
                                        <option value="">Select priority</option>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="emergency">Emergency</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea placeholder="Describe the issue in detail..."></textarea>
                                </div>
                                <div className="form-group">
                                    <label>Location</label>
                                    <input type="text" placeholder="Enter location or use map..." />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Media Upload</h3>
                                <div className="media-upload">
                                    <div className="upload-area">
                                        <FiCamera className="upload-icon" />
                                        <p>Upload photos or videos</p>
                                        <button className="upload-btn">
                                            <FiUpload />
                                            Choose Files
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button className="submit-btn">
                                    <FiAlertTriangle />
                                    Submit Report
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'my-reports':
                return (
                    <div className="my-reports-content">
                        <div className="content-header">
                            <h2>My Reports</h2>
                            <div className="header-actions">
                                <div className="search-box">
                                    <FiSearch className="search-icon" />
                                    <input type="text" placeholder="Search reports..." />
                                </div>
                                <button className="filter-btn">
                                    <FiFilter />
                                    Filter
                                </button>
                            </div>
                        </div>
                        <div className="coming-soon">
                            <FiFileText className="coming-soon-icon" />
                            <h3>Report Management</h3>
                            <p>Track and manage all your submitted reports</p>
                        </div>
                    </div>
                );
            case 'events':
                return (
                    <div className="events-content">
                        <div className="content-header">
                            <h2>Community Events</h2>
                            <div className="header-actions">
                                <button className="filter-btn">
                                    <FiFilter />
                                    Filter
                                </button>
                            </div>
                        </div>
                        <div className="coming-soon">
                            <FiCalendar className="coming-soon-icon" />
                            <h3>Event Management</h3>
                            <p>Join community events and initiatives</p>
                        </div>
                    </div>
                );
            case 'rewards':
                return (
                    <div className="rewards-content">
                        <div className="content-header">
                            <h2>Rewards & Recognition</h2>
                        </div>
                        <div className="coming-soon">
                            <FiAward className="coming-soon-icon" />
                            <h3>Reward System</h3>
                            <p>Earn points and rewards for your contributions</p>
                        </div>
                    </div>
                );
            case 'cleanup':
                return (
                    <div className="cleanup-content">
                        <div className="content-header">
                            <h2>Cleanup Points</h2>
                        </div>
                        <div className="coming-soon">
                            <FiTarget className="coming-soon-icon" />
                            <h3>Cleanup Points System</h3>
                            <p>Earn points by keeping your area clean</p>
                        </div>
                    </div>
                );
            case 'volunteer':
                return (
                    <div className="volunteer-content">
                        <div className="content-header">
                            <h2>Volunteer Opportunities</h2>
                        </div>
                        <div className="coming-soon">
                            <FiUsers className="coming-soon-icon" />
                            <h3>Volunteer Management</h3>
                            <p>Find and join volunteer opportunities</p>
                        </div>
                    </div>
                );
            case 'leaderboard':
                return (
                    <div className="leaderboard-content">
                        <div className="content-header">
                            <h2>Community Leaderboard</h2>
                        </div>
                        <div className="coming-soon">
                            <FiTrophy className="coming-soon-icon" />
                            <h3>Leaderboard</h3>
                            <p>See top contributors in your community</p>
                        </div>
                    </div>
                );
            case 'settings':
                return (
                    <div className="settings-content">
                        <div className="content-header">
                            <h2>Settings</h2>
                        </div>
                        <div className="coming-soon">
                            <FiSettings className="coming-soon-icon" />
                            <h3>Settings & Preferences</h3>
                            <p>Configure your account and notification preferences</p>
                        </div>
                    </div>
                );
            default:
                return <div>Content not found</div>;
        }
    };

    return (
        <div className={`citizen-dashboard ${darkMode ? 'dark' : 'light'}`}>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        className="mobile-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Mobile Menu Button */}
            <button
                className="mobile-menu-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                <FiMenu />
            </button>

            {/* Sidebar */}
            <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <FiUser className="logo-icon" />
                        <span>Citizen Portal</span>
                    </div>
                    <div className="user-info">
                        <div className="user-avatar">
                            <FiUser />
                        </div>
                        <div className="user-details">
                            <h4>{user.firstName} {user.lastName}</h4>
                            <p>Citizen</p>
                            <span className="points-badge">{stats[2].value} points</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navigationItems.map((item) => (
                        <motion.button
                            key={item.id}
                            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}
                            whileHover={{ x: 5 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <item.icon className="nav-icon" />
                            <span>{item.label}</span>
                        </motion.button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button
                        className="theme-toggle"
                        onClick={() => setDarkMode(!darkMode)}
                    >
                        {darkMode ? <FiSun /> : <FiMoon />}
                        {darkMode ? 'Light' : 'Dark'} Mode
                    </button>
                    <button onClick={logout} className="logout-btn">
                        <FiLogOut />
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                <div className="content-header">
                    <div className="header-left">
                        <h1>{navigationItems.find(item => item.id === activeTab)?.label}</h1>
                        <p>Make a positive impact in your community</p>
                    </div>
                    <div className="header-right">
                        <button className="notification-btn">
                            <FiBell />
                            <span className="notification-badge">2</span>
                        </button>
                        <div className="user-menu">
                            <div className="user-avatar-small">
                                <FiUser />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="content-body">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default CitizenDashboard;

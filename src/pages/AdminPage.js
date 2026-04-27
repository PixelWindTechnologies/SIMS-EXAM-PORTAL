import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [results, setResults] = useState([]);
  const [shortlist, setShortlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/dashboard'); return; }
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getStats();
      setStats(data.stats);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadResults = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getResults();
      setResults(data.results);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadShortlist = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getShortlist();
      setShortlist(data.shortlisted);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'stats') loadStats();
    if (tab === 'results') loadResults();
    if (tab === 'shortlist') loadShortlist();
  };

  const tabStyle = (tab) => ({
    padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem',
    background: activeTab === tab ? 'var(--accent-blue)' : 'transparent',
    color: activeTab === tab ? 'white' : 'var(--text-secondary)',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, padding: '16px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem' }}>🛡 Admin Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>SecureAssess Management Panel</p>
          </div>
          <button className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '8px 16px' }} onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <button style={tabStyle('stats')} onClick={() => handleTabChange('stats')}>📊 Statistics</button>
          <button style={tabStyle('results')} onClick={() => handleTabChange('results')}>📋 All Results</button>
          <button style={tabStyle('shortlist')} onClick={() => handleTabChange('shortlist')}>⭐ Shortlist</button>
        </div>

        {loading ? (
          <div className="loader"><div className="spinner" /></div>
        ) : (
          <>
            {/* Stats Tab */}
            {activeTab === 'stats' && stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                {[
                  { label: 'Total Students', value: stats.totalStudents, icon: '👥', color: 'var(--accent-blue)' },
                  { label: 'Completed Exams', value: stats.completedExams, icon: '📝', color: 'var(--accent-cyan)' },
                  { label: 'Passed', value: stats.passed, icon: '✅', color: 'var(--accent-green)' },
                  { label: 'Failed', value: stats.failed, icon: '❌', color: 'var(--accent-red)' },
                  { label: 'Terminated', value: stats.terminated, icon: '🚫', color: 'var(--accent-yellow)' },
                  { label: 'Avg Score', value: stats.avgScore, icon: '📈', color: 'var(--accent-purple)' },
                ].map((s, i) => (
                  <div key={i} className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>{s.icon}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Results Tab */}
            {activeTab === 'results' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>All Student Results ({results.length})</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {['Rank', 'Name', 'Roll No', 'Score', 'Correct', 'Wrong', 'Skipped', 'Status', 'Warnings'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={r._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: i < 3 ? 'var(--accent-yellow)' : 'var(--text-primary)' }}>#{r.rank || i + 1}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.studentName}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{r.rollNumber}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 800, color: r.passed ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '1rem' }}>{r.score}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/100</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--accent-green)' }}>{r.correctAnswers}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--accent-red)' }}>{r.wrongAnswers}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--accent-yellow)' }}>{r.skippedAnswers}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge ${r.examStatus === 'terminated' ? 'badge-red' : r.passed ? 'badge-green' : 'badge-yellow'}`}>
                              {r.examStatus === 'terminated' ? 'Terminated' : r.passed ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: r.cheatingWarnings > 0 ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>{r.cheatingWarnings || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No results yet</div>}
                </div>
              </div>
            )}

            {/* Shortlist Tab */}
            {activeTab === 'shortlist' && (
              <div>
                <div className="alert alert-success" style={{ marginBottom: 20 }}>
                  ⭐ Shortlisted: Students who scored 65+ marks and were not terminated. Total: <strong>{shortlist.length}</strong>
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(16,185,129,0.05)' }}>
                          {['Rank', 'Student Name', 'Roll Number', 'Score', 'Status'].map(h => (
                            <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: 'var(--accent-green)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shortlist.map((s, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '14px 20px', fontFamily: 'var(--font-display)', fontWeight: 800, color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text-primary)', fontSize: i < 3 ? '1.1rem' : '1rem' }}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                            </td>
                            <td style={{ padding: '14px 20px', fontWeight: 700 }}>{s.studentName}</td>
                            <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>{s.rollNumber}</td>
                            <td style={{ padding: '14px 20px' }}>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--accent-green)', fontSize: '1.1rem' }}>{s.score}</span>
                              <span style={{ color: 'var(--text-muted)' }}>/100</span>
                            </td>
                            <td style={{ padding: '14px 20px' }}>
                              <span className="badge badge-green">✅ Shortlisted</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {shortlist.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No shortlisted candidates yet</div>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

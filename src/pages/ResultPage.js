import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { examAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PASS_MARK = 65;

export default function ResultPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const { data } = await examAPI.getResult();
        setResult(data.result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, []);

  const formatTime = (secs) => {
    if (!secs) return 'N/A';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  const passed = result?.passed;
  const score = result?.score || 0;
  const percentage = Math.round((score / 100) * 100);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Result Header */}
        <div style={{ textAlign: 'center', marginBottom: 40, padding: '48px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: `1px solid ${passed ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, boxShadow: `0 0 40px ${passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}` }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>{passed ? '🏆' : '📚'}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, color: passed ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: 8 }}>
            {passed ? 'Congratulations!' : 'Better Luck Next Time'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: 32 }}>
            {passed ? 'You have passed the assessment!' : `You need ${PASS_MARK} marks to pass.`}
          </p>
          {/* Score Circle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 150, height: 150, borderRadius: '50%', background: `conic-gradient(${passed ? 'var(--accent-green)' : 'var(--accent-red)'} ${percentage * 3.6}deg, var(--bg-secondary) 0deg)`, marginBottom: 16 }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2rem', color: passed ? 'var(--accent-green)' : 'var(--accent-red)' }}>{score}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>/ 100</div>
            </div>
          </div>
          <div>
            <span className={`badge ${passed ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.9rem', padding: '8px 20px' }}>
              {passed ? '✅ PASSED' : '❌ FAILED'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Correct', value: result?.correctAnswers, icon: '✅', color: 'var(--accent-green)' },
            { label: 'Wrong', value: result?.wrongAnswers, icon: '❌', color: 'var(--accent-red)' },
            { label: 'Skipped', value: result?.skippedAnswers, icon: '⏭', color: 'var(--accent-yellow)' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 20 }}>📊 Exam Details</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { label: 'Student Name', value: result?.studentName || user?.name },
              { label: 'Roll Number', value: result?.rollNumber || user?.rollNumber },
              { label: 'Score', value: `${score} / 100` },
              { label: 'Pass Mark', value: `${PASS_MARK} / 100` },
              { label: 'Time Taken', value: formatTime(result?.timeTaken) },
              { label: 'Tab Switches', value: result?.tabSwitchCount || 0 },
              { label: 'Warnings', value: result?.cheatingWarnings || 0 },
              { label: 'Exam Status', value: result?.examStatus?.replace('_', ' ')?.toUpperCase() },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.label}</span>
                <span style={{ fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

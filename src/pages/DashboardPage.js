import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const canStartExam = user?.examStatus === 'not_started' || user?.examStatus === 'in_progress';
  const isCompleted = user?.examStatus === 'completed';
  const isTerminated = user?.examStatus === 'terminated';

  const instructions = [
    { icon: '⏱', text: 'Exam duration is 40 minutes. Timer starts immediately when you click Start Exam.' },
    { icon: '🔀', text: 'Questions are randomized — each student receives a unique order.' },
    { icon: '🚫', text: 'Switching tabs or minimizing the window will trigger warnings. 3 violations = auto-termination.' },
    { icon: '📵', text: 'Right-click and copy-paste are disabled during the exam.' },
    { icon: '✅', text: 'Pass mark is 65 out of 100 questions.' },
    { icon: '📤', text: 'Exam auto-submits when time expires or you can submit manually.' },
    { icon: '🖥', text: 'Ensure fullscreen mode throughout. Exiting fullscreen counts as a warning.' },
    { icon: '📱', text: 'Do not use external devices or resources during the exam.' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px' }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, padding: '16px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>{user?.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user?.rollNumber}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>Logout</button>
        </div>

        {/* Status Banner */}
        {isCompleted && (
          <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✅ Exam completed! View your results below.</span>
            <button className="btn btn-success" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => navigate('/result')}>View Results</button>
          </div>
        )}
        {isTerminated && (
          <div className="alert alert-error">❌ Your exam was terminated due to policy violations.</div>
        )}

        {/* Student Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Student', value: user?.name, icon: '👤' },
            { label: 'Roll Number', value: user?.rollNumber, icon: '🎫' },
            { label: 'Exam Status', value: user?.examStatus?.replace('_', ' ')?.toUpperCase(), icon: '📋' },
            { label: 'Duration', value: '40 Minutes', icon: '⏱' },
            { label: 'Pass Mark', value: '65 / 100', icon: '🎯' },
          ].map((item, i) => (
            <div key={i} className="card" style={{ padding: '18px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-display)' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="card" style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            📋 <span>Exam Instructions</span>
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {instructions.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{ins.icon}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{ins.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        {canStartExam && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              By clicking Start Exam, you agree to abide by all exam rules.
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/exam')}>
              {user?.examStatus === 'in_progress' ? '▶ Resume Exam' : '🚀 Start Exam'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { examAPI } from '../utils/api';

const EXAM_DURATION = 40 * 60; // 40 mins
const MAX_WARNINGS = 3;

export default function ExamPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState('');
  const [warningCount, setWarningCount] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [terminated, setTerminated] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [examStartTime, setExamStartTime] = useState(null);
  const timerRef = useRef(null);
  const warningRef = useRef(0);
  const tabSwitchRef = useRef(0);
  const isSubmitting = useRef(false);

  // --- LOAD EXAM ---
  useEffect(() => {
    const loadExam = async () => {
      try {
        const { data } = await examAPI.start();
        setQuestions(data.questions);
        setTimeLeft(data.remainingTime);
        setExamStartTime(new Date(data.examStartTime));
        setLoading(false);
        // Enter fullscreen
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to load exam');
        navigate('/dashboard');
      }
    };
    loadExam();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [navigate]);

  // --- TIMER ---
  useEffect(() => {
    if (loading || terminated) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit('time_expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [loading, terminated]);

  // --- ANTI-CHEAT: Disable right-click ---
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // --- ANTI-CHEAT: Disable copy/paste/cut ---
  useEffect(() => {
    const block = (e) => e.preventDefault();
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('cut', block);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('cut', block);
    };
  }, []);

  // --- ANTI-CHEAT: Disable keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Block common shortcuts
      if (
        (e.ctrlKey && ['c','v','x','a','u','s','p','f'].includes(e.key.toLowerCase())) ||
        (e.altKey && e.key === 'Tab') ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        triggerWarning('keyboard_shortcut', 'Keyboard shortcut blocked');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- ANTI-CHEAT: Tab/window visibility ---
  useEffect(() => {
    if (loading || terminated) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        setTabSwitchCount(tabSwitchRef.current);
        triggerWarning('tab_switch', `⚠️ Tab switch detected! Warning ${tabSwitchRef.current}/${MAX_WARNINGS}`);
      }
    };
    const handleBlur = () => {
      if (!document.hidden) {
        triggerWarning('window_blur', '⚠️ Window focus lost! Stay on exam window.');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [loading, terminated]);

  // --- ANTI-CHEAT: Fullscreen exit ---
  useEffect(() => {
    if (loading || terminated) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        triggerWarning('fullscreen_exit', '⚠️ Fullscreen exited! Please return to fullscreen.');
        // Re-enter fullscreen
        setTimeout(() => {
          if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        }, 2000);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [loading, terminated]);

  const triggerWarning = useCallback(async (eventType, message) => {
    if (isSubmitting.current || terminated) return;
    warningRef.current += 1;
    setWarningCount(warningRef.current);
    setWarning(message);
    setTimeout(() => setWarning(''), 4000);

    try {
      const { data } = await examAPI.reportCheat({ eventType, count: warningRef.current });
      if (data.action === 'terminate' || warningRef.current >= MAX_WARNINGS) {
        handleSubmit('terminated');
      }
    } catch (err) {
      if (warningRef.current >= MAX_WARNINGS) {
        handleSubmit('terminated');
      }
    }
  }, [terminated]);

  const handleSubmit = useCallback(async (type = 'manual') => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    if (type === 'terminated') {
      setTerminated(true);
    }

    const answersArray = Object.entries(answers).map(([questionId, selectedOption]) => ({
      questionId: parseInt(questionId),
      selectedOption
    }));

    try {
      await examAPI.submit({
        answers: answersArray,
        tabSwitchCount: tabSwitchRef.current,
        cheatingWarnings: warningRef.current,
        submissionType: type
      });
      navigate('/result');
    } catch (err) {
      console.error('Submit error:', err);
      navigate('/result');
    }
  }, [answers, navigate]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentQuestion = questions[currentIndex];
  const answered = Object.keys(answers).length;
  const progress = questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0;
  const isUrgent = timeLeft <= 300; // last 5 mins
  const isCritical = timeLeft <= 60;

  if (loading) {
    return (
      <div className="page-center">
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading your exam...</p>
        </div>
      </div>
    );
  }

  if (terminated) {
    return (
      <div className="page-center">
        <div className="card" style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>🚫</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--accent-red)', marginBottom: 12 }}>Exam Terminated</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Your exam was terminated due to {warningCount} policy violations. Submitting responses...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', userSelect: 'none' }}>
      {/* Top Bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-blue)' }}>
          🎓 SecureAssess
        </div>
        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', borderRadius: 8, background: isCritical ? 'rgba(239,68,68,0.15)' : isUrgent ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)', border: `1px solid ${isCritical ? 'rgba(239,68,68,0.4)' : isUrgent ? 'rgba(245,158,11,0.4)' : 'var(--border)'}` }}>
          <span style={{ fontSize: '1.2rem' }}>{isCritical ? '🔴' : isUrgent ? '🟡' : '⏱'}</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.5rem', color: isCritical ? 'var(--accent-red)' : isUrgent ? 'var(--accent-yellow)' : 'var(--text-primary)', animation: isCritical ? 'pulse 1s infinite' : 'none' }}>
            {formatTime(timeLeft)}
          </span>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>✅ {answered}/{questions.length}</span>
          <span style={{ color: warningCount > 0 ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
            ⚠️ {warningCount}/{MAX_WARNINGS}
          </span>
        </div>
        <button onClick={() => setShowSubmitConfirm(true)} className="btn btn-success" style={{ padding: '8px 18px', fontSize: '0.875rem' }}>
          Submit Exam
        </button>
      </div>

      {/* Warning Banner */}
      {warning && (
        <div style={{ background: 'rgba(239,68,68,0.9)', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 700, fontSize: '0.95rem', animation: 'pulse 0.5s ease' }}>
          {warning}
        </div>
      )}

      {/* Progress Bar */}
      <div style={{ height: 3, background: 'var(--bg-card)' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', transition: 'width 0.3s ease' }} />
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 24 }}>
        {/* Question Panel */}
        <div>
          {/* Question Header */}
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`badge badge-${currentQuestion?.topic === 'HTML' ? 'yellow' : currentQuestion?.topic === 'CSS' ? 'blue' : currentQuestion?.topic === 'JavaScript' ? 'green' : 'blue'}`}>
              {currentQuestion?.topic}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Question {currentIndex + 1} of {questions.length}
            </span>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.7, marginBottom: 28 }}>
              {currentQuestion?.question}
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              {currentQuestion?.options.map((opt, idx) => {
                const isSelected = answers[currentQuestion.id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setAnswers({ ...answers, [currentQuestion.id]: idx })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                      background: isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease', fontFamily: 'var(--font-body)', fontSize: '0.95rem',
                      fontWeight: isSelected ? 600 : 400
                    }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--accent-blue)' : 'var(--bg-secondary)', color: isSelected ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            <button className="btn btn-outline" onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0}>
              ← Previous
            </button>
            <button className="btn btn-outline" onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))} disabled={currentIndex === questions.length - 1}>
              Next →
            </button>
          </div>
        </div>

        {/* Question Navigator */}
        <div>
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Question Navigator
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
              {questions.map((q, i) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    style={{
                      width: '100%', aspectRatio: '1', border: `2px solid ${isCurrent ? 'var(--accent-blue)' : isAnswered ? 'var(--accent-green)' : 'var(--border)'}`,
                      borderRadius: 6, background: isCurrent ? 'rgba(59,130,246,0.2)' : isAnswered ? 'rgba(16,185,129,0.15)' : 'transparent',
                      color: isCurrent ? 'var(--accent-blue)' : isAnswered ? 'var(--accent-green)' : 'var(--text-muted)',
                      fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            {/* Legend */}
            <div style={{ display: 'grid', gap: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(59,130,246,0.2)', border: '2px solid var(--accent-blue)' }} />
                Current
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(16,185,129,0.15)', border: '2px solid var(--accent-green)' }} />
                Answered ({answered})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid var(--border)' }} />
                Unanswered ({questions.length - answered})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirm Modal */}
      {showSubmitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div className="card" style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📤</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: 12 }}>Submit Exam?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
              Answered: <strong style={{ color: 'var(--accent-green)' }}>{answered}</strong> / {questions.length}
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              Unanswered: <strong style={{ color: 'var(--accent-yellow)' }}>{questions.length - answered}</strong> questions will be marked as skipped.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-outline btn-full" onClick={() => setShowSubmitConfirm(false)} disabled={submitting}>Cancel</button>
              <button className="btn btn-success btn-full" onClick={() => handleSubmit('manual')} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

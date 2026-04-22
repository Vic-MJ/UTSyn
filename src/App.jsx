import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, BookOpen, Calculator, GraduationCap, LogIn, Loader2, UserCircle, History, ListTodo, Wallet, User as UserIcon } from 'lucide-react';
import './App.css';

const GRADE_VALUES = {
  AU: 10,
  CA: 10,
  DE: 9,
  SA: 8,
  NA: 0,
  AC: null 
};

const GRADES = ['AU', 'DE', 'SA', 'NA'];

export default function App() {
  const [activeTab, setActiveTab] = useState('current'); 

  const [subjects, setSubjects] = useState(() => {
    const saved = localStorage.getItem('promedio-subjects');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [kardex, setKardex] = useState(() => {
    const saved = localStorage.getItem('promedio-kardex');
    return saved ? JSON.parse(saved) : [];
  });

  const [personalData, setPersonalData] = useState(() => {
    const saved = localStorage.getItem('promedio-personalData');
    return saved ? JSON.parse(saved) : null;
  });

  const [accountStatus, setAccountStatus] = useState(() => {
    const saved = localStorage.getItem('promedio-accountStatus');
    return saved ? JSON.parse(saved) : null;
  });

  const [studentInfo, setStudentInfo] = useState(() => {
    const saved = localStorage.getItem('promedio-student');
    return saved ? JSON.parse(saved) : null;
  });

  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState(() => localStorage.getItem('promedio-username') || '');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => { localStorage.setItem('promedio-subjects', JSON.stringify(subjects)); }, [subjects]);
  useEffect(() => { localStorage.setItem('promedio-kardex', JSON.stringify(kardex)); }, [kardex]);
  useEffect(() => { localStorage.setItem('promedio-personalData', JSON.stringify(personalData)); }, [personalData]);
  useEffect(() => { localStorage.setItem('promedio-accountStatus', JSON.stringify(accountStatus)); }, [accountStatus]);
  useEffect(() => {
    if (studentInfo) localStorage.setItem('promedio-student', JSON.stringify(studentInfo));
    else localStorage.removeItem('promedio-student');
  }, [studentInfo]);

  const handleUTSynLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Error al conectar con UTSyn');

      setStudentInfo(data.student);
      setSubjects(data.currentSubjects || []);
      setKardex(data.kardex || []);
      setPersonalData(data.personalData || null);
      setAccountStatus(data.accountStatus || null);
      
      localStorage.setItem('promedio-username', username);
      setShowLogin(false);
      setPassword('');
      setShowDisclaimer(true);
      
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    setStudentInfo(null);
    setSubjects([]);
    setKardex([]);
    setPersonalData(null);
    setAccountStatus(null);
    setActiveTab('current');
  };

  const addSubject = () => {
    setSubjects([...subjects, { id: crypto.randomUUID(), name: '', units: [{ id: crypto.randomUUID(), name: 'Unidad 1', grade: null }] }]);
  };
  const updateSubjectName = (subjectId, name) => {
    setSubjects(subjects.map(s => s.id === subjectId ? { ...s, name } : s));
  };
  const removeSubject = (subjectId) => {
    setSubjects(subjects.filter(s => s.id !== subjectId));
  };
  const addUnit = (subjectId) => {
    setSubjects(subjects.map(s => s.id === subjectId ? { ...s, units: [...s.units, { id: crypto.randomUUID(), name: `Unidad ${s.units.length + 1}`, grade: null }] } : s));
  };
  const updateUnitName = (subjectId, unitId, name) => {
    setSubjects(subjects.map(s => s.id === subjectId ? { ...s, units: s.units.map(u => u.id === unitId ? { ...u, name } : u) } : s));
  };
  const updateUnitGrade = (subjectId, unitId, grade) => {
    setSubjects(subjects.map(s => s.id === subjectId ? { ...s, units: s.units.map(u => u.id === unitId ? { ...u, grade } : u) } : s));
  };
  const removeUnit = (subjectId, unitId) => {
    setSubjects(subjects.map(s => s.id === subjectId ? { ...s, units: s.units.filter(u => u.id !== unitId) } : s));
  };
  const calculateSubjectAverage = (units) => {
    if (units.length === 0) return 0;
    const gradedUnits = units.filter(u => u.grade && GRADE_VALUES[u.grade] !== null);
    if (gradedUnits.length === 0) return 0;
    const sum = gradedUnits.reduce((acc, curr) => acc + GRADE_VALUES[curr.grade], 0);
    return sum / gradedUnits.length;
  };

  const currentGeneralAverage = useMemo(() => {
    if (subjects.length === 0) return 0;
    const validSubjects = subjects.filter(s => s.units.some(u => u.grade && GRADE_VALUES[u.grade] !== null));
    if (validSubjects.length === 0) return 0;
    const sum = validSubjects.reduce((acc, curr) => acc + calculateSubjectAverage(curr.units), 0);
    return sum / validSubjects.length;
  }, [subjects]);

  const kardexGeneralAverage = useMemo(() => {
    if (kardex.length === 0) return 0;
    let totalSum = 0; let totalSubjects = 0;
    kardex.forEach(cycle => {
      cycle.subjects.forEach(subject => {
        if (subject.grade && GRADE_VALUES[subject.grade] !== null) {
          totalSum += GRADE_VALUES[subject.grade];
          totalSubjects++;
        }
      });
    });
    if (totalSubjects === 0) return 0;
    return totalSum / totalSubjects;
  }, [kardex]);

  const handlePrintOrder = async () => {
    setIsPrinting(true);
    try {
      const response = await fetch('/api/print-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al generar la orden');
      
      const linkSource = `data:application/pdf;base64,${data.pdfBase64}`;
      const downloadLink = document.createElement("a");
      downloadLink.href = linkSource;
      downloadLink.download = `OrdenPago_${username}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      alert(err.message);
      if (err.message.includes('expirada')) setShowLogin(true);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <>
      {showLogin && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-slide-in">
            <h2>Iniciar sesión en UTSyn</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Tus credenciales se envían directamente al portal para sincronizar tus calificaciones, kardex, foto y estatus de cuenta.
            </p>
            
            <form onSubmit={handleUTSynLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Matrícula / Usuario</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="modal-input" placeholder="Ej. 5123180035" required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="modal-input" required />
              </div>
              {loginError && (
                <div style={{ color: 'var(--grade-na)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                  {loginError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowLogin(false)} className="add-subject-btn" style={{ marginTop: 0, flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={isLoggingIn} className="add-subject-btn" style={{ marginTop: 0, flex: 1, borderStyle: 'solid', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                  {isLoggingIn ? <Loader2 className="spinner" size={20} /> : 'Conectar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDisclaimer && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-slide-in" style={{ border: '2px solid var(--primary)', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Aviso Importante</h2>
            <p style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1rem', lineHeight: '1.5' }}>
              Este proyecto fue creado sin fines de lucro. Toda la información se extrae directamente de los servidores de la universidad. Nosotros no almacenamos claves ni datos personales.
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Para más información visita nuestro repositorio en GitHub.
            </p>
            <button onClick={() => setShowDisclaimer(false)} className="add-subject-btn" style={{ borderStyle: 'solid', borderColor: 'var(--primary)', color: 'var(--primary)', margin: '0 auto' }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      <div className="animate-slide-in">
        <header className="app-header glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 0 }}>
          <h1 className="app-title">Portal Estudiantil</h1>
          
          {studentInfo ? (
            <div style={{ marginTop: '1rem', textAlign: 'center', width: '100%' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                {studentInfo.photoBase64 ? (
                  <img src={studentInfo.photoBase64} alt="Perfil" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', boxShadow: '0 4px 15px rgba(20, 184, 166, 0.2)' }} />
                ) : (
                  <UserCircle size={48} />
                )}
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{studentInfo.name}</h2>
              </div>
              <p className="app-subtitle" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{studentInfo.career}</p>
              
              <button onClick={logout} className="delete-btn" style={{ margin: '0 auto', border: '1px solid var(--card-border)', padding: '0.5rem 1rem', marginBottom: '1.5rem' }}>
                Cerrar Sesión
              </button>
              
              {/* TABS */}
              <div className="tabs-container" style={{ display: 'flex', borderTop: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('current')} className={`tab-btn ${activeTab === 'current' ? 'active' : ''}`} style={{ flex: '1 1 50%', padding: '1rem', borderBottom: activeTab === 'current' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'current' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                  <ListTodo size={18} /> Cuatrimestre Actual
                </button>
                <button onClick={() => setActiveTab('kardex')} className={`tab-btn ${activeTab === 'kardex' ? 'active' : ''}`} style={{ flex: '1 1 50%', padding: '1rem', borderBottom: activeTab === 'kardex' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'kardex' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                  <History size={18} /> Kardex Histórico
                </button>
                <button onClick={() => setActiveTab('datos')} className={`tab-btn ${activeTab === 'datos' ? 'active' : ''}`} style={{ flex: '1 1 50%', padding: '1rem', borderBottom: activeTab === 'datos' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'datos' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                  <UserIcon size={18} /> Mis Datos
                </button>
                <button onClick={() => setActiveTab('adeudos')} className={`tab-btn ${activeTab === 'adeudos' ? 'active' : ''}`} style={{ flex: '1 1 50%', padding: '1rem', borderBottom: activeTab === 'adeudos' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'adeudos' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
                  <Wallet size={18} /> Estatus de Cuenta
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <button onClick={() => setShowLogin(true)} className="add-subject-btn" style={{ borderStyle: 'solid', borderColor: 'var(--primary)', color: 'var(--text-main)', marginTop: 0, width: 'auto', padding: '0.75rem 1.5rem', backgroundColor: 'rgba(20, 184, 166, 0.1)' }}>
                <LogIn size={20} /> Conectar con UTSyn
              </button>
            </div>
          )}
        </header>

        {studentInfo && (activeTab === 'current' || activeTab === 'kardex') && (
          <div className="summary-board glass-panel" style={{ marginTop: '2rem' }}>
            <div className="summary-item">
              <span className="summary-label">
                {activeTab === 'current' ? 'Materias Actuales' : 'Total Materias Cursadas'}
              </span>
              <span className="summary-value" style={{ fontSize: '2rem' }}>
                {activeTab === 'current' ? subjects.length : kardex.reduce((acc, cycle) => acc + cycle.subjects.length, 0)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">
                {activeTab === 'current' ? 'Promedio del Cuatrimestre' : 'Promedio General (Carrera)'}
              </span>
              <span className={`summary-value ${(activeTab === 'current' ? currentGeneralAverage : kardexGeneralAverage) >= 8 ? 'passing' : 'failing'}`}>
                {(activeTab === 'current' ? currentGeneralAverage : kardexGeneralAverage).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div className="subjects-container" style={{ marginTop: '2rem' }}>
          
          {activeTab === 'current' && (
            <>
              {subjects.length === 0 ? (
                <div className="empty-state glass-panel">
                  <BookOpen size={48} />
                  <h2>No hay materias actuales</h2>
                  <p>Agrega materias manualmente o vuelve a sincronizar.</p>
                </div>
              ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: '1.5rem', width: '100%' }}>
                {subjects.map((subject) => {
                  const subjectAvg = calculateSubjectAverage(subject.units);
                  return (
                    <div key={subject.id} className="subject-card glass-panel animate-slide-in">
                      <div className="subject-header">
                        <div className="subject-info">
                          <input type="text" value={subject.name} onChange={(e) => updateSubjectName(subject.id, e.target.value)} placeholder="Nombre de la materia..." className="subject-input" />
                        </div>
                        <div className="subject-average-pill" style={{ color: subjectAvg >= 8 ? 'var(--grade-au)' : subjectAvg > 0 ? 'var(--grade-na)' : 'var(--text-muted)' }}>
                          {subjectAvg > 0 ? subjectAvg.toFixed(2) : '--'}
                        </div>
                        <button onClick={() => removeSubject(subject.id)} className="delete-btn" title="Eliminar materia">
                          <Trash2 size={20} />
                        </button>
                      </div>
                      <div className="units-list">
                        {subject.units.map(unit => (
                          <div key={unit.id} className="unit-item">
                            <input type="text" value={unit.name} onChange={(e) => updateUnitName(subject.id, unit.id, e.target.value)} placeholder="Nombre de la unidad" className="unit-name" />
                            <div className="grades-group">
                              {GRADES.map(grade => (
                                <button key={grade} onClick={() => updateUnitGrade(subject.id, unit.id, grade)} className={`grade-btn ${unit.grade === grade ? `active ${grade.toLowerCase()}` : ''}`}>
                                  {grade}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => removeUnit(subject.id, unit.id)} className="delete-btn" style={{ padding: '0.25rem' }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addUnit(subject.id)} className="add-unit-btn">
                        <Plus size={16} /> Agregar Unidad
                      </button>
                    </div>
                  );
                })}
              </div>
              )}
              <button onClick={addSubject} className="add-subject-btn">
                <Plus size={20} /> Agregar Materia Manualmente
              </button>
            </>
          )}

          {activeTab === 'kardex' && (
            <>
              {kardex.length === 0 ? (
                <div className="empty-state glass-panel">
                  <History size={48} />
                  <h2>No hay historial académico</h2>
                </div>
              ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem', width: '100%' }}>
                {kardex.map((cycle) => {
                  let cycleSum = 0; let cycleCount = 0;
                  cycle.subjects.forEach(subject => {
                    if (subject.grade && GRADE_VALUES[subject.grade] !== null) {
                      cycleSum += GRADE_VALUES[subject.grade];
                      cycleCount++;
                    }
                  });
                  const cycleAvg = cycleCount > 0 ? (cycleSum / cycleCount).toFixed(2) : '--';
                  const isPassingCycle = cycleCount > 0 && (cycleSum / cycleCount) >= 8;

                  return (
                  <div key={cycle.id} className="subject-card glass-panel animate-slide-in" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                      <h3 style={{ color: 'var(--primary)', margin: 0 }}>Ciclo: {cycle.name}</h3>
                      <div className="subject-average-pill" style={{ color: cycleAvg !== '--' ? (isPassingCycle ? 'var(--grade-au)' : 'var(--grade-na)') : 'var(--text-muted)' }}>
                        Promedio: {cycleAvg}
                      </div>
                    </div>
                    
                    <div className="units-list">
                      {cycle.subjects.map(subject => {
                        const numericGrade = GRADE_VALUES[subject.grade];
                        const isPassing = numericGrade >= 8;
                        const gradeColor = subject.grade === 'AU' || subject.grade === 'CA' ? 'var(--grade-au)' : 
                                           subject.grade === 'DE' ? 'var(--grade-de)' :
                                           subject.grade === 'SA' ? 'var(--grade-sa)' :
                                           subject.grade === 'AC' ? 'var(--text-main)' : 'var(--grade-na)';

                        return (
                          <div key={subject.id} className="unit-item" style={{ justifyContent: 'space-between' }}>
                            <span className="unit-name" style={{ fontWeight: 600 }}>{subject.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <span style={{ color: gradeColor, fontWeight: 'bold', fontSize: '1.1rem' }}>{subject.grade}</span>
                              {numericGrade !== null && (
                                <div className="subject-average-pill" style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem', color: isPassing ? 'var(--grade-au)' : 'var(--grade-na)' }}>
                                  {numericGrade}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );})}
              </div>
              )}
            </>
          )}

          {activeTab === 'datos' && (
            <div className="glass-panel animate-slide-in" style={{ padding: '2rem' }}>
              <h2 style={{ color: 'var(--primary)', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                Datos Generales
              </h2>
              {personalData ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  {[
                    { label: 'Nombre Completo', value: `${personalData.nombres} ${personalData.apellidoPaterno} ${personalData.apellidoMaterno}` },
                    { label: 'CURP', value: personalData.curp },
                    { label: 'Email Institucional', value: personalData.correoInstitucional },
                    { label: 'Teléfono Móvil', value: personalData.movil },
                    { label: 'Sexo', value: personalData.sexo },
                    { label: 'Tipo de Sangre', value: personalData.tipoSangre },
                    { label: 'Domicilio', value: `${personalData.domicilio}, ${personalData.colonia}, ${personalData.municipio}` },
                    { label: 'Código Postal', value: personalData.codigoPostal }
                  ].map((field, i) => (
                    <div key={i} style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{field.label}</span>
                      <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-main)', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{field.value || 'No especificado'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No hay datos sincronizados.</p>
              )}
            </div>
          )}

          {activeTab === 'adeudos' && (
            <div className="glass-panel animate-slide-in" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: 'var(--primary)', margin: 0 }}>Adeudos e Historial</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {accountStatus?.total && parseFloat(accountStatus.total.replace('$', '')) > 0 && (
                    <button 
                      onClick={handlePrintOrder}
                      disabled={isPrinting}
                      className="add-subject-btn" 
                      style={{ margin: 0, padding: '0.5rem 1.5rem', backgroundColor: 'var(--secondary)', color: '#fff', fontWeight: 'bold', border: 'none', display: 'flex', justifyContent: 'center' }}
                      title="Generar y descargar PDF de orden de pago"
                    >
                      {isPrinting ? <Loader2 className="spinner" size={18} /> : 'Imprimir Orden'}
                    </button>
                  )}
                  {accountStatus?.total && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem 1.5rem', borderRadius: '8px', border: '1px solid var(--grade-na)' }}>
                      <span style={{ color: 'var(--grade-na)', fontWeight: 'bold', fontSize: '1.2rem' }}>Debe: {accountStatus.total}</span>
                    </div>
                  )}
                </div>
              </div>

              {accountStatus && accountStatus.debts && accountStatus.debts.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {accountStatus.debts.map((debt, i) => (
                    <div key={i} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: parseFloat(debt.aPagar) > 0 ? 'rgba(239, 68, 68, 0.03)' : 'var(--card-bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem', margin: 0, flex: 1, lineHeight: '1.4' }}>{debt.concepto}</h3>
                        <span style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{debt.ciclo}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.75rem', borderRadius: '8px' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Generado</span>
                          <span style={{ color: 'var(--text-main)' }}>{debt.generado}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Límite</span>
                          <span style={{ color: 'var(--text-main)' }}>{debt.limite}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginTop: 'auto' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Pagado</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--grade-au)', fontSize: '1.1rem' }}>${Number(debt.pagado).toFixed(2)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>A Pagar</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: parseFloat(debt.aPagar) > 0 ? 'var(--grade-na)' : 'var(--text-muted)' }}>
                              ${Number(debt.aPagar).toFixed(2)}
                            </span>
                            {parseFloat(debt.aPagar) > 0 && (
                              <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--grade-na)', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>PENDIENTE</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No hay adeudos sincronizados o no tienes deudas.</p>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

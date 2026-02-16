import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, 
  deleteDoc, collection, query, where 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  Clipboard, Trash2, Settings, CheckCircle, Copy, ChevronRight, Check, Smartphone, Clock, XCircle, Users, FileText, Lock, Building2, UserCircle, Eye, LogOut, Loader2
} from 'lucide-react';

// --- PRODUCTION CONFIGURATION ---
// I have applied your specific SeaBlue Dental credentials below.
const firebaseConfig = {
  apiKey: "AIzaSyBraAp7BUqNNgo4kEeV1rD3z9favTXQ804",
  authDomain: "seablue-dental-form.firebaseapp.com",
  projectId: "seablue-dental-form",
  storageBucket: "seablue-dental-form.firebasestorage.app",
  messagingSenderId: "52351095408",
  appId: "1:52351095408:web:9c809372dfce463a9d1ab5",
  measurementId: "G-K2J4PK1CN8"
};

// Auto-switch between Gemini environment and your production config
const finalConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : firebaseConfig;

const app = initializeApp(finalConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Unique ID for your application's data silo
const APP_ID = "seablue-dental-production-v1"; 

const FIELD_TYPES = [
    { id: 'text', label: 'Short Answer' },
    { id: 'long_note', label: 'Long Note / History' },
    { id: 'toggle', label: 'Yes/No Toggle' },
    { id: 'radio', label: 'Single Choice' },
    { id: 'checkbox', label: 'Multiple Choice' },
    { id: 'pain_scale', label: 'Pain Scale (1-10)' },
    { id: 'dob', label: 'Date of Birth' },
    { id: 'phone', label: 'Phone Number' },
    { id: 'email', label: 'Email' },
    { id: 'signature', label: 'Digital Signature' }
];

const App = () => {
  const [user, setUser] = useState(null);
  const [clinicId, setClinicId] = useState(localStorage.getItem('dfp_clinic_id') || '');
  const [clinicConfig, setClinicConfig] = useState(null);
  const [view, setView] = useState('clinic-gate'); 
  const [loading, setLoading] = useState(true);
  
  const [allForms, setAllForms] = useState({});
  const [activeSessions, setActiveSessions] = useState([]); 
  const [allSubmissions, setAllSubmissions] = useState([]);
  
  const [activeFormId, setActiveFormId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [copying, setCopying] = useState(false);
  const [successId, setSuccessId] = useState('');
  
  const [patientInputName, setPatientInputName] = useState('');
  const [patientError, setPatientError] = useState('');
  const [rolePasscode, setRolePasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [viewingResult, setViewingResult] = useState(null);

  // 1. Authentication Lifecycle
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth failed. Ensure Anonymous Auth is enabled in Firebase Console.", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sync Clinic Configuration
  useEffect(() => {
    if (!user || !clinicId) return;
    const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'clinicConfigs', clinicId);
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        setClinicConfig(snap.data());
      } else {
        setClinicConfig('NEW_CLINIC');
        setView('clinic-setup');
      }
    }, (err) => console.error("Config Sync Error:", err));
    return () => unsub();
  }, [user, clinicId]);

  // 3. Real-Time Data Sync
  useEffect(() => {
    if (!user || !clinicId || clinicConfig === 'NEW_CLINIC' || !clinicConfig) return;
    
    const templatesRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'clinicTemplates', clinicId);
    const unsubTemplates = onSnapshot(templatesRef, (snap) => {
      if (snap.exists()) setAllForms(snap.data());
      else setAllForms({});
    }, (err) => console.error("Template Sync Error:", err));

    const sessionsCol = collection(db, 'artifacts', APP_ID, 'public', 'data', `sessions_${clinicId}`);
    const unsubSessions = onSnapshot(sessionsCol, (snap) => {
      const sessions = [];
      snap.forEach(doc => sessions.push(doc.data()));
      setActiveSessions(sessions.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, (err) => console.error("Sessions Sync Error:", err));

    const submissionsCol = collection(db, 'artifacts', APP_ID, 'public', 'data', `submissions_${clinicId}`);
    const unsubSubmissions = onSnapshot(submissionsCol, (snap) => {
      const subs = [];
      snap.forEach(doc => subs.push(doc.data()));
      setAllSubmissions(subs.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)));
    }, (err) => console.error("Submissions Sync Error:", err));

    return () => {
      unsubTemplates();
      unsubSessions();
      unsubSubmissions();
    };
  }, [user, clinicId, clinicConfig]);

  useEffect(() => {
    if (view === 'waiting-room' && patientInputName) {
      const foundSession = activeSessions.find(s => s.patientName.toLowerCase() === patientInputName.toLowerCase());
      if (foundSession) {
        setActiveSession(foundSession);
        setView('patient-form');
      }
    }
  }, [activeSessions, view, patientInputName]);

  const copyToClipboard = (text) => {
    setCopying(true);
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); } catch (err) { console.error(err); }
    document.body.removeChild(textArea);
    setTimeout(() => setCopying(false), 2000);
  };

  const saveClinicId = (id) => {
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (!cleanId) return;
    setClinicId(cleanId);
    localStorage.setItem('dfp_clinic_id', cleanId);
    setView('landing');
  };

  const setupClinic = async (e) => {
    e.preventDefault();
    const config = {
      name: e.target.clinicName.value,
      adminPasscode: e.target.adminPass.value,
      designerPasscode: e.target.designPass.value,
      createdAt: Date.now()
    };
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'clinicConfigs', clinicId), config);
    setView('landing');
  };

  const checkPasscode = (role) => {
    const correctPass = role === 'admin' ? clinicConfig.adminPasscode : clinicConfig.designerPasscode;
    if (rolePasscode === correctPass) {
      setView(role === 'admin' ? 'admin-dash' : 'doctor-config');
      setRolePasscode('');
      setAuthError('');
    } else {
      setAuthError('Incorrect passcode.');
    }
  };

  const updateCloudForms = async (updatedForms) => {
    if (!user || !clinicId) return;
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'clinicTemplates', clinicId), updatedForms);
  };

  const createNewForm = (name) => {
    const id = `form_${Date.now()}`;
    const updated = { ...allForms, [id]: { id, name, deletePasscode: "", fields: [], createdAt: Date.now() } };
    updateCloudForms(updated);
    setActiveFormId(id);
  };

  const addField = (formId, field) => {
    const updated = { ...allForms };
    updated[formId].fields = [...(updated[formId].fields || []), { ...field, id: 'f' + Date.now(), options: field.options || "" }];
    updateCloudForms(updated);
  };

  const startPatientSession = async (e) => {
    e.preventDefault();
    const name = e.target.patientName.value.trim();
    const formId = e.target.formId.value;
    if (!formId || !allForms[formId]) return;

    const sessionId = `sess_${Date.now()}`;
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `sessions_${clinicId}`, sessionId), {
      id: sessionId,
      patientName: name, 
      formId, 
      formName: allForms[formId].name,
      formData: allForms[formId],
      status: 'pending', 
      createdAt: Date.now()
    });
    e.target.reset();
  };

  const submitForm = async (responses) => {
    const subId = `sub_${Date.now()}`;
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `submissions_${clinicId}`, subId), {
      id: subId,
      responses,
      patientName: activeSession.patientName,
      formName: activeSession.formData?.name || 'Intake Form',
      timestamp: Date.now()
    });
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `sessions_${clinicId}`, activeSession.id));
    setSuccessId(activeSession.patientName);
    setView('success');
  };

  const deleteSession = async (id) => {
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `sessions_${clinicId}`, id));
  };

  const deleteSubmission = async (id) => {
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `submissions_${clinicId}`, id));
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <div className="font-bold text-slate-400 uppercase tracking-widest italic text-sm">Initializing Secure Cloud...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased">
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <h1 className="font-bold text-lg tracking-tight text-slate-800">
              DentalForm <span className="text-blue-600">Pro</span>
            </h1>
          </div>
          {clinicId && clinicConfig && clinicConfig !== 'NEW_CLINIC' && (
            <div className="flex items-center gap-4">
               <div className="hidden md:flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase">Clinic Workspace</span>
                <span className="text-xs font-bold text-slate-700">{clinicConfig.name}</span>
              </div>
              <button onClick={() => { localStorage.removeItem('dfp_clinic_id'); setClinicId(''); setView('clinic-gate'); }} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                <LogOut size={18}/>
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-6 pb-20">
        
        {view === 'clinic-gate' && (
           <div className="py-20 space-y-8 text-center animate-in fade-in">
             <div className="space-y-4">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-xl rotate-3">
                    <Building2 size={40}/>
                </div>
                <h2 className="text-4xl font-black tracking-tight">Clinic Portal</h2>
                <p className="text-slate-500 font-medium max-w-xs mx-auto">Enter your Clinic ID or create a new workspace.</p>
             </div>
             <form onSubmit={(e) => { e.preventDefault(); saveClinicId(e.target.cid.value); }} className="max-w-xs mx-auto space-y-4">
                <input name="cid" required placeholder="e.g. smile-dental" className="w-full p-5 bg-white border-2 rounded-2xl outline-none focus:border-blue-600 text-center font-bold uppercase tracking-widest" />
                <button className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-colors">Access Portal</button>
             </form>
           </div>
        )}

        {view === 'clinic-setup' && (
            <div className="py-12 space-y-8 animate-in fade-in">
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black">Register New Clinic</h2>
                    <p className="text-slate-500">Workspace: <span className="font-bold text-slate-800">{clinicId}</span></p>
                </div>
                <form onSubmit={setupClinic} className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-slate-400 ml-1">Clinic Name</label>
                        <input name="clinicName" required placeholder="City Dental Center" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-600" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-400 ml-1">Front Desk Passcode</label>
                            <input name="adminPass" required type="password" placeholder="4-8 digits" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-600" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-400 ml-1">Designer Passcode</label>
                            <input name="designPass" required type="password" placeholder="4-8 digits" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-600" />
                        </div>
                    </div>
                    <button className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-lg">Complete Registration</button>
                </form>
            </div>
        )}

        {view === 'landing' && (
          <div className="py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black text-slate-900 leading-tight">Workspace</h2>
              <p className="text-slate-500 font-medium">Select a role to continue</p>
            </div>
            <div className="grid gap-4">
              <MenuButton icon={<Smartphone size={24}/>} title="Patient Tablet" subtitle="Self-service check-in" color="blue" onClick={() => setView('patient-gate')} />
              <MenuButton icon={<Clipboard size={24}/>} title="Front Desk" subtitle="Queue & Results" color="slate" onClick={() => setView('auth-admin')} />
              <MenuButton icon={<Settings size={24}/>} title="Form Designer" subtitle="Build & Modify Templates" color="indigo" onClick={() => setView('auth-designer')} />
            </div>
          </div>
        )}

        {(view === 'auth-admin' || view === 'auth-designer') && (
            <div className="py-20 text-center space-y-8 animate-in zoom-in-95">
                <div className="w-16 h-16 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center mx-auto">
                    <Lock size={30}/>
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black">Authorized Access</h2>
                    <p className="text-slate-500 font-medium">Enter the {view === 'auth-admin' ? 'Front Desk' : 'Designer'} passcode.</p>
                </div>
                <div className="max-w-xs mx-auto space-y-4">
                    <input 
                        type="password"
                        value={rolePasscode}
                        onChange={(e) => setRolePasscode(e.target.value)}
                        placeholder="••••" 
                        className="w-full p-6 bg-white border-2 rounded-3xl outline-none focus:border-blue-600 text-center text-3xl font-bold tracking-widest"
                    />
                    {authError && <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl">{authError}</p>}
                    <button onClick={() => checkPasscode(view === 'auth-admin' ? 'admin' : 'designer')} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-lg">Enter Dashboard</button>
                    <button onClick={() => setView('landing')} className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Go Back</button>
                </div>
            </div>
        )}

        {view === 'patient-gate' && (
          <div className="py-12 space-y-8 text-center animate-in zoom-in-95">
             <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                    <UserCircle size={32}/>
                </div>
                <h2 className="text-3xl font-black">Patient Check-In</h2>
                <p className="text-slate-500 font-medium px-8">Enter your Full Legal Name to begin your intake paperwork.</p>
             </div>
             <div className="max-w-sm mx-auto space-y-4">
                <input 
                    value={patientInputName}
                    onChange={(e) => { setPatientInputName(e.target.value); setPatientError(''); }}
                    placeholder="Full Name" 
                    className="w-full p-6 bg-white border-2 rounded-3xl outline-none focus:border-blue-600 text-xl font-bold text-center" 
                />
                {patientError && <p className="text-red-500 text-xs font-bold">{patientError}</p>}
                <button 
                  onClick={() => {
                      if (!patientInputName.trim()) return setPatientError('Please enter your name.');
                      const session = activeSessions.find(s => s.patientName.toLowerCase() === patientInputName.toLowerCase());
                      if (session) {
                        setActiveSession(session);
                        setView('patient-form');
                      } else {
                        setView('waiting-room');
                      }
                  }}
                  className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-lg shadow-xl"
                >
                    Check In
                </button>
                <button onClick={() => setView('landing')} className="text-slate-400 font-bold uppercase text-[10px] tracking-widest pt-4 block w-full">Staff Only</button>
             </div>
          </div>
        )}

        {view === 'waiting-room' && (
            <div className="py-24 text-center space-y-8 animate-in fade-in">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    <div className="absolute inset-0 flex items-center justify-center"><Clock size={24} className="text-blue-600" /></div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black">Hi, {patientInputName}</h2>
                    <p className="text-slate-500 font-medium">Waiting for staff to initialize your form...</p>
                </div>
                <button onClick={() => setView('patient-gate')} className="text-slate-400 block w-full text-xs font-bold uppercase">Cancel</button>
            </div>
        )}

        {view === 'admin-dash' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <button onClick={() => setView('landing')} className="text-xs font-bold text-slate-400 uppercase">← Back</button>
                    <h2 className="text-xl font-black">Front Desk</h2>
                </div>
                
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Users className="text-blue-600" size={20}/> Send Form to Patient</h3>
                    <form onSubmit={startPatientSession} className="space-y-3">
                        <input name="patientName" required placeholder="Patient's Full Name" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-600" />
                        <select name="formId" required className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold text-blue-600">
                            <option value="">Select Template...</option>
                            {Object.values(allForms).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <button className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black">Initialize Form</button>
                    </form>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Clock className="text-blue-600" size={20}/> Live Queue</h3>
                    <div className="space-y-2">
                        {activeSessions.length === 0 ? <p className="text-xs text-slate-400 italic py-2">Queue is empty.</p> : activeSessions.map(s => (
                            <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{s.patientName}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{s.formName}</p>
                                    </div>
                                </div>
                                <button onClick={() => deleteSession(s.id)} className="text-slate-300 hover:text-red-500"><XCircle size={18}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><FileText className="text-blue-600" size={20}/> Recent Submissions</h3>
                    <div className="space-y-3">
                        {allSubmissions.map(sub => (
                            <div key={sub.id} className="p-5 bg-slate-50 rounded-3xl border flex justify-between items-center group">
                                <div>
                                    <h4 className="font-black text-slate-800">{sub.patientName}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{sub.formName} • {new Date(sub.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setViewingResult(sub)} className="p-3 bg-white border rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all"><Eye size={18}/></button>
                                    <button onClick={() => deleteSubmission(sub.id)} className="p-3 bg-white border rounded-xl text-slate-300 hover:text-red-500 transition-all"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {viewingResult && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900">{viewingResult.patientName}</h3>
                            <p className="text-xs font-black text-blue-600 uppercase tracking-widest">{viewingResult.formName}</p>
                        </div>
                        <button onClick={() => setViewingResult(null)} className="p-2 bg-white rounded-xl shadow-sm"><XCircle size={24}/></button>
                    </div>
                    <div className="p-8 overflow-y-auto space-y-6">
                        {Object.entries(viewingResult.responses).map(([label, value]) => (
                            <div key={label} className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</label>
                                <p className="text-slate-800 font-bold bg-slate-50 p-4 rounded-2xl border whitespace-pre-wrap">{value || <span className="text-slate-300 italic">No entry</span>}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-slate-50 border-t text-center">
                        <button onClick={() => {
                                const str = Object.entries(viewingResult.responses).map(([k,v]) => `${k}: ${v}`).join('\n');
                                copyToClipboard(`PATIENT: ${viewingResult.patientName}\nFORM: ${viewingResult.formName}\n---\n${str}`);
                            }}
                            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 mx-auto"
                        >
                            {copying ? <Check size={18}/> : <Copy size={18}/>} {copying ? 'Copied' : 'Copy to Clipboard'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {view === 'doctor-config' && (
          <div className="space-y-6">
            <button onClick={() => setView('landing')} className="text-xs font-bold text-slate-400 uppercase">← Back</button>
            
            {(!activeFormId || !allForms[activeFormId]) ? (
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border">
                  <h3 className="text-xl font-bold mb-6">Clinic Form Library</h3>
                  <div className="space-y-3">
                    {Object.values(allForms).length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-4">No forms created yet.</p>
                    ) : (
                        Object.values(allForms).map(form => (
                            <div key={form.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border hover:border-blue-200 cursor-pointer group" onClick={() => setActiveFormId(form.id)}>
                              <div>
                                <h4 className="font-bold text-slate-800">{form.name}</h4>
                                <span className="text-[10px] font-black text-slate-400 uppercase">{form.fields?.length || 0} Questions</span>
                              </div>
                              <button onClick={(e) => { 
                                e.stopPropagation(); 
                                const updated = {...allForms};
                                delete updated[form.id];
                                updateCloudForms(updated);
                              }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                            </div>
                          ))
                    )}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border space-y-4 shadow-sm">
                  <h4 className="font-bold text-slate-800">Create New Template</h4>
                  <form onSubmit={(e) => { e.preventDefault(); createNewForm(e.target.name.value); e.target.reset(); }} className="space-y-3">
                    <input name="name" required placeholder="Form Title" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" />
                    <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold">Create Template</button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border space-y-8 animate-in slide-in-from-right-4">
                <div className="flex justify-between items-center">
                  <button onClick={() => setActiveFormId(null)} className="text-blue-600 font-bold text-xs uppercase tracking-widest">← Back</button>
                  <h2 className="text-xl font-black">{allForms[activeFormId].name}</h2>
                </div>
                <div className="space-y-2">
                  {(allForms[activeFormId].fields || []).map((f, i) => (
                    <div key={f.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center border">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-700">{f.label}</span>
                        <span className="text-[9px] font-black text-blue-500 uppercase">{f.type}</span>
                      </div>
                      <button onClick={() => {
                        const updated = {...allForms};
                        updated[activeFormId].fields.splice(i, 1);
                        updateCloudForms(updated);
                      }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
                <div className="pt-6 border-t space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-400">Add Question</h4>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    addField(activeFormId, { label: e.target.label.value, type: e.target.type.value, options: e.target.options.value });
                    e.target.reset();
                  }} className="space-y-3">
                    <input name="label" required placeholder="Question Text" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none focus:border-blue-600" />
                    <div className="grid grid-cols-2 gap-2">
                      <select name="type" className="p-4 bg-slate-50 border rounded-2xl outline-none font-bold">
                        {FIELD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <input name="options" placeholder="Choices (comma sep)" className="p-4 bg-slate-50 border rounded-2xl outline-none" />
                    </div>
                    <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black">Add to Form</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'patient-form' && activeSession && (
          <div className="space-y-8 animate-in slide-in-from-right-12">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border">
              <div className="text-center mb-10">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">PATIENT: {activeSession.patientName}</span>
                <h2 className="text-3xl font-black text-slate-900 mt-2">{activeSession.formData?.name || 'Form'}</h2>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const resp = {};
                (activeSession.formData?.fields || []).forEach(f => {
                  if (f.type === 'checkbox') resp[f.label] = fd.getAll(f.id).join(', ');
                  else if (f.type === 'toggle') resp[f.label] = fd.get(f.id) === 'on' ? 'Yes' : 'No';
                  else resp[f.label] = fd.get(f.id);
                });
                submitForm(resp);
              }} className="space-y-12">
                {(activeSession.formData?.fields || []).map(f => (
                  <div key={f.id} className="space-y-4">
                    <label className="flex items-center gap-2 text-xl font-bold text-slate-800">{f.label}</label>
                    {f.type === 'text' && <input name={f.id} required className="w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none focus:border-blue-600" />}
                    {f.type === 'long_note' && <textarea name={f.id} required className="w-full p-5 bg-slate-50 border-2 rounded-[2rem] outline-none focus:border-blue-600 min-h-[150px]" />}
                    {f.type === 'toggle' && (
                      <div className="flex justify-between items-center bg-slate-50 p-6 rounded-3xl border">
                        <span className="font-bold text-slate-400 uppercase text-xs">No / Yes</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" name={f.id} className="sr-only peer" />
                          <div className="w-16 h-10 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-8 after:w-8 after:transition-all peer-checked:after:translate-x-6"></div>
                        </label>
                      </div>
                    )}
                    {(f.type === 'radio' || f.type === 'checkbox') && (
                      <div className="grid gap-2">
                        {(f.options || "Yes,No").split(',').map(opt => (
                          <label key={opt} className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl cursor-pointer hover:bg-white hover:border-blue-200 border-2 border-transparent transition-all">
                            <input type={f.type} name={f.id} value={opt} required={f.type==='radio'} className="w-6 h-6 accent-blue-600" />
                            <span className="font-bold">{opt.trim()}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {f.type === 'pain_scale' && (
                      <div className="bg-slate-50 p-8 rounded-[2rem] border-2 text-center space-y-4">
                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-2"><span>No Pain</span><span>Severe</span></div>
                        <input type="range" name={f.id} min="1" max="10" step="1" className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" onInput={e => {
                            e.target.parentElement.querySelector('.pain-val').innerText = e.target.value;
                        }} />
                        <div className="text-7xl font-black text-blue-600 pain-val">5</div>
                      </div>
                    )}
                    {f.type === 'dob' && <input type="date" name={f.id} required className="w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none" />}
                    {f.type === 'phone' && <input type="tel" name={f.id} required className="w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none" />}
                    {f.type === 'email' && <input type="email" name={f.id} required className="w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none" />}
                    {f.type === 'signature' && (
                      <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Digital Signature</p>
                        <input name={f.id} required placeholder="Legal Signature" className="w-full p-6 bg-white border-2 border-blue-100 rounded-2xl outline-none focus:border-blue-500 text-2xl font-serif italic text-blue-800 shadow-inner" style={{ fontFamily: 'Georgia, serif' }} />
                      </div>
                    )}
                  </div>
                ))}
                <button className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-lg active:scale-[0.98] transition-transform">Complete & Submit</button>
              </form>
            </div>
          </div>
        )}

        {view === 'success' && (
          <div className="py-24 text-center space-y-8 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl"><CheckCircle size={48}/></div>
            <h2 className="text-3xl font-black">All Done!</h2>
            <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
                <p className="text-sm font-bold text-slate-600">Thank you, <span className="text-blue-600">{successId}</span>.</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Paperwork completed successfully.</p>
            </div>
            <button onClick={() => { setPatientInputName(''); setView('patient-gate'); }} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black">Back to Start</button>
          </div>
        )}

      </main>
    </div>
  );
};

const MenuButton = ({ icon, title, subtitle, color, onClick }) => {
  const colors = {
    blue: "border-blue-100 hover:border-blue-600 text-blue-600",
    slate: "border-slate-100 hover:border-slate-800 text-slate-800",
    indigo: "border-indigo-100 hover:border-indigo-600 text-indigo-600"
  };
  return (
    <div onClick={onClick} className={`w-full p-8 bg-white border-2 rounded-[2.5rem] text-left flex items-center gap-6 group transition-all active:scale-[0.98] shadow-sm cursor-pointer ${colors[color]}`}>
      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-current group-hover:text-white transition-all">
        {icon}
      </div>
      <div className="flex-grow">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{subtitle}</p>
      </div>
      <ChevronRight className="text-slate-200 group-hover:text-current group-hover:translate-x-1 transition-all" />
    </div>
  );
};

export default App;
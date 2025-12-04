import React, { useState, useEffect, Suspense, lazy } from 'react';
import { toast } from "sonner";
import { Toaster } from "sonner";
import { Toaster as SonnerToaster } from "./ocr/components/ui/sonner.tsx";
import Toasts from "./components/Toast.jsx";
import Sidebar from './components/Sidebar.jsx';
import Auth from './page/Auth.jsx';
import Dashboard from './page/Dashboard.jsx';
import EmployeeInformation from './page/EmployeeInformation.jsx';
import ApplicantInformation from './page/ApplicantInformation.jsx';
import Employee from './page/Employees.jsx';
// import Attendance from './page/Attendance.jsx';
import Shifting from './page/Shifting.jsx';
import Training from './page/Training.jsx';
import Management from './page/Management.jsx';
import Logs from './page/Logs.jsx';
import { TooltipProvider } from "./ocr/components/ui/tooltip.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentScanner } from "./ocr/components/DocumentScanner.tsx";
import ocrCssPath from './ocr/ocrstyles.css?url';
import { useOcrStore } from './electron/ocrStore';
import { useAnalysisStore, defaultResume } from './electron/aiStore';
import {API_BASE_URL} from './config';

const Analyzer = lazy(() => import('./app/resume-parser/page.tsx'));
const Screening = lazy(() => import('./page/Screening.jsx'));

const queryClient = new QueryClient();

const TASK_POLL_INTERVAL = 2000; // 2 seconds
const PENDING_KEY = "batchOcr:pending";
const INFLIGHT_KEY = "batchOcr:inflight";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('Dashboard');
  const [previousPage, setPreviousPage] = useState(null);
  const [selectedTab, setSelectedTab] = useState("Attendance");
  const [previousTab, setPreviousTab] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedApplicantId, setSelectedApplicantId] = useState(null);
  const [selectedResumeFile, setSelectedResumeFile] = useState(null);
  const [activeTasks, setActiveTasks] = useState(new Map());
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [parsingFileName, setParsingFileName] = useState("");

  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showApplicantInfo, setShowApplicantInfo] = useState(false);

  // raw store selectors (keep for background logic)
  const processingMap = useOcrStore(s => s.processingMap);
  const batchId = useOcrStore(s => s.batchId);

  // validated flag that only becomes true when there is a *real* unresolved OCR task
  const [validatedOcrProcessing, setValidatedOcrProcessing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      const pm = processingMap || {};
      const hasPm = Object.keys(pm).length > 0;
      if (!hasPm && !batchId) {
        if (!cancelled) setValidatedOcrProcessing(false);
        return;
      }

      try {
        // get file list and ocr results to validate persisted map
        const docsList = await window.fileAPI.listDocuments().catch(() => []);
        const ocrFiles = await window.fileAPI.readDirectory('ocr_results').catch(() => []);
        const existingResults = new Set((ocrFiles || []).map(f => f.replace(/\.json$/i, '').trim()));

        // if an inflight batch id exists -> treat as active
        if (batchId) {
          if (!cancelled) setValidatedOcrProcessing(true);
          return;
        }

        // check if any processingMap key is actually unresolved:
        const unresolved = Object.keys(pm).some((key) => {
          const normalizedKey = String(key).trim();
          // check docs list for a matching doc that is not marked processed
          const doc = (docsList || []).find(d => String(d.name || '').trim() === normalizedKey);
          if (doc) {
            // show spinner only if doc is not processed and no saved result exists
            if (doc.isProcessed) return false;
            if (existingResults.has(normalizedKey)) return false;
            return true;
          }
          // if doc not found, treat as unresolved only if we don't have an ocr result file
          return !existingResults.has(normalizedKey);
        });

        if (!cancelled) setValidatedOcrProcessing(Boolean(unresolved));
      } catch (err) {
        // on error be conservative: only show spinner if there are map entries
        if (!cancelled) setValidatedOcrProcessing(Boolean(Object.keys(processingMap || {}).length > 0 || batchId));
      }
    };

    validate();
    return () => { cancelled = true; };
  }, [processingMap, batchId]);

  const globalOcrProcessing = useOcrStore(s => {
    const pm = s.processingMap || {};
    return Boolean((Object.keys(pm).length > 0) || s.batchId);
  });
  const globalAnalysisProcessing = useAnalysisStore(s => s.isProcessing);

  const handleParsingStateChange = (parsing, fileName) => {
    setIsParsingResume(parsing);
    setParsingFileName(fileName);
  };

useEffect(() => {
  const restoreSession = async () => {
    setLoading(true);
    try {
      const savedSession = await window.authAPI.getSession();
      if (savedSession?.access_token && savedSession?.refresh_token) {
        await window.authAPI.restoreSession(savedSession);
      }
      const sessionUser = await window.authAPI.getCurrentUser();
      if (sessionUser) {
        setUser(sessionUser);
      } else {
        setUser(null);
        setActivePage("Auth");
      }
    } catch {
      setUser(null);
      setActivePage("Auth");
    } finally {
      setLoading(false);
    }
  };
  restoreSession();
}, []);

  useEffect(() => {
    // Clear OCR processing state on app init (session-based, not persisted across restarts)
    const clearOcrState = async () => {
      try {
        // Clear the processing map and batch ID on cold start
        useOcrStore.setState({ 
          processingMap: {}, 
          batchId: null,
          ocrMatches: {}
        });
        
        // Clear localStorage keys used for OCR state persistence
        localStorage.removeItem("documentProcessingState");
        localStorage.removeItem("batchOcr:pendingMap");
        localStorage.removeItem("batchOcr:inflight");
      } catch (err) {
        console.warn("Failed to clear OCR state on init:", err);
      }
    };
    
    clearOcrState();
  }, []); // Run once on app mount

  useEffect(() => {
    const unsubscribe = window.authAPI.onAuthStateChange((session) => {
      if (!session) {
        setUser(null);
        setActivePage("Auth");
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let link;
    if (activePage === "Scanner") {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = ocrCssPath;
      link.id = "ocr-css";
      document.head.appendChild(link);
    }
    return () => {
      const existing = document.getElementById("ocr-css");
      if (existing) existing.remove();
    };
  }, [activePage]);

  const handleLogin = (user) => {
    setUser(user);
    setActivePage("Dashboard");
  };

  const handleLogout = async () => {
    await window.authAPI.logout();
    await window.authAPI.clearSession();
    setUser(null);
    setActivePage("Auth");
  };

  const renderPage = () => {
    if (!user) return <Auth onLogin={handleLogin} />;
    if (activePage === "Scanner") {
      return (
        <div id="ocr-root">
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <DocumentScanner />
            </TooltipProvider>
          </QueryClientProvider>
        </div>
      );
    }
    switch (activePage) {
      case "Dashboard":
        return <Dashboard {...sharedProps} selectedTab={selectedTab} setSelectedTab={setSelectedTab} setPreviousTab={setPreviousTab} />;
      case "Employee":
        return <Employee {...sharedProps} />;
      // case "Attendance":
      //   return <Attendance {...sharedProps} />;
      case "Shifting":
        return <Shifting />;
      case "Training":
        return <Training {...sharedProps} />;
      case "Screening":
        return (
          <Suspense fallback={<div>Loading Screening...</div>}>
            <Screening {...sharedProps} selectedResumeFile={selectedResumeFile} setSelectedResumeFile={setSelectedResumeFile} />
          </Suspense>
        );
      case "Analyzer":
        if (!showAnalyzer) setShowAnalyzer(true);
        return (
          <Suspense fallback={<div>Loading Analyzer...</div>}>
            <Analyzer 
              {...sharedProps} 
              showAnalyzer
              setShowAnalyzer
              selectedResumeFile={selectedResumeFile} 
              setSelectedResumeFile={setSelectedResumeFile}
              onParsingStateChange={handleParsingStateChange}
              goBack={() => {
                setShowAnalyzer(false); 
                setActivePage(previousPage || "Dashboard");
              }}
            />
          </Suspense>
        );
      case "Management":
        return <Management {...sharedProps} />;
      case "Logs":
        return <Logs  {...sharedProps} />;
      case "EmployeeInformation":
        return (
          <EmployeeInformation
            employeeId={selectedEmployeeId}
            uid={user?.id}
            goBack={() => {
              setSelectedEmployeeId(null);
              if (previousPage === "Dashboard") {
                setActivePage("Dashboard");
                if (previousTab) setSelectedTab(previousTab);
              } else {
                setActivePage(previousPage || "Dashboard");
              }
            }}
          />
        );
      case "ApplicantInformation":
        if (!showApplicantInfo) setShowApplicantInfo(true);
        return (
          <ApplicantInformation
            setShowApplicantInfo
            uid={user?.id}
            showApplicantInfo
            applicantId={selectedApplicantId}
            goBack={() => {
              setSelectedApplicantId(null);
              setShowApplicantInfo(false);
              if (previousPage === "Dashboard") {
                setActivePage("Dashboard");
                if (previousTab) setSelectedTab(previousTab);
              } else {
                setActivePage(previousPage || "Dashboard");
              }
            }}
          />
        );
      default:
        return <Dashboard {...sharedProps} />;
    }
  };

  // Add OCR progress listener at app level
  useEffect(() => {
    if (!window.fileAPI?.onOcrProgress) return;

    // Scheduler: ensure OCR toasts are spaced to avoid folded/overlapping notifications
    // nextToastAvailable tracks the earliest epoch (ms) when the next toast may appear
    let nextToastAvailable = Date.now();

    const scheduleToast = (fn) => {
      const now = Date.now();
      const delay = Math.max(0, nextToastAvailable - now);
      const scheduledAt = now + delay;
      // schedule the toast action
      setTimeout(() => {
        try { fn(); } catch (e) { console.error('Toast scheduler error', e); }
      }, delay);
      // reserve the next slot 3 seconds after this toast appears
      nextToastAvailable = scheduledAt + 3000;
    };

    const unsubscribe = window.fileAPI.onOcrProgress((evt) => {
      const { filename, status, progress, error, batch_id } = evt || {};
      const toastId = filename ? `ocr-${filename}` : "ocr-batch";

      // --- Sync shared store so Sidebar reacts even when Management is unmounted ---
      try {
        if (filename) {
          const nsKey = `batch:${filename}`;
          if (status === "started") {
            // mark file as processing
            useOcrStore.setState((prev) => {
              const pm = { ...(prev.processingMap || {}) };
              pm[nsKey] = true;
              return { processingMap: pm, batchId: batch_id ?? prev.batchId };
            });
          } else if (status === "done" || status === "error") {
            // remove single file key
            useOcrStore.setState((prev) => {
              const pm = { ...(prev.processingMap || {}) };
              delete pm[nsKey];
              return { processingMap: pm };
            });
          }
        }

        if (status === "all_done") {
          // clear everything on completion
          useOcrStore.setState({ processingMap: {}, batchId: null });
          try {
            localStorage.removeItem("documentProcessingState");
            localStorage.removeItem("batchOcr:pendingMap");
            localStorage.removeItem("batchOcr:inflight");
          } catch (e) { /* noop */ }
          // refresh docs list so UI reflects processed state
          window.fileAPI.listDocuments().then((d) => {
            try { useOcrStore.getState().setDocs?.(d); } catch(_) {}
          });
        }
      } catch (storeErr) {
        console.error("Failed to sync OCR progress to useOcrStore:", storeErr);
      }
      // --- end store sync ---

      // Dispatch event for management page immediately (management handles its own delays)
      window.dispatchEvent(new CustomEvent("app:ocr-progress", { detail: evt }));

      // Schedule toast notifications spaced by 3s
      if (status === "started") {
        scheduleToast(() => toast(`${filename || 'OCR'}: Started`, { id: toastId, duration: 2000, dismissible: true }));
      } else if (status === "progress") {
        const pct = progress ? Math.round(progress * 100) : null;
        scheduleToast(() => toast(`${filename}: ${pct}%`, { id: toastId, duration: 2000, dismissible: true }));
      } else if (status === "done") {
        scheduleToast(() => toast.success(`${filename}: Completed`, { id: toastId, duration: 2000, dismissible: true }));
      } else if (status === "error") {
        scheduleToast(() => toast.error(`${filename}: ${error || 'Failed'}`, { id: toastId, duration: 2000, dismissible: true }));
      } else if (status === "all_done") {
        scheduleToast(() => toast.success("All files processed", { id: "ocr-batch" }));
      }
    });

    return () => unsubscribe?.();
  }, []);

  // Poll active tasks
  useEffect(() => {
    if (activeTasks.size === 0) return;

    const pollTasks = async () => {
      try {
        // Get list of non-completed tasks
        const taskIds = Array.from(activeTasks.keys());
        const responses = await Promise.all(
          taskIds.map(id => 
            fetch(`${API_BASE_URL}/ocr/tasks/${id}`)
              .then(r => r.json())
              .catch(err => ({ error: err.message }))
          )
        );

        // Process responses and update UI
        responses.forEach((res, idx) => {
          const taskId = taskIds[idx];
          const task = res.task;
          
          if (!task || res.error) {
            console.warn(`Failed to fetch task ${taskId}:`, res.error);
            return;
          }

          // Update task in state
          setActiveTasks(prev => {
            const next = new Map(prev);
            if (task.status === "completed" || task.status === "failed") {
              next.delete(taskId);
            } else {
              next.set(taskId, task);
            }
            return next;
          });

          const toastId = `task-${taskId}`;
          if (task.status === "in_progress") {
            toast.loading(
              `${task.filename}: ${Math.round(task.progress * 100)}%`, 
              { id: toastId }
            );
          } else if (task.status === "completed") {
            toast.success(`${task.filename}: Completed`, { id: toastId });
          } else if (task.status === "failed") {
            toast.error(
              `${task.filename}: Failed - ${task.details.error || "Unknown error"}`, 
              { id: toastId }
            );
          }
        });
      } catch (err) {
        console.error("Task polling failed:", err);
      }
    };

    const interval = setInterval(pollTasks, TASK_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [activeTasks]);

  useEffect(() => {
    // Clear any persisted blob: URLs from analysis or ocr stores on app cold start
    try {
      const o = useOcrStore.getState().currentFile;
      if (o && typeof o.url === "string" && o.url.startsWith("blob:")) {
        console.warn("App init: clearing stale blob URL in useOcrStore");
        useOcrStore.setState({ currentFile: { ...o, url: undefined } });
      }
    } catch (e) { /* noop */ }

    try {
      const a = useAnalysisStore.getState().currentFile;
      if (a && typeof a.url === "string" && a.url.startsWith("blob:")) {
        console.warn("App init: clearing stale blob URL in useAnalysisStore");
        useAnalysisStore.setState({ currentFile: { ...a, url: undefined } });
      }
    } catch (e) { /* noop */ }

    // NEW: clear previous parsing/analysis results on cold start
    try {
      useAnalysisStore.setState({
      editableResume: defaultResume,
      analysisResult: "",
      parseComplete: false,
      isHydrated: false,
      selectedCategory: "",
      selectedJobRole: "",
      customJobDescription: "",
      currentFile: null,
      tasks: []
    });
    } catch (e) { /* noop */ }

    // One-time cleanup: if there's stray analysisResult but parseComplete is false,
    // clear the analysisResult and reset editableResume so the UI doesn't show a ghost card.
    try {
      const st = useAnalysisStore.getState();
      const hasStrayAnalysis = typeof st.analysisResult === "string" && st.analysisResult.trim().length > 0;
      if (!st.parseComplete && hasStrayAnalysis) {
        console.warn("App init: clearing stray analysisResult because parseComplete=false");
        useAnalysisStore.setState({
          analysisResult: "",
          editableResume: { ...defaultResume }
        });
        // Force-write snapshot so persisted store and hydration reflect the cleanup
        try {
          localStorage.setItem("resume-analysis-store", JSON.stringify(useAnalysisStore.getState()));
        } catch (_) { /* ignore */ }
      }
    } catch (e) { /* noop */ }
  }, []);

  const trackTask = (taskId, metadata = {}) => {
    setActiveTasks(prev => {
      const next = new Map(prev);
      next.set(taskId, { ...metadata, status: "pending" });
      return next;
    });
  };

  const untrackTask = (taskId) => {
    setActiveTasks(prev => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
  };

  const sharedProps = {
    uid: user?.id,
    activePage,
    setActivePage,
    setSelectedEmployeeId,
    setPreviousPage,
    setSelectedApplicantId,
    onTaskStart: trackTask,
    onTaskEnd: untrackTask
  };
  // console.log("Rendering App, user:", user?.id);

  if (loading) {
    return (
      <div className="loadingContainer">
        <div className="spinner"></div>
        <p className="loadingText">Checking session...</p>
      </div>
    );
  }

  return (
    <div>
      {user && <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        onLogout={handleLogout} 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
        selectedEmployeeId={selectedEmployeeId} 
        setSelectedEmployeeId={setSelectedEmployeeId} 
        selectedApplicantId={selectedApplicantId} 
        setSelectedApplicantId={setSelectedApplicantId} 
        showAnalyzer={showAnalyzer}
        setShowAnalyzer={setShowAnalyzer}
        showApplicantInfo={showApplicantInfo}
        setShowApplicantInfo={setShowApplicantInfo}
        isParsingResume={isParsingResume}
        parsingFileName={parsingFileName}
        // pass the validated boolean instead of raw store value
        isOcrProcessing={validatedOcrProcessing}
        isProcessing={globalAnalysisProcessing}
      />}
      <Toasts />
      <div className={`content ${isSidebarCollapsed ? 'collapsed' : 'expanded'}`}>{renderPage()}</div>
      <Toaster 
        position="top-right"
        expand={false}
        richColors
        closeButton
        duration={4000}
        toastOptions={{
          dismissible: true,
          style: {
            background: 'white',
            color: '#222',
            border: '1px solid #e6e6e6', 
            borderRadius: '8px',
            padding: '12px 16px'
          },
          className: 'toast-persistent-class'
        }}
      />
    </div>
  );
};

export default App;
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { toast } from "sonner";
import { Toaster } from "sonner";
import { Toaster as SonnerToaster } from "./ocr/components/ui/sonner.tsx";
import Toasts from "./components/Toast.jsx";
import Sidebar from './components/Sidebar.jsx';
import Auth from './page/Auth.jsx';
import Dashboard from './page/Dashboard.jsx';
import EmployeeInformation from './page/EmployeeInformation.jsx';
import Employee from './page/Employees.jsx';
import Attendance from './page/Attendance.jsx';
import Shifting from './page/Shifting.jsx';
import Training from './page/Training.jsx';
import Management from './page/Management.jsx';
import Logs from './page/Logs.jsx';
import { TooltipProvider } from "./ocr/components/ui/tooltip.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentScanner } from "./ocr/components/DocumentScanner.tsx";
import AnalyzerImport from './app/resume-parser/page.tsx';
import ocrCssPath from './ocr/ocrstyles.css?url';

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
  const [activeTasks, setActiveTasks] = useState(new Map()); // taskId -> task metadata

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
    const unsubscribe = window.authAPI.onAuthStateChange((session) => {
      if (session) {
        setUser(session.user);
        setActivePage("Dashboard");
      } else {
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

  console.log("Current user:", user?.id);

  const renderPage = () => {
    if (!user) return <Auth onLogin={handleLogin} />;
    if (activePage === "Scanner") {
      return (
        <div id="ocr-root">
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <SonnerToaster />
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
      case "Attendance":
        return <Attendance {...sharedProps} />;
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
        return (
          <Suspense fallback={<div>Loading Analyzer...</div>}>
            <Analyzer {...sharedProps} selectedResumeFile={selectedResumeFile} setSelectedResumeFile={setSelectedResumeFile} />
          </Suspense>
        );
      case "Management":
        return <Management {...sharedProps} />;
      case "Logs":
        return <Logs />;
      case "EmployeeInformation":
        return (
          <EmployeeInformation
            employeeId={selectedEmployeeId}
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
      default:
        return <Dashboard {...sharedProps} />;
    }
  };

  // Add OCR progress listener at app level
  useEffect(() => {
    if (!window.fileAPI?.onOcrProgress) return;

    const unsubscribe = window.fileAPI.onOcrProgress((evt) => {
      const { filename, status, progress, error } = evt || {};
      const toastId = filename ? `ocr-${filename}` : "ocr-batch";

      // Dispatch event for management page
      window.dispatchEvent(new CustomEvent("app:ocr-progress", { detail: evt }));

      // Show toast notifications
      if (status === "started") {
        toast.loading(`${filename || 'OCR'}: Started`, { id: toastId });
      } else if (status === "progress") {
        const pct = progress ? Math.round(progress * 100) : null;
        toast.loading(`${filename}: ${pct}%`, { id: toastId });
      } else if (status === "done") {
        toast.success(`${filename}: Completed`, { id: toastId });
      } else if (status === "error") {
        toast.error(`${filename}: ${error || 'Failed'}`, { id: toastId });
      } else if (status === "all_done") {
        toast.success("All files processed", { id: "ocr-batch" });
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
            fetch(`http://localhost:8000/ocr/tasks/${id}`)
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

          // Show toast based on status
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

  // Add task tracking functions
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

  // Pass task tracking to children via props
  const sharedProps = {
  uid: user?.id,
  activePage,
  setActivePage,
  setSelectedEmployeeId,
  setPreviousPage,
  setSelectedApplicantId,
  selectedApplicantId,
  onTaskStart: trackTask,
  onTaskEnd: untrackTask
};

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
      {user && <Sidebar activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout} isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} selectedEmployeeId={selectedEmployeeId} setSelectedEmployeeId={setSelectedEmployeeId} selectedApplicantId={selectedApplicantId} setSelectedApplicantId={setSelectedApplicantId} />}
      <Toasts />
      <div className={`content ${isSidebarCollapsed ? 'collapsed' : 'expanded'}`}>{renderPage()}</div>
      <Toaster richColors position="top-right" />
    </div>
  );
};

export default App;
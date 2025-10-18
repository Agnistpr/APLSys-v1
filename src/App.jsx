import React, { useState, useEffect, Suspense, lazy } from 'react';
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
import { Toaster } from "./ocr/components/ui/toaster.js";
import { Toaster as Sonner } from "./ocr/components/ui/sonner.js";
import { TooltipProvider } from "./ocr/components/ui/tooltip.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentScanner } from "./ocr/components/DocumentScanner.tsx";
import AnalyzerImport from './app/resume-parser/page.tsx';
import ocrCssPath from './ocr/ocrstyles.css?url';

const Analyzer = lazy(() => import('./app/resume-parser/page.tsx'));
const Screening = lazy(() => import('./page/Screening.jsx'));

const queryClient = new QueryClient();

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

  const sharedProps = {
    userId: user?.id,
    activePage,
    setActivePage,
    setSelectedEmployeeId,
    setPreviousPage,
    setSelectedApplicantId,
    selectedApplicantId,
  };

  const renderPage = () => {
    if (!user) return <Auth onLogin={handleLogin} />;
    if (activePage === "Scanner") {
      return (
        <div id="ocr-root">
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
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

  if (loading) return <div className="loading-screen">Checking session...</div>;

  return (
    <div>
      {user && <Sidebar activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout} isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} selectedEmployeeId={selectedEmployeeId} setSelectedEmployeeId={setSelectedEmployeeId} selectedApplicantId={selectedApplicantId} setSelectedApplicantId={setSelectedApplicantId} />}
      <Toasts />
      <div className={`content ${isSidebarCollapsed ? 'collapsed' : 'expanded'}`}>{renderPage()}</div>
    </div>
  );
};

export default App;
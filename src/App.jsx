import React, { useState, useEffect } from 'react';

import Toasts from "./components/Toast.jsx";
import Sidebar from './components/Sidebar.jsx';

import Auth from './page/Auth.jsx';
import Dashboard from './page/Dashboard.jsx';
import EmployeeInformation from './page/EmployeeInformation.jsx';
import Employee from './page/Employees.jsx';
import Attendance from './page/Attendance.jsx';
import Shifting from './page/Shifting.jsx';
import Training from './page/Training.jsx';
import Screening from './page/Screening.jsx';
import Management from './page/Management.jsx';
import Logs from './page/Logs.jsx';

import '../styles.css';

import { Toaster } from "./ocr/components/ui/toaster.js";
import { Toaster as Sonner } from "./ocr/components/ui/sonner.js";
import { TooltipProvider } from "./ocr/components/ui/tooltip.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentScanner } from "./ocr/components/DocumentScanner.tsx";

import Analyzer from './app/resume-parser/page.tsx';
import ocrCssPath from './ocr/ocrstyles.css?url';

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
    const getSession = async () => {
      try {
        const session = await window.authAPI.getSession();
        if (session) setUser(session.user);
      } catch (err) {
        console.error("Error fetching session:", err);
      } finally {
        setLoading(false);
      }
    };
    getSession();
  }, []);

  // ✅ Dynamic OCR CSS loader
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
        return (
          <Dashboard
            {...sharedProps}
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
            setPreviousTab={setPreviousTab}
          />
        );
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
          <Screening
            {...sharedProps}
            selectedResumeFile={selectedResumeFile}
            setSelectedResumeFile={setSelectedResumeFile}
          />
        );
      case "Analyzer":
        return (
          <Analyzer
            {...sharedProps}
            selectedResumeFile={selectedResumeFile}
            setSelectedResumeFile={setSelectedResumeFile}
          />
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

  if (loading) {
    return <div className="loading-screen">Checking session...</div>;
  }

  return (
    <div>
      {user && (
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          onLogout={handleLogout}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          selectedApplicantId={selectedApplicantId}
          setSelectedApplicantId={setSelectedApplicantId}
        />
      )}
      <Toasts />
      <div className={`content ${isSidebarCollapsed ? 'collapsed' : 'expanded'}`}>
        {renderPage()}
      </div>
    </div>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import Login from './page/Login.jsx';
import Dashboard from './page/Dashboard.jsx';
import Sidebar from './components/Sidebar.jsx';
import EmployeeInformation from './page/EmployeeInformation.jsx';
import Employee from './page/Employees.jsx';
import Attendance from './page/Attendance.jsx';
import Shifting from './page/Shifting.jsx';
import Training from './page/Training.jsx';
import Screening from './page/Screening.jsx';
import Management from './page/Management.jsx';
// import OCR from './page/OCR.jsx';
// import DocumentManagement from './ocr/DocumentManagement.jsx';
import Logs from './page/Logs.jsx';
import '../styles.css';
// import '../index.css'; 
// import ResumeParser from "./app/resume-parser/page.tsx";

import { Toaster } from "./ocr/components/ui/toaster.js";
import { Toaster as Sonner } from "./ocr/components/ui/sonner.js";
import { TooltipProvider } from "./ocr/components/ui/tooltip.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocumentScanner } from "./ocr/components/DocumentScanner.tsx";

import Analyzer from './app/resume-parser/page.tsx';
// import ResumeParser from "./app/resume-parser/page.tsx";

import ocrCssPath from './ocr/ocrstyles.css?url';

const queryClient = new QueryClient();

const App = () => {
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem("userId") || null;
  });
  const [activePage, setActivePage] = useState('Dashboard');
  const [previousPage, setPreviousPage] = useState(null);

  const [selectedTab, setSelectedTab] = useState("Attendance");
  const [previousTab, setPreviousTab] = useState(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedApplicantId, setSelectedApplicantId] = useState(null);
  const [selectedResumeFile, setSelectedResumeFile] = useState(null);

  // const [isCssReady, setIsCssReady] = useState(null);

  // useEffect(() => {
  //   let linkTag;
  //
  //   if (activePage === "DocumentManagement") {
  //     setIsCssReady(false);
  //
  //     linkTag = document.createElement("link");
  //     linkTag.rel = "stylesheet";
  //     linkTag.type = "text/css";
  //     linkTag.href = "dms.css";
  //     linkTag.id = "document-css";
  //
  //     linkTag.onload = () => setIsCssReady(true);
  //
  //     document.head.appendChild(linkTag);
  //   } else {
  //     setIsCssReady(true);
  //   }
  //
  //   return () => {
  //     // Cleanup when leaving DocumentManagement
  //     if (linkTag) {
  //       linkTag.remove();
  //       setIsCssReady(null);
  //     } else {
  //       const existing = document.getElementById("document-css");
  //       if (existing) existing.remove();
  //     }
  //   };
  // }, [activePage]);

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


  const loginAction = (id) => {
    setUserId(id);
    localStorage.setItem("userId", id);
    setActivePage("Dashboard");
  };

  const logoutAction = () => {
    setUserId(null);
    localStorage.removeItem("userId");
    setActivePage("Login");
  };

  const sharedProps = {
    userId,
    activePage,
    setActivePage,
    setSelectedEmployeeId,
    setPreviousPage,
    setSelectedApplicantId,
    selectedApplicantId,
  };

  const renderPage = () => {
    if (!userId) {
      return <Login onLogin={loginAction} />;
    }

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
        return <Screening {...sharedProps} selectedResumeFile={selectedResumeFile} setSelectedResumeFile={setSelectedResumeFile} />;
      case "Analyzer":
        return <Analyzer {...sharedProps} selectedResumeFile={selectedResumeFile} setSelectedResumeFile={setSelectedResumeFile} />;
      case "Management":
        return <Management {...sharedProps} />;
      case "Logs":
        return <Logs />;
      // case "Add Applicant":
      //   return <ResumeParser />;
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
      }
    };


  return (
    <div>
      {userId && (
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          onLogout={logoutAction}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          selectedApplicantId={selectedApplicantId}
          setSelectedApplicantId={setSelectedApplicantId}
        />
      )}
      <div className={`content ${isSidebarCollapsed ? 'collapsed' : 'expanded'}`}>
        {renderPage()}
      </div>
    </div>
  );
};

export default App;
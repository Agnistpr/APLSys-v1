import React, { useState, useEffect } from 'react';
import logoutIcon from '../assets/logout.png';
import { FaChevronRight, FaChevronDown, FaBars, FaTachometerAlt, FaUsers, FaUserPlus, FaFileAlt, FaChartBar } from 'react-icons/fa';
import { LuLogs, LuScan } from "react-icons/lu";
import { MdManageSearch } from "react-icons/md";
import {
  FaChalkboardTeacher,
  FaSearch,
  FaUserTie,
  FaClock,
  FaCalendarAlt
} from 'react-icons/fa';
import { useOcrStore } from '../electron/ocrStore';

const subNavIcons = {
  Employee: <FaUserTie />,
  Attendance: <FaClock />,
  Shifting: <FaCalendarAlt />,
  Training: <FaChalkboardTeacher />,
  Analyzer: <FaChartBar />,
  Screening: <FaSearch />,
  Scanner: <LuScan />,
  Management: <MdManageSearch />
};

const Sidebar = ({ activePage, setActivePage, onLogout, isCollapsed, setIsCollapsed, selectedEmployeeId, setSelectedEmployeeId, selectedApplicantId, setSelectedApplicantId, setShowAnalyzer, showAnalyzer, showApplicantInfo, setShowApplicantInfo, isParsingResume, isOcrProcessing, isProcessing, parsingFileName }) => {
  const [showEmployees, setShowEmployees] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const [userName, setUserName] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const processingMap = useOcrStore(state => state.processingMap);
  // derive context-aware flags from the shared processingMap
  const scannerProcessing = Boolean(Object.keys(processingMap || {}).find(k => String(k).startsWith('scanner:')));
  const batchProcessing = Boolean(Object.keys(processingMap || {}).find(k => String(k).startsWith('batch:')));

  useEffect(() => {
    console.log("Sidebar states:", { activePage, showAnalyzer, showApplicantInfo, scannerProcessing, batchProcessing });
  }, [activePage, showAnalyzer, showApplicantInfo, scannerProcessing, batchProcessing]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await window.authAPI.getCurrentUser();
        if (user) {
          setUserName(user.username || 'Unknown User');
          setUserRole(user.userrole || 'Unknown Role');
        } else {
          setUserName('Guest');
          setUserRole('N/A');
        }
      } catch (err) {
        console.error('Failed to load user session:', err);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.devicePixelRatio >= 1.5);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Spinner flags are derived above; do not redeclare scannerProcessing here.

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="userProfile">
        <div className="topBar">
          <div className="avatarPlaceholder" />
          <div className="userInfo">
            <div className="role">{userRole}</div>
            <div className="name">{userName}</div>
          </div>
        </div>
        <button
          className="hamburgerBtn"
          onClick={() => setIsCollapsed(prev => !prev)}
          style={{ fontSize: isCollapsed ? '36px' : '27px' }}
        >
          <FaBars />
        </button>
      </div>

      {/* Nav Items */}
      <div className="navList">
        <div
          className={`sidebarNav ${activePage === 'Dashboard' ? 'activeTab' : ''}`}
          onClick={() => setActivePage('Dashboard')}
        >
          <FaTachometerAlt />
          <span>Dashboard</span>
        </div>

        <div className="navSection">
          <div className="sidebarNav" onClick={() => setShowEmployees(!showEmployees)}>
            <FaUsers />
            <span>Employees</span>
            <span className="chevron">
              {showEmployees ? <FaChevronDown /> : <FaChevronRight />}
            </span>
          </div>
          {showEmployees && (
            <div className="subNavList">
              {['Employee'].map((page, idx) => (
                <div
                  key={idx}
                  className={`subNavItem ${activePage === page ? 'activeSubTab' : ''}`}
                  onClick={() => setActivePage(page)}
                  title={page}
                >
                  {subNavIcons[page]}
                  <span>{page}</span>
                </div>
              ))}
              {selectedEmployeeId && (
                <div
                  className={`subNavItem ${activePage === 'EmployeeInformation' ? 'activeSubTab' : ''}`}
                  onClick={() => setActivePage('EmployeeInformation')}
                  title="Information"
                >
                  <FaUserTie />
                  <span>Information</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="navSection">
          <div className="sidebarNav" onClick={() => setShowApplicants(!showApplicants)}>
            <FaUserPlus />
            <span>Applicants</span>
            <span className="chevron">
              {showApplicants ? <FaChevronDown /> : <FaChevronRight />}
            </span>
          </div>

          {showApplicants && (
            <div className="subNavList">
              {["Screening", "Training"].map((page) => (
                <div
                  key={page}
                  className={`subNavItem ${activePage === page ? "activeSubTab" : ""}`}
                  onClick={() => setActivePage(page)}
                  title={page}
                >
                  {subNavIcons[page]}
                  <span>{page}</span>
                </div>
              ))}

              {(activePage === "Analyzer" || showAnalyzer) && (
                <div
                  className={`subNavItem ${activePage === "Analyzer" ? "activeSubTab" : ""}`}
                  onClick={() => {
                    setActivePage("Analyzer");
                    setShowAnalyzer(true); // mark as open
                    setShowApplicantInfo(false);
                  }}
                  title={isParsingResume ? `Parsing ${parsingFileName || 'resume'}... Please be patient` : "Analyzer"}
                  style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}
                >
                  {subNavIcons["Analyzer"]}
                  <span>Analyzer</span>

                  {/* Inline spinner + accessible label when parsing */}
                  {(isParsingResume || isProcessing) && (
                    <span
                      role="status"
                      aria-label={`${parsingFileName || 'resume'} is currently being processed`}
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        marginLeft: 6,
                        border: "2px solid rgba(0,0,0,0.12)",
                        borderTop: "2px solid #1976d2",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                      }}
                    />
                  )}
                </div>
              )}

              {(activePage === "ApplicantInformation" || showApplicantInfo) && (
                <div
                  className={`subNavItem ${activePage === "ApplicantInformation" ? "activeSubTab" : ""}`}
                  onClick={() => {
                    setActivePage("ApplicantInformation");
                    setShowApplicantInfo(true); // ✅ mark as open
                    setShowAnalyzer(false);
                  }}
                  title="Information"
                >
                  <FaUserTie />
                  <span>Information</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="navSection">
          <div className="sidebarNav" onClick={() => setShowDocuments(!showDocuments)}>
            <FaFileAlt />
            <span>Documents</span>
            <span className="chevron">
              {showDocuments ? <FaChevronDown /> : <FaChevronRight />}
            </span>
          </div>
           {showDocuments && (
             <div className="subNavList">
              {['Scanner', 'Management'].map((page, idx) => (
                <div
                  key={idx}
                  className={`subNavItem ${activePage === page ? "activeSubTab" : ""}`}
                  onClick={() => {
                    setActivePage(page);
                    // keep analyzer/applicant behavior unchanged
                    setShowAnalyzer(page === "Scanner" ? false : showAnalyzer);
                    setShowApplicantInfo(false);
                  }}
                  title={page}
                  style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}
                >
                  {subNavIcons[page]}
                  <span>{page}</span>

                  {/* show circular inline spinner only when corresponding context has active keys */}
                  {page === "Scanner" && scannerProcessing && (
                    <span
                      className="inlineSpinner"
                      title="Manual scan in progress"
                      aria-hidden="true"
                      style={{ marginLeft: 6 }}
                    />
                  )}

                  {page === "Management" && batchProcessing && (
                    <span
                      className="inlineSpinner"
                      title="Batch OCR in progress"
                      aria-hidden="true"
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </div>
              ))}
             </div>
           )}
        </div>

        <div
          className={`sidebarNav ${activePage === 'Logs' ? 'activeTab' : ''}`}
          onClick={() => setActivePage('Logs')}
        >
          <LuLogs />
          <span>Logs</span>
        </div>
      </div>

      <div className="logoutSection" onClick={onLogout}>
        <img src={logoutIcon} className="logoutImg" alt="Logout" />
        <span className="logoutText">Logout</span>
      </div>

      {/* Add spin keyframes if not present in global CSS */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Sidebar;
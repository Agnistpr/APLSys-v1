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

const Sidebar = ({ activePage, setActivePage, onLogout, isCollapsed, setIsCollapsed, selectedEmployeeId, setSelectedEmployeeId, selectedApplicantId, setSelectedApplicantId }) => {
  const [showEmployees, setShowEmployees] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showApplicantInfo, setShowApplicantInfo] = useState(false);

  const [userName, setUserName] = useState(null);
  const [userRole, setUserRole] = useState(null);

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

  useEffect(() => {
  // Always show the Applicants section if we're inside any of its pages
  if (["Screening", "Training", "Analyzer", "ApplicantInformation"].includes(activePage)) {
    setShowApplicants(true);
  }

  // Control Analyzer and Applicant Info visibility strictly based on the current page
  if (activePage === "Analyzer") {
    setShowAnalyzer(true);
    setShowApplicantInfo(false);
  } else if (activePage === "ApplicantInformation") {
    setShowAnalyzer(false);
    setShowApplicantInfo(true);
  } else {
    // Reset both when leaving applicant-related pages
    setShowAnalyzer(false);
    setShowApplicantInfo(false);
  }
  }, [activePage]);

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

              {selectedApplicantId && (
                <>
                  {/* Analyzer */}
                  <div
                    className={`subNavItem ${activePage === "Analyzer" ? "activeSubTab" : ""}`}
                    onClick={() => {
                      setShowAnalyzer(true);
                      setShowApplicantInfo(false);
                      setActivePage("Analyzer");
                    }}
                    title="Analyzer"
                  >
                    {subNavIcons["Analyzer"]}
                    <span>Analyzer</span>
                  </div>

                  {/* Applicant Information (only if Analyzer is open) */}
                  {showAnalyzer && (
                    <div
                      className={`subNavItem ${activePage === "ApplicantInformation" ? "activeSubTab" : ""}`}
                      onClick={() => {
                        setShowAnalyzer(false);
                        setShowApplicantInfo(true);
                        setActivePage("ApplicantInformation");
                      }}
                      title="Information"
                    >
                      <FaUserTie />
                      <span>Information</span>
                    </div>
                  )}
                </>
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
                  className={`subNavItem ${activePage === page ? 'activeSubTab' : ''}`}
                  onClick={() => setActivePage(page)}
                  title={page}
                >
                  {subNavIcons[page]}
                  <span>{page}</span>
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
    </div>
  );
};

export default Sidebar;
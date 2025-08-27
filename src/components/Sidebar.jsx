import React, { useState, useEffect } from 'react';
import logoutIcon from '../assets/logout.png';
import { FaChevronRight, FaChevronDown, FaBars, FaTachometerAlt, FaUsers, FaUserPlus, FaFileAlt, FaCog, FaChartBar, FaFileUpload } from 'react-icons/fa';
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

  // Collapse on small or zoom?
  useEffect(() => {
    const handleResize = () => {
      if (window.devicePixelRatio >= 1.5) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="userProfile">
        <div className="topBar">
          <div className="avatarPlaceholder" />
          <div className="userInfo">
            <div className="role">HR</div>
            <div className="name">Jane Doe</div>
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
              {['Employee', 'Attendance'].map((page, idx) => (
                <div
                  key={idx}
                  className={`subNavItem ${activePage === page ? 'activeSubTab' : ''}`}
                  onClick={() => setActivePage(page)}
                  title={page}
                >
                  {subNavIcons[page]}
                  <span>{page.replace(/([A-Z])/g, ' $1').trim()}</span>
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
              {['Training', 'Screening'].map((page, idx) => (
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
              {selectedApplicantId && (
                <div
                  className={`subNavItem ${activePage === 'Analyzer' ? 'activeSubTab' : ''}`}
                  onClick={() => setActivePage('Analyzer')}
                  title="Analyzer"
                >
                  {subNavIcons['Analyzer']}
                  <span>Analyzer</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* <div className={`sidebarNav ${activePage === 'OCR' ? 'activeTab' : ''}`} onClick={() => setActivePage('OCR')}>
          <FaFileUpload />
          <span>Document Scanning</span>
        </div> */}

        {/* Documents */}
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

        <div className={`sidebarNav ${activePage === 'Logs' ? 'activeTab' : ''}`} onClick={() => setActivePage('Logs')}>
          <LuLogs />
          <span>Logs</span>
        </div>

        {/* <div className={`sidebarNav ${activePage === 'Settings' ? 'activeTab' : ''}`} onClick={() => setActivePage('Settings')}>
          <FaCog />
          <span>Settings</span>
        </div> */}
      </div>

      <div className="logoutSection" onClick={onLogout}>
        <img src={logoutIcon} className="logoutImg" alt="Logout" />
        <span className="logoutText">Logout</span>
      </div>
    </div>
  );
};

export default Sidebar;

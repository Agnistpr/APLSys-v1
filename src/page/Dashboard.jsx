import React, { useEffect, useState } from 'react';
import { FaUsers, FaUserClock, FaBell } from 'react-icons/fa';

import AttendanceComponent from '../components/AttendanceComponent.jsx';
import AbsenceComponent from '../components/AbsenceComponent.jsx';
import LeaveComponent from '../components/OnLeaveComponent.jsx';
import InventoryComponent from '../components/InventoryComponent.jsx';

const Dashboard = ({ userId, setActivePage, setSelectedEmployeeId, setPreviousPage, selectedTab, setSelectedTab, setPreviousTab  }) => {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalAttendance, setTotalAttendance] = useState(0);
  const [totalOnLeave, setTotalOnLeave] = useState(0);

  const handleTabChange = (tab) => setSelectedTab(tab);

  const fetchCounts = async () => {
    try {
      const counts = await window.fileAPI.getDashboardCardData();
      if (counts) {
        setTotalEmployees(counts.totalEmployees);
        setTotalAttendance(counts.totalAttendance);
        setTotalOnLeave(counts.totalOnLeave);
      } else {
        console.error('Counts is undefined');
      }
    } catch (err) {
      console.error('Failed to fetch dashboard counts:', err);
    }
  };

  const tabComponents = {
    Attendance: (
      <AttendanceComponent
        userId={userId}
        setActivePage={(page) => {
          setPreviousPage("Dashboard");
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
    Absent: (
      <AbsenceComponent
        userId={userId}
        setActivePage={(page) => {
          setPreviousPage("Dashboard");
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
    "On Leave": (
      <LeaveComponent
        userId={userId}
        setActivePage={(page) => {
          setPreviousPage("Dashboard");
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
    "PPE Inventory": (
      <InventoryComponent
        userId={userId}
        setActivePage={(page) => {
          setPreviousPage("Dashboard");
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
  };

  useEffect(() => {
    const updateTimeAndData = async () => {
      const now = new Date();
      setDateStr(now.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      }));
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      await fetchCounts();
    };

    updateTimeAndData();
    const interval = setInterval(updateTimeAndData, 60000);
    return () => clearInterval(interval);
  }, []);

  const tabs = ["Attendance", "Absent", "On Leave", "PPE Inventory"];

  return (
    <div className="dashboardContainer">
      <div className="dashboardHeader">
        <h1>Dashboard</h1>
        <div className="rightHeader">
          <div className="dateTime">
            <span>{dateStr}</span>
            <span className="divider">|</span>
            <span>{timeStr}</span>
          </div>
          {/* <FaBell className="notifIcon" /> */}
        </div>
      </div>

      <div className="topCards">
        {[
          ["Total Employees", totalEmployees, <FaUsers />, null],
          ["Today's Attendance", totalAttendance, <FaUserClock />, "Attendance"],
          ["On Leave Today", totalOnLeave, <FaUserClock />, "On Leave"]
        ].map(([title, value, icon, redirectTab], idx) => (
          <div key={idx} className="dashboardCards">
            <div className="cardBody">
              <div className="cardIcon">{icon}</div>
              <div className="cardInfo">
                <div className="cardTitle">{title}</div>
                <div className="cardValue">{value}</div>
              </div>
            </div>
            <div className="cardFooter">
              <button
                className="viewDetails"
                onClick={() => {
                  if (redirectTab) handleTabChange(redirectTab);
                }}
              >
                View Details ➔
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="tabContainer">
        <div className="dashboardTabs">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              className={`dashboardTab ${selectedTab === tab ? "active" : ""}`}
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className='scrollContainer'>
          <div className="dashboardContent">
            {tabComponents[selectedTab] || (
              <div style={{ padding: '20px', textAlign: 'center', color: '#555' }}>
                <em>Component for "{selectedTab}" is not yet implemented.</em>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
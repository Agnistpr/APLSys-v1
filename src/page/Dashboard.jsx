import React, { useEffect, useState, useRef } from 'react';
import { FaUserClock, FaClipboardCheck, FaClipboardList } from 'react-icons/fa';
import AttendanceTab from '../tabs/AttendanceTab.jsx';
import AbsenceTab from '../tabs/AbsenceTab.jsx';
import LeaveTab from '../tabs/LeaveTab.jsx';
import InventoryTab from '../tabs/InventoryTab.jsx';

function useFitText({ text, maxSize = 28, minSize = 12 }) {
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const resizeToFit = () => {
      let currentSize = maxSize;
      element.style.fontSize = `${currentSize}px`;

      while (element.scrollWidth > element.clientWidth && currentSize > minSize) {
        currentSize -= 1;
        element.style.fontSize = `${currentSize}px`;
      }
    };

    resizeToFit();

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resizeToFit);
      observer.observe(element);
      if (element.parentElement) observer.observe(element.parentElement);
    } else {
      window.addEventListener('resize', resizeToFit);
    }

    return () => {
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', resizeToFit);
    };
  }, [text, maxSize, minSize]);

  return elementRef;
}

function CardValue({ value, loading, max = 28, min = 12 }) {
  const ref = useFitText({ text: value, maxSize: max, minSize: min });

  if (loading) {
    return (
      <div className="cardValue spinnerInline">
        <div className="spinner small" />
      </div>
    );
  }

  return (
    <div ref={ref} className="cardValue">
      {value}
    </div>
  );
}

const Dashboard = ({
  uid,
  setActivePage,
  setSelectedEmployeeId,
  setPreviousPage,
  selectedTab,
  setSelectedTab,
  setPreviousTab
}) => {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalAttendance, setTotalAttendance] = useState(0);
  const [totalApprovedLeaves, setTotalApprovedLeaves] = useState(0);
  const [totalLeaveRequests, setTotalLeaveRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleTabChange = (tab) => setSelectedTab(tab);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      const counts = await window.utilityAPI.getDashboardCardData();
      if (counts) {
        setTotalEmployees(counts.totalEmployees || 0);
        setTotalAttendance(counts.totalAttendance || 0);
        setTotalApprovedLeaves(counts.totalApprovedLeaves || 0);
        setTotalLeaveRequests(counts.totalLeaveRequests || 0);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard counts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const updateTimeAndData = async () => {
      const now = new Date();
      setDateStr(
        now.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      );
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      await fetchCounts();
    };

    updateTimeAndData();
    const interval = setInterval(updateTimeAndData, 60000);
    return () => clearInterval(interval);
  }, []);

  const tabComponents = {
    Attendance: (
      <AttendanceTab
        uid={uid}
        setActivePage={(page) => {
          setPreviousPage('Dashboard');
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
    Absent: (
      <AbsenceTab
        uid={uid}
        setActivePage={(page) => {
          setPreviousPage('Dashboard');
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
    'Approved Leaves': (
      <LeaveTab
        status="Approved"
        uid={uid}
        setActivePage={(page) => {
          setPreviousPage('Dashboard');
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
    'Leave Requests': (
      <LeaveTab
        status="Request"
        uid={uid}
        setActivePage={(page) => {
          setPreviousPage('Dashboard');
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
    'PPE Inventory': (
      <InventoryTab
        uid={uid}
        setActivePage={(page) => {
          setPreviousPage('Dashboard');
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
  };

  const tabs = ['Attendance', 'Absent', 'Approved Leaves', 'Leave Requests', 'PPE Inventory'];

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
        </div>
      </div>

      <div className="topCards">
        {[
          ['Attendance (Yesterday)', `${totalAttendance} / ${totalEmployees}`, <FaUserClock />],
          ['Approved On Leave', String(totalApprovedLeaves), <FaClipboardCheck />],
          ['Leave Requests', String(totalLeaveRequests), <FaClipboardList />],
        ].map(([title, value, icon], idx) => (
          <div key={idx} className="dashboardCards">
            <div className="cardBody">
              <div className="cardIcon">{icon}</div>
              <div className="cardInfo">
                <div className="cardTitle">{title}</div>
                <CardValue value={value} loading={loading} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="tabContainer">
        <div className="tabs">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              className={`tab ${selectedTab === tab ? 'active' : ''}`}
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="scrollContainer">
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
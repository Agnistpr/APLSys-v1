import React, { useEffect, useState, useRef } from 'react';
import { FaUserClock, FaClipboardCheck, FaClipboardList } from 'react-icons/fa';
import { IoIosNotifications } from "react-icons/io";
import AttendanceTab from '../tabs/AttendanceTab.jsx';
import AbsenceTab from '../tabs/AbsenceTab.jsx';
import LeaveTab from '../tabs/LeaveTab.jsx';
import InventoryTab from '../tabs/InventoryTab.jsx';
import ConfirmModal from "../components/ConfirmModal.jsx";

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
  setPreviousTab,
  setSelectedApplicantId
}) => {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalAttendance, setTotalAttendance] = useState(0);
  const [totalApprovedLeaves, setTotalApprovedLeaves] = useState(0);
  const [totalLeaveRequests, setTotalLeaveRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const fetchNotifications = async () => {
    try {
      const result = await window.utilityAPI.getNotification(uid);
      if (Array.isArray(result)) {
        setNotifications(result);
      }
    } catch (err) {
      console.error("Notif fetch error:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      const modal = document.querySelector(".confirmModalOverlay");

      // If modal is open and the click is INSIDE it → do nothing
      if (modal && modal.contains(event.target)) return;

      // Normal notification dropdown closing logic
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        if (showNotif) {
          const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
          if (unreadIds.length > 0) {
            window.utilityAPI.setNotificationsRead(uid, unreadIds);
          }
          const updated = notifications.map(n => ({ ...n, read: true }));
          setNotifications(updated);
        }
        setShowNotif(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotif, notifications]);

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
    const updateTime = () => {
      const now = new Date();
      setDateStr(now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchCounts();
  }, []);

  const updateDetailRequestStatus = async (id, status) => {
    try {
      await window.utilityAPI.updateDetailRequestStatus(id, status);

      await fetchNotifications();

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Failed to update request status:", err);
    }
  };

  const tabComponents = {
    Attendance: (
      <AttendanceTab
        uid={uid}
        setActivePage={(page) => {
          setPreviousPage('Dashboard');
          setPreviousTab(selectedTab);
          setActivePage(page);
        }}
        setSelectedApplicantId={setSelectedApplicantId}
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
        setSelectedApplicantId={setSelectedApplicantId}
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
        setSelectedApplicantId={setSelectedApplicantId}
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
        setSelectedApplicantId={setSelectedApplicantId}
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
        setSelectedApplicantId={setSelectedApplicantId}
        setSelectedEmployeeId={setSelectedEmployeeId}
        refreshDashboard={fetchCounts}
      />
    ),
  };

  const tabs = ['Attendance', 'Absent', 'Approved Leaves', 'Leave Requests', 'PPE Inventory'];

  const formatTimestamp = (d) => {
    const dateObj = new Date(d);
    return dateObj.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

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
          <div className="notifContainer" ref={notifRef}>
            <div className="notifIcon" onClick={() => setShowNotif(prev => !prev)}>
              <IoIosNotifications />
            </div>

            {showNotif && (
              <div className="notifDropdown">
                <div className="notifHeader">
                  Notifications
                </div>

                <div className="notifList">
                  {notifications.length === 0 ? (
                    <div className="notifItem empty">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        className="notifItem"
                        key={n.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNotif(n);
                          setConfirmOpen(true);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <div
                          style={{ fontWeight: n.read ? "normal" : "bold" }}
                        >
                          {n.text}
                        </div>
                        <div className="notifDate">{formatTimestamp(n.datetime)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="topCards">
        {[
          ['Attendance (Yesterday)', `${totalAttendance} / ${totalEmployees}`, <FaUserClock />],
          ['On Leave (Today)', String(totalApprovedLeaves), <FaClipboardCheck />],
          ['Leave Requests', String(totalLeaveRequests), <FaClipboardList />],
        ].map(([title, value, icon], idx) => (
          <div key={idx} className="dashboardCards">
          <div className="cardBody">
            {loading ? (
              <div className="cardLoader spinnerInline">
                <div className="spinner" />
              </div>
            ) : (
              <>
                <div className="cardIcon">{icon}</div>
                <div className="cardInfo">
                  <div className="cardTitle">{title}</div>
                  <CardValue value={value} />
                </div>
              </>
            )}
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
      <ConfirmModal
        open={confirmOpen}
        title="Approve Detail Request?"
        message={selectedNotif ? selectedNotif.text : ""}
        confirmLabel="Approve"
        cancelLabel="Cancel"
        onConfirm={async () => {
          await updateDetailRequestStatus(selectedNotif.id, "Approved");
          console.log("Approved:", selectedNotif);
          setConfirmOpen(false);
        }}
        onCancel={() => {
          console.log("Cancelled:", selectedNotif);
          setConfirmOpen(false);
        }}
      />\
    </div>
  );
};

export default Dashboard;
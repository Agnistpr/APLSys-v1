import React, { useState, useEffect, useMemo } from "react";
import { FiSearch } from "react-icons/fi";
import { FaSortAmountDownAlt, FaSortAmountUp } from "react-icons/fa";

const DashboardLeave = () => {
  const [leaveData, setLeaveData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("Approved");

  const itemsPerPage = 8;

  // Fetch leave data
  const fetchLeave = async () => {
    try {
      const result = await window.fileAPI.getLeave();
      setLeaveData(result || []);
    } catch {
      window.toast("Failed to load leave data.", "error");
    }
  };

  useEffect(() => {
    fetchLeave();
  }, []);

  // Filter + search
  const filtered = useMemo(() => {
    return leaveData.filter((item) => {
      const matchesTab =
        activeTab === "Approved"
          ? item.status === "Approved"
          : item.status !== "Approved";
      const matchesSearch =
        !searchTerm ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.position?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [leaveData, activeTab, searchTerm]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const valA = a[sortField]?.toString().toLowerCase() || "";
      const valB = b[sortField]?.toString().toLowerCase() || "";
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }, [filtered, sortField, sortOrder]);

  // Pagination
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);

  const toggleSort = (field) => {
    setSortField(field);
    setSortOrder((prev) =>
      sortField === field && prev === "asc" ? "desc" : "asc"
    );
  };

  // Add Leave handler
  const handleAddLeave = async (selectedEmployees, date, reason, duration) => {
    try {
      const result = await window.fileAPI.addLeave(
        selectedEmployees,
        date,
        reason,
        duration
      );
      if (result.success) {
        window.toast(
          `${activeTab === "Approved" ? "Leave added" : "Leave requested"} successfully.`,
          "success"
        );
        fetchLeave();
      } else {
        window.toast(result.message || "Error adding leave.", "error");
      }
    } catch {
      window.toast("Failed to add leave.", "error");
    }
  };

  return (
    <div className="pageContainer">
      <div className="pageHeader">
        <h2>Leave Management</h2>
        <div className="pageActions">
          <div className="tabs">
            {["Approved", "Others"].map((tab) => (
              <button
                key={tab}
                className={`tabBtn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="addBtn" onClick={() => setShowModal(true)}>
            {activeTab === "Approved" ? "Add Leave" : "Request Leave"}
          </button>
        </div>
      </div>

      <div className="tableHeader">
        <div className="searchBox">
          <FiSearch />
          <input
            type="text"
            placeholder="Search name or position..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="sortBtn" onClick={() => toggleSort("name")}>
          Sort by Name{" "}
          {sortOrder === "asc" ? <FaSortAmountUp /> : <FaSortAmountDownAlt />}
        </button>
      </div>

      <table className="mainTable">
        <thead>
          <tr>
            <th>Date</th>
            <th>Employee</th>
            <th>Position</th>
            <th>Reason</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan="5" className="noData">No records found.</td>
            </tr>
          ) : (
            paginated.map((row, idx) => (
              <tr key={idx}>
                <td>{row.start_date}</td>
                <td>{row.name}</td>
                <td>{row.position}</td>
                <td>{row.reason}</td>
                <td>{row.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="pagination">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
        >
          Prev
        </button>
        <span>
          Page {currentPage} / {totalPages || 1}
        </span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {/* ✅ Inline Add/Request Leave Modal */}
      {showModal && (
        <div
          className="modalOverlay"
          onClick={(e) => e.target.classList.contains("modalOverlay") && setShowModal(false)}
        >
          <div className="modalContainer">
            <div className="modalHeader">
              <h3>{activeTab === "Approved" ? "Add Leave" : "Request Leave"}</h3>
              <button className="closeBtn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <AddLeaveForm
              onConfirm={handleAddLeave}
              onClose={() => setShowModal(false)}
              type={activeTab}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// 🧩 Internal modal form component (inline)
const AddLeaveForm = ({ onConfirm, onClose, type }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [duration, setDuration] = useState(1);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const result = await window.fileAPI.getEmployees();
        setEmployees(result || []);
      } catch {
        window.toast("Error loading employees", "error");
      }
    };
    loadEmployees();
  }, []);

  const toggleEmployee = (id) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!startDate || !reason || selectedEmployees.length === 0) {
      window.toast("Please complete all fields.", "error");
      return;
    }
    onConfirm(selectedEmployees, startDate, reason, duration);
    onClose();
  };

  return (
    <div className="modalContent">
      <div className="formGroup">
        <label>Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="formGroup">
        <label>Duration (days)</label>
        <input
          type="number"
          min="1"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </div>

      <div className="formGroup">
        <label>Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for leave..."
        />
      </div>

      <div className="formGroup">
        <label>Select Employees</label>
        <div className="employeeList">
          {employees.length === 0 ? (
            <p>No employees found.</p>
          ) : (
            employees.map((emp) => (
              <label key={emp.employeeid} className="employeeOption">
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(emp.employeeid)}
                  onChange={() => toggleEmployee(emp.employeeid)}
                />
                {emp.fullname || `${emp.firstname} ${emp.lastname}`}
              </label>
            ))
          )}
        </div>
      </div>

      <div className="modalFooter">
        <button className="cancelBtn" onClick={onClose}>Cancel</button>
        <button className="confirmBtn" onClick={handleSubmit}>
          {type === "Approved" ? "Add" : "Request"}
        </button>
      </div>
    </div>
  );
};

export default DashboardLeave;
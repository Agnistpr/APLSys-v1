import React, { useEffect, useState, useMemo, useRef } from "react";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";
import Toast from "../components/Toast.jsx";
import DatePicker from "../components/DatePicker.jsx";

const DashboardLeave = ({ setActivePage, setSelectedEmployeeId, refreshDashboard, type }) => {
  const [onLeave, setOnLeave] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("fullName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [selectedDate, setSelectedDate] = useState(() => localStorage.getItem("leaveDate") || "");
  const [showAddModal, setShowAddModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [addLeaveDate, setAddLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveReason, setLeaveReason] = useState("");
  const [addLeaveDuration, setAddLeaveDuration] = useState(1);
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toasts, setToasts] = useState([]);
  const suggestionRef = useRef(null);

  const columns = ["fullName", "department", "position", "shift", "reason", "duration", "date"];
  const columnLabelMap = {
    fullName: "Name",
    department: "Department",
    position: "Position",
    shift: "Shift",
    reason: "Reason",
    duration: "Duration",
    date: "Date",
  };

  const addToast = (message, type) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchOnLeave = async () => {
    const data = await window.attendanceAPI.getLeave(selectedDate);
    const filtered =
      type === "Approved"
        ? data.filter((l) => l.status === "Approved")
        : data.filter((l) => ["Request", "Revoked", "Rejected"].includes(l.status));
    setOnLeave(filtered);
  };

  useEffect(() => {
    fetchOnLeave();
  }, [selectedDate, type]);

  const uniqueValues = useMemo(() => {
    const values = {
      department: new Set(),
      position: new Set(),
      shift: new Set(),
      // reason: new Set(),
      duration: new Set(),
    };

    onLeave.forEach((row) => {
      if (row.department) values.department.add(row.department);
      if (row.position) values.position.add(row.position);
      if (row.shift) values.shift.add(row.shift);
      // if (row.reason) values.reason.add(row.reason);
      if (row.Duration) values.duration.add(row.Duration);
    });

    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift),
      // reason: Array.from(values.reason),
      duration: Array.from(values.duration),
    };
  }, [onLeave]);

  // Filter, sort, paginate
  const filtered = useMemo(() => {
    return onLeave.filter((row) => {
      const matchesSearch = row.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === "__activeColumn") return true;
        return values.length === 0 || values.includes(row[column] || "");
      });
      return matchesSearch && matchesFilters;
    });
  }, [onLeave, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] ?? "";
      const bVal = b[sortColumn] ?? "";
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortColumn, sortOrder]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  const formatTime = (time) => {
    if (!time) return "";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour);
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  const openAddModal = async () => {
    const data = await window.employeeAPI.getEmployees();
    setEmployees(data);
    setSelectedEmployeeIds([]);
    setShowAddModal(true);
  };

  const handleConfirmAddLeave = async () => {
    if (!addLeaveDate || selectedEmployeeIds.length === 0) return;

    const formatLocalDate = (d) => {
      const date = d instanceof Date ? d : new Date(d);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
    };

    const existing = onLeave.filter(
      (l) => selectedEmployeeIds.includes(l.employeeid) && formatLocalDate(l.date) === addLeaveDate
    );

    const toAdd = selectedEmployeeIds.filter(
      (id) => !existing.some((l) => l.employeeid === id)
    );

    if (existing.length > 0) {
      addToast(
        `Leave already exists for:\n${existing.map((e) => e.fullName).join("\n")}`,
        "error"
      );
    }

    if (toAdd.length > 0) {
      try {
        const result = await window.attendanceAPI.addLeave(toAdd, addLeaveDate, leaveReason, addLeaveDuration,);
        if (!result.success) {
          addToast(`Error adding leave: ${result.error}`, "error");
          return;
        }
        await fetchOnLeave();
        refreshDashboard();
        addToast("Leave successfully added!", "success");
        setLeaveReason("");
        setShowAddModal(false);
      } catch (err) {
        addToast(`Error adding leave: ${err.message}`, "error");
      }
    }
  };

  const updateLeaveStatus = async (status) => {
    if (!showCheckboxes) {
      setShowCheckboxes(true);
      return;
    }
    if (selectedIds.length === 0) return;

    try {
      await window.attendanceAPI.updateLeaveStatus(selectedIds, status);
      setSelectedIds([]);
      setShowCheckboxes(false);
      fetchOnLeave();
      refreshDashboard();
      addToast(`Leaves ${status.toLowerCase()} successfully!`, "success");
    } catch (err) {
      addToast(`Error updating leaves: ${err.message}`, "error");
    }
  };

  useEffect(() => {
    if (!showAddModal) return;

    const handleClickOutside = (event) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAddModal]);

  return (
    <div className="tabSection">
      <div className="tabHeaderRow">
        <h2 className="tabTitle">
          {type === "Approved" ? "Approved Leaves" : "Leave Requests"}
        </h2>

        <div className="tabControls">
          <SortDropdown
            columns={columns}
            columnLabelMap={columnLabelMap}
            sortColumn={sortColumn}
            sortOrder={sortOrder}
            onSortChange={(col, order) => {
              setSortColumn(col);
              setSortOrder(order);
            }}
            dropdownOpen={dropdownOpen}
            setDropdownOpen={setDropdownOpen}
          />

          <FilterPanel
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            uniqueValues={uniqueValues}
            columnLabelMap={columnLabelMap}
          />

          <DatePicker
            value={selectedDate}
            onChange={(val) => {
              setSelectedDate(val);
              localStorage.setItem("leaveDate", val);
            }}
            storageKey="leaveDate"
          />

          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      <table className="tabTable">
        <thead>
          <tr>
            {showCheckboxes && <th></th>}
            <th>Name</th>
            <th>Department</th>
            <th>Position</th>
            <th>Shift</th>
            <th>Reason</th>
            <th>Duration</th>
            <th>Date</th>
            {type === "Request" && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={8}>No records found.</td>
            </tr>
          ) : (
            paginated.map((row) => (
              <tr
                key={row.leaveid}
                onClick={() => {
                  if (!showCheckboxes) {
                    setSelectedEmployeeId(row.employeeid);
                    setActivePage("EmployeeInformation");
                  }
                }}
              >
                {showCheckboxes && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.leaveid)}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          prev.includes(row.leaveid)
                            ? prev.filter((x) => x !== row.leaveid)
                            : [...prev, row.leaveid]
                        )
                      }
                    />
                  </td>
                )}
                <td>{row.fullName}</td>
                <td>{row.department}</td>
                <td>{row.position}</td>
                <td>
                  {formatTime(row.shift?.split(" - ")[0])} - {formatTime(row.shift?.split(" - ")[1])}
                </td>
                <td title={row.reason}>
                  {row.reason?.length > 20 ? row.reason.slice(0, 20) + "..." : row.reason}
                </td>
                <td>{row.Duration ? `${row.Duration} ${row.Duration > 1 ? "s" : ""}` : "-"}</td>
                <td>
                  {row.start_date && row.end_date
                    ? `${new Date(row.start_date).toISOString().split("T")[0]} - ${new Date(row.end_date).toISOString().split("T")[0]}`
                    : "-"}
                </td>
                {type === "Request" && <td>{row.status}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="tableFooter">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={onLeave.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />

        <div className="actions">
          <button className="actionBtn" onClick={openAddModal}>Add</button>

          {type === "Approved" && (
            <button className="actionBtn" onClick={() => updateLeaveStatus("Revoked")}>
              Revoke
            </button>
          )}

          {type === "Request" && (
            <>
              <button className="actionBtn" onClick={() => updateLeaveStatus("Approved")}>
                Approve
              </button>
              <button className="actionBtn" onClick={() => updateLeaveStatus("Rejected")}>
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      <Toast toasts={toasts} removeToast={removeToast} />

      {showAddModal && (
        <div
          className="modalOverlay"
          onClick={(e) => {
            if (e.target.classList.contains("modalOverlay")) setShowAddModal(false);
          }}
        >
          <div className="modalContent">
            <h3>Leave Request</h3>
            <hr className="modalDivider" />

            <label>Select Employee(s):</label>
            <div className="employeeSearchBox" ref={suggestionRef}>
              <input
                type="text"
                placeholder="Search employees by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="searchInput"
              />

              {searchTerm && (
                <ul className="suggestionList">
                  {employees
                    .filter((emp) =>
                      emp.name.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .slice(0, 8)
                    .map((emp) => (
                      <li
                        key={emp.employeeid}
                        className={`suggestionItem ${
                          selectedEmployeeIds.includes(emp.employeeid)
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedEmployeeIds((prev) =>
                            prev.includes(emp.employeeid)
                              ? prev.filter((id) => id !== emp.employeeid)
                              : [...prev, emp.employeeid]
                          )
                        }
                      >
                        <strong>{emp.name}</strong>
                        <span>{emp.department} • {emp.position}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {selectedEmployeeIds.length > 0 && (
              <div className="selectedEmployees">
                {employees
                  .filter((e) => selectedEmployeeIds.includes(e.employeeid))
                  .map((e) => (
                    <span key={e.employeeid} className="employeeTag">
                      {e.name}
                      <button
                        onClick={() =>
                          setSelectedEmployeeIds((prev) =>
                            prev.filter((id) => id !== e.employeeid)
                          )
                        }
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>
            )}

            <div className="leaveModalDateRow">
              <div>
                <label>Date:</label>
                <input
                  type="date"
                  value={addLeaveDate}
                  onChange={(e) => setAddLeaveDate(e.target.value)}
                />
              </div>
              <div>
                <label>Duration (days):</label>
                <input
                  type="number"
                  min="1"
                  value={addLeaveDuration}
                  onChange={(e) => setAddLeaveDuration(e.target.value)}
                />
              </div>
            </div>

            <div className="leaveModalReasonRow">
              <label>Reason:</label>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Enter reason for leave"
              />
            </div>

            <div className="modalActions">
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
              <button
                onClick={handleConfirmAddLeave}
                disabled={!addLeaveDate || selectedEmployeeIds.length === 0}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLeave;
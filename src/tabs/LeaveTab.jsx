import React, { useEffect, useState, useMemo, useRef } from "react";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";
import Toast from "../components/Toast.jsx";
import DatePicker from "../components/DatePicker.jsx";

const DashboardLeave = ({ setActivePage, setSelectedEmployeeId, refreshDashboard, status }) => {
  const [onLeave, setOnLeave] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("fullName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => localStorage.getItem("leaveDate") || "");
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [loading, setLoading] = useState(true);

  const [addSearchTerm, setAddSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [addLeaveDate, setAddLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveReason, setLeaveReason] = useState("");
  const [addLeaveDuration, setAddLeaveDuration] = useState(1);
  const [isPaidLeave, setIsPaidLeave] = useState(true);
  const [addLeaveEndDate, setAddLeaveEndDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate());
    return today.toISOString().split("T")[0];
  });
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toasts, setToasts] = useState([]);
  const suggestionRef = useRef(null);
  const [leaveType, setLeaveType] = useState("");

  const columns = [
    "fullName",
    "department",
    "position",
    "shift",
    "reason",
    "type",
    "isPaid",
    "duration",
    "date",
    "status"
  ];

  const columnLabelMap = {
    fullName: "Name",
    department: "Department",
    position: "Position",
    shift: "Shift",
    reason: "Reason",
    type: "Type",
    isPaid: "Paid Leave",
    duration: "Duration",
    date: "Date",
    status: "Status"
  };

  const addToast = (message, type) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const fetchOnLeave = async () => {
    setLoading(true);
    const data = await window.attendanceAPI.getLeave(selectedDate);
    const filtered =
      status === "Approved"
        ? data.filter((l) => l.status === "Approved")
        : data.filter((l) => ["Request", "Revoked", "Rejected"].includes(l.status));
    setOnLeave(filtered);
    setLoading(false);
  };

  useEffect(() => {
    fetchOnLeave();
  }, [selectedDate, status]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setAddSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!addLeaveDate || !addLeaveDuration) return;
    const start = new Date(addLeaveDate);
    const end = new Date(start);
    end.setDate(start.getDate() + Number(addLeaveDuration) - 1);
    setAddLeaveEndDate(end.toISOString().split("T")[0]);
  }, [addLeaveDate, addLeaveDuration]);

  useEffect(() => {
    if (!addLeaveDate || !addLeaveEndDate) return;
    const start = new Date(addLeaveDate);
    const end = new Date(addLeaveEndDate);
    const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
    if (diffDays !== Number(addLeaveDuration)) {
      setAddLeaveDuration(diffDays);
    }
  }, [addLeaveEndDate]);

  const uniqueValues = useMemo(() => {
    const values = {
      department: new Set(),
      position: new Set(),
      shift: new Set(),
      isPaid: new Set(),
      type: new Set(),
      duration: new Set(),
      status: new Set(),
    };

    onLeave.forEach((row) => {
      if (row.department) values.department.add(row.department);
      if (row.position) values.position.add(row.position);
      if (row.shift) values.shift.add(row.shift);
      if (row.isPaid) values.isPaid.add(row.isPaid);
      if (row.type) values.type.add(row.type);
      if (row.Duration) values.duration.add(row.Duration);
      if (row.status) values.status.add(row.status);
    });

    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift),
      isPaid: Array.from(values.isPaid),
      type: Array.from(values.type),
      duration: Array.from(values.duration),
      status: Array.from(values.status),
    };
  }, [onLeave]);

  const filtered = useMemo(() => {
    return onLeave.filter((row) => {
      const matchesSearch = row.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([col, vals]) => {
        return col === "__activeColumn" || !vals.length || vals.includes(row[col]);
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

  const openAddModal = async () => {
    const data = await window.employeeAPI.getEmployees();
    setEmployees(data);
    setSelectedEmployeeIds([]);
    setShowAddModal(true);
  };

  const handleConfirmAddLeave = async () => {
    if (!addLeaveDate || selectedEmployeeIds.length === 0) return;
    const existing = onLeave.filter(
      (l) => selectedEmployeeIds.includes(l.employeeid) && l.date === addLeaveDate
    );
    const toAdd = selectedEmployeeIds.filter(
      (id) => !existing.some((l) => l.employeeid === id)
    );
    if (existing.length > 0)
      addToast(`Leave already exists for:\n${existing.map((e) => e.fullName).join("\n")}`, "error");
    if (toAdd.length > 0) {
      try {
        const result = await window.attendanceAPI.addLeave(
          toAdd,
          addLeaveDate,
          leaveReason,
          addLeaveDuration,
          leaveType,
          isPaidLeave ? true : false,
          status
        );
        if (!result.success) {
          window.toast(`${result.message}`, `error`);
          return;
        }
        await fetchOnLeave();
        refreshDashboard();
        window.toast(`${result.message}`, "success");
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

  return (
    <div className="tabSection">
      <div className="tabHeaderRow">
        <h2 className="tabTitle">
          {status === "Approved" ? "Approved Leaves" : "Leave Requests"}
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

      <div className="tableContainer">
        <table className={`tabTable ${loading ? "skeleton" : ""}`}>
          <thead>
            <tr>
              {showCheckboxes && <th></th>}
              <th>Date</th>
              <th>Name</th>
              <th>Department</th>
              <th>Position</th>
              <th>Shift</th>
              <th>Paid Leave</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Duration</th>
              {status === "Request" && <th>Status</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: itemsPerPage }).map((_, idx) => (
                <tr key={idx} className="skeletonRow">
                  {columns.map((_, i) => (
                    <td key={i}>
                      <div className="shimmerCell" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={10}>No records found.</td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr
                  key={row.leaveid}
                  onDoubleClick={() => {
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
                  <td>
                    {row.start_date && row.end_date
                      ? `${new Date(row.start_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })} - ${new Date(row.end_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`
                      : "-"}
                  </td>                  
                  <td>{row.fullName}</td>
                  <td>{row.department}</td>
                  <td>{row.position}</td>
                  <td>{row.shift}</td>
                  <td>
                    <span
                      className={`statusBadge ${
                        row.isPaid ? "paid" : "unpaid"
                      }`}
                    >
                      {row.isPaid ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td>{row.type || "-"}</td>
                  <td title={row.reason}>
                    {row.reason?.length > 20 ? row.reason.slice(0, 20) + "..." : row.reason}
                  </td>
                  <td>
                    {row.Duration === "Expired"
                      ? "Expired"
                      : row.Duration
                      ? `${row.Duration} day${row.Duration > 1 ? "s" : ""}`
                      : "-"}
                  </td>
                  {status === "Request" && <td>{row.status}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
          {status === "Approved" && (
            <button className="actionBtn" onClick={() => updateLeaveStatus("Revoked")}>
              Revoke
            </button>
          )}
          {status === "Request" && (
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

      <Toast toasts={toasts} remockveToast={removeToast} />
      {showAddModal && (
        <div
          className="modalOverlay"
          onClick={(e) => {
            if (e.target.classList.contains("modalOverlay")) {
              setShowAddModal(false);
            }
          }}
        >
          <div className="modalContent">
            <h3>Leave Request</h3>
            <hr className="modalDivider" />

            <label>Select Employee(s):</label>
            <div className="employeeSearchBox" ref={suggestionRef}>
              <input
                type="text"
                value={addSearchTerm}
                onChange={(e) => {
                  setAddSearchTerm(e.target.value);
                }}
                className="searchInput"
              />

              {addSearchTerm && (
                <ul className="suggestionList">
                  {employees
                    .filter((emp) =>
                      emp.name.toLowerCase().includes(addSearchTerm.toLowerCase())
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
                        onClick={() => {
                          setSelectedEmployeeIds((prev) => {
                            const updated = prev.includes(emp.employeeid)
                              ? prev.filter((id) => id !== emp.employeeid)
                              : [...prev, emp.employeeid];
                            return updated;
                          });
                        }}
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
                        onClick={() => {
                          setSelectedEmployeeIds((prev) =>
                            prev.filter((id) => id !== e.employeeid)
                          );
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>
            )}

            <div className="leaveModalDateRow">
              <div>
                <label>Start Date:</label>
                <input
                  type="date"
                  value={addLeaveDate}
                  onChange={(e) => {
                    setAddLeaveDate(e.target.value);
                  }}
                />
              </div>

              <div>
                <label>End Date:</label>
                <input
                  type="date"
                  value={addLeaveEndDate}
                  onChange={(e) => {
                    setAddLeaveEndDate(e.target.value);
                  }}
                  min={addLeaveDate}
                />
              </div>

              <div>
                <label>Duration (days):</label>
                <input
                  type="number"
                  min="1"
                  value={addLeaveDuration}
                  onChange={(e) => {
                    setAddLeaveDuration(e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="leaveModalPaidRow">
              <label>
                <input
                  type="checkbox"
                  checked={isPaidLeave}
                  onChange={(e) => {
                    setIsPaidLeave(e.target.checked);
                  }}
                />
                Paid Leave
              </label>
            </div>

            <div className="leaveModalTypeRow">
              <label>Leave Type:</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="leaveTypeSelect"
              >
                <option value="">Select Type</option>
                <option value="Sick">Sick</option>
                <option value="Vacation">Vacation</option>
                <option value="Emergency">Emergency</option>
                <option value="Personal">Personal</option>
                <option value="Maternity">Maternity</option>
                <option value="Paternity">Paternity</option>
                <option value="Bereavement">Bereavement</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div className="leaveModalReasonRow">
              <label>Reason:</label>
              <textarea
                value={leaveReason}
                onChange={(e) => {
                  setLeaveReason(e.target.value);
                }}
                placeholder="Enter reason for leave"
              />
            </div>

            <div className="modalActions">
              <button
                onClick={() => {
                  setShowAddModal(false);
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleConfirmAddLeave();
                }}
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
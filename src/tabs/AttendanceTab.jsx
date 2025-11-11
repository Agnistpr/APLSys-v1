import React, { useEffect, useState, useMemo } from "react";
import ImportModal from "../components/Import.jsx";
import DatePicker from "../components/DatePicker.jsx";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};

const DashboardAttendance = ({ setActivePage, setSelectedEmployeeId, setSelectedApplicantId }) => {
  const [attendance, setAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("fullName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem("attendanceDate");
    return saved === null ? getYesterday() : saved;
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [loading, setLoading] = useState(true);

  const columns = [
    "date",
    "fullName",
    "role",
    "department",
    "position",
    "shift",
    "timeIn",
    "arrivalDiff",
    "arrivalStatus",
    "timeOut",
    "hoursWorked",
    "workStatus",
  ];

  const columnLabelMap = {
    date: "Date",
    fullName: "Name",
    role: "Role",
    department: "Department",
    position: "Position",
    shift: "Shift",
    timeIn: "Time In",
    arrivalDiff: "Arrival Diff",
    arrivalStatus: "Arrival Status",
    timeOut: "Time Out",
    hoursWorked: "Hours Worked",
    workStatus: "Work Status",
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      let data = [];
      if (selectedDate) {
        data = await window.attendanceAPI.getAttendance(selectedDate);
      } else {
        data = await window.attendanceAPI.getAttendance();
      }
      setAttendance(data || []);
      setLoading(false);
    };
    fetchAttendance();
  }, [selectedDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilters, selectedDate]);

  const uniqueValues = useMemo(() => {
    const values = { role: new Set(), department: new Set(), position: new Set(), shift: new Set(), arrivalStatus: new Set(), workStatus: new Set() };
    attendance.forEach((row) => {
      values.role.add(row.role);
      values.department.add(row.department);
      values.position.add(row.position);
      values.shift.add(row.shift);
      values.arrivalStatus.add(row.arrivalStatus);
      values.workStatus.add(row.workStatus);
    });
    return {
      role: Array.from(values.role),
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift),
      arrivalStatus: Array.from(values.arrivalStatus),
      workStatus: Array.from(values.workStatus),
    };
  }, [attendance]);

  const filtered = useMemo(() => {
    return attendance.filter((row) => {
      const matchesSearch = row.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([col, vals]) => {
        return col === "__activeColumn" || !vals.length || vals.includes(row[col]);
      });
      return matchesSearch && matchesFilters;
    });
  }, [attendance, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] ?? "";
      const bVal = b[sortColumn] ?? "";
      if (["arrivalDiff", "hoursWorked"].includes(sortColumn)) {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
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

  const colorForArrival = (status) => {
    if (status === "Late") return "red";
    if (status === "Early") return "green";
    return "black";
  };
  const colorForWork = (status) => {
    if (status === "Overtime") return "green";
    if (status === "Undertime") return "red";
    return "black";
  };
  
  return (
    <div className="tabSection">
      <div className="tabHeaderRow">
        <h2 className="tabTitle">Attendance</h2>

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
            onChange={setSelectedDate}
            storageKey="attendanceDate"
          />

          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      <div className="tableContainer">
        <table className={`tabTable ${loading ? "skeleton" : ""}`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{columnLabelMap[col]}</th>
              ))}
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
                <td colSpan={columns.length}>No records found.</td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
                <tr
                  key={idx}
                  onDoubleClick={() => {
                    switch (row.role) {
                      case "Employee":
                        setSelectedEmployeeId(row.profileid);
                        setActivePage("EmployeeInformation");
                        break;
                      case "Applicant":
                        setSelectedApplicantId(row.profileid);
                        // setPreviousPage(activePage);
                        setActivePage("ApplicantInformation");
                        break;
                      default:
                        console.log("Something went wrong.");
                    }
                  }}
                >
                  <td>
                    {row.date
                      ? new Date(row.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "-"}
                  </td>
                  <td>{row.fullName}</td>
                  <td>{row.role}</td>
                  <td>{row.department}</td>
                  <td>{row.position}</td>
                  <td>{row.shift}</td>
                  <td>{row.timeIn || "-"}</td>
                  <td style={{ color: colorForArrival(row.arrivalStatus) }}>
                    {row.arrivalDiff === 0 ? "-" : `${row.arrivalDiff > 0 ? "+" : ""}${row.arrivalDiff}`}
                  </td>
                  <td>{row.arrivalStatus}</td>
                  <td>{row.timeOut || "-"}</td>
                  <td style={{ color: colorForWork(row.workStatus) }}>
                    {row.hoursWorked || "-"}
                  </td>
                  <td>{row.workStatus}</td>
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
          totalItems={attendance.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          onImport={() => setShowImportModal(true)}
          onExport={() => window.exportAPI.exportAttendance()}
        />
        <div className="actions">
          <button className="exportBtn" onClick={() => setShowImportModal(true)}>
            Import
          </button>
          <button className="exportBtn" onClick={() => window.exportAPI.exportAttendance()}>
            Export
          </button>
        </div>
      </div>

      <ImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={async (rows) => {
          try {
            const result = await window.utilityAPI.importAttendance(rows);
            // window.toast("Attendance imported successfully!", "success");
            setSelectedDate(selectedDate);
          } catch (err) {
            console.error("Import failed:", err);
            window.toast("❌ Import failed", "error");
          } finally {
            setShowImportModal(false);
          }
        }}
      />
    </div>
  );
};

export default DashboardAttendance;
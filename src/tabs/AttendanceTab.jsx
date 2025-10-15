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

const DashboardAttendance = ({ setActivePage, setSelectedEmployeeId }) => {
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

  const columns = ["fullName", "position", "shift", "timeIn", "timeOut", "status", "diffValue"];
  const columnLabelMap = {
    fullName: "Name",
    position: "Position",
    shift: "Shift",
    timeIn: "Time In",
    timeOut: "Time Out",
    status: "Status",
    diffValue: "UT/OT",
  };

  const calculateMinutes = (start, end) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(":").map(Number);
    const [h2, m2] = end.split(":").map(Number);
    return h2 * 60 + m2 - (h1 * 60 + m1);
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      const data = selectedDate
        ? await window.fileAPI.getAttendanceByDate(selectedDate)
        : await window.fileAPI.getAttendance();

      const formatted = data.map((row) => {
        const [shiftStart = '', shiftEnd = ''] = row.shift?.split(' - ') || [];
        const expected = calculateMinutes(shiftStart, shiftEnd);
        const actual = calculateMinutes(row.timeIn, row.timeOut);
        const diff = actual - expected;
        return {
          ...row,
          utot: `${Math.abs(diff)} min(s)`,
          status: diff < 0 ? 'Undertime' : 'On time / Overtime',
          diffValue: diff
        };
      });

      setAttendance(formatted);
    };

    fetchAttendance();
  }, [selectedDate]);

  const formatTime = (time) => {
    if (!time) return "";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour);
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  const uniqueValues = useMemo(() => {
    const values = { position: new Set(), status: new Set() };
    attendance.forEach((row) => {
      values.position.add(row.position);
      values.status.add(row.status);
    });
    return {
      position: Array.from(values.position),
      status: Array.from(values.status),
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
      if (sortColumn === "diffValue") return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
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

      <table className="tabTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Position</th>
            <th>Shift</th>
            <th>Time-in</th>
            <th>Time-out</th>
            <th>UT/OT</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={7}>No records found.</td>
            </tr>
          ) : (
            paginated.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => {
                  setSelectedEmployeeId(row.employeeid);
                  setActivePage("EmployeeInformation");
                }}
              >
                <td>{row.fullName}</td>
                <td>{row.position}</td>
                <td>
                  {formatTime(row.shift?.split(" - ")[0])} -{" "}
                  {formatTime(row.shift?.split(" - ")[1])}
                </td>
                <td>{formatTime(row.timeIn)}</td>
                <td>{formatTime(row.timeOut)}</td>
                <td style={{ color: row.diffValue < 0 ? "red" : "green" }}>{row.utot}</td>
                <td>{row.status}</td>
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
          totalItems={attendance.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          onImport={() => setShowImportModal(true)}
          onExport={() => window.fileAPI.exportAttendance()}
        />
        <div className="actions">
          <button className="exportBtn" onClick={() => setShowImportModal(true)}>
            Import
          </button>
          <button className="exportBtn" onClick={() => window.fileAPI.exportAttendance()}>
            Export
          </button>
        </div>
      </div>

      <ImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={async () => {
          setShowImportModal(false);
          const data = await window.fileAPI.getAttendanceByDate(selectedDate);
          const formatted = data.map((row) => {
            const [shiftStart = "", shiftEnd = ""] = row.shift?.split(" - ") || [];
            const expected = calculateMinutes(shiftStart, shiftEnd);
            const actual = calculateMinutes(row.timeIn, row.timeOut);
            const diff = actual - expected;
            return {
              ...row,
              utot: `${Math.abs(diff)} min(s)`,
              status: diff < 0 ? "Undertime" : "On time / Overtime",
              diffValue: diff,
            };
          });
          setAttendance(formatted);
        }}
      />
    </div>
  );
};

export default DashboardAttendance;
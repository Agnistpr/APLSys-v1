import React, { useEffect, useState, useMemo } from "react";
import DatePicker from "../components/DatePicker.jsx";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";

const DashboardAbsence = ({ setActivePage, setSelectedEmployeeId }) => {
  const [absence, setAbsence] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("fullName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem("absenceDate") || new Date().toISOString().split("T")[0];
  });
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const columns = ["fullName", "department", "position", "shift"];
  const columnLabelMap = {
    fullName: "Name",
    department: "Department",
    position: "Position",
    shift: "Shift",
  };

  useEffect(() => {
    const fetchAbsences = async () => {
      const data = await window.attendanceAPI.getAbsent(selectedDate);
      setAbsence(data);
    };
    fetchAbsences();
  }, [selectedDate]);

  const formatTime = (time) => {
    if (!time) return "";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  const uniqueValues = useMemo(() => {
    const values = { department: new Set(), position: new Set(), shift: new Set() };
    absence.forEach((row) => {
      const [start, end] = row.shift?.split(" - ") || [];
      const shiftDisplay = start && end ? `${formatTime(start)} - ${formatTime(end)}` : "";
      values.department.add(row.department || "");
      values.position.add(row.position || "");
      values.shift.add(shiftDisplay);
    });
    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift),
    };
  }, [absence]);

  const filtered = useMemo(() => {
    return absence.filter((row) => {
      const matchesSearch = row.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([col, vals]) => {
        return col === "__activeColumn" || !vals.length || vals.includes(row[col] || "");
      });
      return matchesSearch && matchesFilters;
    });
  }, [absence, searchTerm, selectedFilters]);

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

  return (
    <div className="tabSection">
      {/* --- Header Section --- */}
      <div className="tabHeaderRow">
        <h2 className="tabTitle">Absent</h2>

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
            storageKey="absenceDate"
          />

          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      <div className="tableContainer">
        <table className="tabTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Position</th>
              <th>Shift</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={4}>No records found.</td>
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
                  <td>{row.department}</td>
                  <td>{row.position}</td>
                  <td>
                    {formatTime(row.shift?.split(" - ")[0])} -{" "}
                    {formatTime(row.shift?.split(" - ")[1])}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- Footer / Pagination --- */}
      <div className="tableFooter">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={absence.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          onExport={() => window.exportAPI.exportAbsence(selectedDate)}
        />

        <div className="actions">
          <button
            className="exportBtn"
            onClick={() => window.exportAPI.exportAbsence(selectedDate)}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardAbsence;
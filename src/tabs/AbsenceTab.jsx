import React, { useEffect, useState, useMemo } from "react";
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

const DashboardAbsence = ({ uid, setActivePage, setSelectedEmployeeId }) => {
  const [absence, setAbsence] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("fullName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem("absenceDate");
    return saved === null ? getYesterday() : saved;
  });
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [loading, setLoading] = useState(true);

  const columns = ["date", "fullName", "role", "department", "position", "shift"];
  const columnLabelMap = {
    date: "Date",
    fullName: "Name",
    role: "Role",
    department: "Department",
    position: "Position",
    shift: "Shift",
  };

  useEffect(() => {
    const fetchAbsences = async () => {
      setLoading(true);
      let data = [];
      if (selectedDate) {
        data = await window.attendanceAPI.getAbsent(selectedDate);
      } else {
        data = await window.attendanceAPI.getAbsent();
      }
      setAbsence(data || []);
      setLoading(false);
    };
    fetchAbsences();
  }, [selectedDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilters, selectedDate]);

  const uniqueValues = useMemo(() => {
    const values = { role: new Set(), department: new Set(), position: new Set(), shift: new Set() };
    absence.forEach((row) => {
      values.role.add(row.role);
      values.department.add(row.department);
      values.position.add(row.position);
      values.shift.add(row.shift);
    });
    return {
      role: Array.from(values.role),
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift),
    };
  }, [absence]);

  const filtered = useMemo(() => {
    return absence.filter((row) => {
      const matchesSearch = row.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([col, vals]) => {
        return col === "__activeColumn" || !vals.length || vals.includes(row[col]);
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
      <div className="tabHeaderRow">
        <h2 className="tabTitle">Absence</h2>

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
                    uid,
                    setSelectedEmployeeId(row.employeeid);
                    setActivePage("EmployeeInformation");
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
                  <td>{row.shift || "-"}</td>
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
          totalItems={absence.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />

        <div className="actions">
          <button
            className="exportBtn"
            onClick={async () => {
              try {
                const result = await window.exportAPI.exportAbsence(selectedDate);
                console.log(uid);
                if (result.success) {
                  await window.userAPI.logAction(uid, "exported a copy of Absent records");
                  window.toast("Absence exported successfully!", "success");
                } else {
                  window.toast(result.message || "Export failed", "error");
                }
              } catch (err) {
                console.error("Export error:", err);
                window.toast("An error occurred during export", "error");
              }
            }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardAbsence;
import React, { useEffect, useState, useMemo } from "react";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";
import SkeletonLoader from "../components/SkeletonLoader.jsx";

const Employee = ({ setActivePage, setSelectedEmployeeId, setPreviousPage, activePage }) => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("employeeid");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);

  const columns = [
    "employeeid",
    "name",
    "department",
    "position",
    "shift",
    "leavecredit",
  ];

  const columnLabelMap = {
    employeeid: "ID",
    name: "Name",
    department: "Department",
    position: "Position",
    shift: "Shift",
    leavecredit: "Leave Credit",
  };

  const formatTime = (time) => {
    if (!time) return "";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  // 🧭 Fetch employee list
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      const data = await window.employeeAPI.getEmployees();
      setEmployees(data || []);
      setLoading(false);
    };
    fetchEmployees();
  }, []);

  // 🧠 Unique values for filters
  const uniqueValues = useMemo(() => {
    const values = { department: new Set(), position: new Set(), shift: new Set() };

    employees.forEach((row) => {
      if (row.department) values.department.add(row.department);
      if (row.position) values.position.add(row.position);
      if (row.shift) {
        const parts = row.shift.split(" - ");
        const formatted = `${formatTime(parts[0])} - ${formatTime(parts[1])}`;
        values.shift.add(formatted);
      }
    });

    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift),
    };
  }, [employees]);

  // 🔍 Filter + search logic
  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([col, vals]) => {
        return col === "__activeColumn" || !vals.length || vals.includes(emp[col]);
      });
      return matchesSearch && matchesFilters;
    });
  }, [employees, searchTerm, selectedFilters]);

  // ↕️ Sort logic
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortColumn] ?? "";
      let bVal = b[sortColumn] ?? "";

      if (sortColumn === "leavecredit") {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortColumn, sortOrder]);

  // 📄 Pagination logic
  const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  return (
    <div className="employeeContainer">
      <div className="employeeHeaderRow">
        <div className="employeeHeader">
          <h1>Employees</h1>
          <button
            className="exportBtn"
            onClick={() => window.exportAPI.exportEmployees()}
          >
            Export All
          </button>
        </div>

        <div className="employeeControls">
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

          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name..."
          />
        </div>
      </div>

      <table className={`employeeTable ${loading ? "skeleton" : ""}`}>
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
                <td colSpan={columns.length}>No employees found.</td>
              </tr>
            ) : (
              paginated.map((emp) => (
                <tr
                  key={emp.employeeid}
                  onDoubleClick={() => {
                    setSelectedEmployeeId(emp.employeeid);
                    setPreviousPage(activePage);
                    setActivePage("EmployeeInformation");
                  }}
                >
                  {columns.map((col) => {
                    if (col === "shift") {
                      const shiftStr = emp.shift || "";
                      const [start, end] = shiftStr.split(" - ");
                      return (
                        <td key={col}>
                          {formatTime(start)} - {formatTime(end)}
                        </td>
                      );
                    }
                    return <td key={col}>{emp[col] || "N/A"}</td>;
                  })}
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
          totalItems={employees.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          onExport={() => window.exportAPI.exportEmployees()}
        />
      </div>
    </div>
  );
};

export default Employee;
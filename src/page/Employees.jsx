import React, { useEffect, useState, useRef, useMemo } from 'react';
import { FiSearch } from 'react-icons/fi';
import { MdClear } from 'react-icons/md';
import { FaSortAmountDownAlt, FaSortAmountUp, FaFilter } from 'react-icons/fa';

const Employee = ({ setActivePage, setSelectedEmployeeId, setPreviousPage, activePage }) => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [sortColumn, setSortColumn] = useState('employeeid');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const filterRef = useRef(null);
  const sortRef = useRef(null);

  const columns = [
    'employeeid',
    'name',
    'department',
    'position',
    'shift',
    'leavecredit',
  ];

  const columnLabelMap = {
    employeeid: 'ID',
    name: 'Name',
    department: 'Department',
    position: 'Position',
    shift: 'Shift',
    leavecredit: 'Leave Credit',
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  useEffect(() => {
    fetchAllEmployees();

    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
        setFilterColumn('');
      }
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAllEmployees = async () => {
    const data = await window.fileAPI.getEmployees();
    setEmployees(data);
    setCurrentPage(1);
  };

  const handleFilterChange = (col, value) => {
    setFilterValues((prev) => {
      const newValues = { ...prev };
      if (!newValues[col]) newValues[col] = [];
      if (newValues[col].includes(value)) {
        newValues[col] = newValues[col].filter((v) => v !== value);
      } else {
        newValues[col].push(value);
      }
      if (newValues[col].length === 0) delete newValues[col];
      setCurrentPage(1);
      return newValues;
    });
  };

  // const clearFilters = () => {
  //   setFilterValues({});
  //   setFilterColumn('');
  //   setCurrentPage(1);
  // };

  const handleFilterColumnClick = (col) => {
    setFilterColumn((prev) => (prev === col ? '' : col));
  };

  const uniqueValues = useMemo(() => {
    const values = { department: new Set(), position: new Set(), shift: new Set() };

    employees.forEach(row => {
      if (row.department) values.department.add(row.department);
      if (row.position) values.position.add(row.position);
      if (row.shift) {
        const parts = row.shift.split(' - ');
        const formattedShift = `${formatTime(parts[0])} - ${formatTime(parts[1])}`;
        values.shift.add(formattedShift);
      }
    });

    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift)
    };
  }, [employees]);

  const clearFilters = () => {
    setSelectedFilters({});
  };

  const filteredBySearch = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const lower = searchTerm.toLowerCase();
    return employees.filter((emp) => (emp.name ?? '').toLowerCase().includes(lower));
  }, [employees, searchTerm]);

  const filteredEmployees = useMemo(() => {
    if (Object.keys(filterValues).length === 0) return filteredBySearch;

    return filteredBySearch.filter((emp) =>
      Object.entries(filterValues).every(([col, values]) =>
        values.includes(emp[col] || 'N/A')
      )
    );
  }, [filteredBySearch, filterValues]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      let aVal = a[sortColumn] ?? '';
      let bVal = b[sortColumn] ?? '';

      if (sortColumn === 'leavecredit') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEmployees, sortColumn, sortOrder]);

  const totalPages = Math.ceil(sortedEmployees.length / itemsPerPage) || 1;

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedEmployees.slice(start, start + itemsPerPage);
  }, [sortedEmployees, currentPage, itemsPerPage]);

  return (
    <div className="employeeContainer">
      <div className="employeeHeaderRow">
        <div className="employeeHeader">
          <h1>Employees</h1>
          <button className="exportBtn" onClick={() => window.fileAPI.exportEmployees()}>
            Export All
          </button>
        </div>

        <div className="employeeControls">
          <div className="sortContainer" ref={sortRef}>
            <div
              className="sortIcon"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            >
              {sortOrder === 'asc' ? <FaSortAmountDownAlt /> : <FaSortAmountUp />}
            </div>
            <div className="sortText" onClick={() => setDropdownOpen((prev) => !prev)}>
              Sort: {columnLabelMap[sortColumn] || sortColumn}
            </div>
            {dropdownOpen && (
              <div className="sortDropdown">
                {columns.map((col) => (
                  <div
                    key={col}
                    className="dropdownItem"
                    onClick={() => {
                      setSortColumn(col);
                      setDropdownOpen(false);
                    }}
                  >
                    {columnLabelMap[col] || col}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="filterContainer" ref={filterRef}>
            <button className="filterBtn" onClick={() => setFilterOpen((prev) => !prev)}>
              <FaFilter />
            </button>

            {filterOpen && (
              <div className="filterDropdown">
                <div className="filterHeader">
                  <strong>Filter by</strong>
                  <button className="clearFilterBtn" onClick={clearFilters}>
                    Clear
                  </button>
                </div>
                <div className="filterColumns">
                  {Object.keys(uniqueValues).map((col) => (
                    <div
                      key={col}
                      className={`filterColumnName ${filterColumn === col ? 'activeColumn' : ''}`}
                      onClick={() => handleFilterColumnClick(col)}
                    >
                      {columnLabelMap[col] || col}
                      <span className="chevronIcon">&gt;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filterOpen && filterColumn && (
              <div className="filterValuesPanel">
                <div className="filterValuesHeader">{columnLabelMap[filterColumn] || filterColumn}</div>
                <div className="filterValuesList">
                  {uniqueValues[filterColumn]?.map((val) => (
                    <label key={val} className="filterValueItem">
                      <input
                        type="checkbox"
                        checked={filterValues[filterColumn]?.includes(val) || false}
                        onChange={() => handleFilterChange(filterColumn, val)}
                      />
                      {val}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="searchContainer">
            <input
              type="text"
              placeholder="Search by name..."
              className="searchBar"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <button className="searchIconBtn" aria-hidden="true">
              <FiSearch />
            </button>
            {searchTerm && (
              <button className="clearSearchBtn" onClick={() => setSearchTerm('')}>
                <MdClear />
              </button>
            )}
          </div>
        </div>
      </div>

      <table className="employeeTable">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{columnLabelMap[col] || col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedEmployees.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No employees found.</td>
            </tr>
          ) : (
            paginatedEmployees.map((emp) => (
              <tr
                key={emp.employeeid}
                onClick={() => {
                  setSelectedEmployeeId(emp.employeeid);
                  setPreviousPage(activePage);
                  setActivePage('EmployeeInformation');
                  
                }}
              >
                {columns.map((col) => {
                  if (col === 'shift') {
                    const shiftStr = emp.shift || '';
                    const [start, end] = shiftStr.split(' - ');
                    return (
                      <td key={col}>
                        {formatTime(start)} - {formatTime(end)}
                      </td>
                    );
                  }
                  return <td key={col}>{emp[col] || 'N/A'}</td>;
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="tableFooter">
        <div className="paginationItems">
          <label>Items: </label>
          <select
            value={itemsPerPage === employees.length ? 'all' : itemsPerPage}
            onChange={(e) => {
              const val = e.target.value;
              setItemsPerPage(val === 'all' ? employees.length : Number(val));
              setCurrentPage(1);
            }}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            <option value="all">All</option>
          </select>
        </div>

        <div className="paginationPage">
          <button
            className="paginationBtn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            &lt;
          </button>

          {(() => {
            if (totalPages === 0) return null;

            const pages = [];

            if (totalPages <= 3) {
              for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
              }
            } else {
              if (currentPage <= 2) {
                pages.push(1, 2, 'ellipsis', totalPages);
              } else if (currentPage >= totalPages - 1) {
                pages.push(1, 'ellipsis', totalPages - 1, totalPages);
              } else {
                pages.push(1, currentPage, 'ellipsis', totalPages);
              }
            }

            return pages.map((page, idx) => {
              if (page === 'ellipsis') {
                if (showJumpInput) {
                  return (
                    <input
                      key="jumpInput"
                      className="paginationJumpInput"
                      type="number"
                      min={1}
                      max={totalPages}
                      autoFocus
                      value={jumpPage}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (/^\d+$/.test(val) && Number(val) <= totalPages)) {
                          setJumpPage(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const pageNum = Number(jumpPage);
                          if (pageNum >= 1 && pageNum <= totalPages) {
                            setCurrentPage(pageNum);
                            setShowJumpInput(false);
                            setJumpPage('');
                          }
                        } else if (e.key === 'Escape') {
                          setShowJumpInput(false);
                          setJumpPage('');
                        }
                      }}
                      onBlur={() => {
                        setShowJumpInput(false);
                        setJumpPage('');
                      }}
                      placeholder="Page #"
                    />
                  );
                } else {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="paginationEllipsis"
                      onClick={() => setShowJumpInput(true)}
                      title="Jump to page"
                    >
                      {jumpPage !== '' ? jumpPage : '...'}
                    </span>
                  );
                }
              } else {
                return (
                  <button
                    key={page}
                    className={`paginationBtn ${currentPage === page ? 'currentPage' : ''}`}
                    onClick={() => setCurrentPage(page)}
                    disabled={currentPage === page}
                  >
                    {page}
                  </button>
                );
              }
            });
          })()}

          <button
            className="paginationBtn"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            &gt;
          </button>
        </div>

        <div>
        </div>
      </div>
    </div>
  );
};

export default Employee;
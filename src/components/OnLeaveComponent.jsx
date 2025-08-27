import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { MdClear } from 'react-icons/md';
import { FaSortAmountDownAlt, FaSortAmountUp, FaFilter } from 'react-icons/fa';

const DashboardLeave = ({ setActivePage, setSelectedEmployeeId, refreshDashboard }) => {
  const [onLeave, setOnLeave] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('fullName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem('leaveDate') || new Date().toISOString().split('T')[0];
  });

  //ref
  const sortRef = useRef(null);
  const filterRef = useRef(null);

  // footer
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [addLeaveDate, setAddLeaveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [leaveReason, setLeaveReason] = useState('');

  const [toasts, setToasts] = useState([]); 

  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const [modalItemsPerPage, setModalItemsPerPage] = useState(5);
  const [showJumpInputModal, setShowJumpInputModal] = useState(false);
  const [jumpPageModal, setJumpPageModal] = useState('');

  const modalTotalPages = Math.ceil(employees.length / modalItemsPerPage) || 1;
  const modalPaginated = useMemo(() => {
    const start = (modalCurrentPage - 1) * modalItemsPerPage;
    return employees.slice(start, start + modalItemsPerPage);
  }, [employees, modalCurrentPage, modalItemsPerPage]);

  const columns = ['fullName', 'department', 'position', 'shift', 'reason', 'date'];
  const columnLabelMap = {
    fullName: 'Name',
    department: 'Department',
    position: 'Position',
    shift: 'Shift',
    reason: 'Reason',
    date: 'Date',
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addToast = (message, type) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id) => {
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, closing: true } : t))
    );
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const fetchOnLeave = async () => {
      const data = await window.fileAPI.getLeave(selectedDate);
      setOnLeave(data);
    };
    fetchOnLeave();
  }, [selectedDate]);

  const uniqueValues = useMemo(() => {
    const values = {
      department: new Set(),
      position: new Set(),
      shift: new Set(),
    };
    onLeave.forEach(row => {
      values.department.add(row.department || '');
      values.position.add(row.position || '');
      values.shift.add(row.shift || '');
    });
    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift),
    };
  }, [onLeave]);

  const clearFilters = () => {
    setSelectedFilters({});
  };

  const toggleFilterValue = (column, value) => {
    setSelectedFilters(prev => {
      const colValues = prev[column] || [];
      const updated = colValues.includes(value)
        ? colValues.filter(v => v !== value)
        : [...colValues, value];
      return {
        ...prev,
        [column]: updated,
        __activeColumn: column
      };
    });
  };

  const filtered = useMemo(() => {
    return onLeave.filter(row => {
      const matchesSearch = row.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === '__activeColumn') return true;
        return values.length === 0 || values.includes(row[column] || '');
      });
      return matchesSearch && matchesFilters;
    });
  }, [onLeave, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';
      return sortOrder === 'asc'
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
    if (!time) return '';
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  const openAddModal = async () => {
    const data = await window.fileAPI.getEmployees();
    setEmployees(data);
    setSelectedEmployeeIds([]);
    setShowAddModal(true);
  };

  const toggleEmployeeSelection = (id) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
    );
  };

  const handleConfirmAddLeave = async () => {
    if (!addLeaveDate || selectedEmployeeIds.length === 0) return;

    const formatLocalDate = (d) => {
      const date = d instanceof Date ? d : new Date(d);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    };

    const existing = onLeave.filter(
      (l) => selectedEmployeeIds.includes(l.employeeid) && formatLocalDate(l.date) === addLeaveDate
    );

    const toAdd = selectedEmployeeIds.filter(
      (id) => !existing.some((l) => l.employeeid === id)
    );

    if (existing.length > 0) {
      addToast(
        `Leave already exists for:\n${existing.map((e) => e.fullName).join('\n')}`,
        'error'
      );
    }

    if (toAdd.length > 0) {
      try {
        const result = await window.fileAPI.addLeave(toAdd, addLeaveDate, leaveReason);

        if (!result.success) {
          addToast(`Error adding leave: ${result.error}`, "error");
          return;
        }

        const updated = await window.fileAPI.getLeave(selectedDate);
        refreshDashboard();
        setOnLeave(updated);

        const addedNames = toAdd
          .map((id) => updated.find((e) => e.employeeid === id)?.fullName || id)
          .join(", "); // 👈 changed \n to ", " so it's cleaner in useraction

        // Build log parts
        const mainDesc = `(${addedNames}) on ${addLeaveDate}`;
        const note = leaveReason ? `Reason: ${leaveReason}` : "";

        // Log with correct separation
        await window.fileAPI.logAction(
          1, // replace with real userid
          `added leave for ${mainDesc}`, // 👈 goes into useraction
          note // 👈 only reason goes into description
        );

        addToast(`Leave successfully added for:\n${addedNames}`, "success");
        setLeaveReason("");
      } catch (err) {
        addToast(`Error adding leave: ${err.message}`, "error");
      }
    }
  };


  const toggleCheckboxes = () => {
    setShowCheckboxes(!showCheckboxes);
    setSelectedIds([]);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="tabSection">
      <div className="tabHeaderRow">
        <h2 className="tabTitle">On Leave</h2>

        <div className="tabControls">
          <div className="sortContainer" ref={sortRef}>
            <div className="sortIcon" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
              {sortOrder === 'asc' ? <FaSortAmountDownAlt /> : <FaSortAmountUp />}
            </div>
            <div className="sortText" onClick={() => setDropdownOpen(prev => !prev)}>
              Sort: {columnLabelMap[sortColumn]}
            </div>
            {dropdownOpen && (
              <div className="tabSortOptions">
                {columns.map((col) => (
                  <div
                    key={col}
                    onClick={() => {
                      setSortColumn(col);
                      setDropdownOpen(false);
                    }}
                  >
                    {columnLabelMap[col]}
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
                  <button className="clearFilterBtn" onClick={clearFilters}>Clear</button>
                </div>
                <div className="filterColumns">
                  {['department', 'position', 'shift'].map((col) => (
                    <div
                      key={col}
                      className={`filterColumnName ${selectedFilters[col] ? 'activeColumn' : ''}`}
                      onClick={() => {
                        setSelectedFilters((prev) => ({
                          ...prev,
                          __activeColumn: prev.__activeColumn === col ? null : col
                        }));
                      }}
                    >
                      {columnLabelMap[col]}
                      <span className="chevronIcon">&gt;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filterOpen && selectedFilters.__activeColumn && (
              <div className="filterValuesPanel">
                <div className="filterValuesHeader">
                  {columnLabelMap[selectedFilters.__activeColumn]}
                </div>
                <div className="filterValuesList">
                  {uniqueValues[selectedFilters.__activeColumn]?.map((val) => (
                    <label key={val} className="filterValueItem">
                      <input
                        type="checkbox"
                        checked={selectedFilters[selectedFilters.__activeColumn]?.includes(val) || false}
                        onChange={() => toggleFilterValue(selectedFilters.__activeColumn, val)}
                      />
                      {val || '—'}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="calendarContainer">
            <input
              type="date"
              value={selectedDate}
              isClearable={false}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDate(val);
                localStorage.setItem('leaveDate', val);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="tabSearchContainer">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="searchIconBtn"><FiSearch /></span>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}>
                <MdClear />
              </button>
            )}
          </div>
        </div>
      </div>

      <table className="tabTable">
        <thead>
          <tr>
            {showCheckboxes && (
              <th>
                <input
                  type="checkbox"
                  checked={selectedIds.length === paginated.length && paginated.length > 0}
                  onChange={() => {
                    if (selectedIds.length === paginated.length) {
                      setSelectedIds([]);
                    } else {
                      setSelectedIds(paginated.map((row) => row.leaveid));
                    }
                  }}
                />
              </th>
            )}
            <th>Name</th>
            <th>Department</th>
            <th>Position</th>
            <th>Shift</th>
            <th>Reason</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={showCheckboxes ? 7 : 6}>No records found.</td>
            </tr>
          ) : (
            paginated.map((row, idx) => (
              <tr
                key={idx}
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
                      onChange={() => toggleSelect(row.leaveid)}
                    />
                  </td>
                )}
                <td>{row.fullName}</td>
                <td>{row.department}</td>
                <td>{row.position}</td>
                <td>{formatTime(row.shift?.split(' - ')[0])} - {formatTime(row.shift?.split(' - ')[1])}</td>
                <td title={row.reason}>
                  {row.reason?.length > 20 ? row.reason.slice(0, 20) + "..." : row.reason}
                </td>
                <td>{row.date ? new Date(row.date).toISOString().split("T")[0] : ""}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="tableFooter">
        <div className="paginationItems">
          <label>Items: </label>
          <select
            value={itemsPerPage === onLeave.length ? 'all' : itemsPerPage}
            onChange={(e) => {
              const val = e.target.value;
              setItemsPerPage(val === 'all' ? onLeave.length : Number(val));
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
          <button className="addBtn" onClick={openAddModal}>+ Add</button>
          {/* <button className="addBtn" onClick={toggleCheckboxes}>
            {showCheckboxes ? "Untoggle Delete" : "Toggle Delete"}
          </button> */}
        </div>
      </div>

        {showAddModal && (
          <div
            className="modalOverlay"
            onClick={(e) => {
              if (e.target.classList.contains('modalOverlay')) {
                setShowAddModal(false);
              }
            }}
          >
            <div className="modalContent">
              <h3>Leave Request Window</h3>
              <hr className="modalDivider" />
              <label>Select Employee(s): </label> <br />
              <table className="tabTable">
                <thead>
                  <tr>
                    <th></th>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {modalPaginated.length === 0 ? (
                    <tr><td colSpan={4}>No employees found.</td></tr>
                  ) : (
                    modalPaginated.map(emp => (
                      <tr key={emp.employeeid}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.includes(emp.employeeid)}
                            onChange={() => toggleEmployeeSelection(emp.employeeid)}
                          />
                        </td>
                        <td>{emp.employeeid}</td>
                        <td>{emp.name}</td>
                        <td>{emp.department}</td>
                        <td>{emp.position}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="tableFooter">
                <div className="paginationItems">
                  <label>Items: </label>
                  <select
                    value={modalItemsPerPage === employees.length ? 'all' : modalItemsPerPage}
                    onChange={(e) => {
                      const val = e.target.value;
                      setModalItemsPerPage(val === 'all' ? employees.length : Number(val));
                      setModalCurrentPage(1);
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
                    disabled={modalCurrentPage === 1}
                    onClick={() => setModalCurrentPage(modalCurrentPage - 1)}
                  >
                    &lt;
                  </button>

                  {(() => {
                    if (modalTotalPages === 0) return null;
                    const pages = [];

                    if (modalTotalPages <= 3) {
                      for (let i = 1; i <= modalTotalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      if (modalCurrentPage <= 2) {
                        pages.push(1, 2, 'ellipsis', modalTotalPages);
                      } else if (modalCurrentPage >= modalTotalPages - 1) {
                        pages.push(1, 'ellipsis', modalTotalPages - 1, modalTotalPages);
                      } else {
                        pages.push(1, modalCurrentPage, 'ellipsis', modalTotalPages);
                      }
                    }

                    return pages.map((page, idx) => {
                      if (page === 'ellipsis') {
                        if (showJumpInputModal) {
                          return (
                            <input
                              key="jumpInputModal"
                              className="paginationJumpInput"
                              type="number"
                              min={1}
                              max={modalTotalPages}
                              autoFocus
                              value={jumpPageModal}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || (/^\d+$/.test(val) && Number(val) <= modalTotalPages)) {
                                  setJumpPageModal(val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const pageNum = Number(jumpPageModal);
                                  if (pageNum >= 1 && pageNum <= modalTotalPages) {
                                    setModalCurrentPage(pageNum);
                                    setShowJumpInputModal(false);
                                    setJumpPageModal('');
                                  }
                                } else if (e.key === 'Escape') {
                                  setShowJumpInputModal(false);
                                  setJumpPageModal('');
                                }
                              }}
                              onBlur={() => {
                                setShowJumpInputModal(false);
                                setJumpPageModal('');
                              }}
                              placeholder="Page #"
                            />
                          );
                        } else {
                          return (
                            <span
                              key={`ellipsis-${idx}`}
                              className="paginationEllipsis"
                              onClick={() => setShowJumpInputModal(true)}
                              title="Jump to page"
                            >
                              {jumpPageModal !== '' ? jumpPageModal : '...'}
                            </span>
                          );
                        }
                      } else {
                        return (
                          <button
                            key={page}
                            className={`paginationBtn ${modalCurrentPage === page ? 'currentPage' : ''}`}
                            onClick={() => setModalCurrentPage(page)}
                            disabled={modalCurrentPage === page}
                          >
                            {page}
                          </button>
                        );
                      }
                    });
                  })()}

                  <button
                    className="paginationBtn"
                    disabled={modalCurrentPage === modalTotalPages || modalTotalPages === 0}
                    onClick={() => setModalCurrentPage(modalCurrentPage + 1)}
                  >
                    &gt;
                  </button>
                </div>
              </div>

              <div className="leaveModalDateRow">
                <label>Select Date: </label>
                <input
                  type="date"
                  value={addLeaveDate}
                  onChange={(e) => setAddLeaveDate(e.target.value)}
                />
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
                <button onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAddLeave}
                  disabled={!addLeaveDate || selectedEmployeeIds.length === 0}
                >
                  Confirm
                </button>
              </div>
            </div>
            <div className="toastContainer">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`toast ${toast.type} ${toast.closing ? "fade-out" : ""}`}
                  onClick={() => removeToast(toast.id)}
                >
                  {toast.message}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
};

export default DashboardLeave;
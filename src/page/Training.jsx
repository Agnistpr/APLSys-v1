import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { MdClear } from 'react-icons/md';
import { FaSortAmountDownAlt, FaSortAmountUp, FaFilter } from 'react-icons/fa';

const Training = ({ setActivePage, setSelectedApplicantId }) => {
  const [selectedTab, setSelectedTab] = useState('Training');
  const [trainees, setTrainees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('applicantid');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  const sortRef = useRef(null);
  const filterRef = useRef(null);
  const selectAllRef = useRef(null);

  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const [toasts, setToasts] = useState([]);

  const [trainingTrainees, setTrainingTrainees] = useState([]);
  const [rejectedTrainees, setRejectedTrainees] = useState([]);

  const columns = ['applicantid', 'fullName', 'department', 'position', 'trainingdate'];
  const columnLabelMap = {
    applicantid: 'ID',
    fullName: 'Name',
    department: 'Department',
    position: 'Position',
    trainingdate: 'Training Date'
  };

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleFile = async (filePath) => {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeMap = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      csv: 'text/csv',
    };
    const mimeType = mimeMap[ext];
    const allowedFileTypes = Object.values(mimeMap);

    if (!allowedFileTypes.includes(mimeType)) {
      alert('Invalid file type. Only PNG, JPG, JPEG, PDF, DOCX, and CSV are allowed.');
      return;
    }

    try {
      await window.fileAPI.saveFileToFolder(filePath);
    } catch (err) {
      console.error('File upload failed:', err);
    }
  };

  const filePicker = async () => {
    try {
      const filePaths = await window.fileAPI.selectFile();

      if (Array.isArray(filePaths) && filePaths.length > 0) {
        for (const filePath of filePaths) {
          await handleFile(filePath);
        }

        setToasts(prev => [
          ...prev,
          {
            id: Date.now(),
            message: 'File(s) uploaded successfully.',
            type: 'success'
          }
        ]);
      } else {
        setToasts(prev => [
          ...prev,
          {
            id: Date.now(),
            message: 'No files were selected.',
            type: 'error'
          }
        ]);
      }
    } catch (err) {
      console.error('error: ', err);
      setToasts(prev => [
        ...prev,
        {
          id: Date.now(),
          message: 'An error occurred while uploading the file(s).',
          type: 'error'
        }
      ]);
    }
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

  const fetchAllApplicants = async () => {
    const trainingData = await window.fileAPI.getTrainees('Training');
    const rejectedData = await window.fileAPI.getTrainees('Rejected');

    setTrainingTrainees(Array.isArray(trainingData) ? trainingData : []);
    setRejectedTrainees(Array.isArray(rejectedData) ? rejectedData : []);
  };

  useEffect(() => {
    fetchAllApplicants();
  }, []);

  useEffect(() => {
    switch(selectedTab) {
      case 'Rejected':
        setTrainees(rejectedTrainees);
        break;
      case 'Training':
      default:
        setTrainees(trainingTrainees);
    }
    setCurrentPage(1);
  }, [selectedTab, trainingTrainees, rejectedTrainees]);

  const counts = {
    Training: trainingTrainees.length,
    Rejected: rejectedTrainees.length,
  };

  const uniqueValues = useMemo(() => {
    const values = { department: new Set(), position: new Set() };
    trainees.forEach(row => {
      values.department.add(row.department);
      values.position.add(row.position);
    });
    return {
      department: Array.from(values.department),
      position: Array.from(values.position)
    };
  }, [trainees]);

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
    return trainees.filter(row => {
      const matchesSearch = (row.fullname || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === '__activeColumn') return true;
        return values.length === 0 || values.includes(row[column]);
      });
      return matchesSearch && matchesFilters;
    });
  }, [trainees, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortColumn] ?? '';
      let bVal = b[sortColumn] ?? '';

      const isNumeric = !isNaN(parseFloat(aVal)) && !isNaN(parseFloat(bVal));
      const isDate =
        !isNumeric &&
        !isNaN(new Date(aVal).getTime()) &&
        !isNaN(new Date(bVal).getTime());

      if (isNumeric) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (isDate) {
        const dateA = new Date(aVal);
        const dateB = new Date(bVal);
        return sortOrder === 'asc'
          ? dateA - dateB
          : dateB - dateA;
      }

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

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.length > 0 && selectedIds.length < filtered.length;
    }
  }, [selectedIds, filtered.length]);

  const toggleCheckboxes = () => {
    setShowCheckboxes(prev => !prev);
    setSelectedIds([]);
  };

  const toggleApplicantSelection = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.length > 0 && selectedIds.length < filtered.length;
    }
  }, [selectedIds, filtered.length]);

  const handleApprove = () => {
    if (selectedTab === "Training") {
      updateStatus(selectedIds, { status: "Hired", setTrainingDate: false, setApplicationDate: false });
    }
  };

  const handleReject = (type) => {
    if (selectedTab === "Training") {
      updateStatus(selectedIds, { status: "Rejected", setTrainingDate: false, setApplicationDate: false });
    } else if (selectedTab === "Rejected") {
      if (type === "Re-screen") {
        updateStatus(selectedIds, { status: "Pending", resetTraining: true, setApplicationDate: true });
      } else {
        updateStatus(selectedIds, { status: "Training", setTrainingDate: true, setApplicationDate: false });
      }
    }
  };

  const updateStatus = async (ids, options) => {
    try {
      console.log("Sending to backend:", { ids, options });
      const res = await window.fileAPI.updateApplicantsStatus(ids, options);
      if (!res.success) {
        console.error(res.message);
        return;
      }
      await fetchAllApplicants();
      setSelectedIds([]);
      setShowCheckboxes(false);
    } catch (err) {
      console.error("Error updating applicants:", err);
    }
  };

  return (
    <div className="trainingContainer">
      <div className="trainingHeader">
        <h1 className="trainingTitle">Training</h1>
        <button className="exportBtn" onClick={() => window.fileAPI.exportAllTrainees()}>
          Export All
        </button>
      </div>

      <div className="trainingContent">
        {/* <div className="uploadSection">
          <h2 className="sectionTitle">Assessment Form Upload</h2>
          <p className="sectionDescription">
            Upload assessment form images or PDFs to extract applicant information.
          </p>

          <div className="uploadBox" onClick={filePicker}>
            <div className="uploadIcon">📄</div>
            <p className="uploadText">Upload Assessment Form</p>
            <p className="uploadHint">Click to select a file from your system</p>
            <p className="uploadTypes">Supports: PNG, JPG, JPEG, PDF</p>
          </div>

          <button className="uploadButton" onClick={filePicker}>
            Select Assessment File
          </button>
        </div> */}

        <div className="traineeSection">
          <div className="traineeHeader">
            <div className='traineeControls'>
              <div className="sortContainer" ref={sortRef}>
                <div className="sortIcon" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                  {sortOrder === 'asc' ? <FaSortAmountDownAlt /> : <FaSortAmountUp />}
                </div>
                <div className="sortText" onClick={() => setDropdownOpen(prev => !prev)}>
                  Sort: {columnLabelMap[sortColumn]}
                </div>
                {dropdownOpen && (
                  <div className="tabSortOptions">
                    {columns.map(col => (
                      <div key={col} onClick={() => { setSortColumn(col); setDropdownOpen(false); }}>
                        {columnLabelMap[col]}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="filterContainer" ref={filterRef}>
                <button className="filterBtn" onClick={() => setFilterOpen(prev => !prev)}>
                  <FaFilter />
                </button>

                {filterOpen && (
                  <div className="filterDropdown">
                    <div className="filterHeader">
                      <strong>Filter by</strong>
                      <button className="clearFilterBtn" onClick={clearFilters}>Clear</button>
                    </div>
                    <div className="filterColumns">
                      {['department', 'position'].map(col => (
                        <div
                          key={col}
                          className={`filterColumnName ${selectedFilters[col] ? 'activeColumn' : ''}`}
                          onClick={() => {
                            setSelectedFilters(prev => ({
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
                      {uniqueValues[selectedFilters.__activeColumn]?.map(val => (
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

          <div className="traineeTabs">
            {['Training', 'Rejected'].map(tab => (
              <button
                key={tab}
                className={`tab ${selectedTab === tab ? 'active' : ''}`}
                onClick={() => setSelectedTab(tab)}
              >
                {tab} ({counts[tab] || 0})
              </button>
            ))}
          </div>

          <table className="traineeTable">
            <thead>
              <tr>
                {showCheckboxes && (
                  <th>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={selectedIds.length === filtered.length && filtered.length > 0}
                      onChange={() => {
                        if (selectedIds.length === filtered.length) {
                          setSelectedIds([]);
                        } else {
                          setSelectedIds(filtered.map((row) => row.applicantid));
                        }
                      }}
                    />
                  </th>
                )}
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Position</th>
                <th>Training Date</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={showCheckboxes ? 6 : 5}>No records found.</td></tr>
              ) : (
                paginated.map((row) => (
                  <tr key={row.applicantid}>
                    {showCheckboxes && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.applicantid)}
                          onChange={() => toggleApplicantSelection(row.applicantid)}
                        />
                      </td>
                    )}
                    <td>{row.applicantid}</td>
                    <td>{row.fullname}</td>
                    <td>{row.department}</td>
                    <td>{row.position}</td>
                    <td>{row.trainingdate ? new Date(row.trainingdate).toLocaleDateString() : ''}</td>
                 </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="tableFooter">
            <div className="paginationItems">
              <label>Items: </label>
              <select
                value={itemsPerPage === trainees.length ? 'all' : itemsPerPage}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemsPerPage(val === 'all' ? trainees.length : Number(val));
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
                  <div className="actions">
                    {!showCheckboxes ? (
                      <button className="addBtn" onClick={toggleCheckboxes}>
                        Toggle
                      </button>
                    ) : (
                      <>
                        <button className="addBtn" onClick={toggleCheckboxes}>
                          Cancel
                        </button>

                        {selectedTab === "Training" && (
                          <>
                            <button
                              className="addBtn"
                              onClick={handleApprove}
                              disabled={selectedIds.length === 0}
                            >
                              Hire
                            </button>
                            <button
                              className="addBtn"
                              onClick={handleReject}
                              disabled={selectedIds.length === 0}
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {selectedTab === "Rejected" && (
                          <>
                            <button
                              className="addBtn"
                              onClick={() => handleReject("Retrain")}
                              disabled={selectedIds.length === 0}
                            >
                              Retrain
                            </button>
                            <button
                              className="addBtn"
                              onClick={() => handleReject("Re-screen")}
                              disabled={selectedIds.length === 0}
                            >
                              Re-screen
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
          </div>
          <button className="exportBtn" onClick={() => window.fileAPI.exportTrainees(selectedTab)}>
            Export Table
          </button>
        </div>
      </div>
      <div className="toast-container">
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
  );
};

export default Training;
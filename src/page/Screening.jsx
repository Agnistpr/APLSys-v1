import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { MdClear } from 'react-icons/md';
import { FaSortAmountDownAlt, FaSortAmountUp, FaFilter } from 'react-icons/fa';

const Screening = ({ setActivePage, setSelectedApplicantId,  setPreviousPage, activePage, selectedApplicantId, setSelectedResumeFile }) => {
  const [selectedTab, setSelectedTab] = useState('Pending');
  const [applicants, setApplicants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('applicantid');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  const [resumeFiles, setResumeFiles] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  const sortRef = useRef(null);
  const filterRef = useRef(null);
  const selectAllRef = useRef(null);

  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);

  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const [uploadMessage, setUploadMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const [pendingApplicants, setPendingApplicants] = useState([]);
  const [approvedApplicants, setApprovedApplicants] = useState([]);
  const [rejectedApplicants, setRejectedApplicants] = useState([]);

  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");

  const columns = ['applicantid', 'fullName', 'department', 'position', 'applicationdate'];
  const columnLabelMap = {
    applicantid: 'ID',
    fullName: 'Name',
    department: 'Department',
    position: 'Position',
    applicationdate: 'Application Date'
  };

  useEffect(() => {
    const loadDeps = async () => {
      const data = await window.fileAPI.getDeptPos();

      const deptMap = {};
      data.forEach((row) => {
        if (!deptMap[row.departmentid]) {
          deptMap[row.departmentid] = {
            id: row.departmentid,
            name: row.departmentname,
            positions: [],
          };
        }
        deptMap[row.departmentid].positions.push({
          id: row.positionid,
          name: row.positionname,
        });
      });

      setDepartments(Object.values(deptMap));
    };

    loadDeps();
  }, []);

  const handleFile = async (filePath) => {
    try {
      const ext = filePath.split(".").pop().toLowerCase();
      if (ext !== "pdf") {
        console.warn("Skipped non-PDF file:", filePath);
        return null;
      }

      const fileData = await window.fileAPI.readFileAsBase64(filePath);

      return {
        name: filePath.split(/[\\/]/).pop(),
        data: fileData,
        type: "application/pdf",
      };
    } catch (err) {
      console.error("File handling failed:", err);
      return null;
    }
  };

  const filePicker = async () => {
    try {
      const filePaths = await window.fileAPI.selectFile({
        type: "pdf",
        multi: false,
      });

      if (Array.isArray(filePaths) && filePaths.length > 0) {
        const results = [];
        for (const filePath of filePaths) {
          const res = await handleFile(filePath);
          if (res) results.push(res); 
        }

        if (results.length > 0) {
          setResumeFiles(results);
          setUploadMessage("Resume(s) uploaded successfully.");
          setSelectedResumeFile(results[0]);

          setSelectedApplicantId(true);
          setPreviousPage(activePage);
          setActivePage("Analyzer");
          setIsError(false);
        } else {
          setIsError(true);
          setUploadMessage("No valid PDF files were selected.");
        }
      } else {
        setIsError(true);
        setUploadMessage("No files were selected.");
      }

      setTimeout(() => setUploadMessage(""), 3000);
    } catch (err) {
      console.error("error: ", err);
      setIsError(true);
      setUploadMessage("An error occurred while selecting the file(s).");
      setTimeout(() => setUploadMessage(""), 3000);
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
    const pendingData = await window.fileAPI.getApplicants("Pending");
    const approvedData = await window.fileAPI.getApplicants("Approved");
    const rejectedData = await window.fileAPI.getApplicants("Rejected");

    setPendingApplicants(Array.isArray(pendingData) ? pendingData : []);
    setApprovedApplicants(Array.isArray(approvedData) ? approvedData : []);
    setRejectedApplicants(Array.isArray(rejectedData) ? rejectedData : []);
  };

  useEffect(() => {
    fetchAllApplicants();
  }, []);

  useEffect(() => {
    switch (selectedTab) {
      case 'Pending':
        setApplicants(pendingApplicants);
        break;
      case 'Approved':
        setApplicants(approvedApplicants);
        break;
      case 'Rejected':
        setApplicants(rejectedApplicants);
        break;
      case 'All':
        setApplicants([...pendingApplicants, ...approvedApplicants, ...rejectedApplicants]);
        break;
      default:
        setApplicants([]);
    }
  }, [selectedTab, pendingApplicants, approvedApplicants, rejectedApplicants]);

  const counts = {
    Pending: pendingApplicants.length,
    Approved: approvedApplicants.length,
    Rejected: rejectedApplicants.length,
  };

  const uniqueValues = useMemo(() => {
    const values = { department: new Set(), position: new Set() };
    applicants.forEach(row => {
      values.department.add(row.department);
      values.position.add(row.position);
    });
    return {
      department: Array.from(values.department),
      position: Array.from(values.position)
    };
  }, [applicants]);

  const clearFilters = () => setSelectedFilters({});
  
  const toggleFilterValue = (column, value) => {
    setSelectedFilters(prev => {
      const colValues = prev[column] || [];
      const updated = colValues.includes(value)
        ? colValues.filter(v => v !== value)
        : [...colValues, value];
      return { ...prev, [column]: updated, __activeColumn: column };
    });
  };

  const filtered = useMemo(() => {
    return applicants.filter(row => {
      const matchesSearch = (row.fullname || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === '__activeColumn') return true;
        return values.length === 0 || values.includes(row[column]);
      });
      return matchesSearch && matchesFilters;
    });
  }, [applicants, searchTerm, selectedFilters]);

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
    console.log(selectedTab);
    if (selectedTab === "Pending") {
      console.log(selectedTab);
      updateStatus(selectedIds, { status: "Approved", setTrainingDate: false });
      // console.log(updateStatus);
    } else if (selectedTab === "Approved") {
      updateStatus(selectedIds, { status: "Training", setTrainingDate: true });
    } else if (selectedTab === "Rejected") {
      updateStatus(selectedIds, { status: "Pending", resetTraining: true, setApplicationDate: true });
    }
  };

  const handleReject = () => {
    if (selectedTab === "Pending" || selectedTab === "Approved") {
      updateStatus(selectedIds, { status: "Rejected" });
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

  const handleAddApplicant = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const formValues = Object.fromEntries(data.entries());

    if (selectedImage) {
      formValues.image = selectedImage
    }
    if (resumeFiles.length > 0) {
      formValues.resumes = resumeFiles;
    }

    console.log("Submitting applicant:", formValues);

    try {
      await window.fileAPI.addApplicant(formValues);
      await fetchAllApplicants();
      setShowAddModal(false);
    } catch (err) {
      console.error("Error adding applicant:", err);
    }
  };

  return (
    <div className="screeningContainer">
      <div className="screeningContent">
        <div className="screeningHeader">
          <h1>Applicant Screening Dashboard</h1>
          <button className="exportBtn" onClick={() => window.fileAPI.exportAllApplicants()}>
            Export All
          </button>
        </div>

        <div className="topStats">
          <div className="statBox">
            <div className="statValue">{counts.Pending}</div>
            <div className="statLabel">Current Applicants</div>
          </div>
          <div className="statBox">
            <div className="statValue">{counts.Approved}</div>
            <div className="statLabel">Approved (Awaiting Document Completion)</div>
          </div>
          <div className="statBox">
            <div className="statValue">{counts.Rejected}</div>
            <div className="statLabel">Rejected Applicants</div>
          </div>
        </div>

        <div className="screeningMain">
          <div className="resumeSection">
            <h2 className="sectionTitle">Resume Upload</h2>
            <p className="sectionDescription">
              Upload Resume images or PDFs to extract applicant information and add them to the screening list.
            </p>

            <div className="uploadBox" onClick={filePicker}>
              <div className="uploadIcon">📄</div>
              <p className="uploadText">Upload Resume</p>
              <p className="uploadHint">Click to select a file from your system</p>
              <p className="uploadTypes">Supports: PNG, JPG, JPEG, PDF</p>
            </div>

            <button
              className="uploadButton"
              onClick={() => {
                setSelectedResumeFile(null);
                setSelectedApplicantId(true);
                setPreviousPage(activePage);
                setActivePage("Analyzer");
              }}
            >
              Add Applicant
            </button>

            {/* <div className="filterApplicants">
              <h3>Filter Applicants</h3>
              <label>Applicant Experience (Years)</label>
              <input type="range" min="0" max="10" />
              <label>Minimum Compatibility Score (%)</label>
              <input type="range" min="0" max="100" />

              <label>Required Skills</label>
              <div className="skillsCheckbox">
                <label><input type="checkbox" /> Machine Operation</label>
                <label><input type="checkbox" /> Quality Control</label>
              </div>
              <button className="applyFilterBtn">Apply Filter</button>
            </div> */}
          </div>

          <div className="applicantSection">
            <div className="applicantHeader">
              <div className="applicantTabs">
                {['Pending', 'Approved', 'Rejected'].map(tab => (
                  <button
                    key={tab}
                    className={`tab ${selectedTab === tab ? 'active' : ''}`}
                    onClick={() => setSelectedTab(tab)}
                  >
                    {tab} ({counts[tab] || 0})
                  </button>
                ))}
              </div>

              <div className='applicantControls'>
                {/* <button
                  className="addBtn"
                  onClick={() => {
                    setPreviousPage(activePage);
                    setActivePage("DocumentManagement");
                    // setShowAddModal(true);
                  }}
                >
                  +
                </button> */}
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

            <table className="applicantTable">
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
                  <th>Application Date</th>
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
                      <td>{row.applicationdate ? new Date(row.applicationdate).toLocaleDateString() : ''}</td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="tableFooter">
              <div className="paginationItems">
                <label>Items: </label>
                <select
                  value={itemsPerPage === applicants.length ? 'all' : itemsPerPage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItemsPerPage(val === 'all' ? applicants.length : Number(val));
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

                        {selectedTab === "Pending" && (
                          <>
                            <button
                              className="addBtn"
                              onClick={handleApprove}
                              disabled={selectedIds.length === 0}
                            >
                              Approve
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

                        {selectedTab === "Approved" && (
                          <>
                            <button
                              className="addBtn"
                              onClick={handleApprove}
                              disabled={selectedIds.length === 0}
                            >
                              Move to Training
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
                          <button
                            className="addBtn"
                            onClick={handleApprove}
                            disabled={selectedIds.length === 0}
                          >
                            Reconsider
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
            </div>
            <button className="exportBtn" onClick={() => window.fileAPI.exportApplicants(selectedTab)}>
              Export Table
            </button>
          </div>
        </div>
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
            <h3>Add Applicant</h3>
            <hr className="modalDivider" />

            <form onSubmit={handleAddApplicant} className="modalForm">
              <div className='formColumn'>
                <div className="formRow">
                  <label htmlFor="firstName">First Name: <span className="required">*</span></label>
                  <input id="firstName" type="text" name="firstName" required />

                  <label htmlFor="middleName">Middle Name: <span className="required">*</span></label>
                  <input id="middleName" type="text" name="middleName" required />

                  <label htmlFor="lastName">Last Name: <span className="required">*</span></label>
                  <input id="lastName" type="text" name="lastName" required />

                  <label htmlFor="contact">Contact No.: <span className="required">*</span></label>
                  <input id="contact" type="tel" name="contact" required pattern="[0-9]{11}" />

                  <label htmlFor="email">Email: <span className="required">*</span></label>
                  <input id="email" type="email" name="email" required />

                  <label htmlFor="address">Address: <span className="required">*</span></label>
                  <input id="address" type="text" name="address" required />

                  <label htmlFor="sss">SSS No.:</label>
                  <input id="sss" type="text" name="sss" pattern="[0-9]{10}" />

                  <label htmlFor="pagibig">PAGIBIG No.:</label>
                  <input id="pagibig" type="text" name="pagibig" pattern="[0-9]{12}" />

                  <label htmlFor="philhealth">PhilHealth No.:</label>
                  <input id="philhealth" type="text" name="philhealth" pattern="[0-9]{12}" />
                </div>

                <div className='formColumnII'>
                  <div className="uploadSection">
                    <div className="uploadBox" onClick={() => filePicker(true)}>
                      {selectedImage ? (
                        <img
                          src={`data:${selectedImage.type};base64,${selectedImage.data}`}
                          alt="Selected"
                          className="previewImage"
                        />
                      ) : (
                        <>
                          <p className="uploadText">Upload Image</p>
                          <p className="uploadHint">Click to select an image</p>
                          <p className="uploadTypes">Supports: PNG, JPG, JPEG</p>
                        </>
                      )}
                    </div>
                  </div>
                  <label htmlFor="department">Department: <span className="required">*</span></label>
                  <select
                    id="department"
                    name="departmentId"
                    required
                    value={selectedDept}
                    onChange={(e) => {
                      const deptId = e.target.value;
                      setSelectedDept(deptId);
                      const dept = departments.find((d) => d.id.toString() === deptId);
                      setPositions(dept ? dept.positions : []);
                    }}
                  >
                    <option disabled value="">-- Select --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>

                  {selectedDept && (
                    <>
                      <label htmlFor="position">Position: <span className="required">*</span></label>
                      <select id="position" name="positionId" required>
                        <option disabled value="">-- Select --</option>
                        {positions.map((pos) => (
                          <option key={pos.id} value={pos.id}>
                            {pos.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>

              <div className="modalActions">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="cancelBtn"
                >
                  Cancel
                </button>
                <button type="submit" className="submitBtn">
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
      {uploadMessage && (
        <div
          className={`toast ${isError ? 'error' : 'success'}`}
          onClick={() => setUploadMessage('')}
        >
          {uploadMessage}
        </div>
      )}
    </div>
  );
};

export default Screening;

import React, { useState, useEffect, useMemo, useRef } from "react";
import { FaFilter } from "react-icons/fa";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";

const Screening = ({ uid, setActivePage, setSelectedApplicantId, setPreviousPage, activePage, setSelectedResumeFile, setShowAnalyzer }) => {
  const [selectedTab, setSelectedTab] = useState("Pending");
  const [applicants, setApplicants] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("applicantid");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [resumeFiles, setResumeFiles] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pendingApplicants, setPendingApplicants] = useState([]);
  // const [approvedApplicants, setApprovedApplicants] = useState([]);
  const [rejectedApplicants, setRejectedApplicants] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [loading, setLoading] = useState(true);
  // console.log(uid);

  const selectAllRef = useRef(null);

  const columns = ["applicantid", "fullname", "department", "position", "applicationdate"];
  const columnLabelMap = {
    applicantid: "ID",
    fullname: "Name",
    department: "Department",
    position: "Position",
    applicationdate: "Application Date",
  };

  useEffect(() => {
    const loadDeps = async () => {
      const data = await window.utilityAPI.getDeptPos();
      const deptMap = {};
      data.forEach((row) => {
        if (!deptMap[row.departmentid]) {
          deptMap[row.departmentid] = { id: row.departmentid, name: row.departmentname, positions: [] };
        }
        deptMap[row.departmentid].positions.push({ id: row.positionid, name: row.positionname });
      });
      setDepartments(Object.values(deptMap));
    };
    loadDeps();
  }, []);

  const handleFile = async (filePath) => {
    try {
      const ext = filePath.split(".").pop().toLowerCase();
      const allowed = ["pdf", "docx", "doc", "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"];
      if (!allowed.includes(ext)) return null;
      const fileData = await window.fileAPI.readFileAsBase64(filePath);
      let mime = "application/octet-stream";
      if (ext === "pdf") mime = "application/pdf";
      else if (ext === "docx") mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (ext === "doc") mime = "application/msword";
      else if (["jpg", "jpeg"].includes(ext)) mime = "image/jpeg";
      else if (ext === "png") mime = "image/png";
      else if (ext === "gif") mime = "image/gif";
      else if (ext === "bmp") mime = "image/bmp";
      else if (ext === "tiff") mime = "image/tiff";
      else if (ext === "webp") mime = "image/webp";

      return { name: filePath.split(/[\\\/]/).pop(), data: fileData, type: mime };
    } catch {
      return null;
    }
  };

  const filePicker = async () => {
    try {
      const filePaths = await window.fileAPI.selectFile({ type: ["pdf", "docx", "image"], multi: false });
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
          try {setShowAnalyzer?.(true);} catch(_) {}
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
    } catch {
      setIsError(true);
      setUploadMessage("An error occurred while selecting the file(s).");
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  const fetchAllApplicants = async () => {
    setLoading(true);
    const pendingData = await window.applicantAPI.getApplicants("Pending");
    // const approvedData = await window.applicantAPI.getApplicants("Approved");
    const rejectedData = await window.applicantAPI.getApplicants("Rejected");
    setPendingApplicants(Array.isArray(pendingData) ? pendingData : []);
    // setApprovedApplicants(Array.isArray(approvedData) ? approvedData : []);
    setRejectedApplicants(Array.isArray(rejectedData) ? rejectedData : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllApplicants();
  }, []);

  useEffect(() => {
    switch (selectedTab) {
      case "Pending":
        setApplicants(pendingApplicants);
        break;
      // case "Approved":
      //   setApplicants(approvedApplicants);
      //   break;
      case "Rejected":
        setApplicants(rejectedApplicants);
        break;
      case "All":
        setApplicants([...pendingApplicants, ...rejectedApplicants]);
        break;
      default:
        setApplicants([]);
    }
  }, [selectedTab, pendingApplicants, rejectedApplicants]);

  const counts = {
    Pending: pendingApplicants.length,
    // Approved: approvedApplicants.length,
    Rejected: rejectedApplicants.length,
  };

  const uniqueValues = useMemo(() => {
    const values = { department: new Set(), position: new Set() };
    applicants.forEach((row) => {
      values.department.add(row.department);
      values.position.add(row.position);
    });
    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
    };
  }, [applicants]);

  const filtered = useMemo(() => {
    return applicants.filter((row) => {
      const matchesSearch = (row.fullname || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === "__activeColumn") return true;
        return values.length === 0 || values.includes(row[column]);
      });
      return matchesSearch && matchesFilters;
    });
  }, [applicants, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortColumn] ?? "";
      let bVal = b[sortColumn] ?? "";
      const isNumeric = !isNaN(parseFloat(aVal)) && !isNaN(parseFloat(bVal));
      const isDate = !isNumeric && !isNaN(new Date(aVal).getTime()) && !isNaN(new Date(bVal).getTime());
      if (isNumeric) return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      if (isDate) return sortOrder === "asc" ? new Date(aVal) - new Date(bVal) : new Date(bVal) - new Date(aVal);
      return sortOrder === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortColumn, sortOrder]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  const toggleCheckboxes = () => {
    setShowCheckboxes((prev) => !prev);
    setSelectedIds([]);
  };

  const toggleApplicantSelection = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]));
  };

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.length > 0 && selectedIds.length < filtered.length;
    }
  }, [selectedIds, filtered.length]);

  const handleApprove = () => {
    if (selectedTab === "Pending") updateStatus(selectedIds, { status: "Training", setTrainingDate: true });
    // else if (selectedTab === "Approved") updateStatus(selectedIds, { status: "Training", setTrainingDate: true });
    else if (selectedTab === "Rejected") updateStatus(selectedIds, { status: "Pending", resetTraining: true, setApplicationDate: true });
  };

  const handleReject = () => {
    if (selectedTab === "Pending" || selectedTab === "Approved") updateStatus(selectedIds, { status: "Rejected" });
  };

  const updateStatus = async (ids, options) => {
    try {
      const res = await window.applicantAPI.updateApplicantsStatus(ids, options);
      if (!res.success) return;
      await fetchAllApplicants();
      setSelectedIds([]);
      setShowCheckboxes(false);
    } catch {}
  };

  const handleAddApplicant = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const formValues = Object.fromEntries(data.entries());
    if (selectedImage) formValues.image = selectedImage;
    if (resumeFiles.length > 0) formValues.resumes = resumeFiles;
    await window.applicantAPI.addApplicant(formValues);
    await fetchAllApplicants();
    setShowAddModal(false);
  };

  return (
    <div className="screeningContainer">
      <div className="screeningContent">
        <div className="screeningHeader">
          <h1>Applicant Screening Dashboard</h1>
          <button
            className="exportBtn"
            onClick={async () => {
              try {
                const result = await window.exportAPI.exportAllApplicants();
                console.log(uid);
                if (result.success) {
                  await window.userAPI.logAction(uid, "exported a copy of all Applicant records");
                  window.toast("Applicants exported successfully!", "success");
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

        <div className="topStats">
          <div className="statBox">
            <div className="statValue">{counts.Pending}</div>
            <div className="statLabel">Current Applicants</div>
          </div>
          {/* <div className="statBox">
            <div className="statValue">{counts.Approved}</div>
            <div className="statLabel">Approved (Awaiting Document Completion)</div>
          </div> */}
          <div className="statBox">
            <div className="statValue">{counts.Rejected}</div>
            <div className="statLabel">Rejected Applicants</div>
          </div>
        </div>

        <div className="screeningMain">
          <div className="resumeSection">
            <h2 className="sectionTitle">Resume Upload</h2>
            <p className="sectionDescription">Upload Resumes (PDFs) to extract applicant information and add them to the screening list.</p>
            <div className="uploadBox" onClick={filePicker}>
              <div className="uploadIcon">📄</div>
              <p className="uploadText">Upload Resume</p>
              <p className="uploadHint">Click to select a file from your system</p>
              <p className="uploadTypes">Supports PDF, Word(DOCx) and Image Files</p>
            </div>
            <button
              className="uploadButton"
              onClick={() => {
                setSelectedResumeFile(null);
                setSelectedApplicantId(true);
                setPreviousPage(activePage);
                try {setShowAnalyzer?.(true);} catch(_) {}
                setActivePage("Analyzer");
              }}
            >
              Add Applicant
            </button>
          </div>

          <div className="tabContainer">
            <div className="tabs">
              {["Pending", "Rejected"].map((tab) => (
                <button key={tab} className={`tab ${selectedTab === tab ? "active" : ""}`} onClick={() => setSelectedTab(tab)}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="applicantSection">
              <div className="applicantHeader">
              <button
                className="exportBtn"
                onClick={async () => {
                  try {
                    const result = await window.exportAPI.exportApplicants(selectedTab);
                    console.log(uid);
                    if (result.success) {
                      await window.userAPI.logAction(uid, "exported a copy of " + selectedTab + " Applicant records" );
                      window.toast("Applicants exported successfully!", "success");
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
                <div className="applicantControls">
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
                    triggerButton={<button className="filterBtn"><FaFilter /></button>}
                  />

                  <SearchBar value={searchTerm} onChange={setSearchTerm} />
                </div>
              </div>

              <div className="tableContainer">
                <table className={`applicantTable ${loading ? "skeleton" : ""}`}>
                  <thead>
                    <tr>
                      {showCheckboxes && (
                        <th>
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            checked={selectedIds.length === filtered.length && filtered.length > 0}
                            onChange={() => {
                              if (selectedIds.length === filtered.length) setSelectedIds([]);
                              else setSelectedIds(filtered.map((row) => row.applicantid));
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
                    {loading ? (
                      Array.from({ length: itemsPerPage }).map((_, idx) => (
                        <tr key={idx} className="skeletonRow">
                          {(showCheckboxes ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4]).map((i) => (
                            <td key={i}>
                              <div className="shimmerCell" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={showCheckboxes ? 6 : 5}>No records found.</td>
                      </tr>
                    ) : (
                      paginated.map((row, idx) => (
                        <tr 
                          key={idx}
                          onDoubleClick={() => {
                            uid={uid};
                            setSelectedApplicantId(row.applicantid);
                            setPreviousPage(activePage);
                            setActivePage("ApplicantInformation");
                          }}
                        >
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
                          <td>
                            {row.applicationdate
                              ? new Date(row.applicationdate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : ""}
                          </td>
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
                  totalItems={applicants.length}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  // onExport={() => window.exportAPI.exportApplicants(selectedTab)}
                />

                <div className="actions">
                  {!showCheckboxes ? (
                    <button className="actionBtn" onClick={toggleCheckboxes}>
                      Toggle
                    </button>
                  ) : (
                    <>
                      <button className="actionBtn" onClick={toggleCheckboxes}>
                        Cancel
                      </button>

                      {selectedTab === "Pending" && (
                        <>
                          <button
                            className="actionBtn"
                            onClick={handleApprove}
                            disabled={selectedIds.length === 0}
                          >
                            Approve
                          </button>
                          <button
                            className="actionBtn"
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
                            className="actionBtn"
                            onClick={handleApprove}
                            disabled={selectedIds.length === 0}
                          >
                            Move to Training
                          </button>
                          <button
                            className="actionBtn"
                            onClick={handleReject}
                            disabled={selectedIds.length === 0}
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {selectedTab === "Rejected" && (
                        <button
                          className="actionBtn"
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
          </div>
        </div>

        {showAddModal && (
          <div
            className="modalOverlay"
            onClick={(e) => {
              if (e.target.classList.contains("modalOverlay")) setShowAddModal(false);
            }}
          >
            <div className="modalContent">
              <h3>Add Applicant</h3>
              <hr className="modalDivider" />
              <form onSubmit={handleAddApplicant} className="modalForm">
                <div className="formColumn">
                  <div className="formRow">
                    <label htmlFor="firstName">
                      First Name: <span className="required">*</span>
                    </label>
                    <input id="firstName" type="text" name="firstName" required />
                    <label htmlFor="middleName">
                      Middle Name: <span className="required">*</span>
                    </label>
                    <input id="middleName" type="text" name="middleName" required />
                    <label htmlFor="lastName">
                      Last Name: <span className="required">*</span>
                    </label>
                    <input id="lastName" type="text" name="lastName" required />
                    <label htmlFor="contact">
                      Contact No.: <span className="required">*</span>
                    </label>
                    <input id="contact" type="tel" name="contact" required pattern="[0-9]{11}" />
                    <label htmlFor="email">
                      Email: <span className="required">*</span>
                    </label>
                    <input id="email" type="email" name="email" required />
                    <label htmlFor="address">
                      Address: <span className="required">*</span>
                    </label>
                    <input id="address" type="text" name="address" required />
                    <label htmlFor="sss">SSS No.:</label>
                    <input id="sss" type="text" name="sss" pattern="[0-9]{10}" />
                    <label htmlFor="tin">TIN No.:</label>
                    <input id="tin" type="text" name="tin" pattern="[0-9]{9}" />
                    <label htmlFor="philhealth">PhilHealth No.:</label>
                    <input id="philhealth" type="text" name="philhealth" pattern="[0-9]{12}" />
                    <label htmlFor="pagibig">Pag-IBIG No.:</label>
                    <input id="pagibig" type="text" name="pagibig" pattern="[0-9]{12}" />
                  </div>
                  <div className="formRow">
                    <label>Gender: <span className="required">*</span></label>
                    <select name="gender" required>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <label>Date of Birth: <span className="required">*</span></label>
                    <input type="date" name="birthdate" required />
                    <label>Department: <span className="required">*</span></label>
                    <select
                      name="departmentid"
                      required
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <label>Position: <span className="required">*</span></label>
                    <select name="positionid" required>
                      <option value="">Select Position</option>
                      {departments
                        .find((d) => d.id === selectedDept)
                        ?.positions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <label>Resume: <span className="required">*</span></label>
                    <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const base64 = await window.fileAPI.readFileAsBase64(file.path);
                        // determine mime from extension
                        const fext = file.name.split('.').pop().toLowerCase();
                        let ftype = file.type || "application/octet-stream";
                        if (!ftype) {
                          if (fext === 'pdf') ftype = 'application/pdf';
                          else if (fext === 'docx') ftype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                          else if (fext === 'doc') ftype = 'application/msword';
                          else if (['jpg','jpeg'].includes(fext)) ftype = 'image/jpeg';
                          else if (fext === 'png') ftype = 'image/png';
                        }
                        setResumeFiles([{ name: file.name, data: base64, type: ftype }]);
                      }
                    }} required />
                    <label>Image: </label>
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const base64 = await window.fileAPI.readFileAsBase64(file.path);
                        setSelectedImage({ name: file.name, data: base64, type: file.type });
                      }
                    }} />
                  </div>
                </div>
                <div className="modalFooter">
                  <button type="submit" className="submitBtn">Add Applicant</button>
                  <button type="button" className="cancelBtn" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Screening;

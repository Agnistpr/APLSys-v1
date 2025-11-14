import React, { useState, useEffect, useMemo, useRef } from "react";
import { FaFilter } from "react-icons/fa";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";

const Training = ({ setActivePage, setSelectedApplicantId, setPreviousPage, activePage }) => {
  const [selectedTab, setSelectedTab] = useState("Training");
  const [applicants, setApplicants] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("applicantid");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [trainingApplicants, setTrainingApplicants] = useState([]);
  const [hiredApplicants, setHiredApplicants] = useState([]);
  const [rejectedApplicants, setRejectedApplicants] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectAllRef = useRef(null);

  const columns = ["applicantid", "fullname", "department", "position", "trainingdate"];
  const columnLabelMap = {
    applicantid: "ID",
    fullname: "Name",
    department: "Department",
    position: "Position",
    trainingdate: "Training Date",
  };

  const fetchAllApplicants = async () => {
    setLoading(true);
    const trainingData = await window.applicantAPI.getTrainees("Training");
    const hiredData = await window.applicantAPI.getTrainees("Hired");
    const rejectedData = await window.applicantAPI.getTrainees("Rejected");
    setTrainingApplicants(Array.isArray(trainingData) ? trainingData : []);
    setHiredApplicants(Array.isArray(hiredData) ? hiredData : []);
    setRejectedApplicants(Array.isArray(rejectedData) ? rejectedData : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllApplicants();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilters]);

  useEffect(() => {
    if (selectedTab === "Training") setApplicants(trainingApplicants);
    else if (selectedTab === "Hired") setApplicants(hiredApplicants);
    else if (selectedTab === "Rejected") setApplicants(rejectedApplicants);
  }, [selectedTab, trainingApplicants, hiredApplicants, rejectedApplicants]);

  const counts = {
    Training: trainingApplicants.length,
    Hired: hiredApplicants.length,
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

  const updateStatus = async (ids, options) => {
    const res = await window.applicantAPI.updateApplicantsStatus(ids, options);
    if (!res.success) return;
    await fetchAllApplicants();
    setSelectedIds([]);
    setShowCheckboxes(false);
  };

  const handleApprove = () => {
    if (selectedTab === "Training") updateStatus(selectedIds, { status: "Hired" });
    else if (selectedTab === "Rejected") updateStatus(selectedIds, { status: "Training" });
  };

  const handleReject = () => {
    if (selectedTab === "Training") updateStatus(selectedIds, { status: "Rejected" });
  };

  return (
    <div className="screeningContainer">
      <div className="screeningContent">
        <div className="screeningHeader">
          <h1>Training Dashboard</h1>
          <button className="exportBtn" onClick={() => window.exportAPI.exportAllApplicants()}>
            Export All
          </button>
        </div>

        <div className="topStats">
          <div className="statBox">
            <div className="statValue">{counts.Training}</div>
            <div className="statLabel">In Training</div>
          </div>
          <div className="statBox">
            <div className="statValue">{counts.Hired}</div>
            <div className="statLabel">Hired Employees</div>
          </div>
          <div className="statBox">
            <div className="statValue">{counts.Rejected}</div>
            <div className="statLabel">Rejected Applicants</div>
          </div>
        </div>

        <div className="screeningMain">
          <div className="tabContainer">
            <div className="tabs">
              {["Training", "Hired", "Rejected"].map((tab) => (
                <button key={tab} className={`tab ${selectedTab === tab ? "active" : ""}`} onClick={() => setSelectedTab(tab)}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="applicantSection">
              <div className="applicantHeader">
                <button className="exportBtn" onClick={() => window.exportAPI.exportApplicants(selectedTab)}>
                  Export Table
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
                      <th>Training Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      Array.from({ length: itemsPerPage }).map((_, idx) => (
                        <tr key={idx} className="skeletonRow">
                          {(showCheckboxes ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4]).map((i) => (
                            <td key={i}><div className="shimmerCell" /></td>
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
                            {row.trainingdate
                              ? new Date(row.trainingdate).toLocaleDateString("en-US", {
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
                  onExport={() => window.exportAPI.exportApplicants(selectedTab)}
                />

                <div className="actions">
                  {!showCheckboxes ? (
                    <button className="actionBtn" onClick={toggleCheckboxes}>Toggle</button>
                  ) : (
                    <>
                      <button className="actionBtn" onClick={toggleCheckboxes}>Cancel</button>

                      {selectedTab === "Training" && (
                        <>
                          <button className="actionBtn" onClick={handleApprove} disabled={selectedIds.length === 0}>Hire</button>
                          <button className="actionBtn" onClick={handleReject} disabled={selectedIds.length === 0}>Reject</button>
                        </>
                      )}

                      {selectedTab === "Rejected" && (
                        <button className="actionBtn" onClick={handleApprove} disabled={selectedIds.length === 0}>Re-Train</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Training;
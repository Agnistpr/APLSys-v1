import React, { useEffect, useState, useRef, useMemo } from "react";
import { MdEdit, MdClear } from "react-icons/md";
import { FaSortAmountDownAlt, FaSortAmountUp, FaFilter } from "react-icons/fa";

const EmployeeInformation = ({ employeeId, goBack }) => {
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const [uploadMessage, setUploadMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [sortColumn, setSortColumn] = useState("date");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [jumpPage, setJumpPage] = useState("");
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem("attendanceDate") || new Date().toISOString().split("T")[0];
  });


  const sortRef = useRef(null);
  const filterRef = useRef(null);

  const columns = [
    "date",
    "shift",
    "timein",
    "timeout",
    "diff",
    "status",
  ];

  const columnLabelMap = {
    date: "Date",
    shift: "Shift Schedule",
    timein: "Time In",
    timeout: "Time Out",
    diff: "UT/OT",
    status: "Status",
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchEmployee = async () => {
      const data = await window.fileAPI.getEmployee(employeeId);
      setEmployee(data);

      if (data?.image) {
        setSelectedImage({
          type: data.imageType,
          data: data.image,
        });
      }
    };
    const fetchAttendance = async () => {
      const data = await window.fileAPI.getEmployeeAttendance(employeeId, selectedDate);
      setAttendance(data);
    };
    fetchEmployee();
    fetchAttendance();
  }, [employeeId, selectedDate]);

  const calculateTimeDiff = (start, end) => {
    const startDate = new Date(`1970-01-01T${start}`);
    const endDate = new Date(`1970-01-01T${end}`);
    const diff = (endDate - startDate) / (1000 * 60);
    return diff;
  };

  const formatTime = (timeStr) => {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${m} ${suffix}`;
  };

  const handleEditClick = (field, value) => {
    setEditingField(field);
    setFieldValue(value);
  };

  const handleKeyDown = async (e, field, isDate = false) => {
    if (e.key === "Enter") {
      let safeValue = fieldValue;

      if (isDate) {
        safeValue = new Date(fieldValue).toISOString().split("T")[0];
      }

      const updated = { ...employee, [field]: safeValue };
      setEmployee(updated);
      setEditingField(null);

      await window.fileAPI.updateEmployee(employeeId, field, safeValue);
    }
  };

  const renderEditableField = (label, field, isDate = false) => (
    <p
      key={field}
      className="editableField"
      style={{ position: "relative", marginBottom: "8px" }}
    >
      <strong>{label}:</strong>{" "}
      {editingField === field ? (
        <input
          type={isDate ? "date" : "text"}
          value={
            isDate
              ? new Date(fieldValue).toISOString().split("T")[0]
              : fieldValue
          }
          autoFocus
          onChange={(e) => setFieldValue(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, field, isDate)}
          onBlur={() => setEditingField(null)}
          style={{ padding: "2px 4px" }}
        />
      ) : (
        <>
          {isDate
            ? new Date(employee[field]).toISOString().split("T")[0]
            : employee[field]}
          <MdEdit
            className="editIcon"
            onClick={() => handleEditClick(field, employee[field])}
          />
        </>
      )}
    </p>
  );

  const handleFile = async (filePath) => {
    try {
      const fileData = await window.fileAPI.readFileAsBase64(filePath);
      return {
        name: filePath.split(/[\\/]/).pop(),
        data: fileData,
        type: `image/${filePath.split(".").pop().toLowerCase()}`,
      };
    } catch (err) {
      console.error("File handling failed:", err);
      return null;
    }
  };

  const filePicker = async () => {
    try {
      const filePaths = await window.fileAPI.selectFile({
        type: "images",
        multi: false,
      });

      if (Array.isArray(filePaths) && filePaths.length > 0) {
        const res = await handleFile(filePaths[0]);
        if (res) {
          setSelectedImage(res);
          setUploadMessage("Profile image selected. Saving...");
          setIsError(false);

          // 👇 Immediately save after selection
          await saveProfileImage(res);
        }
      } else {
        setIsError(true);
        setUploadMessage("No image selected.");
      }
      setTimeout(() => setUploadMessage(""), 3000);
    } catch (err) {
      console.error("error: ", err);
      setIsError(true);
      setUploadMessage("An error occurred while selecting the file.");
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  const saveProfileImage = async (image = selectedImage) => {
    if (!image) return;
    try {
      const res = await window.fileAPI.updateEmployee(
        employeeId,
        "employeeimage",
        image.data 
      );

      if (res.success) {
        setUploadMessage("Profile image saved successfully.");
        setIsError(false);
      } else {
        setUploadMessage("Failed to save image.");
        setIsError(true);
      }
    } catch (err) {
      console.error("Error saving image:", err);
      setUploadMessage("Error saving image.");
      setIsError(true);
    }
    setTimeout(() => setUploadMessage(""), 3000);
  };

  const uniqueValues = useMemo(() => {
    const values = { status: new Set() };
    attendance.forEach((row) => {
      const expectedMinutes = calculateTimeDiff(row.shiftstart, row.shiftend);
      const actualMinutes = calculateTimeDiff(row.timein, row.timeout);
      const diff = actualMinutes - expectedMinutes;
      const status = diff < 0 ? "Undertime" : "On time / Overtime";
      values.status.add(status);
    });
    return { status: Array.from(values.status) };
  }, [attendance]);

  const clearFilters = () => setSelectedFilters({});

  const toggleFilterValue = (column, value) => {
    setSelectedFilters((prev) => {
      const colValues = prev[column] || [];
      const updated = colValues.includes(value)
        ? colValues.filter((v) => v !== value)
        : [...colValues, value];
      return { ...prev, [column]: updated, __activeColumn: column };
    });
  };

  const filtered = useMemo(() => {
    return attendance.filter((row) => {
      const expectedMinutes = calculateTimeDiff(row.shiftstart, row.shiftend);
      const actualMinutes = calculateTimeDiff(row.timein, row.timeout);
      const diff = actualMinutes - expectedMinutes;
      const status = diff < 0 ? "Undertime" : "On time / Overtime";


      const matchesFilters = Object.entries(selectedFilters).every(
        ([column, values]) => {
          if (column === "__activeColumn") return true;
          if (column === "status") return (
            values.length === 0 || values.includes(status)
          );
          return true;
        }
      );
      return matchesFilters;
    });
  }, [attendance, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal, bVal;

      switch (sortColumn) {
        case "shift":
          aVal = `${a.shiftstart}-${a.shiftend}`;
          bVal = `${b.shiftstart}-${b.shiftend}`;
          break;

        case "status":
          const expA = calculateTimeDiff(a.shiftstart, a.shiftend);
          const actA = calculateTimeDiff(a.timein, a.timeout);
          aVal = actA - expA < 0 ? "Undertime" : "On time / Overtime";

          const expB = calculateTimeDiff(b.shiftstart, b.shiftend);
          const actB = calculateTimeDiff(b.timein, b.timeout);
          bVal = actB - expB < 0 ? "Undertime" : "On time / Overtime";
          break;

        case "diff": {
          const diffA = calculateTimeDiff(a.timein, a.timeout) - calculateTimeDiff(a.shiftstart, a.shiftend);
          const diffB = calculateTimeDiff(b.timein, b.timeout) - calculateTimeDiff(b.shiftstart, b.shiftend);
          aVal = diffA;
          bVal = diffB;
          break;
        }

        default:
          aVal = a[sortColumn] ?? "";
          bVal = b[sortColumn] ?? "";
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

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

  if (!employee) {
    return (
      <div className="loadingContainer">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="employeeInfoContainer">
      <div className="employeeInfoHeader">
        <h2>Employee Profile</h2>
        <button onClick={goBack}>x</button>
      </div>

      <div className="employeeInfoGrid">
        <div className="employeeInfoPhoto">
          <div className="ImageContainer">
            {selectedImage ? (
              <img
                src={`data:${selectedImage.type};base64,${selectedImage.data}`}
                alt="Employee"
                className="previewImage"
                onClick={filePicker}
              />
            ) : employee.employeeimage ? (
              <img
                src={`data:image/png;base64,${employee.employeeimage}`}
                alt="Profile"
                className="previewImage"
                onClick={filePicker}
              />
            ) : (
              <div className="placeholderPhoto" onClick={filePicker}>
                {/* No Image */}
              </div>
            )}
          </div>
        </div>

        <div className="employeeInfoMeta">
          <div className="employeeInfoName">
            {employee.employeeid} | {employee.name}
          </div>

          <div className="employeeInfoDetails">
            {renderEditableField("Department", "department")}
            {renderEditableField("Position", "position")}
            {renderEditableField("Leave Credit", "leavecredit")}
            {renderEditableField("Contact", "contact")}
            {renderEditableField("Email", "email")}
            {renderEditableField("Address", "address")}
            {renderEditableField("Hire Date", "hiredate", true)}
            {renderEditableField("SSS #", "sss_number")}
            {renderEditableField("PAGIBIG #", "pagibig_number")}
            {renderEditableField("PhilHealth #", "philhealth_number")}
            {renderEditableField("BIR #", "bir_number")}
          </div>
        </div>
      </div>

      <div className="attendanceHeaderRow">
        <h1>Attendance Records</h1>

        <div className="attendanceControls">
          <div className="sortContainer" ref={sortRef}>
            <div
              className="sortIcon"
              onClick={() =>
                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
              }
            >
              {sortOrder === "asc" ? <FaSortAmountDownAlt /> : <FaSortAmountUp />}
            </div>
            <div
              className="sortText"
              onClick={() => setDropdownOpen((prev) => !prev)}
            >
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
            <button
              className="filterBtn"
              onClick={() => setFilterOpen((prev) => !prev)}
            >
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
                  {["status"].map((col) => (
                    <div
                      key={col}
                      className={`filterColumnName ${
                        selectedFilters[col] ? "activeColumn" : ""
                      }`}
                      onClick={() =>
                        setSelectedFilters((prev) => ({
                          ...prev,
                          __activeColumn:
                            prev.__activeColumn === col ? null : col,
                        }))
                      }
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
                        checked={
                          selectedFilters[selectedFilters.__activeColumn]?.includes(
                            val
                          ) || false
                        }
                        onChange={() =>
                          toggleFilterValue(selectedFilters.__activeColumn, val)
                        }
                      />
                      {val}
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
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDate(val);
                localStorage.setItem("attendanceDate", val);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>
      <div className="attendanceTableWrapper">
        <table className="attendanceTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift Schedule</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>UT/OT</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((entry, index) => {
              const expectedMinutes = calculateTimeDiff(
                entry.shiftstart,
                entry.shiftend
              );
              const actualMinutes = calculateTimeDiff(
                entry.timein,
                entry.timeout
              );
              const diff = actualMinutes - expectedMinutes;
              const isUndertime = diff < 0;
              const color = isUndertime ? "red" : "green";
              const status = isUndertime ? "Undertime" : "On time / Overtime";

              return (
                <tr key={index}>
                  <td>{new Date(entry.date).toISOString().split("T")[0]}</td>
                  <td>
                    {formatTime(entry.shiftstart)} - {formatTime(entry.shiftend)}
                  </td>
                  <td>{formatTime(entry.timein)}</td>
                  <td>{formatTime(entry.timeout)}</td>
                  <td style={{ color }}>{Math.abs(diff)} min(s)</td>
                  <td>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tableFooter">
        <div className="paginationItems">
          <label>Items: </label>
          <select
            value={itemsPerPage === attendance.length ? "all" : itemsPerPage}
            onChange={(e) => {
              const val = e.target.value;
              setItemsPerPage(val === "all" ? attendance.length : Number(val));
              setCurrentPage(1);
            }}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
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
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              if (currentPage <= 2) {
                pages.push(1, 2, "ellipsis", totalPages);
              } else if (currentPage >= totalPages - 1) {
                pages.push(1, "ellipsis", totalPages - 1, totalPages);
              } else {
                pages.push(1, currentPage, "ellipsis", totalPages);
              }
            }

            return pages.map((page, idx) => {
              if (page === "ellipsis") {
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
                        if (
                          val === "" ||
                          (/^\d+$/.test(val) && Number(val) <= totalPages)
                        ) {
                          setJumpPage(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const pageNum = Number(jumpPage);
                          if (pageNum >= 1 && pageNum <= totalPages) {
                            setCurrentPage(pageNum);
                            setShowJumpInput(false);
                            setJumpPage("");
                          }
                        } else if (e.key === "Escape") {
                          setShowJumpInput(false);
                          setJumpPage("");
                        }
                      }}
                      onBlur={() => {
                        setShowJumpInput(false);
                        setJumpPage("");
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
                      {jumpPage !== "" ? jumpPage : "..."}
                    </span>
                  );
                }
              } else {
                return (
                  <button
                    key={page}
                    className={`paginationBtn ${
                      currentPage === page ? "currentPage" : ""
                    }`}
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
      </div>
    </div>
  );
};

export default EmployeeInformation;

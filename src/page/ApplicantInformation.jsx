import React, { useEffect, useState, useMemo } from "react";
import { MdEdit } from "react-icons/md";
import DatePicker from "../components/DatePicker.jsx";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import Pagination from "../components/Pagination.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

const ApplicantInformation = ({ applicantId, goBack }) => {
  const [applicant, setApplicant] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [deptPosList, setDeptPosList] = useState([]);
  const [sortColumn, setSortColumn] = useState("date");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [loading, setLoading] = useState(true);
  const [confirmChanges, setConfirmChanges] = useState(false);
  const [pendingChange, setPendingChange] = useState(null);

  const [confirmImageChange, setConfirmImageChange] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem("attendanceDate") || "";
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilters, selectedDate]);

  const validationRules = {
    contact: { regex: /^\d{11}$/, message: "Contact number must be exactly 11 digits." },
    pagibig_number: { regex: /^\d{12}$/, message: "PAGIBIG number must be exactly 12 digits." },
    sss_number: { regex: /^\d{10}$/, message: "SSS number must be exactly 10 digits." },
    bir_number: { regex: /^\d{9}$/, message: "BIR TIN must be exactly 9 digits." },
    philhealth_number: { regex: /^\d{12}$/, message: "PhilHealth number must be exactly 12 digits." },
  };

  const departments = useMemo(() => {
    const unique = [];
    const seen = new Set();
    deptPosList.forEach((d) => {
      if (!seen.has(d.departmentid)) {
        seen.add(d.departmentid);
        unique.push({ id: d.departmentid, name: d.departmentname });
      }
    });
    return unique;
  }, [deptPosList]);

  const positionsByDept = useMemo(() => {
    const map = {};
    deptPosList.forEach((d) => {
      if (!map[d.departmentid]) map[d.departmentid] = [];
      map[d.departmentid].push({ id: d.positionid, name: d.positionname });
    });
    return map;
  }, [deptPosList]);

  useEffect(() => {
    const fetchDeptPos = async () => {
      const result = await window.utilityAPI.getDeptPos();
      setDeptPosList(result || []);
    };
    fetchDeptPos();
  }, []);

  useEffect(() => {
    const fetchApplicant = async () => {
      const data = await window.applicantAPI.getApplicant(applicantId);
      if (!data) return;
      setApplicant(data);
    };
    fetchApplicant();
  }, [applicantId]);

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      const data = await window.attendanceAPI.getApplicantAttendance(applicantId, selectedDate);
      setAttendance(data);
      setLoading(false);
    };
    fetchAttendance();
  }, [applicantId, selectedDate]);

  const handleEditClick = (field, value) => {
    setEditingField(field);
    setFieldValue(value);
  };

  const handleKeyDown = async (e, field, isDate = false) => {
    if (e.key === "Enter") {
      setEditingField(null);
      let safeValue = isDate ? new Date(fieldValue).toISOString().split("T")[0] : fieldValue.trim();

      if (validationRules[field]) {
        const { regex, message } = validationRules[field];
        if (!regex.test(safeValue)) {
          window.toast(message, "error");
          return;
        }
      }

      if (field === "position") {
        const deptId = applicant.departmentid;
        const posId = safeValue;
        const validCombo = deptPosList.some(
          (d) => d.departmentid == deptId && d.positionid == posId
        );
        if (!validCombo) {
          window.toast("Invalid department/position combination.", "error");
          return;
        }
      }

      setPendingChange({ field, value: safeValue });
      setConfirmChanges(true);
    }
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    const { field, value } = pendingChange;

    let dbField = field;
    let dbValue = value;

    if (field === "department") dbField = "departmentid";
    if (field === "position") dbField = "positionid";

    try {
      await window.applicantAPI.updateApplicant(applicantId, dbField, dbValue);

      setApplicant((prev) => {
        const newState = { ...prev };
        if (field === "department") {
          newState.positionid = null;
          newState.position = "---";
          newState.departmentid = value;
        } else if (field === "position") {
          newState.positionid = value;
          const posObj = deptPosList.find(
            (d) => d.departmentid === prev.departmentid && d.positionid == value
          );
          newState.position = posObj?.positionname || "---";
        } else {
          newState[field] = value;
        }
        return newState;
      });

      window.toast("Change saved successfully", "success");
    } catch (err) {
      console.error("Update failed:", err);
      window.toast("Database update failed.", "error");
    } finally {
      setEditingField(null);
      setConfirmChanges(false);
      setPendingChange(null);
    }
  };

  const handleFieldBlur = (field, isDate) => {
    if (fieldValue !== applicant[field]) {
      setPendingChange({ field, value: fieldValue });
      setConfirmChanges(true);
    } else {
      setEditingField(null);
    }
  };

  const renderEditableField = (label, field, isDate = false) => {
    const isDepartment = field === "department";
    const isPosition = field === "position";

    return (
      <p key={field} className="editableField">
        <strong>{label}:</strong>{" "}
        {editingField === field ? (
          isDepartment ? (
            <select
              value={applicant.departmentid || ""}
              onChange={(e) => {
                const newDeptId = e.target.value;
                const newDept = departments.find((d) => d.id == newDeptId);
                setApplicant((prev) => ({
                  ...prev,
                  departmentid: newDeptId,
                  department: newDept?.name,
                  positionid: null,
                  position: "---",
                }));
                setFieldValue(newDeptId);
              }}
              onBlur={(e) => handleFieldBlur(field, isDate)}
              autoFocus
              onKeyDown={(e) => handleKeyDown(e, "department")}
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          ) : isPosition ? (
            <select
              value={applicant.positionid || ""}
              onChange={(e) => {
                const newPosId = e.target.value;
                const newPos =
                  positionsByDept[applicant.departmentid]?.find((p) => p.id == newPosId);
                setApplicant((prev) => ({
                  ...prev,
                  positionid: newPosId,
                  position: newPos?.name,
                }));
                setFieldValue(newPosId);
              }}
              onBlur={(e) => handleFieldBlur(field, isDate)}
              disabled={!applicant.departmentid}
              autoFocus
              onKeyDown={(e) => handleKeyDown(e, "position")}
            >
              {(positionsByDept[applicant.departmentid] || []).map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={isDate ? "date" : "text"}
              value={
                isDate && fieldValue
                  ? (() => {
                      const d = new Date(fieldValue);
                      return isNaN(d) ? "" : d.toISOString().split("T")[0];
                    })()
                  : fieldValue
              }
              autoFocus
              onChange={(e) => setFieldValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, field, isDate)}
              onBlur={(e) => handleFieldBlur(field, isDate)}
            />
          )
        ) : (
          <>
            {isDate
              ? applicant[field]
                ? new Date(applicant[field]).toISOString().split("T")[0]
                : "—"
              : applicant[field] || "—"}
            <MdEdit className="editIcon" onClick={() => handleEditClick(field, applicant[field])} />
          </>
        )}
      </p>
    );
  };

  const filePicker = async () => {
    try {
      const filePaths = await window.fileAPI.selectFile({ type: "images", multi: false });
      if (!filePaths?.length) return;

      const filePath = filePaths[0];
      const fileData = await window.fileAPI.readFileAsBase64(filePath);
      const fileExt = filePath.split(".").pop().toLowerCase();
      const base64Data = `data:image/${fileExt};base64,${fileData}`;

      if (applicant.applicantimage) {
        setPendingImage(base64Data);
        setConfirmImageChange(true);
      } else {
        const res = await window.applicantAPI.updateApplicant(applicantId, "applicantimage", base64Data);
        if (res.success) {
          setApplicant(prev => ({ ...prev, applicantimage: res.imageUrl }));
          window.toast("Profile image updated.", "success");
        } else {
          window.toast("Upload failed.", "error");
        }
      }
    } catch (err) {
      console.error(err);
      setIsError(true);
    }
  };

  const handleConfirmImage = async () => {
    if (!pendingImage) return;
    setConfirmImageChange(false);

    try {
      const res = await window.applicantAPI.updateApplicant(applicantId, "applicantimage", pendingImage);
      if (res.success) {
        setApplicant(prev => ({ ...prev, applicantimage: res.imageUrl }));
        window.toast("Profile image updated.", "success");
        setIsError(false);
      } else {
        window.toast("Something went wrong.", "error");
        setIsError(true);
      }
    } catch (err) {
      console.error(err);
      window.toast("Something went wrong.", "error");
      setIsError(true);
    } finally {
      setPendingImage(null);
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  const calculateTimeDiff = (start, end) => {
    const startDate = new Date(`1970-01-01T${start}`);
    const endDate = new Date(`1970-01-01T${end}`);
    return (endDate - startDate) / (1000 * 60);
  };

  const filtered = useMemo(() => {
    return attendance.filter((row) => {
      const expected = calculateTimeDiff(row.shiftstart, row.shiftend);
      const actual = calculateTimeDiff(row.timein, row.timeout);
      const diff = actual - expected;
      const status = diff < 0 ? "Undertime" : "On time / Overtime";
      return Object.entries(selectedFilters).every(([column, values]) => {
        if (column === "__activeColumn") return true;
        if (column === "status") return values.length === 0 || values.includes(status);
        return true;
      });
    });
  }, [attendance, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal, bVal;
      switch (sortColumn) {
        case "diff":
          aVal = calculateTimeDiff(a.timein, a.timeout) - calculateTimeDiff(a.shiftstart, a.shiftend);
          bVal = calculateTimeDiff(b.timein, b.timeout) - calculateTimeDiff(b.shiftstart, b.shiftend);
          break;
        default:
          aVal = a[sortColumn] ?? "";
          bVal = b[sortColumn] ?? "";
      }
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortColumn, sortOrder]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  if (!applicant) return <div className="loadingContainer"><div className="spinner"></div></div>;

  const fullName = `${applicant.firstname || ""} ${applicant.middlename || ""} ${applicant.lastname || ""}`.trim();

  return (
    <div className="employeeInfoContainer">
      <div className="employeeInfoHeader">
        <h2>Applicant Profile</h2>
        <button onClick={goBack}>x</button>
      </div>

      <div className="employeeInfoGrid">
        <div className="employeeInfoPhoto">
          <div className="ImageContainer" onClick={filePicker}>
            {applicant.applicantimage ? (
              <img src={applicant.applicantimage} alt="Profile" className="previewImage" />
            ) : (
              <div className="placeholderPhoto" />
            )}
          </div>
          {uploadMessage && <div className={`uploadMessage ${isError ? "error" : ""}`}>{uploadMessage}</div>}
        </div>

        <div className="employeeInfoMeta">
          <div className="employeeInfoName">
            {applicant.applicantid} | {applicant.name}
          </div>

          <div className="employeeInfoColumns">
            <div className="infoColumn">
              {renderEditableField("Department", "department")}
              {renderEditableField("Position", "position")}
              {renderEditableField("Application Status", "status")}
              {renderEditableField("Application Date", "applicationdate", true)}
              {renderEditableField("Training Date", "trainingdate", true)}
            </div>

            <div className="infoColumn">
              {renderEditableField("Contact", "contact")}
              {renderEditableField("Email", "email")}
              {renderEditableField("Address", "address")}
              {renderEditableField("Gender", "gender")}
              {renderEditableField("Age", "age")}
              {renderEditableField("Birthdate", "birthdate", true)}
            </div>

            <div className="infoColumn">
              {renderEditableField("SSS #", "sss_number")}
              {renderEditableField("PAGIBIG #", "pagibig_number")}
              {renderEditableField("BIR #", "bir_number")}
              {renderEditableField("PhilHealth #", "philhealth_number")}
            </div>
          </div>
        </div>
      </div>

      <div className="attendanceHeaderRow">
        <h1>Attendance Records</h1>
        <div className="attendanceControls">
          <SortDropdown
            columns={[
              "date",
              "shift",
              "timeIn",
              "arrivalDiff",
              "arrivalStatus",
              "timeOut",
              "hoursWorked",
              "workStatus",
            ]}
            columnLabelMap={{
              date: "Date",
              shift: "Shift",
              timeIn: "Time In",
              arrivalDiff: "Arrival Diff",
              arrivalStatus: "Arrival Status",
              timeOut: "Time Out",
              hoursWorked: "Hours Worked",
              workStatus: "Work Status",
            }}
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
            uniqueValues={{
              shift: [...new Set(attendance.map((r) => r.shift))],
              arrivalStatus: [...new Set(attendance.map((r) => r.arrivalStatus))],
              workStatus: [...new Set(attendance.map((r) => r.workStatus))],
            }}
            columnLabelMap={{
              shift: "Shift",
              arrivalStatus: "Arrival Status",
              workStatus: "Work Status",
            }}
          />

          <DatePicker
            value={selectedDate}
            onChange={(val) => {
              setSelectedDate(val);
              localStorage.setItem("attendanceDate", val);
              setCurrentPage(1);
            }}
            storageKey="attendanceDate"
          />
        </div>
      </div>

      <div className="tableContainer">
        <table className={`tabTable ${loading ? "skeleton" : ""}`}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Shift</th>
              <th>Time In</th>
              <th>Arrival Diff</th>
              <th>Arrival Status</th>
              <th>Time Out</th>
              <th>Hours Worked</th>
              <th>Work Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: itemsPerPage }).map((_, idx) => (
                <tr key={idx} className="skeletonRow">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <td key={i}>
                      <div className="shimmerCell" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={11}>No records found.</td>
              </tr>
            ) : (
              paginated.map((row, idx) => {
                const colorForArrival = (status) => {
                  if (status === "Late") return "red";
                  if (status === "Early") return "green";
                  return "black";
                };
                const colorForWork = (status) => {
                  if (status === "Overtime") return "green";
                  if (status === "Undertime") return "red";
                  return "black";
                };

                return (
                  <tr key={idx}>
                    <td>
                      {row.date
                        ? new Date(row.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "-"}
                    </td>
                    <td>{row.shift || "-"}</td>
                    <td>{row.timeIn || "-"}</td>
                    <td style={{ color: colorForArrival(row.arrivalStatus) }}>
                      {row.arrivalDiff === 0
                        ? "-"
                        : `${row.arrivalDiff > 0 ? "+" : ""}${row.arrivalDiff}`}
                    </td>
                    <td>{row.arrivalStatus || "-"}</td>
                    <td>{row.timeOut || "-"}</td>
                    <td style={{ color: colorForWork(row.workStatus) }}>
                      {row.hoursWorked || "-"}
                    </td>
                    <td>{row.workStatus || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="tableFooter">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
        <div></div>
      </div>

      <ConfirmModal
        open={confirmChanges}
        title="Confirm Changes"
        message="Are you sure you want to save this change?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={handleConfirmChange}
        onCancel={() => {
          setConfirmChanges(false);
          setPendingChange(null);
        }}
      />

      <ConfirmModal
        open={confirmImageChange}
        title="Confirm Image Change"
        message="Are you sure you want to save this change? This cannot be undone and changes may take some time."
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={handleConfirmImage}
        onCancel={() => {
          setConfirmImageChange(false);
          setPendingImage(null);
        }}
      />
    </div>
  );
};

export default ApplicantInformation;
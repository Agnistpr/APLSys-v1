import React, { useEffect, useState, useMemo } from "react";
import { MdEdit } from "react-icons/md";
import DatePicker from "../components/DatePicker.jsx";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import Pagination from "../components/Pagination.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

const EmployeeInformation = ({ employeeId, goBack }) => {
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
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

  const [needsPositionUpdate, setNeedsPositionUpdate] = useState(false);
  const [autoFocusPosition, setAutoFocusPosition] = useState(false);

  const [confirmFieldChange, setConfirmFieldChange] = useState({
    open: false,
    field: null,
    newValue: "",
    newId: ""
  });

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
    setCurrentPage(1);
  }, [selectedFilters, selectedDate]);

  useEffect(() => {
    const fetchDeptPos = async () => {
      const result = await window.utilityAPI.getDeptPos();
      setDeptPosList(result);
    };
    fetchDeptPos();
  }, []);

  useEffect(() => {
    const fetchEmployee = async () => {
      const data = await window.employeeAPI.getEmployee(employeeId);
      if (!data) return;
      setEmployee(data);
    };
    fetchEmployee();
  }, [employeeId]);

  useEffect(() => {
    if (!employee || deptPosList.length === 0) return;

    const deptObj = deptPosList.find((d) => d.departmentname === employee.department);
    const posObj = deptPosList.find((d) => d.positionname === employee.position);

    setEmployee((prev) => ({
      ...prev,
      departmentid: deptObj?.departmentid || prev.departmentid,
      positionid: posObj?.positionid || prev.positionid,
    }));
  }, [deptPosList, employee]);

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      const data = await window.attendanceAPI.getEmployeeAttendance(employeeId, selectedDate);
      setAttendance(data);
      setLoading(false);
    };
    fetchAttendance();
  }, [employeeId, selectedDate]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (needsPositionUpdate) {
        e.preventDefault();
        e.returnValue = "";
        window.toast("Please select a new position before leaving this page.", "error");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [needsPositionUpdate]);

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
        const deptId = employee.departmentid;
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

  const formatContactNumber = (value) => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");

    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    const { field, value } = pendingChange;

    let dbField = field;
    let dbValue = value;

    if (field === "department") dbField = "departmentid";
    if (field === "position") dbField = "positionid";

    try {
      await window.employeeAPI.updateEmployee(employeeId, dbField, dbValue);

      if (field === "department") {
        await window.employeeAPI.updateEmployee(employeeId, "positionid", null);
      }

      setEmployee((prev) => {
        const newState = { ...prev };
        if (field === "department") {
          newState.positionid = null;
          newState.position = "---";
          newState.departmentid = value;
        } else if (field === "position") {
          newState.positionid = value;
          const posObj = deptPosList
            .find((d) => d.departmentid === prev.departmentid && d.positionid == value);
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

  const handleConfirmFieldChange = async () => {
    const { field, newId, newValue } = confirmFieldChange;
    if (!field) return;

    try {
      const dbField = field === "department" ? "departmentid" : "positionid";
      await window.employeeAPI.updateEmployee(employeeId, dbField, newId);

      setEmployee((prev) => {
        const newState = { ...prev };
        if (field === "department") {
          newState.departmentid = newId;
          newState.department = newValue;
          newState.positionid = null;
          newState.position = "---";
          setNeedsPositionUpdate(true);
          setEditingField("position");
          setTimeout(() => setAutoFocusPosition(true), 100);
          window.toast(`${field} changed successfully. Please select a new position.`, "success");
        } else if (field === "position") {
          newState.positionid = newId;
          newState.position = newValue;
          setNeedsPositionUpdate(false);
          setAutoFocusPosition(false);
          window.toast(`${field} changed successfully`, "success");
        } else {
          window.toast(`${field} changed successfully`, "success");
        }
        return newState;
      });
    } catch (err) {
      console.error("Update failed:", err);
      window.toast("Update failed.", "error");
    } finally {
      setConfirmFieldChange({ open: false, field: null, newValue: "", newId: "" });
    }
  };

  const handleCancelFieldChange = () => {
    setConfirmFieldChange((prev) => {
      setEmployee((e) => {
        const copy = { ...e };
        if (prev.field === "department") copy.departmentid = e.departmentid;
        if (prev.field === "position") copy.positionid = e.positionid;
        return copy;
      });
      return { open: false, field: null, newValue: "", newId: "" };
    });
  };

  const handleConfirmImage = async () => {
    if (!pendingImage) return;

    setConfirmImageChange(false);
    try {
      const res = await window.employeeAPI.updateEmployee(employeeId, "employeeimage", pendingImage);

      if (res.success) {
        setEmployee(prev => ({ ...prev, employeeimage: res.imageUrl }));
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

  const handleFieldBlur = (field, isDate) => {
    if (fieldValue !== employee[field]) {
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
              value={employee.departmentid || ""}
              onChange={(e) => {
                const newDeptId = e.target.value;
                const newDept = departments.find((d) => d.id == newDeptId);

                if (newDeptId != employee.departmentid) {
                  setConfirmFieldChange({
                    open: true,
                    field: "department",
                    newValue: newDept?.name,
                    newId: newDeptId
                  });
                }
              }}
              autoFocus
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          ) : isPosition ? (
            <select
              ref={(el) => {
                if (autoFocusPosition && el) {
                  el.focus();
                  const clickEvent = new MouseEvent("mousedown", { bubbles: true });
                  el.dispatchEvent(clickEvent);
                  el.classList.add("highlight-focus");
                  setTimeout(() => {
                    el.classList.remove("highlight-focus");
                    setAutoFocusPosition(false);
                  }, 1200);
                }
              }}
              value={employee.positionid || ""}
              onChange={(e) => {
                const newPosId = e.target.value;
                const newPos = positionsByDept[employee.departmentid]?.find((p) => p.id == newPosId);

                if (newPosId != employee.positionid) {
                  setConfirmFieldChange({
                    open: true,
                    field: "position",
                    newValue: newPos?.name,
                    newId: newPosId
                  });
                }
              }}
              disabled={!employee.departmentid}
              autoFocus
            >
              {(positionsByDept[employee.departmentid] || []).map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={isDate ? "date" : "text"}
              value={
                isDate
                  ? new Date(fieldValue).toISOString().split("T")[0]
                  : field === "contact"
                    ? formatContactNumber(fieldValue)
                    : fieldValue
              }
              autoFocus
              onChange={(e) => {
                let val = e.target.value;
                if (field === "contact") val = e.target.value.replace(/\D/g, "");
                setFieldValue(val);
              }}
              onKeyDown={(e) => handleKeyDown(e, field, isDate)}
              onBlur={(e) => handleFieldBlur(field, isDate)}
            />
          )
        ) : (
          <>
            {isDate
              ? new Date(employee[field]).toISOString().split("T")[0]
              : field === "contact"
                ? formatContactNumber(employee[field])
                : employee[field] || "—"}
            <MdEdit className="editIcon" onClick={() => handleEditClick(field, employee[field])} />
          </>
        )}
      </p>
    );
  };

  const filePicker = async () => {
    try {
      const filePaths = await window.fileAPI.selectFile({ type: "images", multi: false });
      if (Array.isArray(filePaths) && filePaths.length > 0) {
        const filePath = filePaths[0];
        const fileData = await window.fileAPI.readFileAsBase64(filePath);
        const fileExt = filePath.split(".").pop().toLowerCase();
        const base64Data = `data:image/${fileExt};base64,${fileData}`;

        const res = await window.employeeAPI.updateEmployee(employeeId, "employeeimage", base64Data);

        if (employee.employeeimage) {
          setPendingImage(base64Data);
          setConfirmImageChange(true);
        } else {
          const res = await window.employeeAPI.updateEmployee(employeeId, "employeeimage", base64Data);
          if (res.success) {
            setEmployee((prev) => ({ ...prev, employeeimage: res.imageUrl }));
            window.toast("Profile image updated.", "success");
          } else {
            window.toast("Upload failed.", "error");
          }
        }
      }
    } catch (err) {
      setIsError(true);
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
      const filterableRow = {
        ...row,
        status,
      };
      return Object.entries(selectedFilters).every(([col, vals]) => {
        return (
          col === "__activeColumn" || !vals.length || vals.includes(filterableRow[col])
        );
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

  if (!employee) return <div className="loadingContainer"><div className="spinner"></div></div>;

  return (
    <div className="employeeInfoContainer">
      <div className="employeeInfoHeader">
        <h2>Employee Profile</h2>
        <button
          onClick={() => {
            if (needsPositionUpdate) {
              window.toast("Please select a new position before leaving this page.", "error");
              return;
            }
            goBack();
          }}
        >
          ×
        </button>
      </div>

      <div className="employeeInfoGrid">
        <div className="employeeInfoPhoto">
          <div className="ImageContainer" onClick={filePicker}>
            {employee.employeeimage ? (
              <img src={employee.employeeimage} alt="Profile" className="previewImage" />
            ) : (
              <div className="placeholderPhoto" />
            )}
          </div>
        </div>

        <div className="employeeInfoMeta">
          <div className="employeeInfoName">
            {employee.employeeid} | {employee.name}
          </div>

          <div className="employeeInfoColumns">
            <div className="infoColumn">
              {renderEditableField("Department", "department")}
              {renderEditableField("Position", "position")}
              {renderEditableField("Employee Type", "type")}
              {renderEditableField("Leave Credit", "leavecredit")}
              {renderEditableField("Hire Date", "hiredate", true)}
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

      <ConfirmModal
        open={confirmFieldChange.open}
        title={`Confirm ${confirmFieldChange.field} change`}
        message={`Do you want to change ${confirmFieldChange.field} to "${confirmFieldChange.newValue}"?`}
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={handleConfirmFieldChange}
        onCancel={handleCancelFieldChange}
      />
    </div>
  );
};

export default EmployeeInformation;
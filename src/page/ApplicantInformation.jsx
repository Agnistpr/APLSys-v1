import React, { useEffect, useState, useMemo } from "react";
import { MdEdit } from "react-icons/md";
import DatePicker from "../components/DatePicker.jsx";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import Pagination from "../components/Pagination.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

const ApplicantInformation = ({ uid, applicantId, goBack }) => {
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

  const [needsPositionUpdate, setNeedsPositionUpdate] = useState(false);
  const [autoFocusPosition, setAutoFocusPosition] = useState(false);

  const [confirmFieldChange, setConfirmFieldChange] = useState({
    open: false,
    field: null,
    newValue: "",
    newId: ""
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
    if (!applicant || deptPosList.length === 0) return;

    const deptObj = deptPosList.find((d) => d.departmentname === applicant.department);
    const posObj = deptPosList.find((d) => d.positionname === applicant.position);

    setApplicant((prev) => ({
      ...prev,
      departmentid: deptObj?.departmentid || prev.departmentid,
      positionid: posObj?.positionid || prev.positionid,
    }));
  }, [deptPosList, applicant]);

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      const data = await window.attendanceAPI.getApplicantAttendance(applicantId, selectedDate);
      setAttendance(data || []);
      setLoading(false);
    };
    fetchAttendance();
  }, [applicantId, selectedDate]);

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

  const toInputDate = (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d)) return "";
    return d.toISOString().split("T")[0];
  };

  const handleEditClick = (field, value) => {
    setEditingField(field);
    if (field === "name") {
      setFieldValue({
        firstname: value?.firstname || applicant?.firstname || "",
        middlename: value?.middlename || applicant?.middlename || "",
        lastname: value?.lastname || applicant?.lastname || "",
      });
    } else {
      setFieldValue(value ?? "");
    }
  };

  const handleKeyDown = async (e, field, isDate = false) => {
    if (e.key === "Enter") {
      setEditingField(null);
      let safeValue;

      if (isDate) {
        if (!fieldValue) {
          safeValue = "";
        } else {
          const d = new Date(fieldValue);
          safeValue = !isNaN(d) ? d.toISOString().split("T")[0] : "";
        }
      } else {
        safeValue = fieldValue.trim();
      }

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

  const handleKeyDownName = (e) => {
    if (e.key === "Enter") {
      handleBlurName();
    }
  };

  const handleBlurName = () => {
    if (!applicant) return;
    const changed =
      fieldValue.firstname !== (applicant.firstname || "") ||
      fieldValue.middlename !== (applicant.middlename || "") ||
      fieldValue.lastname !== (applicant.lastname || "");

    if (changed) {
      setPendingChange({ field: "name", value: { ...fieldValue } });
      setConfirmChanges(true);
    } else {
      setEditingField(null);
    }
  };

  const formatContactNumber = (value) => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");

    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  };

  const formatTime12Hour = (timeString) => {
    if (!timeString) return "";
    const parts = timeString.split(":");
    if (parts.length < 2) return timeString;
    const hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const suffix = hour >= 12 ? "PM" : "AM";
    const h = ((hour + 11) % 12) + 1;
    return `${h}:${minute.padStart(2, "0")} ${suffix}`;
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    const { field, value } = pendingChange;

    try {
      if (field === "name") {
        const oldFullName = `${applicant.firstname || ""} ${applicant.middlename || ""} ${applicant.lastname || ""}`
          .replace(/\s+/g, " ")
          .trim();
        const { firstname, middlename, lastname } = value;
        
        await Promise.all([
          window.applicantAPI.updateApplicant(applicantId, "firstname", firstname.trim()),
          window.applicantAPI.updateApplicant(applicantId, "middlename", middlename.trim()),
          window.applicantAPI.updateApplicant(applicantId, "lastname", lastname.trim()),
        ]);

        setApplicant((prev) => ({
          ...prev,
          firstname,
          middlename,
          lastname,
        }));

        window.toast("Name updated successfully", "success");

        const newFullName = `${firstname} ${middlename || ""} ${lastname}`.replace(/\s+/g, " ").trim();
        await window.userAPI.logAction(uid, `updated ${oldFullName}`, `Changed name to ${newFullName}`);
      } else {
        let dbField = field;
        let dbValue = value;

        if (field === "department") dbField = "departmentid";
        if (field === "position") dbField = "positionid";

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

        const fullName = `${applicant.firstname || ""} ${applicant.middlename || ""} ${applicant.lastname || ""}`.replace(/\s+/g, " ").trim();
        await window.userAPI.logAction(uid, `updated ${fullName}`, `${field} changed to ${value}`);
      }

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
      await window.applicantAPI.updateApplicant(applicantId, dbField, newId);

      setApplicant((prev) => {
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
      const fullName = `${applicant.firstname || ""} ${applicant.middlename || ""} ${applicant.lastname || ""}`.replace(/\s+/g, ' ').trim();
      await window.userAPI.logAction(uid, `updated ${fullName}`, `Changed ${field} to ${newValue}`);
    } catch (err) {
      console.error("Update failed:", err);
      window.toast("Update failed.", "error");
    } finally {
      setConfirmFieldChange({ open: false, field: null, newValue: "", newId: "" });
    }
  };

  const handleCancelFieldChange = () => {
    setConfirmFieldChange((prev) => {
      setApplicant((a) => {
        const copy = { ...a };
        if (prev.field === "department") copy.departmentid = a.departmentid;
        if (prev.field === "position") copy.positionid = a.positionid;
        return copy;
      });
      return { open: false, field: null, newValue: "", newId: "" };
    });
  };

  const handleFieldBlur = (field, isDate) => {
    if (field === "name") {
      const currentBuilt = `${applicant?.lastname || ""}, ${applicant?.firstname || ""}`;
      if ((fieldValue.lastname || "") !== (applicant?.lastname || "") ||
          (fieldValue.firstname || "") !== (applicant?.firstname || "") ||
          (fieldValue.middlename || "") !== (applicant?.middlename || "")) {
        setPendingChange({ field, value: fieldValue });
        setConfirmChanges(true);
      } else {
        setEditingField(null);
      }
      return;
    }

    if (fieldValue !== (applicant?.[field] ?? "")) {
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

                if (newDeptId != applicant.departmentid) {
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
              value={applicant.positionid || ""}
              onChange={(e) => {
                const newPosId = e.target.value;
                const newPos = positionsByDept[applicant.departmentid]?.find((p) => p.id == newPosId);

                if (newPosId != applicant.positionid) {
                  setConfirmFieldChange({
                    open: true,
                    field: "position",
                    newValue: newPos?.name,
                    newId: newPosId
                  });
                }
              }}
              disabled={!applicant.departmentid}
              autoFocus
            >
              {(positionsByDept[applicant.departmentid] || []).map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={
                isDate
                  ? "date"
                  : field.includes("shift")
                    ? "time"
                    : "text"
              }
              value={
                isDate
                  ? toInputDate(fieldValue)
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
              ? applicant[field]
                ? toInputDate(applicant[field])
                : "—"
              : field === "contact"
                ? formatContactNumber(applicant[field])
                : field.includes("shift") && applicant[field]
                  ? formatTime12Hour(applicant[field])
                  : applicant[field] || "—"}
            <MdEdit className="editIcon" onClick={() => handleEditClick(field, applicant[field])} />
          </>
        )}
      </p>
    );
  };

  const renderEditableName = () => {
    const builtName = `${applicant?.lastname || ""}, ${applicant?.firstname || ""}${applicant?.middlename ? ` ${applicant.middlename.charAt(0)}.` : ""}`.trim();

    return (
      <div className="employeeInfoName">
        {editingField === "name" ? (
          <div className="editableField nameInputs"
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                handleBlurName();
              }
            }}
          >
            <input
              type="text"
              placeholder="Last Name"
              value={fieldValue.lastname || ""}
              onChange={(e) =>
                setFieldValue((prev) => ({ ...prev, lastname: e.target.value }))
              }
              onKeyDown={handleKeyDownName}
              autoFocus
            />
            <input
              type="text"
              placeholder="First Name"
              value={fieldValue.firstname || ""}
              onChange={(e) =>
                setFieldValue((prev) => ({ ...prev, firstname: e.target.value }))
              }
              onKeyDown={handleKeyDownName}
            />
            <input
              type="text"
              placeholder="Middle Name"
              value={fieldValue.middlename || ""}
              onChange={(e) =>
                setFieldValue((prev) => ({ ...prev, middlename: e.target.value }))
              }
              onKeyDown={handleKeyDownName}
            />
          </div>
        ) : (
          <>
            {applicant?.applicantid} | <p className="editableField">{builtName}</p>
            <MdEdit
              className="editIcon"
              onClick={() => {
                setEditingField("name");
                setFieldValue({
                  firstname: applicant.firstname || "",
                  middlename: applicant.middlename || "",
                  lastname: applicant.lastname || "",
                });
              }}
            />
          </>
        )}
      </div>
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
          const fullName = `${applicant.firstname || ""} ${applicant.middlename || ""} ${applicant.lastname || ""}`.replace(/\s+/g, ' ').trim();
          await window.userAPI.logAction(uid, `updated ${fullName}`, `Updated their profile image`);
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
        const fullName = `${applicant.firstname || ""} ${applicant.middlename || ""} ${applicant.lastname || ""}`.replace(/\s+/g, ' ').trim();
        await window.userAPI.logAction(uid, `updated ${fullName}`, `Updated their profile image`);
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
    if (!start || !end) return 0;
    const startDate = new Date(`1970-01-01T${start}`);
    const endDate = new Date(`1970-01-01T${end}`);
    return (endDate - startDate) / (1000 * 60);
  };

  const formatShift = (row) => {
    if (row.shift) return row.shift;
    if (row.shiftstart && row.shiftend) {
      const hours = Math.round((calculateTimeDiff(row.shiftstart, row.shiftend) / 60) * 100) / 100;
      return `${formatTime12Hour(row.shiftstart)} - ${formatTime12Hour(row.shiftend)} (${hours}h)`;
    }
    return "-";
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

  return (
    <div className="employeeInfoContainer">
      <div className="employeeInfoHeader">
        <h2>Applicant Profile</h2>
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
            {applicant.applicantimage ? (
              <img src={applicant.applicantimage} alt="Profile" className="previewImage" />
            ) : (
              <div className="placeholderPhoto" />
            )}
          </div>
          {uploadMessage && <div className={`uploadMessage ${isError ? "error" : ""}`}>{uploadMessage}</div>}
        </div>

        <div className="employeeInfoMeta">
          {renderEditableName()}

          <div className="employeeInfoColumns">
            <div className="infoColumn">
              {renderEditableField("Department", "department")}
              {renderEditableField("Position", "position")}
              {renderEditableField("Application Status", "status")}
              {renderEditableField("Application Date", "applicationdate", true)}
              {renderEditableField("Training Date", "trainingdate", true)}
              {renderEditableField("Shift Start", "shiftstart")}
              {renderEditableField("Shift End", "shiftend")}
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
              shift: [...new Set(attendance.map((r) => formatShift(r)))],
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
                    <td>{formatShift(row)}</td>
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

export default ApplicantInformation;
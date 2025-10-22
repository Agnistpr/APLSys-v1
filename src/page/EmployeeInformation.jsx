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

  const [selectedDate, setSelectedDate] = useState(() => {
    return (
      localStorage.getItem("attendanceDate") ||
      ''
    );
  });

  const columns = ["date", "shift", "timein", "timeout", "diff", "status"];
  const columnLabelMap = {
    date: "Date",
    shift: "Shift Schedule",
    timein: "Time In",
    timeout: "Time Out",
    diff: "UT/OT",
    status: "Status",
  };

  const validationRules = {
    contact: {
      regex: /^\d{11}$/,
      message: "Contact number must be exactly 11 digits.",
    },
    pagibig_number: {
      regex: /^\d{12}$/,
      message: "PAGIBIG number must be exactly 12 digits.",
    },
    sss_number: {
      regex: /^\d{10}$/,
      message: "SSS number must be exactly 10 digits.",
    },
    bir_number: {
      regex: /^\d{9}$/,
      message: "BIR TIN must be exactly 9 digits.",
    },
    philhealth_number: {
      regex: /^\d{12}$/,
      message: "PhilHealth number must be exactly 12 digits.",
    },
  };

  const departments = useMemo(() => {
    const unique = [];
    const seen = new Set();
    deptPosList.forEach((d) => {
      if (!seen.has(d.departmentid)) {
        seen.add(d.departmentid);
        unique.push({
          id: d.departmentid,
          name: d.departmentname,
        });
      }
    });
    return unique;
  }, [deptPosList]);

  const positionsByDept = useMemo(() => {
    const map = {};
    deptPosList.forEach((d) => {
      if (!map[d.departmentid]) map[d.departmentid] = [];
      map[d.departmentid].push({
        id: d.positionid,
        name: d.positionname,
      });
    });
    return map;
  }, [deptPosList]);

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
      setEmployee(data);
      if (data?.image) {
        setSelectedImage({
          type: data.imageType,
          data: data.image,
        });
      }
    };

    const fetchAttendance = async () => {
      setLoading(true);
      const data = await window.attendanceAPI.getEmployeeAttendance(
        employeeId,
        selectedDate
      );
      setLoading(false);
      setAttendance(data);
    };

    fetchEmployee();
    fetchAttendance();
  }, [employeeId, selectedDate]);

  const calculateTimeDiff = (start, end) => {
    const startDate = new Date(`1970-01-01T${start}`);
    const endDate = new Date(`1970-01-01T${end}`);
    return (endDate - startDate) / (1000 * 60);
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
      setEditingField(null);
      let safeValue = isDate
        ? new Date(fieldValue).toISOString().split("T")[0]
        : fieldValue.trim();

      if (validationRules[field]) {
        const { regex, message } = validationRules[field];
        if (!regex.test(safeValue)) {
          window.toast(message, "error");
          return;
        }
      }

      if (field === "position") {
        const dept = employee.department;
        const pos = safeValue;
        const validCombo = deptPosList.some(
          (d) =>
            d.departmentname.toLowerCase() === dept.toLowerCase() &&
            d.positionname.toLowerCase() === pos.toLowerCase()
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

    // map name fields to id columns
    if (field === "department") dbField = "departmentid";
    if (field === "position") dbField = "positionid";

    try {
      await window.employeeAPI.updateEmployee(employeeId, dbField, dbValue);

      // if department changed, reset position
      if (field === "department") {
        await window.employeeAPI.updateEmployee(employeeId, "positionid", null);
        setEmployee((prev) => ({ ...prev, positionid: null, position: "---" }));
      }

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
                setEmployee((prev) => ({
                  ...prev,
                  departmentid: newDeptId,
                  department: newDept?.name,
                  positionid: null,
                  position: "---",
                }));
                setFieldValue(newDeptId);
              }}
              onBlur={() => setEditingField(null)}
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
              value={employee.positionid || ""}
              onChange={(e) => {
                const newPosId = e.target.value;
                const newPos =
                  positionsByDept[employee.departmentid]?.find(
                    (p) => p.id == newPosId
                  );
                setEmployee((prev) => ({
                  ...prev,
                  positionid: newPosId,
                  position: newPos?.name,
                }));
                setFieldValue(newPosId);
              }}
              onBlur={() => setEditingField(null)}
              disabled={!employee.departmentid}
              autoFocus
              onKeyDown={(e) => handleKeyDown(e, "position")}
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
                  : fieldValue
              }
              autoFocus
              onChange={(e) => setFieldValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, field, isDate)}
              onBlur={() => setEditingField(null)}
            />
          )
        ) : (
          <>
            {isDate
              ? new Date(employee[field]).toISOString().split("T")[0]
              : employee[field] || "—"}
            <MdEdit
              className="editIcon"
              onClick={() => handleEditClick(field, employee[field])}
            />
          </>
        )}
      </p>
    );
  };

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
      const filePaths = await window.fileAPI.selectFile({ type: "images", multi: false });
      if (Array.isArray(filePaths) && filePaths.length > 0) {
        const res = await handleFile(filePaths[0]);
        if (res) {
          setSelectedImage(res);
          setUploadMessage("Profile image selected. Saving...");
          setIsError(false);
          await saveProfileImage(res);
        }
      } else {
        setIsError(true);
        setUploadMessage("No image selected.");
      }
      setTimeout(() => setUploadMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setIsError(true);
      setUploadMessage("An error occurred while selecting the file.");
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  const saveProfileImage = async (image = selectedImage) => {
    if (!image) return;
    try {
      const res = await window.employeeAPI.updateEmployee(employeeId, "employeeimage", image.data);
      if (res.success) {
        setUploadMessage("Profile image saved successfully.");
        setIsError(false);
      } else {
        setUploadMessage("Failed to save image.");
        setIsError(true);
      }
    } catch (err) {
      console.error(err);
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

  const filtered = useMemo(() => {
    return attendance.filter((row) => {
      const expectedMinutes = calculateTimeDiff(row.shiftstart, row.shiftend);
      const actualMinutes = calculateTimeDiff(row.timein, row.timeout);
      const diff = actualMinutes - expectedMinutes;
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
        case "shift":
          aVal = `${a.shiftstart}-${a.shiftend}`;
          bVal = `${b.shiftstart}-${b.shiftend}`;
          break;
        case "status":
          const diffA = calculateTimeDiff(a.timein, a.timeout) - calculateTimeDiff(a.shiftstart, a.shiftend);
          const diffB = calculateTimeDiff(b.timein, b.timeout) - calculateTimeDiff(b.shiftstart, b.shiftend);
          aVal = diffA < 0 ? "Undertime" : "On time / Overtime";
          bVal = diffB < 0 ? "Undertime" : "On time / Overtime";
          break;
        case "diff":
          aVal = calculateTimeDiff(a.timein, a.timeout) - calculateTimeDiff(a.shiftstart, a.shiftend);
          bVal = calculateTimeDiff(b.timein, b.timeout) - calculateTimeDiff(b.shiftstart, b.shiftend);
          break;
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
        <button onClick={goBack}>x</button>
      </div>

      <div className="employeeInfoGrid">
        <div className="employeeInfoPhoto">
          <div className="ImageContainer" onClick={filePicker}>
            {selectedImage ? (
              <img src={`data:${selectedImage.type};base64,${selectedImage.data}`} alt="Employee" className="previewImage" />
            ) : employee.employeeimage ? (
              <img src={`data:image/png;base64,${employee.employeeimage}`} alt="Profile" className="previewImage" />
            ) : (
              <div className="placeholderPhoto" />
            )}
          </div>
        </div>

        <div className="employeeInfoMeta">
          <div className="employeeInfoName">{employee.employeeid} | {employee.name}</div>
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
          <SortDropdown
            columns={["date", "shift", "timeIn", "arrivalDiff", "arrivalStatus", "timeOut", "hoursWorked", "workStatus"]}
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
            uniqueValues={uniqueValues}
            columnLabelMap={{
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
                  {Array.from({ length: 8 }).map((_, i) => (
                    <td key={i}>
                      <div className="shimmerCell" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={8}>No records found.</td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
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
                  <td>{row.shift}</td>
                  <td>{row.timeIn || "-"}</td>
                  <td style={{ color: row.arrivalDiff > 0 ? "red" : row.arrivalDiff < 0 ? "green" : "black" }}>
                    {row.arrivalDiff === 0 ? "-" : `${row.arrivalDiff > 0 ? "+" : ""}${row.arrivalDiff}`}
                  </td>
                  <td>{row.arrivalStatus}</td>
                  <td>{row.timeOut || "-"}</td>
                  <td style={{ color: row.workStatus === "Overtime" ? "green" : row.workStatus === "Undertime" ? "red" : "black" }}>
                    {row.hoursWorked || "-"}
                  </td>
                  <td>{row.workStatus}</td>
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
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
        <div className="emptyTableFooter"></div>
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
    </div>
  );
};

export default EmployeeInformation;
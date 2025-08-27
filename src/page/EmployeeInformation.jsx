import React, { useEffect, useState } from "react";
import { MdEdit } from "react-icons/md";

const EmployeeInformation = ({ employeeId, goBack }) => {
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const [uploadMessage, setUploadMessage] = useState("");
  const [isError, setIsError] = useState(false);

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
      const data = await window.fileAPI.getEmployeeAttendance(employeeId);
      setAttendance(data);
    };
    fetchEmployee();
    fetchAttendance();
  }, [employeeId]);

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

      // Make sure dates are saved as YYYY-MM-DD string
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

      <h3 className="attendanceHeader">Attendance Records</h3>
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
            {attendance.map((entry, index) => {
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
    </div>
  );
};

export default EmployeeInformation;

import { ipcMain, dialog, app } from "electron";
import fs from "fs";
import path from "path";
import supabase from "./supabaseClient.js";

// LOGGING -----------------------------------------------------------------------------
const logPath = app.isPackaged
  ? path.join(app.getPath("userData"), "log.txt")
  : path.join(process.cwd(), "log.txt");

function logMessage(message) {
  const time = new Date().toISOString();
  fs.appendFileSync(logPath, `[${time}] ${message}\n`);
}

process.on("uncaughtException", (err) => {
  logMessage(`ERROR: ${err.stack || err}`);
});
process.on("unhandledRejection", (reason, p) => {
  logMessage(`UNHANDLED REJECTION: ${reason}`);
});
// -----------------------------------------------------------------------------

// --------------------------------------------------------------------
// Permissions for now
const allowedRoles = ['Finance', 'President', 'HR Generalist', 'IT'];
// --------------------------------------------------------------------

// FORMATTING --------------------------------------------------------------------
// Date formatting
function formatDateToISO(date) {
  if (!date) return "";
  try {
    if (typeof date === "string") {
      return date.split("T")[0];
    }
    return new Date(date).toISOString().split("T")[0];
  } catch (e) {
    return String(date);
  }
}

// Time formatting
function formatTime12(timeStr) {
  if (!timeStr && timeStr !== 0) return "";
  const t = String(timeStr);
  const parts = t.split(":");
  if (parts.length < 2) return t;
  let h = parseInt(parts[0], 10);
  const m = parts[1].padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr && timeStr !== 0) return null;
  const t = String(timeStr);
  const parts = t.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}
// --------------------------------------------------------------------

// CSV --------------------------------------------------------------------
function buildCSV(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  return csv;
}
// --------------------------------------------------------------------

// LOG ACTION--------------------------------------------------------------------
async function logUserAction(uid, useraction, description = "") {
  const now = new Date().toLocaleString("sv-SE").replace(" ", "T");
  const { error } = await supabase.from("userlogs").insert([
    {
      user_id: uid,
      useraction,
      description,
      dateofaction: now
    },
  ]);

  if (error) throw error;
}

ipcMain.handle("logAction", async (event, { uid, useraction, description = "" }) => {
  try {
    await logUserAction(uid, useraction, description);
    return { success: true };
  } catch (err) {
    console.error("Error in logAction:", err);
    return { success: false, error: err.message };
  }
});
// --------------------------------------------------------------------


// ATTENDANCE -----------------------------------------------------------------------------
ipcMain.handle("getAttendanceColumns", async () => {
  try {
    const { data, error } = await supabase.from("attendance").select("*").limit(1);
    if (error) {
      logMessage(`getAttendanceColumns Supabase error: ${error.message}`);
      return [];
    }
    if (!data?.length) return [];
    return Object.keys(data[0]).filter((col) => col !== "attendanceid");
  } catch (err) {
    logMessage(`getAttendanceColumns error: ${err.message}`);
    return [];
  }
});

ipcMain.handle("importAttendance", async (event, { rows }) => {
  if (!Array.isArray(rows)) return { error: "Invalid rows payload" };

  try {
    const [{ data: employees, error: empErr }, { data: applicants, error: appErr }] =
      await Promise.all([
        supabase.from("employee").select("employeeid, firstname, middlename, lastname"),
        supabase
          .from("applicant")
          .select("applicantid, firstname, middlename, lastname, status")
          .neq("status", "Hired"),
      ]);

    if (empErr || appErr) throw empErr || appErr;

    const normalize = (s = "") =>
      s.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();

    const startsWithLoose = (target, partial) => target.startsWith(partial);

    const findProfile = (fullname) => {
      if (!fullname) return { id: null, role: null };

      const [lastRaw, firstRaw] = fullname.split(",").map(normalize);
      if (!lastRaw || !firstRaw) return { id: null, role: null };

      let lastMatches = employees.filter((e) => normalize(e.lastname) === lastRaw);
      if (lastMatches.length === 1) return { id: lastMatches[0].employeeid, role: "Employee" };

      let matched = lastMatches.find(
        (e) => normalize(`${e.firstname} ${e.middlename || ""}`).trim() === firstRaw
      );

      if (!matched) {
        const partials = lastMatches.filter((e) => {
          const fullFirst = normalize(`${e.firstname} ${e.middlename || ""}`);
          return startsWithLoose(fullFirst, firstRaw);
        });
        if (partials.length === 1) matched = partials[0];
      }

      if (!matched) {
        const fullNorm = normalize(fullname.replace(",", ""));
        matched = employees.find(
          (e) =>
            normalize(`${e.lastname} ${e.firstname} ${e.middlename || ""}`) === fullNorm
        );
      }

      if (matched) return { id: matched.employeeid, role: "Employee" };

      lastMatches = applicants.filter((a) => normalize(a.lastname) === lastRaw);
      if (lastMatches.length === 1) return { id: lastMatches[0].applicantid, role: "Applicant" };

      matched = lastMatches.find(
        (a) => normalize(`${a.firstname} ${a.middlename || ""}`).trim() === firstRaw
      );

      if (!matched) {
        const partials = lastMatches.filter((a) => {
          const fullFirst = normalize(`${a.firstname} ${a.middlename || ""}`);
          return startsWithLoose(fullFirst, firstRaw);
        });
        if (partials.length === 1) matched = partials[0];
      }

      if (!matched) {
        const fullNorm = normalize(fullname.replace(",", ""));
        matched = applicants.find(
          (a) =>
            normalize(`${a.lastname} ${a.firstname} ${a.middlename || ""}`) === fullNorm
        );
      }

      return matched
        ? { id: matched.applicantid, role: "Applicant" }
        : { id: null, role: null };
    };

    rows = rows.filter(
      (r) => r.fullname && r.date && r.timein && r.timeout && r.timein.trim() && r.timeout.trim()
    );

    if (!rows.length) {
      return { error: "All rows were incomplete or missing fields" };
    }

    const cleaned = rows.map((r) => {
      if (r.profileid && Number(r.profileid) > 0) {
        return {
          date: r.date,
          profileid: Number(r.profileid),
          timein: r.timein,
          timeout: r.timeout,
          role: "Employee",
        };
      }
      const match = findProfile(r.fullname);
      return {
        date: r.date,
        profileid: match.id,
        timein: r.timein,
        timeout: r.timeout,
        role: match.role,
      };
    });

    const validRows = cleaned.filter((r) => r.profileid != null);
    if (!validRows.length) {
      logMessage(`❌ No matches found. Example input: ${JSON.stringify(rows[0])}`);
      return { error: "No valid rows with matched profile IDs" };
    }

    logMessage(`🟢 Ready to import ${validRows.length} attendance records`);
    logMessage(`Sample record: ${JSON.stringify(validRows[0], null, 2)}`);

    const { data, error } = await supabase.from("attendance").insert(validRows);
    if (error) throw error;

    return { success: true, inserted: data?.length ?? 0 };
  } catch (err) {
    console.error("❌ importAttendance error:", err);
    return { error: err.message };
  }
});

// -----too bothered to organize for now---

ipcMain.handle("exportEmployees", async () => {
  try {
    const { data, error } = await supabase
      .from("employee")
      .select(`
        employeeid,
        lastname,
        firstname,
        middlename,
        contact,
        address,
        email,
        hiredate,
        sss_number,
        pagibig_number,
        philhealth_number,
        bir_number,
        leavecredit,
        shiftstart,
        shiftend,
        department:departmentid ( departmentname ),
        position:positionid ( positionname ),
        type
      `)
      .order("employeeid", { ascending: true });

    if (error) throw error;
    const rowsRaw = data || [];
    if (rowsRaw.length === 0) return { success: false, message: "No employees to export" };

    const rows = rowsRaw.map((r) => ({
      employeeid: r.employeeid,
      lastname: r.lastname,
      firstname: r.firstname,
      middlename: r.middlename,

      type: r.type,
      department: r.department?.departmentname ?? (Array.isArray(r.department) ? r.department[0]?.departmentname : "") ?? "",
      position: r.position?.positionname ?? (Array.isArray(r.position) ? r.position[0]?.positionname : "") ?? "",
      shiftstart: r.shiftstart ? formatTime12(r.shiftstart) : "",
      shiftend: r.shiftend ? formatTime12(r.shiftend) : "",
      leavecredit: r.leavecredit,

      contact: r.contact,
      address: r.address,
      email: r.email,
      hiredate: formatDateToISO(r.hiredate),

      sss_number: r.sss_number,
      pagibig_number: r.pagibig_number,
      philhealth_number: r.philhealth_number,
      bir_number: r.bir_number,
    }));

    const csv = buildCSV(rows);

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Employee Export",
      defaultPath: "employees.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Employees exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportLeave", async (event, status) => {
  try {
    const { data, error } = await supabase
      .from("leave")
      .select(`
        leaveid,
        employeeid,
        start_date,
        end_date,
        reason,
        status,
        type,
        is_paid,
        employee:employeeid (
          firstname,
          middlename,
          lastname,
          positionid,
          departmentid
        )
      `)
      .eq("status", status)
      .order("leaveid", { ascending: true });

    if (error) throw error;

    const rowsRaw = data || [];
    if (rowsRaw.length === 0) return { success: false, message: "No leave records to export" };

    const rows = rowsRaw.map((r) => {
      const emp = r.employee ?? (Array.isArray(r.employee) ? r.employee[0] : {}) ?? {};
      const fullName = `${emp.lastname}, ${emp.firstname}${emp.middlename ? ` ${emp.middlename[0]}.` : ""}`;

      return {
        leaveid: r.leaveid,
        employeeid: r.employeeid,
        name: fullName,
        start_date: formatDateToISO(r.start_date),
        end_date: formatDateToISO(r.end_date),
        reason: r.reason,
        status: r.status,
        type: r.type,
        paid: r.is_paid ? "Yes" : "No",
      };
    });

    const csv = buildCSV(rows);

    const { filePath } = await dialog.showSaveDialog({
      title: `Export ${status} Leave Records`,
      defaultPath: `leave_${status.toLowerCase()}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Leave records exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Leave export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportAttendance", async (event, date = null) => {
  try {
    // logMessage("Starting exportAttendance...");

    const targetDate = date ? formatDateToISO(date) : null;
    
    const query = supabase
      .from("attendance")
      .select("attendanceid, date, timein, timeout, profileid, role");

    if (targetDate) {
      query.eq("date", targetDate).order("timein", { ascending: true });
    } else {
      query.order("date", { ascending: false });
    }

    const { data: attendanceBase, error } = await query;
    if (error) throw error;

    const attendance = await Promise.all(
      (attendanceBase || []).map(async (a) => {
        const role = (a.role || "Employee").toLowerCase();
        let profile = null;

        if (role === "employee") {
          const { data } = await supabase
            .from("employee")
            .select(
              "employeeid, lastname, firstname, middlename, positionid, shiftstart, shiftend, departmentid"
            )
            .eq("employeeid", a.profileid)
            .single();
          profile = data;
        } else if (role === "applicant") {
          const { data } = await supabase
            .from("applicant")
            .select(
              "applicantid, lastname, firstname, middlename, positionid, shiftstart, shiftend, departmentid"
            )
            .eq("applicantid", a.profileid)
            .single();
          profile = data;
        }

        return { ...a, employee: profile };
      })
    );

    const positionIds = [...new Set((attendance || []).map(a => a.employee?.positionid).filter(Boolean))];
    const departmentIds = [...new Set((attendance || []).map(a => a.employee?.departmentid).filter(Boolean))];

    const { data: positions } = await supabase
      .from("position")
      .select("positionid, positionname")
      .in("positionid", positionIds.length ? positionIds : [-1]);
    const posMap = new Map((positions || []).map(p => [p.positionid, p.positionname]));

    const { data: departments } = await supabase
      .from("department")
      .select("departmentid, departmentname")
      .in("departmentid", departmentIds.length ? departmentIds : [-1]);
    const deptMap = new Map((departments || []).map(d => [d.departmentid, d.departmentname]));

    const parseDurationLabel = (mins) => {
      if (mins == null || isNaN(mins)) return "";
      const abs = Math.abs(mins);
      const hh = Math.floor(abs / 60);
      const mm = abs % 60;
      return `${hh}h ${mm}m`;
    };

    const ARRIVAL_TOLERANCE = 15;
    const WORK_TOLERANCE = 15;

    const rows = (attendance || []).map((a) => {
      const emp = a.employee ?? {};
      const pos = posMap.get(emp.positionid) || "";
      const department = deptMap.get(emp.departmentid) || "";

      const timeInMin = timeToMinutes(a.timein);
      const timeOutMin = timeToMinutes(a.timeout);
      const shiftStartMin = timeToMinutes(emp.shiftstart);
      const shiftEndMin = timeToMinutes(emp.shiftend);

      let arrivalDiff = 0;
      let arrivalStatus = "On Time";
      let workStatus = "Exact Time";
      let hoursWorked = "0h 0m";
      let workDiff = 0;

      if (
        timeInMin != null &&
        timeOutMin != null &&
        shiftStartMin != null &&
        shiftEndMin != null
      ) {
        arrivalDiff = timeInMin - shiftStartMin;
        if (Math.abs(arrivalDiff) <= ARRIVAL_TOLERANCE) {
          arrivalDiff = 0;
          arrivalStatus = "On Time";
        } else {
          arrivalStatus = arrivalDiff > 0 ? "Late" : "Early";
        }

        const actualDur = timeOutMin - timeInMin;
        const shiftDur = shiftEndMin - shiftStartMin;
        workDiff = actualDur - shiftDur;
        hoursWorked = parseDurationLabel(actualDur);

        if (Math.abs(workDiff) <= WORK_TOLERANCE) {
          workStatus = "Exact Time";
        } else {
          workStatus = workDiff > 0 ? "Overtime" : "Undertime";
        }
      }

      return {
        AttendanceID: a.attendanceid,
        Date: formatDateToISO(a.date),
        Role: a.role,
        ProfileID: emp.employeeid ?? emp.applicantid ?? "",
        FullName: `${emp.lastname ?? ""}, ${emp.firstname ?? ""}${emp.middlename ? " " + emp.middlename.charAt(0) + "." : ""}`,
        Department: department,
        Position: pos,
        Shift: emp.shiftstart && emp.shiftend
          ? `${formatTime12(emp.shiftstart)} - ${formatTime12(emp.shiftend)}`
          : "",
        TimeIn: formatTime12(a.timein),
        TimeOut: formatTime12(a.timeout),
        ArrivalDifference: parseDurationLabel(arrivalDiff),
        ArrivalStatus: arrivalStatus,
        HoursWorked: hoursWorked,
        WorkDifference: parseDurationLabel(workDiff),
        WorkStatus: workStatus
      };
    });

    if (!rows.length) {
      return { success: false, message: "No attendance records found to export." };
    }

    const csv = buildCSV(rows);

    const today = formatDateToISO(new Date());
    const filenameDate = targetDate || `all_${today}`;

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Attendance Export",
      defaultPath: `attendance_export_${filenameDate}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    await fs.promises.writeFile(filePath, csv, "utf8");
    // logMessage(`Attendance exported to ${filePath} (${rows.length} rows)`);

    // await logUserAction(uid, "Exported Attendance");

    return { success: true, filePath, count: rows.length };
  } catch (err) {
    logMessage("exportAttendance error: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportAbsence", async (event, date) => {
  try {
    const targetDate = date ? formatDateToISO(date) : formatDateToISO(new Date());

    const { data: employees, error: empErr } = await supabase
      .from("employee")
      .select(`
        employeeid,
        lastname,
        firstname,
        middlename,
        shiftstart,
        shiftend,
        department:departmentid ( departmentname ),
        position:positionid ( positionname )
      `)
      .order("lastname", { ascending: true });
    if (empErr) throw empErr;

    const { data: attendance } = await supabase.from("attendance").select("employeeid").eq("date", targetDate);
    const { data: leaves } = await supabase.from("leave").select("employeeid").eq("date", targetDate);

    const presentIds = new Set((attendance || []).map((r) => r.employeeid));
    const leaveIds = new Set((leaves || []).map((r) => r.employeeid));

    const absent = (employees || []).filter((e) => !presentIds.has(e.employeeid) && !leaveIds.has(e.employeeid));

    if (absent.length === 0) return { success: false, message: "No absent employees to export" };

    const rows = absent.map((r) => ({
      ID: r.employeeid,
      "Last Name": r.lastname,
      "First Name": r.firstname,
      "Middle Name": r.middlename,
      Department: r.department?.departmentname ?? (Array.isArray(r.department) ? r.department[0]?.departmentname : "") ?? "",
      Position: r.position?.positionname ?? (Array.isArray(r.position) ? r.position[0]?.positionname : "") ?? "",
      "Shift Start": r.shiftstart ?? "",
      "Shift End": r.shiftend ?? "",
      Date: targetDate,
    }));

    const csv = buildCSV(rows);
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Absent Employees Export",
      defaultPath: `absent_${targetDate}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Absent employees exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportInventory", async () => {
  try {
    const { data, error } = await supabase.from("inventory").select("itemid, itemname, quantity, lastmodified").order("itemid", { ascending: true });
    if (error) throw error;

    const rows = (data || []).map((r) => ({
      "Item ID": r.itemid,
      "Item Name": r.itemname,
      Quantity: r.quantity,
      "Last Modified": formatDateToISO(r.lastmodified),
    }));

    if (rows.length === 0) return { success: false, message: "No inventory records to export" };

    const csv = buildCSV(rows);
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Inventory Export",
      defaultPath: "inventory.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage?.(`Inventory exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage?.("Inventory export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportInventoryLogs", async (event, date = null) => {
  try {
    let query = supabase
      .from("inventorylogs")
      .select(`
        logid,
        itemid,
        quantity,
        date,
        role,
        profileid,
        item:itemid ( itemname )
      `)
      .order("date", { ascending: true });

    if (date) query = query.eq("date", date);

    const { data: logsBase, error } = await query;
    if (error) throw error;
    if (!logsBase || !logsBase.length) return { success: false, message: "No logs to export" };

    const employeeIds = logsBase
      .filter(l => (l.role || "").toLowerCase() === "employee" && l.profileid)
      .map(l => l.profileid);
    const applicantIds = logsBase
      .filter(l => (l.role || "").toLowerCase() === "applicant" && l.profileid)
      .map(l => l.profileid);

    const { data: employees } = await supabase
      .from("employee")
      .select("employeeid, firstname, middlename, lastname, departmentid, positionid")
      .in("employeeid", employeeIds.length ? employeeIds : [-1]);

    const { data: applicants } = await supabase
      .from("applicant")
      .select("applicantid, firstname, middlename, lastname, departmentid, positionid")
      .in("applicantid", applicantIds.length ? applicantIds : [-1]);

    const profileMap = new Map();
    (employees || []).forEach(e => profileMap.set(e.employeeid, e));
    (applicants || []).forEach(a => profileMap.set(a.applicantid, a));

    const deptIds = [...new Set([...employees, ...applicants].map(p => p.departmentid).filter(Boolean))];
    const posIds = [...new Set([...employees, ...applicants].map(p => p.positionid).filter(Boolean))];

    const { data: departments } = await supabase
      .from("department")
      .select("departmentid, departmentname")
      .in("departmentid", deptIds.length ? deptIds : [-1]);

    const { data: positions } = await supabase
      .from("position")
      .select("positionid, positionname")
      .in("positionid", posIds.length ? posIds : [-1]);

    const deptMap = new Map((departments || []).map(d => [d.departmentid, d.departmentname]));
    const posMap = new Map((positions || []).map(p => [p.positionid, p.positionname]));

    const rows = logsBase.map(l => {
      const profile = profileMap.get(l.profileid) || {};
      const name = profile.lastname
        ? `${profile.lastname}, ${profile.firstname}${profile.middlename ? ` ${profile.middlename[0]}.` : ""}`
        : "";
      const department = deptMap.get(profile.departmentid) || "";
      const position = posMap.get(profile.positionid) || "";

      return {
        LogID: l.logid,
        Date: formatDateToISO(l.date),
        Item: l.item?.itemname || "",
        Quantity: l.quantity,
        Role: l.role,
        ProfileID: l.profileid,
        FullName: name,
        Department: department,
        Position: position
      };
    });

    const csv = buildCSV(rows);

    const { filePath } = await dialog.showSaveDialog({
      title: "Export Inventory Logs",
      defaultPath: `inventory_logs${date ? "_" + date : ""}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    await fs.promises.writeFile(filePath, csv, "utf8");

    return { success: true, filePath, count: rows.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportApplicants", async (event, status) => {
  try {
    const { data, error } = await supabase
      .from("applicant")
      .select(`
        applicantid,
        lastname,
        firstname,
        middlename,
        department:departmentid ( departmentname ),
        position:positionid ( positionname ),
        contact,
        address,
        email,
        sss_number,
        pagibig_number,
        philhealth_number,
        bir_number,
        status,
        applicationdate,
        trainingdate
      `)
      .eq("status", status)
      .is("trainingdate", null)
      .order("applicantid", { ascending: true });

    if (error) throw error;
    const rowsRaw = data || [];
    if (rowsRaw.length === 0) return { success: false, message: `No applicants with status "${status}" to export` };

    const rows = rowsRaw.map((r) => ({
      ID: r.applicantid,
      "Last Name": r.lastname,
      "First Name": r.firstname,
      "Middle Name": r.middlename,
      Department: r.department?.departmentname ?? (Array.isArray(r.department) ? r.department[0]?.departmentname : "") ?? "",
      Position: r.position?.positionname ?? (Array.isArray(r.position) ? r.position[0]?.positionname : "") ?? "",
      Contact: r.contact,
      Address: r.address,
      Email: r.email,
      "SSS Number": r.sss_number,
      "Pag-IBIG Number": r.pagibig_number,
      "PhilHealth Number": r.philhealth_number,
      "BIR Number": r.bir_number,
      Status: r.status,
      "Application Date": formatDateToISO(r.applicationdate),
    }));

    const csv = buildCSV(rows);
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Applicant Export",
      defaultPath: `applicants_${status}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Applicants (status=${status}) exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportAllApplicants", async (event) => {
  try {
    const { data, error } = await supabase
      .from("applicant")
      .select(`
        applicantid,
        lastname,
        firstname,
        middlename,
        department:departmentid ( departmentname ),
        position:positionid ( positionname ),
        contact,
        address,
        email,
        sss_number,
        pagibig_number,
        philhealth_number,
        bir_number,
        status,
        applicationdate,
        trainingdate
      `)
      .is("trainingdate", null)
      .order("applicantid", { ascending: true });

    if (error) throw error;
    const rowsRaw = data || [];
    if (rowsRaw.length === 0) return { success: false, message: `No applicants to export` };

    const rows = rowsRaw.map((r) => ({
      ID: r.applicantid,
      "Last Name": r.lastname,
      "First Name": r.firstname,
      "Middle Name": r.middlename,
      Department: r.department?.departmentname ?? (Array.isArray(r.department) ? r.department[0]?.departmentname : "") ?? "",
      Position: r.position?.positionname ?? (Array.isArray(r.position) ? r.position[0]?.positionname : "") ?? "",
      Contact: r.contact,
      Address: r.address,
      Email: r.email,
      "SSS Number": r.sss_number,
      "Pag-IBIG Number": r.pagibig_number,
      "PhilHealth Number": r.philhealth_number,
      "BIR Number": r.bir_number,
      Status: r.status,
      "Application Date": formatDateToISO(r.applicationdate),
    }));

    const csv = buildCSV(rows);
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Applicant Export",
      defaultPath: `applicants_all.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Applicants exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportTrainees", async (event, status) => {
  try {
    const { data, error } = await supabase
      .from("applicant")
      .select(`
        applicantid,
        lastname,
        firstname,
        middlename,
        department:departmentid ( departmentname ),
        position:positionid ( positionname ),
        contact,
        address,
        email,
        sss_number,
        pagibig_number,
        philhealth_number,
        bir_number,
        status,
        trainingdate
      `)
      .eq("status", status)
      .not("trainingdate", "is", null)
      .order("applicantid", { ascending: true });

    if (error) throw error;
    const rowsRaw = data || [];
    if (rowsRaw.length === 0) return { success: false, message: `No Trainees with status "${status}" to export` };

    const rows = rowsRaw.map((r) => ({
      ID: r.applicantid,
      "Last Name": r.lastname,
      "First Name": r.firstname,
      "Middle Name": r.middlename,
      Department: r.department?.departmentname ?? (Array.isArray(r.department) ? r.department[0]?.departmentname : "") ?? "",
      Position: r.position?.positionname ?? (Array.isArray(r.position) ? r.position[0]?.positionname : "") ?? "",
      Contact: r.contact,
      Address: r.address,
      Email: r.email,
      "SSS Number": r.sss_number,
      "Pag-IBIG Number": r.pagibig_number,
      "PhilHealth Number": r.philhealth_number,
      "BIR Number": r.bir_number,
      Status: r.status,
      "Training Date": formatDateToISO(r.trainingdate),
    }));

    const csv = buildCSV(rows);
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Trainees Export",
      defaultPath: `trainees_${status}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Trainees (status=${status}) exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportAllTrainees", async (event) => {
  try {
    const { data, error } = await supabase
      .from("applicant")
      .select(`
        applicantid,
        lastname,
        firstname,
        middlename,
        department:departmentid ( departmentname ),
        position:positionid ( positionname ),
        contact,
        address,
        email,
        sss_number,
        pagibig_number,
        philhealth_number,
        bir_number,
        status,
        trainingdate
      `)
      .not("trainingdate", "is", null)
      .order("applicantid", { ascending: true });

    if (error) throw error;
    const rowsRaw = data || [];
    if (rowsRaw.length === 0) return { success: false, message: `No trainees to export` };

    const rows = rowsRaw.map((r) => ({
      ID: r.applicantid,
      "Last Name": r.lastname,
      "First Name": r.firstname,
      "Middle Name": r.middlename,
      Department: r.department?.departmentname ?? (Array.isArray(r.department) ? r.department[0]?.departmentname : "") ?? "",
      Position: r.position?.positionname ?? (Array.isArray(r.position) ? r.position[0]?.positionname : "") ?? "",
      Contact: r.contact,
      Address: r.address,
      Email: r.email,
      "SSS Number": r.sss_number,
      "Pag-IBIG Number": r.pagibig_number,
      "PhilHealth Number": r.philhealth_number,
      "BIR Number": r.bir_number,
      Status: r.status,
      "Training Date": formatDateToISO(r.trainingdate),
    }));

    const csv = buildCSV(rows);
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Trainees Export",
      defaultPath: `trainees_all.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Trainees exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportLogs", async (event, date) => {
  try {
    let logsRes;
    if (!date) {
      logsRes = await supabase
        .from("userlogs")
        .select("userlogid, userid, useraction, description, dateofaction")
        .order("dateofaction", { ascending: false });
    } else {
      const targetDate = formatDateToISO(date);
      logsRes = await supabase
        .from("userlogs")
        .select("userlogid, userid, useraction, description, dateofaction")
        .eq("dateofaction", targetDate)
        .order("dateofaction", { ascending: false });
    }

    if (logsRes.error) throw logsRes.error;
    const logs = logsRes.data || [];
    if (logs.length === 0) return { success: false, message: "No logs to export" };

    const userIds = [...new Set(logs.map((l) => l.userid))];
    const { data: users } = await supabase.from("users").select("userid, username").in("userid", userIds);
    const userMap = new Map((users || []).map((u) => [u.userid, u.username]));

    const rows = logs.map((l) => ({
      "Log ID": l.userlogid,
      Username: userMap.get(l.userid) || "",
      Action: l.useraction,
      Description: l.description,
      Date: formatDateToISO(l.dateofaction),
    }));

    const csv = buildCSV(rows);
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Logs Export",
      defaultPath: "logs.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage?.(`Logs exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage?.("Logs export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("getDashboardCardData", async () => {
  try {
    const today = formatDateToISO(new Date());
    const yesterday = formatDateToISO(new Date(Date.now() - 86400000));

    const [
      totalEmployeesRes,
      totalAttendanceRes,
      totalApprovedLeavesRes,
      totalLeaveRequestsRes,
    ] = await Promise.all([
      supabase.from("employee").select("*", { count: "exact", head: true }),
      supabase.from("attendance").select("*", { count: "exact", head: true }).eq("date", yesterday),
      supabase.from("leave").select("*", { count: "exact", head: true }).eq("status", "Approved").lte("start_date", today).gte("end_date", today),
      supabase.from("leave").select("*", { count: "exact", head: true }).eq("status", "Request"),
    ]);

    const totalEmployees = Number(totalEmployeesRes.count || 0);
    const totalAttendance = Number(totalAttendanceRes.count || 0);
    const totalApprovedLeaves = Number(totalApprovedLeavesRes.count || 0);
    const totalLeaveRequests = Number(totalLeaveRequestsRes.count || 0);

    return {
      totalEmployees,
      totalAttendance,
      totalApprovedLeaves,
      totalLeaveRequests,
    };
  } catch (error) {
    console.error("Dashboard error:", error);
    return {
      totalEmployees: 0,
      totalAttendance: 0,
      totalApprovedLeaves: 0,
      totalLeaveRequests: 0,
    };
  }
});

ipcMain.handle("getEmployee", async (event, employeeId) => {
  try {
    const { data, error } = await supabase
      .from("employee")
      .select(`
        employeeid,
        lastname,
        firstname,
        middlename,
        contact,
        email,
        address,
        gender,
        age,
        birthdate,
        hiredate,
        sss_number,
        pagibig_number,
        philhealth_number,
        bir_number,
        leavecredit,
        department:departmentid ( departmentid, departmentname ),
        position:positionid ( positionid, positionname ),
        employeeimage,
        type,
        shiftstart,
        shiftend
      `)
      .eq("employeeid", employeeId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const dep = data.department ?? (Array.isArray(data.department) ? data.department[0] : null);
    const pos = data.position ?? (Array.isArray(data.position) ? data.position[0] : null);

    // const name = `${data.lastname}, ${data.firstname}${data.middlename ? ` ${data.middlename.charAt(0)}.` : ""}`;

    return {
      employeeid: data.employeeid,
      firstname: data.firstname,
      middlename: data.middlename,
      lastname: data.lastname,
      department: dep?.departmentname ?? "",
      position: pos?.positionname ?? "",
      contact: data.contact,
      email: data.email,
      address: data.address,
      gender: data.gender,
      age: data.age,
      birthdate: new Date(data.birthdate).toISOString().split("T")[0],
      hiredate: new Date(data.hiredate).toISOString().split("T")[0],
      sss_number: data.sss_number,
      pagibig_number: data.pagibig_number,
      philhealth_number: data.philhealth_number,
      bir_number: data.bir_number,
      leavecredit: data.leavecredit,
      shiftstart: data.shiftstart ?? "",
      shiftend: data.shiftend ?? "",
      employeeimage: data.employeeimage || null,
      type: data.type ?? "",
    };
  } catch (err) {
    console.error("Error fetching employee details:", err);
    return null;
  }
});

ipcMain.handle('getEmployees', async () => {
  try {
    const { data, error } = await supabase
      .from('employee')
      .select(`
        employeeid,
        lastname,
        firstname,
        middlename,
        leavecredit,
        shiftstart,
        shiftend,
        department:departmentid ( departmentname ),
        position:positionid ( positionname )
      `)
      .order('employeeid', { ascending: true });

    if (error) throw error;

    return (data || []).map((r) => ({
      employeeid: r.employeeid,
      name: `${r.lastname}, ${r.firstname}${r.middlename ? ` ${r.middlename.charAt(0)}.` : ''}`,
      department: r.department?.departmentname ?? (Array.isArray(r.department) ? r.department[0]?.departmentname : '') ?? '',
      position: r.position?.positionname ?? (Array.isArray(r.position) ? r.position[0]?.positionname : '') ?? '',
      shift: `${r.shiftstart ?? ''} - ${r.shiftend ?? ''}`,
      leavecredit: r.leavecredit,
    }));
  } catch (err) {
    console.error('getEmployees error:', err);
    return [];
  }
});

ipcMain.handle("getEmployeeAttendance", async (event, employeeId, selectedDate = null) => {
  try {
    if (!employeeId) throw new Error("Missing employeeId");

    let query = supabase
      .from("attendance")
      .select("attendanceid, date, timein, timeout, profileid, role")
      .eq("profileid", employeeId)
      .eq("role", "Employee");

    if (selectedDate) {
      query.eq("date", formatDateToISO(selectedDate));
    }

    const { data: attendanceBase, error } = await query;
    if (error) throw error;

    const { data: employee, error: empError } = await supabase
      .from("employee")
      .select("employeeid, lastname, firstname, middlename, shiftstart, shiftend, positionid, departmentid")
      .eq("employeeid", employeeId)
      .single();
    if (empError) throw empError;
    
    const parseDurationLabel = (mins) => {
      if (mins == null || isNaN(mins)) return "";
      const abs = Math.abs(mins);
      const hh = Math.floor(abs / 60);
      const mm = abs % 60;
      return `${hh}h ${mm}m`;
    };

    const ARRIVAL_TOLERANCE = 15;
    const WORK_TOLERANCE = 15;

    const rows = (attendanceBase || []).map((a) => {
      const timeInMin = timeToMinutes(a.timein);
      const timeOutMin = timeToMinutes(a.timeout);
      const shiftStartMin = timeToMinutes(employee.shiftstart);
      const shiftEndMin = timeToMinutes(employee.shiftend);

      let arrivalDiff = 0;
      let arrivalStatus = "On Time";
      let workStatus = "Exact Time";
      let hoursWorked = "0h 0m";
      let workDiff = 0;

      if (
        timeInMin != null &&
        timeOutMin != null &&
        shiftStartMin != null &&
        shiftEndMin != null
      ) {
        arrivalDiff = timeInMin - shiftStartMin;
        if (Math.abs(arrivalDiff) <= ARRIVAL_TOLERANCE) {
          arrivalDiff = 0;
          arrivalStatus = "On Time";
        } else {
          arrivalStatus = arrivalDiff > 0 ? "Late" : "Early";
        }

        const actualDur = timeOutMin - timeInMin;
        const shiftDur = shiftEndMin - shiftStartMin;
        workDiff = actualDur - shiftDur;
        hoursWorked = parseDurationLabel(actualDur);

        if (Math.abs(workDiff) <= WORK_TOLERANCE) {
          workStatus = "Exact Time";
        } else {
          workStatus = workDiff > 0 ? "Overtime" : "Undertime";
        }
      }

      return {
        date: formatDateToISO(a.date),
        shift:
          employee.shiftstart && employee.shiftend
            ? `${formatTime12(employee.shiftstart)} - ${formatTime12(employee.shiftend)}`
            : "",
        timeIn: formatTime12(a.timein),
        arrivalDiff: parseDurationLabel(arrivalDiff),
        arrivalStatus,
        timeOut: formatTime12(a.timeout),
        hoursWorked,
        workStatus,
      };
    });

    return rows;
  } catch (err) {
    console.error("getEmployeeAttendance error:", err);
    return [];
  }
});

ipcMain.handle("updateEmployee", async (event, employeeId, field, value) => {
  try {
    let updateData = {};

    if (field === "employeeimage" && value.startsWith("data:image")) {
      const base64Data = value.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      const fileExt = value.substring("data:image/".length, value.indexOf(";base64"));
      const fileName = `Employee${employeeId}_image.${fileExt}`;
      const filePath = `Employee${employeeId}_image.${fileExt}`;

      console.log({
        bucket: 'image',
        filePath,
        type: `image/${fileExt}`,
        length: buffer.length,
      });

      const { error: uploadError } = await supabase.storage
        .from("image")
        .upload(filePath, buffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("image")
        .getPublicUrl(filePath);

      updateData = { employeeimage: urlData.publicUrl };
    } else {
      if (value === null || value === "NULL_FORCE" || value === "") {
        updateData = { [field]: null };
      } else {
        updateData = { [field]: value };
      }
    }

    const { error } = await supabase
      .from("employee")
      .update(updateData)
      .eq("employeeid", employeeId);

    if (error) throw error;

    return { success: true, imageUrl: updateData.employeeimage || null };
  } catch (err) {
    console.error("❌ Error updating employee:", err);
    return { success: false, message: err.message };
  }
});

// ipcMain.handle('updateEmployeeField', async (event, { employeeId, field, value }) => {
//   try {
//     const { error } = await supabase.from('employee').update({ [field]: value }).eq('employeeid', employeeId);
//     if (error) throw error;
//     logMessage(`EDIT SUCCESS: employee=${employeeId} field=${field}`);
//     return { success: true };
//   } catch (err) {
//     console.error('updateEmployeeField failed:', err);
//     return { success: false, error: err.message };
//   }
// });

ipcMain.handle("getAttendance", async (event, date = null) => {
  try {
    const targetDate = date ? formatDateToISO(date) : null;

    const query = supabase
      .from("attendance")
      .select("attendanceid, date, timein, timeout, profileid, role");

    if (targetDate) {
      query.eq("date", targetDate).order("timein", { ascending: true });
    } else {
      query.order("date", { ascending: false });
    }

    const { data: attendanceBase, error } = await query;
    if (error) throw error;

    const attendance = await Promise.all(
      (attendanceBase || []).map(async (a) => {
        const role = (a.role || "Employee").toLowerCase();
        let profile = null;

        if (role === "employee") {
          const { data } = await supabase
            .from("employee")
            .select("employeeid, lastname, firstname, middlename, positionid, shiftstart, shiftend, departmentid")
            .eq("employeeid", a.profileid)
            .single();
          profile = data;
        } else if (role === "applicant") {
          const { data } = await supabase
            .from("applicant")
            .select("applicantid, lastname, firstname, middlename, positionid, shiftstart, shiftend, departmentid")
            .eq("applicantid", a.profileid)
            .single();
          profile = data;
        }

        return { ...a, employee: profile };
      })
    );

    const positionIds = [...new Set((attendance || []).map(a => a.employee?.positionid).filter(Boolean))];
    const departmentIds = [...new Set((attendance || []).map(a => a.employee?.departmentid).filter(Boolean))];

    const { data: positions } = await supabase
      .from("position")
      .select("positionid, positionname")
      .in("positionid", positionIds.length ? positionIds : [-1]);
    const posMap = new Map((positions || []).map(p => [p.positionid, p.positionname]));

    const { data: departments } = await supabase
      .from("department")
      .select("departmentid, departmentname")
      .in("departmentid", departmentIds.length ? departmentIds : [-1]);
    const deptMap = new Map((departments || []).map(d => [d.departmentid, d.departmentname]));

    const parseDurationLabel = (mins) => {
      if (mins == null || isNaN(mins)) return "";
      const abs = Math.abs(mins);
      const hh = Math.floor(abs / 60);
      const mm = abs % 60;
      return `${hh}h ${mm}m`;
    };

    const ARRIVAL_TOLERANCE = 15;
    const WORK_TOLERANCE = 15;

    const rows = (attendance || []).map((a) => {
      const emp = a.employee ?? {};
      const pos = posMap.get(emp.positionid) || "";
      const department = deptMap.get(emp.departmentid) || "";

      const timeInMin = timeToMinutes(a.timein);
      const timeOutMin = timeToMinutes(a.timeout);
      const shiftStartMin = timeToMinutes(emp.shiftstart);
      const shiftEndMin = timeToMinutes(emp.shiftend);

      let arrivalDiff = 0;
      let arrivalStatus = "On Time";
      let workStatus = "Exact Time";
      let hoursWorked = "0h 0m";
      let workDiff = 0;

      if (
        timeInMin != null &&
        timeOutMin != null &&
        shiftStartMin != null &&
        shiftEndMin != null
      ) {
        arrivalDiff = timeInMin - shiftStartMin;
        if (Math.abs(arrivalDiff) <= ARRIVAL_TOLERANCE) {
          arrivalDiff = 0;
          arrivalStatus = "On Time";
        } else {
          arrivalStatus = arrivalDiff > 0 ? "Late" : "Early";
        }

        const actualDur = timeOutMin - timeInMin;
        const shiftDur = shiftEndMin - shiftStartMin;
        workDiff = actualDur - shiftDur;
        hoursWorked = parseDurationLabel(actualDur);

        if (Math.abs(workDiff) <= WORK_TOLERANCE) {
          workStatus = "Exact Time";
        } else {
          workStatus = workDiff > 0 ? "Overtime" : "Undertime";
        }
      }

      return {
        attendanceid: a.attendanceid,
        date: formatDateToISO(a.date),
        role: a.role,
        profileid: emp.employeeid ?? emp.applicantid ?? "",
        fullName: `${emp.lastname ?? ""}, ${emp.firstname ?? ""}${
          emp.middlename ? " " + emp.middlename.charAt(0) + "." : ""
        }`,
        department,
        position: pos,
        shift: emp.shiftstart && emp.shiftend
          ? `${formatTime12(emp.shiftstart)} - ${formatTime12(emp.shiftend)}`
          : "",
        timeIn: formatTime12(a.timein),
        timeOut: formatTime12(a.timeout),
        arrivalDiff: parseDurationLabel(arrivalDiff),
        arrivalStatus,
        hoursWorked,
        workDiff: parseDurationLabel(workDiff),
        workStatus,
        utot:
          workDiff === 0
            ? "Exact Time"
            : `${parseDurationLabel(workDiff)} ${workStatus}`,
      };
    });

    return rows;
  } catch (err) {
    console.error("getAttendance error:", err);
    return [];
  }
});

ipcMain.handle("getAbsent", async (event, date) => {
  try {
    const targetDate = date ? formatDateToISO(date) : null;

    const { data: employees, error: empErr } = await supabase
      .from("employee")
      .select(
        `employeeid, lastname, firstname, middlename, shiftstart, shiftend,
         department:departmentid ( departmentname ),
         position:positionid ( positionname )`
      )
      .order("lastname", { ascending: true });
    if (empErr) throw empErr;

    const { data: applicants, error: appErr } = await supabase
      .from("applicant")
      .select(
        `applicantid, lastname, firstname, middlename, shiftstart, shiftend,
         department:departmentid ( departmentname ),
         position:positionid ( positionname )`
      )
      .order("lastname", { ascending: true });
    if (appErr) throw appErr;

    const profiles = [
      ...employees.map((e) => ({ ...e, profileid: e.employeeid, role: "Employee" })),
      ...applicants.map((a) => ({ ...a, profileid: a.applicantid, role: "Applicant" })),
    ];

    const { data: attendance } = targetDate
      ? await supabase.from("attendance").select("profileid, role").eq("date", targetDate)
      : await supabase.from("attendance").select("profileid, role");

    let leaves = [];
    if (targetDate) {
      const { data: allLeaves } = await supabase
        .from("leave")
        .select("employeeid, start_date, end_date, is_paid")
        .eq("is_paid", true)
        .eq("status", "Approved");

      const d = new Date(targetDate);
      leaves = (allLeaves || []).filter((l) => {
        const s = new Date(l.start_date);
        const e = new Date(l.end_date);
        return d >= s && d <= e;
      });
    } else {
      const { data: allLeaves } = await supabase
        .from("leave")
        .select("employeeid")
        .eq("is_paid", true);
      leaves = allLeaves || [];
    }

    const present = new Set(
      (attendance || []).map((r) => `${r.role.toLowerCase()}-${r.profileid}`)
    );
    const onleave = new Set(
      (leaves || []).map((r) => `employee-${r.employeeid}`)
    );

    const absent = profiles.filter(
      (p) =>
        !present.has(`${p.role.toLowerCase()}-${p.profileid}`) &&
        !onleave.has(`${p.role.toLowerCase()}-${p.profileid}`)
    );

    return absent.map((r) => ({
      profileid: r.profileid,
      role: r.role,
      fullName: `${r.lastname}, ${r.firstname}${
        r.middlename ? ` ${r.middlename.charAt(0)}.` : ""
      }`,
      department: r.department?.departmentname ?? "",
      position: r.position?.positionname ?? "",
      shift:
        r.shiftstart && r.shiftend
          ? `${formatTime12(r.shiftstart)} - ${formatTime12(r.shiftend)}`
          : "",
      date: targetDate,
    }));
  } catch (err) {
    console.error("getAbsent error:", err);
    return [];
  }
});

ipcMain.handle('getLeave', async (event, date) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = supabase
      .from("leave")
      .select(`
        leaveid,
        start_date,
        end_date,
        employeeid,
        reason,
        status,
        type,
        is_paid,
        employee:employeeid (
          firstname,
          middlename,
          lastname,
          positionid,
          departmentid,
          shiftstart,
          shiftend
        )
      `)
      .order("employeeid", { ascending: true });

    if (date) {
      const targetDate = date;
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      query = query
        .gte("end_date", targetDate)
        .lt("start_date", nextDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const positionIds = [...new Set((data || []).map(l => l.employee?.positionid).filter(Boolean))];
    const departmentIds = [...new Set((data || []).map(l => l.employee?.departmentid).filter(Boolean))];

    const [{ data: positions }, { data: departments }] = await Promise.all([
      supabase.from("position").select("positionid, positionname").in("positionid", positionIds),
      supabase.from("department").select("departmentid, departmentname").in("departmentid", departmentIds),
    ]);

    const posMap = new Map((positions || []).map(p => [p.positionid, p.positionname]));
    const deptMap = new Map((departments || []).map(d => [d.departmentid, d.departmentname]));

    return (data || []).map(l => {
      const emp = l.employee ?? (Array.isArray(l.employee) ? l.employee[0] : {});
      const startDate = new Date(l.start_date);
      const endDate = new Date(l.end_date);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      let rawDuration;
      if (date) {
        rawDuration = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)) + 1);
      } else {
        rawDuration = Math.max(0, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
      }

      const Duration = rawDuration === 0 ? "Expired" : rawDuration;

      return {
        leaveid: l.leaveid,
        start_date: formatDateToISO(l.start_date),
        end_date: formatDateToISO(l.end_date),
        employeeid: l.employeeid,
        fullName: `${emp.lastname}, ${emp.firstname}${emp.middlename ? ` ${emp.middlename.charAt(0)}.` : ''}`,
        position: posMap.get(emp.positionid) || "",
        department: deptMap.get(emp.departmentid) || "",
        shift:
          emp.shiftstart && emp.shiftend
            ? `${formatTime12(emp.shiftstart)} - ${formatTime12(emp.shiftend)}`
            : "",        reason: l.reason,
        status: l.status,
        type: l.type,
        isPaid: l.is_paid,
        Duration,
      };
    });
  } catch (err) {
    logMessage("getLeave error:", err);
    return [];
  }
});

ipcMain.handle('addLeave', async (event, employeeIds, date, reason, duration, type, isPaid, status) => {
  const normalizeError = (err) => {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (err.msg) return err.msg;
    if (err.details) return err.details;
    return JSON.stringify(err);
  };

  if (status === 'Request') status = 'Pending';

  try {
    duration = parseInt(duration, 10);
    const targetDate = formatDateToISO(date);
    const startDate = new Date(targetDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration - 1);
    const targetEndDate = endDate.toISOString().split('T')[0];

    let inserted = 0;
    let skipped = 0;

    for (const id of employeeIds) {
      const { data: existingLeave, error: leaveErr } = await supabase
        .from('leave')
        .select('leaveid')
        .eq('employeeid', id)
        .or(`and(start_date.lte.${targetEndDate},end_date.gte.${targetDate})`)
        .limit(1);
      if (leaveErr) throw new Error(normalizeError(leaveErr));

      const { data: existingAttendance, error: attErr } = await supabase
        .from('attendance')
        .select('attendanceid')
        .eq('profileid', id)
        .gte('date', targetDate)
        .lte('date', targetEndDate)
        .limit(1);
      if (attErr) throw new Error(normalizeError(attErr));

      if ((existingLeave && existingLeave.length) || (existingAttendance && existingAttendance.length)) {
        skipped++;
        continue;
      }

      if (isPaid) {
        const { data: empData, error } = await supabase
          .from('employee')
          .select('leavecredit')
          .eq('employeeid', id)
          .single();
        if (error) throw new Error(normalizeError(error));
        if (!empData || (empData.leavecredit || 0) < duration) {
          skipped++;
          continue;
        }
      }

      const { error: insErr } = await supabase
        .from('leave')
        .insert([
          {
            employeeid: id,
            start_date: targetDate,
            end_date: targetEndDate,
            reason,
            type,
            is_paid: isPaid,
            status,
          },
        ]);

      if (insErr) throw new Error(normalizeError(insErr));
      inserted++;
    }

    if (inserted === 0) {
      return {
        success: false,
        message: 'No leave added (duplicates, conflicts, or insufficient credits)',
        inserted: 0,
        skipped,
      };
    }

    return {
      success: true,
      message: `Successfully added ${inserted} leave${inserted > 1 ? 's' : ''}${skipped ? ` (${skipped} skipped)` : ''}.`,
      inserted,
      skipped,
    };
  } catch (err) {
    return { success: false, error: normalizeError(err) };
  }
});

ipcMain.handle('updateLeaveStatus', async (event, { ids, status }) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0)
      return { success: false, error: 'No IDs provided' };

    if (status === 'Approved') {
      for (const leaveId of ids) {
        const { data: leaveData, error: leaveErr } = await supabase
          .from('leave')
          .select('employeeid, start_date, end_date, is_paid')
          .eq('leaveid', leaveId)
          .single();
        if (leaveErr) throw new Error(leaveErr.message);

        if (leaveData.is_paid) {
          const start = new Date(leaveData.start_date);
          const end = new Date(leaveData.end_date);
          const duration = Math.floor((end - start) / 86400000) + 1;

          const { data: empData, error: empErr } = await supabase
            .from('employee')
            .select('leavecredit')
            .eq('employeeid', leaveData.employeeid)
            .single();
          if (empErr) throw new Error(empErr.message);

          if ((empData.leavecredit || 0) < duration)
            return { success: false, error: `Insufficient leave credits for employee ${leaveData.employeeid}` };

          const { error: updErr } = await supabase
            .from('employee')
            .update({ leavecredit: empData.leavecredit - duration })
            .eq('employeeid', leaveData.employeeid);
          if (updErr) throw new Error(updErr.message);
        }
      }
    }

    const { error } = await supabase.from('leave').update({ status }).in('leaveid', ids);
    if (error) throw new Error(error.message);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


ipcMain.handle("getInventoryLogs", async (event, date) => {
  try {
    let q = supabase
      .from("inventorylogs")
      .select("logid, profileid, itemid, quantity, date, role")
      .order("date", { ascending: false });

    if (date) q = q.eq("date", formatDateToISO(date));
    const { data, error } = await q;
    if (error) throw error;

    const employeeIds = data.filter(d => d.role === "Employee").map(d => d.profileid);
    const applicantIds = data.filter(d => d.role === "Applicant").map(d => d.profileid);

    const { data: employees } = await supabase
      .from("employee")
      .select("employeeid, firstname, middlename, lastname, departmentid, positionid")
      .in("employeeid", employeeIds);

    const { data: applicants } = await supabase
      .from("applicant")
      .select("applicantid, firstname, middlename, lastname, departmentid, positionid")
      .in("applicantid", applicantIds);

    const empMap = new Map((employees || []).map(e => [e.employeeid, e]));
    const appMap = new Map((applicants || []).map(a => [a.applicantid, a]));

    const { data: departments } = await supabase.from("department").select("departmentid, departmentname");
    const deptMap = new Map((departments || []).map(d => [d.departmentid, d.departmentname]));

    const { data: positions } = await supabase.from("position").select("positionid, positionname");
    const posMap = new Map((positions || []).map(p => [p.positionid, p.positionname]));

    const { data: inventory } = await supabase.from("inventory").select("itemid, itemname");
    const itemMap = new Map((inventory || []).map(i => [i.itemid, i.itemname]));

    const rows = (data || []).map((l) => {
      const person = l.role === "Employee" ? empMap.get(l.profileid) : appMap.get(l.profileid);
      const name = person
        ? `${person.lastname || ""}, ${person.firstname || ""}${person.middlename ? ` ${person.middlename.charAt(0)}.` : ""}`
        : "";
      return {
        name,
        department: deptMap.get(person?.departmentid) || "",
        position: posMap.get(person?.positionid) || "",
        itemname: itemMap.get(l.itemid) || "",
        quantity: l.quantity,
        date: formatDateToISO(l.date),
      };
    });

    return rows;
  } catch (err) {
    console.error("getInventoryLogs error:", err);
    return [];
  }
});

ipcMain.handle("getInventoryCard", async () => {
  try {
    const { data, error } = await supabase
      .from("inventory")
      .select("itemid, itemname, quantity, lastmodified")
      .order("itemid", { ascending: true });

    if (error) throw error;

    return (data || []).map((r) => ({
      itemid: r.itemid,
      itemname: r.itemname,
      quantity: r.quantity,
      lastmodified: formatDateToISO(r.lastmodified),
    }));
  } catch (err) {
    console.error("getInventoryCard error:", err);
    return [];
  }
});

ipcMain.handle("addItem", async (event, form) => {
  try {
    const { itemname, quantity } = form;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("inventory")
      .insert([{ itemname, quantity, lastmodified: now }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("addItem error:", err);
    throw err;
  }
});

ipcMain.handle("updateItem", async (event, form) => {
  try {
    const { itemid, itemname, quantity } = form;
    const now = new Date().toISOString().split("T")[0]; // <-- only "YYYY-MM-DD"

    const { error } = await supabase
      .from("inventory")
      .update({ itemname, quantity, lastmodified: now })
      .eq("itemid", itemid);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("updateItem error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("addInventoryLog", async (event, { itemid, profileid, quantity, role }) => {
  try {
    const safeItemId = Number(itemid);
    if (!safeItemId || isNaN(safeItemId)) {
      return { success: false, error: "Invalid itemid" };
    }

    const safeQuantity = Number(quantity) || 0;
    const safeProfileId = profileid ? Number(profileid) : null;
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("inventorylogs")
      .insert([
        {
          itemid: safeItemId,
          profileid: safeProfileId,
          quantity: safeQuantity,
          date: today,
          role,
        },
      ])
      .select();

    if (error) {
      console.error("Supabase insert failed:", JSON.stringify(error, null, 2));
      return { success: false, error: JSON.stringify(error) };
    }

    if (!data || !data.length) {
      console.error("Supabase insert returned no data", { itemid, profileid, quantity, role });
      return { success: false, error: "No log was created" };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Unexpected addInventoryLog error:", err);
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("deleteItem", async (event, itemid) => {
  try {
    const { error } = await supabase.from("inventory").delete().eq("itemid", itemid);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("deleteItem error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('getTrainees', async (event, status) => {
  try {
    const { data, error } = await supabase
      .from('applicant')
      .select('applicantid, lastname, firstname, middlename, department:departmentid ( departmentname ), position:positionid ( positionname ), trainingdate')
      .eq('status', status)
      .not('trainingdate', 'is', null)
      .order('applicantid', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => ({ applicantid: r.applicantid, fullname: `${r.lastname}, ${r.firstname}${r.middlename ? ` ${r.middlename.charAt(0)}.` : ''}`, department: r.department?.departmentname ?? '', position: r.position?.positionname ?? '', trainingdate: formatDateToISO(r.trainingdate) }));
  } catch (err) {
    console.error('getTrainees error:', err);
    return [];
  }
});

ipcMain.handle("getApplicant", async (event, applicantId) => {
  try {
    const { data, error } = await supabase
      .from("applicant")
      .select(`
        applicantid,
        lastname,
        firstname,
        middlename,
        contact,
        email,
        address,
        gender,
        age,
        birthdate,
        sss_number,
        pagibig_number,
        philhealth_number,
        bir_number,
        status,
        applicationdate,
        trainingdate,
        shiftstart,
        shiftend,
        department:departmentid ( departmentid, departmentname ),
        position:positionid ( positionid, positionname ),
        applicantimage,
        resume
      `)
      .eq("applicantid", applicantId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const dep = data.department ?? (Array.isArray(data.department) ? data.department[0] : null);
    const pos = data.position ?? (Array.isArray(data.position) ? data.position[0] : null);

    // const name = `${data.lastname}, ${data.firstname}${data.middlename ? ` ${data.middlename.charAt(0)}.` : ""}`;

    return {
      applicantid: data.applicantid,
      firstname: data.firstname,
      middlename: data.middlename,
      lastname: data.lastname,      gender: data.gender,
      age: data.age,
      birthdate: new Date(data.birthdate).toISOString().split("T")[0],
      department: dep?.departmentname ?? "",
      position: pos?.positionname ?? "",
      contact: data.contact,
      email: data.email,
      address: data.address,
      sss_number: data.sss_number,
      pagibig_number: data.pagibig_number,
      philhealth_number: data.philhealth_number,
      bir_number: data.bir_number,
      status: data.status,
      applicationdate: data.applicationdate ? new Date(data.applicationdate).toISOString().split("T")[0] : "",
      trainingdate: data.trainingdate ? new Date(data.trainingdate).toISOString().split("T")[0] : "",
      shiftstart: data.shiftstart ?? "",
      shiftend: data.shiftend ?? "",
      applicantimage: data.applicantimage || null,
      resume: data.resume || null,
    };
  } catch (err) {
    console.error("Error fetching applicant details:", err);
    return null;
  }
});

ipcMain.handle("getApplicantAttendance", async (event, applicantId, selectedDate = null) => {
  try {
    if (!applicantId) throw new Error("Missing applicantId");

    let query = supabase
      .from("attendance")
      .select("attendanceid, date, timein, timeout, profileid, role")
      .eq("profileid", applicantId)
      .eq("role", "Applicant");

    if (selectedDate) {
      query.eq("date", formatDateToISO(selectedDate));
    }

    const { data: attendanceBase, error } = await query;
    if (error) throw error;

    const { data: applicant, error: appError } = await supabase
      .from("applicant")
      .select("applicantid, lastname, firstname, middlename, positionid, shiftstart, shiftend, departmentid")
      .eq("applicantid", applicantId)
      .single();
    if (appError) throw appError;

    const parseDurationLabel = (mins) => {
      if (mins == null || isNaN(mins)) return "";
      const abs = Math.abs(mins);
      const hh = Math.floor(abs / 60);
      const mm = abs % 60;
      return `${hh}h ${mm}m`;
    };

    const ARRIVAL_TOLERANCE = 15;
    const WORK_TOLERANCE = 15;

    const rows = (attendanceBase || []).map((a) => {
      const timeInMin = timeToMinutes(a.timein);
      const timeOutMin = timeToMinutes(a.timeout);
      const shiftStartMin = timeToMinutes(applicant.shiftstart);
      const shiftEndMin = timeToMinutes(applicant.shiftend);

      let arrivalDiff = 0;
      let arrivalStatus = "On Time";
      let workStatus = "Exact Time";
      let hoursWorked = "0h 0m";
      let workDiff = 0;

      if (
        timeInMin != null &&
        timeOutMin != null &&
        shiftStartMin != null &&
        shiftEndMin != null
      ) {
        arrivalDiff = timeInMin - shiftStartMin;
        if (Math.abs(arrivalDiff) <= ARRIVAL_TOLERANCE) {
          arrivalDiff = 0;
          arrivalStatus = "On Time";
        } else {
          arrivalStatus = arrivalDiff > 0 ? "Late" : "Early";
        }

        const actualDur = timeOutMin - timeInMin;
        const shiftDur = shiftEndMin - shiftStartMin;
        workDiff = actualDur - shiftDur;
        hoursWorked = parseDurationLabel(actualDur);

        if (Math.abs(workDiff) <= WORK_TOLERANCE) {
          workStatus = "Exact Time";
        } else {
          workStatus = workDiff > 0 ? "Overtime" : "Undertime";
        }
      }

      return {
        date: formatDateToISO(a.date),
        shift:
          applicant.shiftstart && applicant.shiftend
            ? `${formatTime12(applicant.shiftstart)} - ${formatTime12(applicant.shiftend)}`
            : "",
        timeIn: formatTime12(a.timein),
        arrivalDiff: parseDurationLabel(arrivalDiff),
        arrivalStatus,
        timeOut: formatTime12(a.timeout),
        hoursWorked,
        workStatus,
      };
    });

    return rows;
  } catch (err) {
    console.error("getApplicantttendance error:", err);
    return [];
  }
});

ipcMain.handle("updateApplicant", async (event, applicantId, field, value) => {
  try {
    let updateData = {};

    if (field === "applicantimage" && value.startsWith("data:image")) {
      const base64Data = value.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      const fileExt = value.substring("data:image/".length, value.indexOf(";base64"));
      const fileName = `Applicant${applicantId}_image.${fileExt}`;
      const filePath = `Applicant${applicantId}_image.${fileExt}`;

      console.log({
        bucket: "image",
        filePath,
        type: `image/${fileExt}`,
        length: buffer.length,
      });

      const { error: uploadError } = await supabase.storage
        .from("image")
        .upload(filePath, buffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("image")
        .getPublicUrl(filePath);

      updateData = { applicantimage: urlData.publicUrl };
    } else {
      updateData = { [field]: value };
    }

    const { error } = await supabase
      .from("applicant")
      .update(updateData)
      .eq("applicantid", applicantId);

    if (error) throw error;

    return { success: true, imageUrl: updateData.applicantimage || null };
  } catch (err) {
    console.error("❌ Error updating applicant:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('getApplicants', async (event, status) => {
  try {
    const { data, error } = await supabase
      .from('applicant')
      .select('applicantid, lastname, firstname, middlename, department:departmentid ( departmentname ), position:positionid ( positionname ), applicationdate')
      .eq('status', status)
      .is('trainingdate', null)
      .order('applicantid', { ascending: true });
    if (error) throw error;
    
    return (data || []).map(r => ({ applicantid: r.applicantid, fullname: `${r.lastname}, ${r.firstname}${r.middlename ? ` ${r.middlename.charAt(0)}.` : ''}`, department: r.department?.departmentname ?? '', position: r.position?.positionname ?? '', applicationdate: formatDateToISO(r.applicationdate) }));
  } catch (err) {
    logMessage('getApplicants error:', err);
    return [];
  }
});

ipcMain.handle('addApplicant', async (event, resume) => {
  try {
    logMessage('🟢 addApplicant called');
    logMessage(`Incoming resume: ${JSON.stringify(resume, null, 2)}`);

    const profile = resume?.profile || {};

    const firstName = profile.firstName || null;
    const middleName = profile.middleName || null;
    const lastName = profile.lastName || null;
    const email = profile.email || null;
    const contact = profile.phone || null;
    const address = profile.location || null;
    const gender = profile.gender || 'Unspecified';
    const age = profile.age ? parseInt(profile.age, 10) : null;
    const birthdate = profile.birthdate || null;
    const status = 'Pending';
    const applicantImage = resume.image ? resume.image.data || null : null;

    let departmentId = null;
    if (resume.departmentName) {
      const { data: deptData, error: deptErr } = await supabase
        .from('department')
        .select('departmentid')
        .eq('departmentname', resume.departmentName)
        .limit(1);

      if (deptErr) logMessage(`❌ Department query error: ${JSON.stringify(deptErr)}`);
      else logMessage(`✅ Department query result: ${JSON.stringify(deptData)}`);

      if (deptData && deptData.length) departmentId = deptData[0].departmentid;
    }

    let positionId = null;
    if (resume.positionName) {
      const { data: posData, error: posErr } = await supabase
        .from('position')
        .select('positionid')
        .eq('positionname', resume.positionName)
        .limit(1);

      if (posErr) logMessage(`❌ Position query error: ${JSON.stringify(posErr)}`);
      else logMessage(`✅ Position query result: ${JSON.stringify(posData)}`);

      if (posData && posData.length) positionId = posData[0].positionid;
    }

    const insertPayload = {
      firstname: firstName,
      middlename: middleName,
      lastname: lastName,
      contact,
      email,
      address,
      departmentid: departmentId,
      positionid: positionId,
      gender,
      age,
      birthdate,
      status,
      applicantimage: applicantImage,
      resume: resume,
      applicationdate: new Date().toISOString(),
    };

    logMessage(`📦 Insert Payload: ${JSON.stringify(insertPayload, null, 2)}`);

    const { data, error } = await supabase
      .from('applicant')
      .insert([insertPayload])
      .select('applicantid')
      .single();

    if (error) {
      logMessage(`❌ Supabase insert error: ${JSON.stringify(error, null, 2)}`);
      throw error;
    }

    logMessage(`✅ Applicant inserted successfully: ${JSON.stringify(data)}`);
    return data;
  } catch (err) {
    logMessage(`💥 addApplicant error (catch): ${err.stack || JSON.stringify(err, null, 2)}`);
    throw err;
  }
});

ipcMain.handle("getLogs", async (event, date) => {
  try {
    // Base query for logs
    let q = supabase
      .from("userlogs")
      .select("userlogid, user_id, useraction, description, dateofaction")
      .order("dateofaction", { ascending: false });

    // Optional date filter
    if (date) {
      const start = `${date}T00:00:00`;
      const end = `${date}T23:59:59`;
      q = q.gte("dateofaction", start).lte("dateofaction", end);
    }

    // Fetch logs
    const { data: logs, error: logError } = await q;
    if (logError) throw logError;

    // Get distinct user IDs
    const userIds = [...new Set((logs || []).map((l) => l.user_id))].filter(Boolean);
    if (userIds.length === 0) return logs;

    // Fetch corresponding employees
    const { data: employees, error: empError } = await supabase
      .from("employee")
      .select("user_id, firstname, lastname")
      .in("user_id", userIds);

    if (empError) throw empError;

    // Map employee UID → full name
    const employeeMap = new Map(
      (employees || []).map((e) => [e.user_id, `${e.lastname}, ${e.firstname}`])
    );

    // Combine logs with readable username
    return (logs || []).map((l) => ({
      userlogid: l.userlogid,
      username: employeeMap.get(l.user_id) || "Unknown User",
      useraction: l.useraction,
      description: l.description,
      dateofaction: l.dateofaction,
    }));
  } catch (err) {
    console.error("getLogs error:", err);
    return [];
  }
});

ipcMain.handle('updateApplicantsStatus', async (event, ids, options) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) return { success: false, message: 'No applicants selected' };

    const { status, setTrainingDate, resetTraining, setApplicationDate } = options || {};
    const nowISO = new Date().toISOString();

    const updates = { status };
    if (setTrainingDate) updates.trainingdate = nowISO;
    if (resetTraining) updates.trainingdate = null;
    if (setApplicationDate) updates.applicationdate = nowISO;

    const { data, error } = await supabase.from('applicant').update(updates).in('applicantid', ids).select('*');
    if (error) throw error;

    if (status === 'Hired' && (data || []).length > 0) {
      for (const applicant of data) {
        const employeePayload = {
          firstname: applicant.firstname,
          middlename: applicant.middlename,
          lastname: applicant.lastname,
          departmentid: applicant.departmentid,
          positionid: applicant.positionid,
          contact: applicant.contact,
          address: applicant.address,
          email: applicant.email,
          sss_number: applicant.sss_number,
          pagibig_number: applicant.pagibig_number,
          philhealth_number: applicant.philhealth_number,
          bir_number: applicant.bir_number,
          applicantid: applicant.applicantid,
          employeeimage: applicant.applicantimage,
          type: 'Regular',
          leavecredit: 0.00,
          shiftid: 1,
          hiredate: nowISO,
        };
        await supabase.from('employee').insert([employeePayload]);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('updateApplicantsStatus error:', err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('getDeptPos', async () => {
  try {
    const { data, error } = await supabase
      .from('department')
      .select('departmentid, departmentname, positions:position ( positionid, positionname )')
      .order('departmentname', { ascending: true });
    if (error) throw error;

    const rows = [];
    (data || []).forEach(d => {
      (d.positions || []).forEach(p => {
        rows.push({ departmentid: d.departmentid, departmentname: d.departmentname, positionid: p.positionid, positionname: p.positionname });
      });
    });

    return rows;
  } catch (err) {
    console.error('getDeptPos error:', err);
    return [];
  }
});

ipcMain.handle('signUp', async (event, { email, password }) => {
  try {
    const { data: employee, error: empError } = await supabase
      .from('employee')
      .select('employeeid, firstname, middlename, lastname, positionid')
      .filter('email', 'ilike', email.trim())
      .single();

    if (empError || !employee) {
      logMessage(`Employee not found for ${email}`);
      return { error: 'Email not found in employee records.' };
    }

    // 2️⃣ Check employee’s position
    const { data: position, error: posError } = await supabase
      .from('position')
      .select('positionname')
      .eq('positionid', employee.positionid)
      .single();

    if (posError || !position) {
      return { error: 'Employee position not found.' };
    }

    const userRole = position.positionname;

    if (!allowedRoles.includes(userRole)) {
      return { error: 'Only certain positions can create an account.' };
    }

    // 3️⃣ Signup the user in Supabase Auth
    const fullName = `${employee.lastname}, ${employee.firstname} ${employee.middlename || ''}`.trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          userRole,
          employeeid: employee.employeeid,
        },
      },
    });

    if (error) throw error;

    // 4️⃣ Link the auth user to employee record
    if (data.user) {
      await supabase
        .from('employee')
        .update({ user_id: data.user.id })
        .eq('employeeid', employee.employeeid);
    }

    return {
      user: data.user,
      message: 'Signup successful. Please verify your email before logging in.',
    };
  } catch (err) {
    console.error('Signup error:', err.message);
    return { error: err.message };
  }
});

ipcMain.handle('logIn', async (event, { email, password }) => {
  try {
    // 1️⃣ Log in via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const user = data.user;
    if (!user) return { error: 'No user returned from authentication.' };

    // 2️⃣ Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employee')
      .select('employeeid, positionid')
      .eq('user_id', user.id)
      .single();

    if (empError || !employee) {
      // ❌ Immediately revoke session
      await supabase.auth.signOut();
      return { error: 'No matching employee record found for this user.' };
    }

    const { data: position, error: posError } = await supabase
      .from('position')
      .select('positionname')
      .eq('positionid', employee.positionid)
      .single();

    if (posError || !position) {
      await supabase.auth.signOut();
      return { error: 'Unable to determine position for this employee.' };
    }

    const userRole = position.positionname;

    // 4️⃣ Check access
    if (!allowedRoles.map(r => r.toLowerCase()).includes(userRole.toLowerCase())) {
      await supabase.auth.signOut();
      return { error: 'You are not authorized to log in with this account.' };
    }

    return { user, session: data.session, role: userRole };

  } catch (err) {
    console.error('Login error:', err.message);
    await supabase.auth.signOut(); 
    return { error: err.message };
  }
});

ipcMain.handle('logOut', async () => {
  try {
    await supabase.auth.signOut();
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});
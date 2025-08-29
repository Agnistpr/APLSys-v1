import { ipcMain, dialog, app } from "electron";
import fs from "fs";
import path from "path";
import { dbClient } from "./db.js";

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

// -------queries---------------
ipcMain.handle("getUser", async (event, { username, password }) => {
  try {
    logMessage(`Attempting login for user: ${username}, ${password}`);
    const res = await dbClient.query(
      "SELECT userid, username, createddate, userimage FROM users WHERE username = $1 AND password = $2 LIMIT 1",
      [username, password]
    );

    if (res.rows.length > 0) {
      return res.rows[0];
    } else {
      return null;
    }
  } catch (err) {
    console.error("DB error:", err);
    throw err;
  }
});

ipcMain.handle('logAction', async (event, { userid, useraction, description }) => {
  try {
    await dbClient.query(`
      INSERT INTO userlogs (useraction, description, userid)
      VALUES ($1, $2, $3)
    `, [useraction, description, userid]);
    // logMessage("It worked");
    return { success: true };
  } catch (err) {
    logMessage(`Error: ${err.stack || err}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportEmployees", async () => {
  try {
    const res = await dbClient.query(`
      SELECT 
        e.employeeid,
        e.lastname,
        e.firstname,
        e.middlename,
        e.contact,
        e.address,
        e.email,
        e.hiredate,
        e.sss_number,
        e.pagibig_number,
        e.philhealth_number,
        e.bir_number,
        e.leavecredit,
        d.departmentname AS department,
        p.positionname AS position,
        s.timestart AS shiftstart,
        s.timeend AS shiftend,
        e.type,
        e.employeeimage
      FROM public.employee e
      LEFT JOIN public.department d ON e.departmentid = d.departmentid
      LEFT JOIN public.position p   ON e.positionid = p.positionid
      LEFT JOIN public.shift s      ON e.shiftid = s.shiftid
      ORDER BY e.employeeid ASC
    `);

    const rows = res.rows;
    if (rows.length === 0) return { success: false, message: "No employees to export" };

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Employee Export",
      defaultPath: "employees.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
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

ipcMain.handle("exportAttendance", async () => {
  try {
    const res = await dbClient.query(`
      SELECT 
          a.attendanceid,
          TO_CHAR(a.date, 'YY-MM-DD') AS date,
          e.lastname,
          e.firstname,
          e.middlename,
          TO_CHAR(a.timein, 'HH12:MI AM') AS "timeIn",
          TO_CHAR(a.timeout, 'HH12:MI AM') AS "timeOut",
          TO_CHAR(s.timestart, 'HH12:MI AM') AS "shiftStart",
          TO_CHAR(s.timeend, 'HH12:MI AM') AS "shiftEnd",
          ROUND(EXTRACT(EPOCH FROM (a.timeout - a.timein)) / 60 
              - EXTRACT(EPOCH FROM (s.timeend - s.timestart)) / 60) AS "UT/OT (Minutes)",
          CASE 
              WHEN ABS(EXTRACT(EPOCH FROM (a.timeout - a.timein)) / 60 
                      - EXTRACT(EPOCH FROM (s.timeend - s.timestart)) / 60) <= 10 
                  THEN 'On Time'
              WHEN (a.timeout - a.timein) > (s.timeend - s.timestart) 
                  THEN 'Overtime'
              ELSE 'Undertime'
          END AS "Status"
      FROM attendance a
      LEFT JOIN employee e ON a.employeeid = e.employeeid
      LEFT JOIN position p ON e.positionid = p.positionid
      LEFT JOIN shift s ON e.shiftid = s.shiftid
      ORDER BY a.date DESC;
    `);

    const rows = res.rows;
    if (rows.length === 0) return { success: false, message: "No attendance records to export" };

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Attendance Export",
      defaultPath: "attendance.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Attendance exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Attendance export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportTodayAttendance", async () => {
  try {
    const res = await dbClient.query(`
      SELECT 
          a.attendanceid,
          TO_CHAR(a.date, 'YY-MM-DD') AS date,
          e.lastname,
          e.firstname,
          e.middlename,
          TO_CHAR(a.timein, 'HH12:MI AM') AS "timeIn",
          TO_CHAR(a.timeout, 'HH12:MI AM') AS "timeOut",
          TO_CHAR(s.timestart, 'HH12:MI AM') AS "shiftStart",
          TO_CHAR(s.timeend, 'HH12:MI AM') AS "shiftEnd",
          ROUND(EXTRACT(EPOCH FROM (a.timeout - a.timein)) / 60 
              - EXTRACT(EPOCH FROM (s.timeend - s.timestart)) / 60) AS "UT/OT (Minutes)",
          CASE 
              WHEN ABS(EXTRACT(EPOCH FROM (a.timeout - a.timein)) / 60 
                      - EXTRACT(EPOCH FROM (s.timeend - s.timestart)) / 60) <= 10 
                  THEN 'On Time'
              WHEN (a.timeout - a.timein) > (s.timeend - s.timestart) 
                  THEN 'Overtime'
              ELSE 'Undertime'
          END AS "Status"
      FROM attendance a
      LEFT JOIN employee e ON a.employeeid = e.employeeid
      LEFT JOIN position p ON e.positionid = p.positionid
      LEFT JOIN shift s ON e.shiftid = s.shiftid
      WHERE a.date = CURRENT_DATE
      ORDER BY a.timeIn ASC;
    `);

    const rows = res.rows;
    if (rows.length === 0) return { success: false, message: "No attendance records for today" };

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Attendance Export",
      defaultPath: `attendance_${new Date().toISOString().split("T")[0]}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
    });

    if (!filePath) return { success: false, message: "Export cancelled" };

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage(`Attendance exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage("Attendance export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportAbsence", async (event, date) => {
  try {
    let res;
    if (!date) {
      res = await dbClient.query(`
        SELECT 
          e.employeeid AS "ID",
          e.lastname AS "Last Name",
          e.firstname AS "First Name",
          e.middlename AS "Middle Name",
          d.departmentname AS "Department",
          p.positionname AS "Position",
          TO_CHAR(s.timestart, 'HH12:MI AM') AS "Shift Start",
          TO_CHAR(s.timeend, 'HH12:MI AM') AS "Shift End",
          TO_CHAR(CURRENT_DATE, 'YY-MM-DD') AS "Date"
        FROM employee e
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN shift s ON e.shiftid = s.shiftid
        WHERE e.employeeid NOT IN (
          SELECT employeeid FROM attendance WHERE date = CURRENT_DATE
        )
        AND e.employeeid NOT IN (
          SELECT employeeid FROM leave WHERE date = CURRENT_DATE
        )
        ORDER BY e.lastname
      `);
    } else {
      res = await dbClient.query(`
        SELECT 
          e.employeeid AS "ID",
          e.lastname AS "Last Name",
          e.firstname AS "First Name",
          e.middlename AS "Middle Name",
          d.departmentname AS "Department",
          p.positionname AS "Position",
          TO_CHAR(s.timestart, 'HH12:MI AM') AS "Shift Start",
          TO_CHAR(s.timeend, 'HH12:MI AM') AS "Shift End",
          TO_CHAR(CURRENT_DATE, 'YY-MM-DD') AS "Date"
        FROM employee e
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN shift s ON e.shiftid = s.shiftid
        WHERE e.employeeid NOT IN (
          SELECT employeeid FROM attendance WHERE date = $1::date
        )
        AND e.employeeid NOT IN (
          SELECT employeeid FROM leave WHERE date = $1::date
        )
        ORDER BY e.lastname
      `, [date]);
    }

    const rows = res.rows;
    if (rows.length === 0) return { success: false, message: "No absent employees to export" };

    // Build CSV
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(",")),
    ].join("\n");

    // Save dialog
    const { filePath } = await dialog.showSaveDialog({
      title: "Save Absent Employees Export",
      defaultPath: `absent_${date || new Date().toISOString().split("T")[0]}.csv`,
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
    const res = await dbClient.query(`
      SELECT 
        i.itemid AS "Item ID",
        i.itemname AS "Item Name",
        i.quantity AS "Quantity",
        TO_CHAR(i.lastmodified, 'YY-MM-DD') AS "Last Modified"
      FROM inventory i
      ORDER BY i.itemid;
    `);

    const rows = res.rows;
    if (rows.length === 0) {
      return { success: false, message: "No inventory records to export" };
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Inventory Export",
      defaultPath: "inventory.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
    });

    if (!filePath) {
      return { success: false, message: "Export cancelled" };
    }

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage?.(`Inventory exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage?.("Inventory export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportInventoryLogs", async (event, date) => {
  try {
    let res;
    if (!date) {
      res = await dbClient.query(`
        SELECT 
          e.employeeid AS "ID",
          e.lastname AS "Last Name",
          e.firstname AS "First Name",
          e.middlename AS "Middle Name",
          d.departmentname AS "Department",
          p.positionname AS "Position",
          i.itemname AS "Item",
          l.quantity AS "Quantity",
          TO_CHAR(l.date, 'YY-MM-DD') AS "Date"
        FROM inventorylogs l
        LEFT JOIN employee e ON l.employeeid = e.employeeid
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN inventory i ON l.itemid = i.itemid
        ORDER BY l.date DESC
      `);
    } else {
      res = await dbClient.query(`
        SELECT 
          e.employeeid AS "ID",
          e.lastname AS "Last Name",
          e.firstname AS "First Name",
          e.middlename AS "Middle Name",
          d.departmentname AS "Department",
          p.positionname AS "Position",
          i.itemname AS "Item",
          l.quantity AS "Quantity",
          TO_CHAR(l.date, 'YY-MM-DD') AS "Date"
        FROM inventorylogs l
        LEFT JOIN employee e ON l.employeeid = e.employeeid
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN inventory i ON l.itemid = i.itemid
        WHERE l.date = $1::date
        ORDER BY l.date DESC
      `, [date]);
    }

    const rows = res.rows;
    if (rows.length === 0) {
      return { success: false, message: "No inventory log records to export" };
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Inventory Export",
      defaultPath: "inventorylogs.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
    });

    if (!filePath) {
      return { success: false, message: "Export cancelled" };
    }

    fs.writeFileSync(filePath, csv, "utf8");
    logMessage?.(`Inventory logs exported to ${filePath}`);

    return { success: true, filePath };
  } catch (err) {
    logMessage?.("Inventory logs export failed: " + err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("exportApplicants", async (event, status) => {
  try {
    const res = await dbClient.query(
      `
      SELECT 
        a.applicantid as "ID",
        a.lastname AS "Last Name",
        a.firstname AS "First Name",
        a.middlename AS "Middle Name",
        d.departmentname AS "Department",
        p.positionname AS "Position",
        a.contact AS "Contact",
        a.address AS "Address",
        a.email AS "Email",
        a.sss_number AS "SSS Number",
        a.pagibig_number AS "Pag-IBIG Number",
        a.philhealth_number AS "PhilHealth Number",
        a.bir_number AS "BIR Number",
        a.status AS "Status",
        TO_CHAR(a.applicationdate, 'YY-MM-DD') AS "Application Date"
      FROM public.applicant a
      LEFT JOIN public.department d ON a.departmentid = d.departmentid
      LEFT JOIN public.position p   ON a.positionid = p.positionid
      WHERE a.status = $1
        AND a.trainingdate IS NULL
      ORDER BY a.applicantid ASC
      `,
      [status]
    );

    const rows = res.rows;
    if (rows.length === 0) {
      return { success: false, message: `No applicants with status "${status}" to export` };
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => 
        headers.map(h => `"${row[h] ?? ""}"`).join(",")
      )
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Applicant Export",
      defaultPath: `applicants_${status}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
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
    const res = await dbClient.query(
      `
      SELECT 
        a.applicantid as "ID",
        a.lastname AS "Last Name",
        a.firstname AS "First Name",
        a.middlename AS "Middle Name",
        d.departmentname AS "Department",
        p.positionname AS "Position",
        a.contact AS "Contact",
        a.address AS "Address",
        a.email AS "Email",
        a.sss_number AS "SSS Number",
        a.pagibig_number AS "Pag-IBIG Number",
        a.philhealth_number AS "PhilHealth Number",
        a.bir_number AS "BIR Number",
        a.status AS "Status",
        TO_CHAR(a.applicationdate, 'YY-MM-DD') AS "Application Date"
      FROM public.applicant a
      LEFT JOIN public.department d ON a.departmentid = d.departmentid
      LEFT JOIN public.position p   ON a.positionid = p.positionid
      WHERE a.trainingdate IS NULL
      ORDER BY a.applicantid ASC
      `,
    );

    const rows = res.rows;
    if (rows.length === 0) {
      return { success: false, message: `No applicants to export` };
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => 
        headers.map(h => `"${row[h] ?? ""}"`).join(",")
      )
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Applicant Export",
      defaultPath: `applicants_all.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
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
    const res = await dbClient.query(
      `
      SELECT 
        a.applicantid as "ID",
        a.lastname AS "Last Name",
        a.firstname AS "First Name",
        a.middlename AS "Middle Name",
        d.departmentname AS "Department",
        p.positionname AS "Position",
        a.contact AS "Contact",
        a.address AS "Address",
        a.email AS "Email",
        a.sss_number AS "SSS Number",
        a.pagibig_number AS "Pag-IBIG Number",
        a.philhealth_number AS "PhilHealth Number",
        a.bir_number AS "BIR Number",
        a.status AS "Status",
        TO_CHAR(a.trainingdate, 'YY-MM-DD') AS "Training Date"
      FROM public.applicant a
      LEFT JOIN public.department d ON a.departmentid = d.departmentid
      LEFT JOIN public.position p   ON a.positionid = p.positionid
      WHERE a.status = $1
        AND a.trainingdate IS NOT NULL
      ORDER BY a.applicantid ASC
      `,
      [status]
    );

    const rows = res.rows;
    if (rows.length === 0) {
      return { success: false, message: `No Trainees with status "${status}" to export` };
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => 
        headers.map(h => `"${row[h] ?? ""}"`).join(",")
      )
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Trainees Export",
      defaultPath: `trainees_${status}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
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
    const res = await dbClient.query(
      `
      SELECT 
        a.applicantid as "ID",
        a.lastname AS "Last Name",
        a.firstname AS "First Name",
        a.middlename AS "Middle Name",
        d.departmentname AS "Department",
        p.positionname AS "Position",
        a.contact AS "Contact",
        a.address AS "Address",
        a.email AS "Email",
        a.sss_number AS "SSS Number",
        a.pagibig_number AS "Pag-IBIG Number",
        a.philhealth_number AS "PhilHealth Number",
        a.bir_number AS "BIR Number",
        a.status AS "Status",
        TO_CHAR(a.trainingdate, 'YY-MM-DD') AS "Training Date"
      FROM public.applicant a
      LEFT JOIN public.department d ON a.departmentid = d.departmentid
      LEFT JOIN public.position p   ON a.positionid = p.positionid
      WHERE a.trainingdate IS NOT NULL
      ORDER BY a.applicantid ASC
      `,
    );

    const rows = res.rows;
    if (rows.length === 0) {
      return { success: false, message: `No trainees to export` };
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => 
        headers.map(h => `"${row[h] ?? ""}"`).join(",")
      )
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Trainees Export",
      defaultPath: `trainees_all.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
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
    let res;
    if (!date) {
      res = await dbClient.query(`
        SELECT 
          l.userlogid AS "Log ID", 
          u.username AS "Username",
          l.useraction AS "Action", 
          l.description AS "Description", 
          TO_CHAR(l.dateofaction, 'YY-MM-DD') AS "Date"
        FROM userlogs l
        LEFT JOIN users u ON u.userid = l.userid
        ORDER BY dateofaction DESC
      `);
    } else {
      res = await dbClient.query(`
        SELECT 
          l.userlogid AS "Log ID", 
          u.username AS "Username",
          l.useraction AS "Action", 
          l.description AS "Description", 
          TO_CHAR(l.dateofaction, 'YY-MM-DD') AS "Date"
        FROM userlogs l
        LEFT JOIN users u ON u.userid = l.userid
        WHERE DATE(dateofaction) = $1
        ORDER BY dateofaction DESC
      `, [date]);
    }

    const rows = res.rows;
    if (rows.length === 0) return { success: false, message: "No logs to export" };

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","), 
      ...rows.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))
    ].join("\n");

    const { filePath } = await dialog.showSaveDialog({
      title: "Save Logs Export",
      defaultPath: "logs.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }]
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

ipcMain.handle('getDashboardCardData', async () => {
  try {
    const totalEmployeesRes = await dbClient.query(`
      SELECT COUNT(DISTINCT employeeid) AS total FROM employee
    `);

    const totalAttendanceRes = await dbClient.query(`
      SELECT COUNT(*) AS total FROM attendance WHERE date = CURRENT_DATE
    `);

    const totalOnLeaveRes = await dbClient.query(`
      SELECT COUNT(*) AS total FROM leave WHERE date = CURRENT_DATE
    `);

    return {
      totalEmployees: totalEmployeesRes.rows[0].total,
      totalAttendance: totalAttendanceRes.rows[0].total,
      totalOnLeave: totalOnLeaveRes.rows[0].total,
    };
  } catch (error) {
    return {
      totalEmployees: 0,
      totalAttendance: 0,
      totalOnLeave: 0,
    };
  }
});

   
ipcMain.handle('getEmployee', async (event, employeeId) => {
  try {
    const res = await dbClient.query(
      `
      SELECT 
        e.employeeid,
        CONCAT(
          e.lastname, ', ', 
          e.firstname, ' ', 
          COALESCE(LEFT(e.middlename, 1) || '.', '')
        ) AS name,
        d.departmentname AS department,
        p.positionname AS position,
        e.contact,
        e.email,
        e.address,
        e.hiredate,
        e.sss_number,
        e.pagibig_number,
        e.philhealth_number,
        e.bir_number,
        e.leavecredit,
        s.timestart AS shiftstart,
        s.timeend AS shiftend,
        encode(employeeimage, 'base64') AS employeeimage
      FROM employee e
      LEFT JOIN department d ON e.departmentid = d.departmentid
      LEFT JOIN position p ON e.positionid = p.positionid
      LEFT JOIN shift s ON e.shiftid = s.shiftid
      WHERE e.employeeid = $1
      `,
      [employeeId]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    console.error('Error fetching employee details:', err);
    return null;
  }
});

ipcMain.handle('getEmployees', async () => {
  try {
    const res = await dbClient.query(`
      SELECT 
        e.employeeid,
        CONCAT(
          e.lastname, ', ', 
          e.firstname, ' ', 
          COALESCE(LEFT(e.middlename, 1) || '.', '')
        ) AS name,
        d.departmentname AS department,
        p.positionname AS position,
        CONCAT(s.timestart, ' - ', s.timeend) AS shift,
        e.leavecredit
      FROM employee e
      LEFT JOIN department d ON e.departmentid = d.departmentid
      LEFT JOIN position p ON e.positionid = p.positionid
      LEFT JOIN shift s ON e.shiftid = s.shiftid
      ORDER BY e.employeeid ASC
    `);
    return res.rows;
  } catch (err) {
    console.error('DB query error:', err);
    return [];
  }
});

ipcMain.handle('getEmployeeAttendance', async (event, employeeId, selectedDate) => {
  try {
    let res;
    if (selectedDate) {
      res = await dbClient.query(`
        SELECT a.date, a.timein, a.timeout, s.timestart AS shiftstart, s.timeend AS shiftend
        FROM attendance a
        LEFT JOIN employee e ON a.employeeid = e.employeeid
        LEFT JOIN shift s ON e.shiftid = s.shiftid
        WHERE a.employeeid = $1 AND a.date = $2
      `, [employeeId, selectedDate]);
    } else {
      res = await dbClient.query(`
        SELECT a.date, a.timein, a.timeout, s.timestart AS shiftstart, s.timeend AS shiftend
        FROM attendance a
        LEFT JOIN employee e ON a.employeeid = e.employeeid
        LEFT JOIN shift s ON e.shiftid = s.shiftid
        WHERE a.employeeid = $1
      `, [employeeId]);
    }

    return res.rows;
  } catch (err) {
    console.error('Failed to fetch attendance:', err);
    return [];
  }
});

// ipcMain.handle('addEmployees', async (event, employeeId) => {
//   try {
//     const res = await dbClient.query(`
//       SELECT a.date, a.timein, a.timeout, s.timestart AS shiftstart, s.timeend AS shiftend
//       FROM attendance a
//       LEFT JOIN employee e ON a.employeeid = e.employeeid
//       LEFT JOIN shift s ON e.shiftid = s.shiftid
//       WHERE a.employeeid = $1
//       ORDER BY a.date DESC
//     `, [employeeId]);

//     return res.rows;
//   } catch (err) {
//     console.error('Failed to fetch attendance:', err);
//     return [];
//   }
// });

// ipcMain.handle('searchEmployees', async (event, searchTerm) => {
//   try {
//     const res = await dbClient.query(
//       `
//       SELECT 
//         e.employeeid,
//         CONCAT(
//           e.lastname, ', ', 
//           e.firstname, ' ', 
//           COALESCE(LEFT(e.middlename, 1) || '.', '')
//         ) AS "fullName",
//         d.departmentname AS department,
//         p.positionname AS position,
//         s.timestart AS shiftstart,
//         s.timeend AS shiftend,
//         e.leavecredit
//       FROM employee e
//       LEFT JOIN department d ON e.departmentid = d.departmentid
//       LEFT JOIN position p ON e.positionid = p.positionid
//       LEFT JOIN shift s ON e.shiftid = s.shiftid
//       WHERE
//         CONCAT(e.firstname, ' ', COALESCE(LEFT(e.middlename,1) || '. ', ''), e.lastname) ILIKE $1
//       ORDER BY e.employeeid ASC
//       `,
//       [`%${searchTerm}%`]
//     );
//     return res.rows;
//   } catch (err) {
//     console.error('Search failed:', err);
//     return [];
//   }
// });

ipcMain.handle("updateEmployee", async (event, { employeeId, field, value }) => {
  try {
    let finalValue = value;

    if (field === "employeeimage" && typeof value === "string") {
      finalValue = Buffer.from(value, "base64");
    }

    const result = await dbClient.query(
      `UPDATE employee SET ${field} = $1 WHERE employeeid = $2`,
      [finalValue, employeeId]
    );

    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


ipcMain.handle('updateEmployeeField', async (event, { employeeId, field, value }) => {
  try {
    await dbClient.query(
      `UPDATE employee SET ${field} = $1 WHERE employeeid = $2`,
      [value, employeeId]
    );
    logMessage("EDIT SUCCESS", { employeeId, field, value });
    return { success: true };
  } catch (err) {
    console.error('Update failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('getAttendance', async () => {
  try {
    const res = await dbClient.query(`
      SELECT 
        a.date,
        e.employeeid,
        CONCAT(
          e.lastname, ', ', 
          e.firstname, ' ', 
          COALESCE(LEFT(e.middlename, 1) || '.', '')
        ) AS "fullName",
        p.positionname AS position,
        a.timein AS "timeIn",
        a.timeout AS "timeOut",
        CONCAT(s.timestart, ' - ', s.timeend) AS shift,
        CASE 
          WHEN a.timein > s.timestart THEN CONCAT(EXTRACT(EPOCH FROM (a.timein - s.timestart))/60, ' mins')
          WHEN a.timeout < s.timeend THEN CONCAT(EXTRACT(EPOCH FROM (s.timeend - a.timeout))/3600, ' h')
          ELSE '0.00 h'
        END AS utot
      FROM attendance a
      LEFT JOIN employee e ON a.employeeid = e.employeeid
      LEFT JOIN position p ON e.positionid = p.positionid
      LEFT JOIN shift s ON e.shiftid = s.shiftid
      ORDER BY a.date DESC
    `);
    return res.rows;
  } catch (err) {
    console.error('DB query error:', err);
    return [];
  }
});

ipcMain.handle('getAttendanceByDate', async (event, date) => {
  try {
    const res = await dbClient.query(
      `
      SELECT 
        a.date,
        CONCAT(
          e.lastname, ', ', 
          e.firstname, ' ', 
          COALESCE(LEFT(e.middlename, 1) || '.', '')
        ) AS "fullName",
        e.employeeid,
        p.positionname AS position,
        a.timein AS "timeIn",
        a.timeout AS "timeOut",
        CONCAT(s.timestart, ' - ', s.timeend) AS shift
      FROM attendance a
      LEFT JOIN employee e ON a.employeeid = e.employeeid
      LEFT JOIN position p ON e.positionid = p.positionid
      LEFT JOIN shift s ON e.shiftid = s.shiftid
      WHERE a.date = $1
      ORDER BY a.timein
      `,
      [date]
    );
    return res.rows;
  } catch (err) {
    console.error('Error fetching attendance by date:', err);
    return [];
  }
});

ipcMain.handle('getAbsent', async (event, date) => {
  try {
    let res;
    if (!date) { 
      res = await dbClient.query(`
        SELECT 
          e.employeeid,
          CONCAT(
            e.lastname, ', ', 
            e.firstname, ' ', 
            COALESCE(LEFT(e.middlename, 1) || '.', '')
          ) AS "fullName",
          d.departmentname AS department,
          p.positionname AS position,
          s.timestart || ' - ' || s.timeend AS shift
        FROM employee e
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN shift s ON e.shiftid = s.shiftid
        WHERE e.employeeid NOT IN (
          SELECT employeeid FROM attendance
        )
        AND e.employeeid NOT IN (
          SELECT employeeid FROM leave
        )
        ORDER BY e.lastname
      `);
    } else {
      res = await dbClient.query(`
        SELECT 
          e.employeeid,
          CONCAT(
            e.lastname, ', ', 
            e.firstname, ' ', 
            COALESCE(LEFT(e.middlename, 1) || '.', '')
          ) AS "fullName",
          d.departmentname AS department,
          p.positionname AS position,
          s.timestart || ' - ' || s.timeend AS shift
        FROM employee e
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN shift s ON e.shiftid = s.shiftid
        WHERE e.employeeid NOT IN (
          SELECT employeeid FROM attendance WHERE date = $1
        )
        AND e.employeeid NOT IN (
          SELECT employeeid FROM leave WHERE date = $1
        )
        ORDER BY e.lastname
      `, [date]);
    }
    return res.rows;
  } catch (err) {
    console.error('DB query error: ', err);
    return [];
  }
});

ipcMain.handle('getLeave', async (event, date) => {
  try {
    let res;
    if (!date) {
      res = await dbClient.query(`
        SELECT 
          l.date,
          l.employeeid,
          CONCAT(e.firstname, ' ', 
            COALESCE(LEFT(e.middlename,1) || '. ', ''), 
            e.lastname) AS "fullName",
          p.positionname AS position,
          d.departmentname AS department,
          s.timestart || ' - ' || s.timeend AS shift,
          l.reason
        FROM leave l
        LEFT JOIN employee e ON l.employeeid = e.employeeid
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN shift s ON e.shiftid = s.shiftid
        ORDER BY e.lastname
      `);
    } else {
      res = await dbClient.query(`
        SELECT 
          l.date,
          l.employeeid,
          CONCAT(e.firstname, ' ', 
            COALESCE(LEFT(e.middlename,1) || '. ', ''), 
            e.lastname) AS "fullName",
          p.positionname AS position,
          d.departmentname AS department,
          s.timestart || ' - ' || s.timeend AS shift,
          l.reason
        FROM leave l
        LEFT JOIN employee e ON l.employeeid = e.employeeid
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN shift s ON e.shiftid = s.shiftid
        WHERE l.date = $1
        ORDER BY e.lastname
      `, [date]);
    }
    return res.rows;
  } catch (err) {
    console.error('DB query error: ', err);
    return [];
  }
});

ipcMain.handle('addLeave', async (event, employeeIds, date, reason) => {
  try {
    logMessage("Transaction started");
    await dbClient.query('BEGIN');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const id of employeeIds) {
      logMessage(`Processing employee ${id}`);

      // Check existing leave
      const { rows: existing } = await dbClient.query(
        `SELECT 1 FROM leave WHERE employeeid = $1 AND date = $2`,
        [id, date]
      );
      logMessage(`Checked existing leave for employee ${id}`);

      if (existing.length > 0) {
        skippedCount++;
        logMessage(`Skipped employee ${id} (leave already exists)`);
        continue;
      }

      // Get leave credits
      const { rows: emp } = await dbClient.query(
        `SELECT leavecredit FROM employee WHERE employeeid = $1 FOR UPDATE`,
        [id]
      );
      logMessage(`Fetched leave credits for employee ${id}`);

      if (emp.length === 0) {
        throw new Error(`Employee ${id} not found`);   
      }

      const leaveCredit = emp[0].leavecredit;
      logMessage(`Employee ${id} has ${leaveCredit} leave credits`);

      if (leaveCredit <= 0) {
        throw new Error(`Employee ${id} has no leave credits left`);
      }

      // Deduct leave credit
      await dbClient.query(
        `UPDATE employee SET leavecredit = leavecredit - 1 WHERE employeeid = $1`,
        [id]
      );
      logMessage(`Deducted 1 leave credit for employee ${id}`);

      // Insert leave
      await dbClient.query(
        `INSERT INTO leave (employeeid, date, reason) VALUES ($1, $2, $3)`,
        [id, date, reason]
      );
      logMessage(`Inserted leave record for employee ${id} on ${date}`);

      insertedCount++;
    }

    await dbClient.query('COMMIT');
    logMessage("Transaction committed");

    if (insertedCount === 0) {
      logMessage("No leave inserted (all skipped or no credits)");
      return { success: false, message: "No leave added (duplicates or no credits)" };
    }

    logMessage(`Operation finished: inserted=${insertedCount}, skipped=${skippedCount}`);
    return {
      success: true,
      inserted: insertedCount,
      skipped: skippedCount
    };

  } catch (err) {
    await dbClient.query('ROLLBACK');
    logMessage(`Transaction rolled back due to error: ${err.message}`);
    console.error('Error adding leave:', err);
    return { success: false, error: err.message };
  }
});


ipcMain.handle('getInventoryLogs', async (event, date) => {
  try {
    let res;
    if (!date) {
      res = await dbClient.query(`
        SELECT 
          e.employeeid,
          CONCAT(
            e.lastname, ', ',
            e.firstname, ' ',
            COALESCE(LEFT(e.middlename, 1) || '.', '')
          ) AS name,
          d.departmentname AS department,
          p.positionname AS position,
          i.itemname,
          l.quantity,
          l.date
        FROM inventorylogs l
        LEFT JOIN employee e ON l.employeeid = e.employeeid
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN inventory i ON l.itemid = i.itemid
        ORDER BY l.date DESC
      `);
    } else {
      res = await dbClient.query(`
        SELECT 
          CONCAT(
            e.lastname, ', ',
            e.firstname, ' ',
            COALESCE(LEFT(e.middlename, 1) || '.', '')
          ) AS name,
          d.departmentname AS department,
          p.positionname AS position,
          i.itemname,
          l.quantity,
          l.date
        FROM inventorylogs l
        LEFT JOIN employee e ON l.employeeid = e.employeeid
        LEFT JOIN department d ON e.departmentid = d.departmentid
        LEFT JOIN position p ON e.positionid = p.positionid
        LEFT JOIN inventory i ON l.itemid = i.itemid
        WHERE l.date = $1
        ORDER BY l.date DESC
      `, [date]);
    }

    return res.rows;
  } catch (err) {
    console.error('DB query error: ', err);
    return [];
  }
});

ipcMain.handle('getInventoryCard', async () => {
  try {
    const res = await dbClient.query(`
      SELECT 
        i.itemid,
        i.itemname,
        i.quantity,
        i.lastmodified
      FROM inventory i
      ORDER BY i.itemid;
    `);
    return res.rows;
  } catch (err) {
    console.error('DB query error:', err);
    return [];
  }
});

ipcMain.handle('updateItem', async (event, { itemid, itemname, quantity }) => {
  try {
    await dbClient.query(
      `UPDATE inventory
       SET itemname = $1,
           quantity = $2
       WHERE itemid = $3`,
      [itemname, quantity, itemid]
    );
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('getTrainees', async (event, status) => {
  try {
    const res = await dbClient.query(`
      SELECT 
        a.applicantid,
        CONCAT(
          a.lastname, ', ',
          a.firstname, ' ',
          COALESCE(LEFT(a.middlename, 1) || '.', '')
        ) AS "fullname",
        d.departmentname AS department,
        p.positionname AS position,
        a.trainingdate
      FROM applicant a
      LEFT JOIN department d ON a.departmentid = d.departmentid
      LEFT JOIN position p ON a.positionid = p.positionid
      WHERE a.status = $1
        AND a.trainingdate IS NOT NULL
      ORDER BY a.applicantid ASC
    `, [status]);

    return res.rows;
  } catch (err) {
    console.error('DB query error (getTrainees):', err);
    return [];
  }
});

ipcMain.handle('getApplicants', async (event, status) => {
  try {
    const res = await dbClient.query(`
      SELECT 
        a.applicantid,
        CONCAT(
          a.lastname, ', ',
          a.firstname, ' ',
          COALESCE(LEFT(a.middlename, 1) || '.', '')
        ) AS "fullname",
        d.departmentname AS department,
        p.positionname AS position,
        a.applicationdate
      FROM applicant a
      LEFT JOIN department d ON a.departmentid = d.departmentid
      LEFT JOIN position p ON a.positionid = p.positionid
      WHERE a.status = $1
        AND a.trainingdate IS NULL
      ORDER BY a.applicantid ASC
    `, [status]);

    return res.rows;
  } catch (err) {
    console.error('DB query error (getApplicants):', err);
    return [];
  }
});

// ipcMain.handle("addApplicant", async (event, applicant) => {
//   try {
//     const query = `
//       INSERT INTO applicant 
//         (firstname, middlename, lastname, contact, email, address, departmentid, positionid, sss_number, pagibig_number, philhealth_number, status, applicationdate, applicantimage) 
//       VALUES 
//         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
//       RETURNING applicantid
//     `;

//     const values = [
//       applicant.firstName,
//       applicant.middleName,
//       applicant.lastName,
//       applicant.contact,
//       applicant.email,
//       applicant.address,
//       applicant.departmentId,
//       applicant.positionId,
//       applicant.sss || null,
//       applicant.pagibig || null,
//       applicant.philhealth || null,
//       applicant.status || "Pending",
//       applicant.image ? Buffer.from(applicant.image.data, "base64") : null,
//     ];

//     const res = await dbClient.query(query, values);
//     return res.rows[0];
//   } catch (err) {
//     console.error("DB insert error (addApplicant):", err);
//     throw err;
//   }
// });

ipcMain.handle("addApplicant", async (event, resume) => {
  try {
    const profile = resume?.profile || {};

    // Map resume fields to DB columns
    const firstName = profile.firstName || null;
    const middleName = profile.middleName || null;
    const lastName = profile.lastName || null;
    const email = profile.email || null;
    const contact = profile.phone || null;
    const address = profile.location || null;
    const gender = profile.gender || "Unspecified";
    const age = profile.age ? parseInt(profile.age, 10) : null;
    const birthdate = profile.birthdate || null;
    const status = "Pending"; 
    const applicantImage = resume.image ? Buffer.from(resume.image.data, "base64") : null;

    let departmentId = null;
    if (resume.departmentName) {
      const deptRes = await dbClient.query(
        `SELECT departmentid FROM department WHERE departmentName = $1 LIMIT 1`,
        [resume.departmentName]
      );
      if (deptRes.rows.length) departmentId = deptRes.rows[0].departmentid;
    }

    let positionId = null;
    if (resume.positionName) {
      const posRes = await dbClient.query(
        `SELECT positionid FROM position WHERE positionname = $1 LIMIT 1`,
        [resume.positionName]
      );
      if (posRes.rows.length) positionId = posRes.rows[0].positionid;
    }

    // Insert applicant (with resume JSONB)
    const query = `
      INSERT INTO applicant 
        (firstname, middlename, lastname, contact, email, address, departmentid, positionid, gender, age, birthdate, status, applicationdate, applicantimage, resume)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13, $14)
      RETURNING applicantid
    `;

    const values = [
      firstName,
      middleName,
      lastName,
      contact,
      email,
      address,
      departmentId,
      positionId,
      gender,
      age,
      birthdate,
      status,
      applicantImage,
      resume
    ];

    const res = await dbClient.query(query, values);
    return res.rows[0];

  } catch (err) {
    console.error("DB insert error (addApplicantFromResume):", err);
    throw err;
  }
});

ipcMain.handle('getLogs', async (event, date) => {
  try {
    let res;
    if (!date) {
      res = await dbClient.query(`
        SELECT 
          l.userlogid, 
          u.username,
          l.useraction, 
          l.description, 
          l.dateofaction
        FROM userlogs l
        LEFT JOIN users u ON u.userid = l.userid
        ORDER BY dateofaction DESC
      `);
    } else {
      res = await dbClient.query(`
        SELECT 
          l.userlogid, 
          u.username,
          l.useraction, 
          l.description, 
          l.dateofaction
        FROM userlogs l
        LEFT JOIN users u ON u.userid = l.userid
        WHERE DATE(dateofaction) = $1
        ORDER BY dateofaction DESC
      `, [date]);
    }

    return res.rows;
  } catch (err) {
    console.error('DB query error: ', err);
    return [];
  }
});

ipcMain.handle('updateApplicantsStatus', async (event, ids, options) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, message: "No applicants selected" };
    }

    const { status, setTrainingDate, resetTraining, setApplicationDate } = options;
    const now = new Date();

    let query = `
      UPDATE applicant
      SET status = $1
    `;
    const params = [status];

    if (setTrainingDate) {
      query += `, trainingdate = $${params.length + 1}`;
      params.push(now);
    }
    if (resetTraining) {
      query += `, trainingdate = NULL`;
    }
    if (setApplicationDate) {
      query += `, applicationdate = $${params.length + 1}`;
      params.push(now);
    }

    query += ` WHERE applicantid = ANY($${params.length + 1}::int[]) RETURNING *`;
    params.push(ids);

    const result = await dbClient.query(query, params);

    if (status === "Hired" && result.rows.length > 0) {
      for (const applicant of result.rows) {
        const insertEmployeeQuery = `
          INSERT INTO employee (
            firstname,
            middlename,
            lastname,
            departmentid,
            positionid,
            contact,
            address,
            email,
            sss_number,
            pagibig_number,
            philhealth_number,
            bir_number,
            applicantid,
            employeeimage,
            type,
            leavecredit,
            shiftid,
            hiredate
          )
          VALUES (
            $1, $2, $3, $4, $5, 
            $6, $7, $8, $9, $10, 
            $11, $12, $13, $14,
            'Regular', 0.00, 1, $15
          )
          RETURNING employeeid
        `;

        const employeeParams = [
          applicant.firstname,
          applicant.middlename,
          applicant.lastname,
          applicant.departmentid,
          applicant.positionid,
          applicant.contact,
          applicant.address,
          applicant.email,
          applicant.sss_number,
          applicant.pagibig_number,
          applicant.philhealth_number,
          applicant.bir_number,
          applicant.applicantid,
          applicant.applicantimage,
          now
        ];

        await dbClient.query(insertEmployeeQuery, employeeParams);
      }
    }
    return { success: true };
  } catch (err) {
    logMessage("DB query error (updateApplicantsStatus):", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("getDeptPos", async () => {
  try {
    const res = await dbClient.query(`
      SELECT 
        d.departmentid,
        d.departmentname,
        p.positionid,
        p.positionname
      FROM department d
      JOIN position p ON d.departmentid = p.departmentid
      ORDER BY d.departmentname, p.positionname
    `);

    return res.rows;
  } catch (err) {
    console.error("DB query error (getDepartmentsAndPositions):", err);
    return [];
  }
});

// -----------------------------
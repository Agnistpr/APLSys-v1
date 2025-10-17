process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { Client } from "pg";

const NUM_APPLICANTS = 5;
const NUM_EMPLOYEES = 25;
const ATTENDANCE_DAYS = 10;
const NUM_LEAVES = 5;
const NUM_INVENTORY_LOGS = 2;

const client = new Client({
  connectionString:
    "postgresql://postgres.ntsvoexuhippdbfnivud:GO2bHiZvgXTSp3YG@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

const firstNames = ["John", "Jane", "Mike", "Anna", "Paul", "Mary", "Chris", "Laura", "David", "Emma"];
const lastNames = ["Doe", "Smith", "Johnson", "Brown", "Williams", "Jones", "Taylor", "Davis", "Miller", "Wilson"];
const genders = ["Male", "Female"];
const empTypes = ["Regular", "Contractual", "Resigned"];
const leaveStatuses = ["Approved", "Request"];
const leaveReasons = ["Vacation leave", "Sick leave", "Family emergency", "Personal matters", "Medical appointment", "Travel"];
const items = ["Hard Hat", "Safety Gloves", "Boots", "Earplugs", "Safety Goggles", "Reflective Vest", "First Aid Kit", "Tool Belt", "Face Mask", "Harness"];

function getNameByIndex(i) {
  const firstIndex = i % firstNames.length;
  const lastIndex = Math.floor(i / firstNames.length) % lastNames.length;
  return { first: firstNames[firstIndex], last: lastNames[lastIndex] };
}
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function formatDate(date) {
  return date.toISOString().split("T")[0];
}
function smartTimeIn() {
  const hour = 8 + Math.floor(Math.random() * 2);
  const minute = Math.floor(Math.random() * 20);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function smartTimeOut() {
  const hour = 16 + Math.floor(Math.random() * 2);
  const minute = Math.floor(Math.random() * 20);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

async function seedDatabase() {
  try {
    await client.connect();
    console.log("Resetting database...");

    await client.query(`
      TRUNCATE TABLE 
        userlogs, users, attendance, leave, inventorylogs, document,
        employee, applicant, shift, position,
        department, inventory
      RESTART IDENTITY CASCADE
    `);

    const deptRes = await client.query(`
      INSERT INTO department (departmentname) VALUES ('Office'), ('Production') RETURNING *;
    `);

    const posRes = await client.query(`
      INSERT INTO position (positionname, departmentid) VALUES
        ('HR', ${deptRes.rows[0].departmentid}),
        ('Cutting', ${deptRes.rows[1].departmentid}),
        ('Delivery', ${deptRes.rows[1].departmentid}),
        ('Extrusion', ${deptRes.rows[1].departmentid}),
        ('Maintenance', ${deptRes.rows[1].departmentid}),
        ('Manual', ${deptRes.rows[1].departmentid}),
        ('Office', ${deptRes.rows[0].departmentid}),
        ('Printing', ${deptRes.rows[1].departmentid}),
        ('Quality Assurance', ${deptRes.rows[1].departmentid}),
        ('Slitting', ${deptRes.rows[1].departmentid}),
        ('Supervisor', ${deptRes.rows[1].departmentid}),
        ('Utility', ${deptRes.rows[1].departmentid}),
        ('Warehouse', ${deptRes.rows[1].departmentid})
      RETURNING *;
    `);

    const shiftInserts = [];
    let cur = 0;
    while (shiftInserts.length < 20) {
      const startHour = 7 + Math.floor(cur / 2);
      const startMinute = cur % 2 === 0 ? "00" : "30";
      const durationHours = 6 + Math.floor(Math.random() * 4);
      let endHour = startHour + durationHours;
      if (endHour > 19) endHour = 19;
      const endMinute = startMinute;
      shiftInserts.push(`('${String(startHour).padStart(2, "0")}:${startMinute}', '${String(endHour).padStart(2, "0")}:${endMinute}', ${Math.random() < 0.3 ? "NULL" : Math.floor(Math.random() * 5) + 1})`);
      cur++;
    }
    const shiftRes = await client.query(`
      INSERT INTO shift (timestart, timeend, machineno)
      VALUES ${shiftInserts.join(",")}
      RETURNING *;
    `);

    for (let i = 0; i < NUM_APPLICANTS; i++) {
      const { first, last } = getNameByIndex(i);
      const birthdate = randomDate(new Date(1985, 0, 1), new Date(2005, 0, 1));
      const age = new Date().getFullYear() - birthdate.getFullYear();
      await client.query(
        `INSERT INTO applicant (
          firstname, middlename, lastname, departmentid, positionid,
          contact, address, email, sss_number, pagibig_number,
          philhealth_number, bir_number, status, applicantimage,
          applicationdate, gender, age, birthdate
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pending',$13,$14,$15,$16,$17)`,
        [
          first, "M", last,
          randomChoice(deptRes.rows).departmentid,
          randomChoice(posRes.rows).positionid,
          `0917${Math.floor(1000000 + Math.random() * 8999999)}`,
          `${i + 1} Applicant St`,
          `applicant${i + 1}@example.com`,
          `SSS${100 + i}`, `PAG${100 + i}`, `PH${100 + i}`, `BIR${100 + i}`,
          Buffer.from(`ImageData${i + 1}`),
          formatDate(randomDate(new Date(2024, 0, 1), new Date())),
          randomChoice(genders), age, formatDate(birthdate)
        ]
      );
    }

    const empRes = [];

    const specialEmp = await client.query(
      `INSERT INTO employee (firstname, middlename, lastname, departmentid, positionid, contact, address, email, shiftid, hiredate, sss_number, pagibig_number, philhealth_number, bir_number, leavecredit, type, employeeimage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING employeeid`,
      [
        "Admin", "I", "Strator",
        deptRes.rows[1].departmentid, 
        posRes.rows[0].positionid, 
        "09170000000",
        "1 Admin St",
        "admin1@gmail.com",
        randomChoice(shiftRes.rows).shiftid,
        "2022-01-01",
        "SSS999", "PAG999", "PH999", "BIR999",
        20,
        "Regular",
        null
      ]
    );
    empRes.push(specialEmp.rows[0].employeeid);

    for (let i = 1; i < NUM_EMPLOYEES; i++) {
      const { first, last } = getNameByIndex(i);
      const res = await client.query(
        `INSERT INTO employee (firstname, middlename, lastname, departmentid, positionid, contact, address, email, shiftid, hiredate, sss_number, pagibig_number, philhealth_number, bir_number, leavecredit, type, employeeimage)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING employeeid`,
        [
          first, "M", last,
          randomChoice(deptRes.rows).departmentid,
          randomChoice(posRes.rows).positionid,
          `0917${Math.floor(1000000 + Math.random() * 8999999)}`,
          `${i + 1} Employee St`,
          `employee${i + 1}@example.com`,
          randomChoice(shiftRes.rows).shiftid,
          `2022-01-${String((i % 28) + 1).padStart(2, "0")}`,
          `SSS${300 + i}`, `PAG${300 + i}`, `PH${300 + i}`, `BIR${300 + i}`,
          Math.floor(Math.random() * 20),
          randomChoice(empTypes),
          null
        ]
      );
      empRes.push(res.rows[0].employeeid);
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - ATTENDANCE_DAYS);

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      for (let emp of empRes) {
        if (Math.random() < 0.7 || d.toDateString() === today.toDateString()) {
          const timeIn = smartTimeIn();
          const timeOut = smartTimeOut();
          await client.query(
            `INSERT INTO attendance (date, employeeid, timein, timeout) VALUES ($1,$2,$3,$4)`,
            [formatDate(d), emp, timeIn, timeOut]
          );
        }
      }
    }

    const itemRes = [];
    for (let i = 0; i < items.length; i++) {
      const res = await client.query(
        `INSERT INTO inventory (itemname, quantity, lastmodified)
         VALUES ($1, $2, NOW()) RETURNING itemid`,
        [items[i], Math.floor(Math.random() * 100) + 1]
      );
      itemRes.push(res.rows[0].itemid);
    }

    for (let i = 0; i < NUM_INVENTORY_LOGS; i++) {
      await client.query(
        `INSERT INTO inventorylogs (itemid, employeeid, quantity, date) VALUES ($1,$2,$3,$4)`,
        [
          randomChoice(itemRes),
          randomChoice(empRes),
          Math.floor(Math.random() * 5) + 1,
          formatDate(randomDate(new Date(2025, 6, 1), today)),
        ]
      );
    }

    for (let i = 0; i < NUM_LEAVES; i++) {
      const start = randomDate(new Date(2025, 6, 1), today);
      const duration = Math.floor(Math.random() * 3) + 1;
      const end = new Date(start);
      end.setDate(start.getDate() + duration);
      await client.query(
        `INSERT INTO leave (employeeid, reason, start_date, end_date, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          randomChoice(empRes),
          randomChoice(leaveReasons),
          formatDate(start),
          formatDate(end),
          randomChoice(leaveStatuses)
        ]
      );
    }

    console.log("Success");
  } catch (err) {
    console.error("Error:", err.stack);
  } finally {
    await client.end();
  }
}

seedDatabase();

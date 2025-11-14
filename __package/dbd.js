process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { Client } from "pg";

const NUM_APPLICANTS = 10;
const NUM_EMPLOYEES = 9;
const ATTENDANCE_DAYS = 3;
const NUM_LEAVES = 5;
const NUM_INVENTORY_LOGS = 2;

const client = new Client({
  connectionString:
    "postgresql://postgres.ntsvoexuhippdbfnivud:GO2bHiZvgXTSp3YG@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

const rand = {
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  phone: () => `09${rand.int(10, 99)}${rand.int(10000000, 99999999)}`,
  date: (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())),
  dateStr: (d) => d.toISOString().split("T")[0],
  time: (baseHour, variance, minuteVariance = 20) => {
    const h = baseHour + rand.int(0, variance);
    const m = rand.int(0, minuteVariance);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  },
};

const firstNames = ["John", "Jane", "Mike", "Anna", "Paul", "Mary", "Chris", "Laura", "David", "Emma"];
const lastNames = ["Doe", "Smith", "Johnson", "Brown", "Williams", "Jones", "Taylor", "Davis", "Miller", "Wilson"];
const genders = ["Male", "Female"];
const empTypes = ["Regular", "Contractual", "Resigned"];
const leaveStatuses = ["Approved", "Request"];
const leaveReasons = [
  "Vacation leave",
  "Sick leave",
  "Family emergency",
  "Personal matters",
  "Medical appointment",
  "Travel",
];
const items = [
  "Hard Hat",
  "Safety Gloves",
  "Boots",
  "Earplugs",
  "Safety Goggles",
  "Reflective Vest",
  "First Aid Kit",
  "Tool Belt",
  "Face Mask",
  "Harness",
];

const officePositions = [
  "President",
  "Finance",
  "Sales Manager",
  "Senior Production Supervisor",
  "Sales Coordinator",
  "Production Coordinator",
  "Procurement & Supply",
  "Cashier",
  "HR Generalist",
  "Accounting Staff",
  "IT",
];

const productionPositions = [
  "Cutting",
  "Delivery",
  "Extrusion",
  "Maintenance",
  "Manual",
  "Printing",
  "Quality Assurance",
  "Slitting",
  "Supervisor",
  "Utility",
  "Warehouse",
];

function getNameByIndex(i) {
  const first = firstNames[i % firstNames.length];
  const last = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
  return { first, last };
}

async function seedDatabase() {
  try {
    await client.connect();

    await client.query(`
      TRUNCATE TABLE 
        userlogs, users, attendance, leave, inventorylogs, document,
        employee, applicant, shift, position,
        department, inventory
      RESTART IDENTITY CASCADE;
    `);

    const deptRes = await client.query(`
      INSERT INTO department (departmentname)
      VALUES ('Office'), ('Production')
      RETURNING *;
    `);

    const officeDept = deptRes.rows.find((d) => d.departmentname === "Office");
    const productionDept = deptRes.rows.find((d) => d.departmentname === "Production");

    const officePosValues = officePositions.map((p) => `('${p}', ${officeDept.departmentid})`);
    const productionPosValues = productionPositions.map((p) => `('${p}', ${productionDept.departmentid})`);

    const posRes = await client.query(`
      INSERT INTO position (positionname, departmentid)
      VALUES ${[...officePosValues, ...productionPosValues].join(",")}
      RETURNING *;
    `);

    const shiftRows = Array.from({ length: 12 }, () => {
      const startHour = rand.int(7, 9);
      const startMin = rand.choice(["00", "30"]);
      const endHour = Math.min(startHour + rand.int(7, 9), 19);
      const endMin = startMin;
      const machine = Math.random() < 0.4 ? "NULL" : rand.int(1, 5);
      return `('${String(startHour).padStart(2, "0")}:${startMin}', '${String(endHour).padStart(2, "0")}:${endMin}', ${machine})`;
    });

    const shiftRes = await client.query(`
      INSERT INTO shift (timestart, timeend, machineno)
      VALUES ${shiftRows.join(",")}
      RETURNING *;
    `);

    const adminEmp = await client.query(
      `INSERT INTO employee (
        firstname, middlename, lastname, departmentid, positionid, contact, address, email,
        shiftid, hiredate, sss_number, pagibig_number, philhealth_number, bir_number,
        leavecredit, type
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING employeeid;`,
      [
        "Admin",
        "I",
        "Strator",
        officeDept.departmentid,
        posRes.rows.find((p) => p.positionname === "HR Generalist").positionid,
        rand.phone(),
        `${rand.int(1, 999)} Admin Street, Cityville`,
        "admin1@gmail.com",
        rand.choice(shiftRes.rows).shiftid,
        "2022-01-01",
        "SSS999",
        "PAG999",
        "PH999",
        "BIR999",
        20,
        "Regular",
      ]
    );

    const empRes = [adminEmp.rows[0].employeeid];

    for (let i = 0; i < NUM_APPLICANTS; i++) {
      const { first, last } = getNameByIndex(i); // Applicants start from 0
      const birthdate = rand.date(new Date(1985, 0, 1), new Date(2005, 0, 1));
      const age = new Date().getFullYear() - birthdate.getFullYear();

      const dept = rand.choice(deptRes.rows);
      const deptPositions = posRes.rows.filter(p => p.departmentid === dept.departmentid);
      const pos = rand.choice(deptPositions);

      await client.query(
        `INSERT INTO applicant (
          firstname, middlename, lastname, departmentid, positionid, shiftid,
          contact, address, email, sss_number, pagibig_number,
          philhealth_number, bir_number, status,
          applicationdate, gender, age, birthdate
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Pending',$14,$15,$16,$17,$18)`,
        [
          first,
          "M",
          last,
          dept.departmentid,
          pos.positionid,
          rand.choice(shiftRes.rows).shiftid,
          rand.phone(),
          `${i + 1} Applicant St`,
          `applicant${i + 1}@example.com`,
          `SSS${100 + i}`,
          `PAG${100 + i}`,
          `PH${100 + i}`,
          `BIR${100 + i}`,
          rand.dateStr(rand.date(new Date(2024, 0, 1), new Date())),
          rand.choice(genders),
          age,
          rand.dateStr(birthdate),
        ]
      );
    }

    for (let i = 0; i < NUM_EMPLOYEES; i++) {
      const { first, last } = getNameByIndex(i + NUM_APPLICANTS);
      const dept = rand.choice(deptRes.rows);
      const deptPositions = posRes.rows.filter(p => p.departmentid === dept.departmentid);
      const pos = rand.choice(deptPositions);
      const emp = await client.query(
        `INSERT INTO employee (
          firstname, middlename, lastname, departmentid, positionid, contact, address, email,
          shiftid, hiredate, sss_number, pagibig_number, philhealth_number, bir_number,
          leavecredit, type
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING employeeid`,
        [
          first,
          "M",
          last,
          dept.departmentid,
          pos.positionid,
          rand.phone(),
          `${i + 1} Employee St`,
          `employee${i + 1}@example.com`,
          rand.choice(shiftRes.rows).shiftid,
          rand.dateStr(rand.date(new Date(2020, 0, 1), new Date(2024, 11, 31))),
          `SSS${300 + i}`,
          `PAG${300 + i}`,
          `PH${300 + i}`,
          `BIR${300 + i}`,
          rand.int(5, 20),
          rand.choice(empTypes),
        ]
      );
      empRes.push(emp.rows[0].employeeid);
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - ATTENDANCE_DAYS);

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      for (const emp of empRes) {
        if (Math.random() < 0.7 || d.toDateString() === today.toDateString()) {
          await client.query(
            `INSERT INTO attendance (date, profileid, timein, timeout, role)
             VALUES ($1,$2,$3,$4,$5)`,
            [rand.dateStr(d), emp, rand.time(8, 1), rand.time(16, 2), rand.choice(["Employee", "Applicant"])]
          );
        }
      }
    }

    const itemRes = [];
    for (const item of items) {
      const res = await client.query(
        `INSERT INTO inventory (itemname, quantity, lastmodified)
         VALUES ($1, $2, NOW()) RETURNING itemid`,
        [item, rand.int(10, 100)]
      );
      itemRes.push(res.rows[0].itemid);
    }

    for (let i = 0; i < NUM_INVENTORY_LOGS; i++) {
      await client.query(
        `INSERT INTO inventorylogs (itemid, employeeid, quantity, date)
         VALUES ($1,$2,$3,$4)`,
        [
          rand.choice(itemRes),
          rand.choice(empRes),
          rand.int(1, 5),
          rand.dateStr(rand.date(new Date(2025, 6, 1), today)),
        ]
      );
    }

    for (let i = 0; i < NUM_LEAVES; i++) {
      const start = rand.date(new Date(2025, 6, 1), today);
      const end = new Date(start);
      end.setDate(start.getDate() + rand.int(1, 3));
      await client.query(
        `INSERT INTO leave (employeeid, reason, start_date, end_date, status, is_paid)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          rand.choice(empRes),
          rand.choice(leaveReasons),
          rand.dateStr(start),
          rand.dateStr(end),
          rand.choice(leaveStatuses),
          false, // default value for is_paid
        ]
      );
    }

    console.log("✅ Database successfully seeded.");
  } catch (err) {
    console.error("❌ Error:", err.stack);
  } finally {
    await client.end();
  }
}

seedDatabase();
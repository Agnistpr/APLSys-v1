import { Client } from "pg";

const client = new Client({
  user: "client",
  host: "localhost",
  database: "postgres",
  password: "@PLSys",
  port: 5432,
});

const firstNames = ["John", "Jane", "Mike", "Anna", "Paul", "Mary", "Chris", "Laura", "David", "Emma"];
const lastNames = ["Doe", "Smith", "Johnson", "Brown", "Williams", "Jones", "Taylor", "Davis", "Miller", "Wilson"];

function getNameByIndex(i) {
  const firstIndex = i % firstNames.length;
  const lastIndex = Math.floor(i / firstNames.length) % lastNames.length;
  return {
    first: firstNames[firstIndex],
    last: lastNames[lastIndex],
  };
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedDatabase() {
  try {
    await client.connect();

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
      const start = `${String(startHour).padStart(2, "0")}:${startMinute}`;
      const end = `${String(endHour).padStart(2, "0")}:${endMinute}`;
      shiftInserts.push(`('${start}', '${end}', ${Math.random() < 0.3 ? "NULL" : Math.floor(Math.random() * 5) + 1})`);
      cur++;
    }
    const shiftRes = await client.query(`
      INSERT INTO shift (timestart, timeend, machineno)
      VALUES ${shiftInserts.join(",")}
      RETURNING *;
    `);

    function randomDate(start, end) {
      return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }

    function formatDate(date) {
      return date.toISOString().split("T")[0];
    }

    const statuses = ["Pending", "Training", "Rejected", "Hired"];
    const genders = ["Male", "Female"];

    for (let i = 0; i < 10; i++) {
      const { first, last } = getNameByIndex(i);

      const applicationDate = randomDate(new Date(2024, 0, 1), new Date());
      let trainingDate = null;
      if (Math.random() < 0.5) {
        trainingDate = randomDate(
          new Date(applicationDate.getTime() + 24 * 60 * 60 * 1000),
          new Date()
        );
      }

      const birthdate = randomDate(new Date(1985, 0, 1), new Date(2005, 0, 1));
      const age = new Date().getFullYear() - birthdate.getFullYear();

      await client.query(
        `INSERT INTO applicant (
          firstname, middlename, lastname, departmentid, positionid,
          contact, address, email, sss_number, pagibig_number,
          philhealth_number, bir_number, status, applicantimage,
          applicationdate, trainingdate, gender, age, birthdate
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19
        )`,
        [
          first,
          "M",
          last,
          randomChoice(deptRes.rows).departmentid,
          randomChoice(posRes.rows).positionid,
          `0917${Math.floor(1000000 + Math.random() * 8999999)}`,
          `${i + 1} Applicant St`,
          `applicant${i + 1}@example.com`,
          `SSS${100 + i}`,
          `PAG${100 + i}`,
          `PH${100 + i}`,
          `BIR${100 + i}`,
          randomChoice(statuses),
          Buffer.from(`ImageData${i + 1}`),
          formatDate(applicationDate),
          trainingDate ? formatDate(trainingDate) : null,
          randomChoice(genders),
          age,
          formatDate(birthdate)
        ]
      );
    }

    const hiredApplicantIds = [];
    for (let i = 0; i < 100; i++) {
      const { first, last } = getNameByIndex(i);

      const applicationDate = randomDate(new Date(2024, 0, 1), new Date());
      let trainingDate = null;
      if (Math.random() < 0.7) {
        trainingDate = randomDate(
          new Date(applicationDate.getTime() + 24 * 60 * 60 * 1000),
          new Date()
        );
      }

      const birthdate = randomDate(new Date(1985, 0, 1), new Date(2005, 0, 1));
      const age = new Date().getFullYear() - birthdate.getFullYear();

      const res = await client.query(
        `INSERT INTO applicant (
          firstname, middlename, lastname, departmentid, positionid,
          contact, address, email, sss_number, pagibig_number,
          philhealth_number, bir_number, status, applicantimage,
          applicationdate, trainingdate, gender, age, birthdate
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,'Hired',$13,$14,$15,$16,$17,$18
        ) RETURNING applicantid`,
        [
          first,
          "M",
          last,
          randomChoice(deptRes.rows).departmentid,
          randomChoice(posRes.rows).positionid,
          `0917${Math.floor(1000000 + Math.random() * 8999999)}`,
          `${i + 1} Employee St`,
          `employee${i + 1}@example.com`,
          `SSS${200 + i}`,
          `PAG${200 + i}`,
          `PH${200 + i}`,
          `BIR${200 + i}`,
          Buffer.from(`ImageDataEmp${i + 1}`),
          formatDate(applicationDate),
          trainingDate ? formatDate(trainingDate) : null,
          randomChoice(genders),
          age,
          formatDate(birthdate)
        ]
      );
      hiredApplicantIds.push(res.rows[0].applicantid);
    }

    const empTypes = ["Regular", "Contractual", "Resigned"];
    const empRes = [];
    for (let i = 0; i < 100; i++) {
      const { first, last } = getNameByIndex(i);
      const res = await client.query(
        `INSERT INTO employee (firstname, middlename, lastname, departmentid, positionid, contact, address, email, shiftid, hiredate, sss_number, pagibig_number, philhealth_number, bir_number, leavecredit, type, employeeimage, applicantid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING employeeid`,
        [
          first,
          "M",
          last,
          randomChoice(deptRes.rows).departmentid,
          randomChoice(posRes.rows).positionid,
          `0917${Math.floor(1000000 + Math.random() * 8999999)}`,
          `${i + 1} Employee St`,
          `employee${i + 1}@example.com`,
          randomChoice(shiftRes.rows).shiftid,
          `2022-01-${String((i % 28) + 1).padStart(2, "0")}`,
          `SSS${300 + i}`,
          `PAG${300 + i}`,
          `PH${300 + i}`,
          `BIR${300 + i}`,
          Math.floor(Math.random() * 20),
          randomChoice(empTypes),
          null,
          hiredApplicantIds[i],
        ]
      );
      empRes.push(res.rows[0].employeeid);
    }

    const startDate = new Date("2025-07-20");
    const today = new Date();
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      for (let emp of empRes) {
        if (Math.random() < 0.7) {
          const timeIn = `${String(8 + Math.floor(Math.random() * 2)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
          const timeOut = `${String(17 + Math.floor(Math.random() * 2)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
          await client.query(
            `INSERT INTO attendance (date, employeeid, timein, timeout) VALUES ($1,$2,$3,$4)`,
            [d.toISOString().slice(0, 10), emp, timeIn, timeOut]
          );
        }
      }
    }

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
      "Harness"
    ];
    const itemRes = [];
    for (let i = 0; i < items.length; i++) {
      const res = await client.query(
        `INSERT INTO inventory (itemname, quantity, lastmodified)
        VALUES ($1, $2, NOW()) RETURNING itemid`,
        [items[i], Math.floor(Math.random() * 100) + 1]
      );
      itemRes.push(res.rows[0].itemid);
    }

    for (let i = 0; i < 50; i++) {
      await client.query(
        `INSERT INTO inventorylogs (itemid, employeeid, quantity, date) VALUES ($1,$2,$3,$4)`,
        [
          randomChoice(itemRes),
          randomChoice(empRes),
          Math.floor(Math.random() * 5) + 1,
          `2025-07-${String((i % 28) + 1).padStart(2, "0")}`,
        ]
      );
    }

    for (let i = 0; i < 50; i++) {
      await client.query(
        `INSERT INTO leave (date, employeeid) VALUES ($1,$2)`,
        [
          `2025-07-${String((i % 28) + 1).padStart(2, "0")}`,
          randomChoice(empRes),
        ]
      );
    }

    const userRes = [];
    for (let i = 1; i <= 2; i++) {
      const res = await client.query(
        `INSERT INTO users (username, password, userimage) VALUES ($1,$2,$3) RETURNING userid`,
        [`user${i}`, `passhash${i}`, Buffer.from(`UserImage${i}`)]
      );
      userRes.push(res.rows[0].userid);
    }

    const janeRes = await client.query(
      `INSERT INTO users (username, password, userimage) VALUES ($1,$2,$3) RETURNING userid`,
      ["Jane Doe", "admin123", Buffer.from("JaneDoeImage")]
    );

    console.log("✅ Dummy data inserted successfully.");
  } catch (err) {
    console.error("❌ Error:", err.stack);
  } finally {
    await client.end();
  }
}

seedDatabase();
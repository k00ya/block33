const pg = require("pg");
const express = require("express");
const app = express();
const client = new pg.Client(
  process.env.DATABASE_URL || "postgres://localhost/acme_hr_db"
);

//parse body into JS objects
app.use(express.json());

//log the requests as they come in
app.use(require("morgan")("dev"));

//Routes

//Read employees
app.get("/api/employees", async (req, res, next) => {
  try {
    const SQL = `
        SELECT * FROM employees;
        `;
    const response = await client.query(SQL);
    res.send(response.rows);
  } catch (ex) {
    next(ex);
  }
});

//Read departments
app.get("/api/departments", async (req, res, next) => {
  try {
    const SQL = `
        SELECT * FROM departments;
        `;
    const response = await client.query(SQL);
    res.send(response.rows);
  } catch (ex) {
    next(ex);
  }
});

//create employee
app.post("/api/employees", async (req, res, next) => {
  try {
    const { name, department_id } = req.body;
    const SQL = `
            INSERT INTO employees (name, department_id)
            VALUES($1, $2)
            RETURNING *;
        `;

    const response = await client.query(SQL, [name, department_id]);
    res.status(201).json(response.rows[0]);
  } catch (ex) {
    next(ex);
  }
});

//Delete employee
app.delete("/api/employees/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    const SQL = `
        DELETE FROM employees WHERE id = $1;
        `;
    await client.query(SQL, [id]);
    res.sendStatus(204);
  } catch (ex) {
    next(ex);
  }
});

//Update employee
app.put("/api/employees/:id", async (req, res, next) => {
  const { id } = req.params;
  const { name, department_id } = req.body;
  try {
    const SQL = `
        UPDATE employees
        SET name = $1, department_id = $2, updated_at = now()
        WHERE id = $3
        RETURNING *;
        `;
    const response = await client.query(SQL, [name, department_id, id]);

    if (!response.rows[0]) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(response.rows[0]);
  } catch (ex) {
    next(ex);
  }
});

//Error handling route
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Service Error" });
});

const init = async () => {
  try {
    await client.connect();
    console.log("Connected to database");

    //drop tables if they exist
    await client.query("DROP TABLE IF EXISTS employees CASCADE");
    await client.query("DROP TABLE IF EXISTS departments CASCADE");

    //create departments table
    let SQL = `
        CREATE TABLE departments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL
        );
    `;
    await client.query(SQL);

    //create employees table with FK reference to departments
    SQL = `
            CREATE TABLE employees (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE
            );
            `;
    await client.query(SQL);

    console.log("Tables created");

    //Seed tables with data

    SQL = `
        INSERT INTO departments (name) VALUES
            ('HR'), ('Finance'), ('IT');
    
    `;
    await client.query(SQL);

    SQL = `
        INSERT INTO employees (name, department_id) VALUES
            ('John Doe', 1),
            ('Jane Smith', 2),
            ('Bob Johnson', 3);
        `;
    await client.query(SQL);

    console.log("Data seeded");

    //start the server after initializing the database
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
};

//Initialize database
init();
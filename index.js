const pg = require("pg");
const express = require("express");
const app = express();
const client = new pg.Client(
  process.env.DATABASE_URL || "postgres://localhost/acme_hr_db"
);

// Enable JSON body parsing for incoming requests
app.use(express.json());

// Add request logging middleware for better debugging
app.use(require("morgan")("dev"));

// Define API routes

// Endpoint to retrieve all employees
app.get("/api/employees", async (req, res, next) => {
  try {
    // Query to fetch all employees from the database
    const queryText = `SELECT * FROM employees;`;
    const queryResult = await client.query(queryText);
    // Send the retrieved employees back to the client
    res.send(queryResult.rows);
  } catch (error) {
    // Handle any errors that occur during the query
    next(error);
  }
});

// Endpoint to get a list of all departments
app.get("/api/departments", async (req, res, next) => {
  try {
    // Execute query to select all departments
    const queryText = `SELECT * FROM departments;`;
    const queryResult = await client.query(queryText);
    // Respond with the list of departments
    res.send(queryResult.rows);
  } catch (error) {
    // Pass errors to the error handler
    next(error);
  }
});

// Endpoint for adding a new employee
app.post("/api/employees", async (req, res, next) => {
  try {
    // Destructure name and department ID from the request body
    const { name, department_id } = req.body;
    // SQL query to insert the new employee into the database
    const queryText = `INSERT INTO employees (name, department_id) VALUES ($1, $2) RETURNING *;`;
    const queryResult = await client.query(queryText, [name, department_id]);
    // Respond with the newly created employee
    res.status(201).json(queryResult.rows[0]);
  } catch (error) {
    // Forward any errors to the next middleware
    next(error);
  }
});

// Endpoint to delete an employee by ID
app.delete("/api/employees/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    // Prepare and execute the SQL command to remove an employee
    const queryText = `DELETE FROM employees WHERE id = $1;`;
    await client.query(queryText, [id]);
    // Confirm the deletion with a 204 No Content response
    res.sendStatus(204);
  } catch (error) {
    // Error handling for failed deletion attempts
    next(error);
  }
});

// Listen for incoming requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Connect to the database when the server starts
  client.connect().then(() => console.log("Connected successfully to the database"));
});


// Endpoint for modifying employee details
app.put("/api/employees/:id", async (req, res, next) => {
    // Extract the employee ID from the request URL
    const { id } = req.params;
    // Extract updated name and department_id from the request body
    const { name, department_id } = req.body;
  
    try {
      // Prepare the update SQL statement
      const updateQuery = `
        UPDATE employees
        SET name = $1, department_id = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *;
      `;
      // Execute the update query with parameters
      const updateResult = await client.query(updateQuery, [name, department_id, id]);
  
      // If the employee does not exist, send a 404 response
      if (updateResult.rows.length === 0) {
        return res.status(404).send({ message: "Employee not found" });
      }
  
      // Send the updated employee data
      res.json(updateResult.rows[0]);
    } catch (error) {
      // Handle any errors during the update process
      next(error);
    }
  });
  
  // Central error handling middleware
  app.use((error, req, res, next) => {
    // Log the error for server-side debugging
    console.error("Error encountered:", error.stack);
    // Send a generic error response
    res.status(500).send({ message: "Internal Server Error" });
  });
  

  const init = async () => {
    try {
      // Establishing connection to the PostgreSQL database
      await client.connect();
      console.info("Successfully connected to the database.");
  
      // Cleaning up existing data structure
      await client.query("DROP TABLE IF EXISTS employees CASCADE;");
      await client.query("DROP TABLE IF EXISTS departments CASCADE;");
  
      // Creating a new structure for departments
      const createDepartmentsTableQuery = `
        CREATE TABLE departments (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        );
      `;
      await client.query(createDepartmentsTableQuery);
  
      // Establishing a structure for employees with a foreign key to departments
      const createEmployeesTableQuery = `
        CREATE TABLE employees (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE
        );
      `;
      await client.query(createEmployeesTableQuery);
      console.info("Database tables have been successfully created.");
  
      // Populating the database with initial department data
      await client.query(`
        INSERT INTO departments (name) VALUES ('HR'), ('Finance'), ('IT');
      `);
  
      // Adding initial employees to the database
      await client.query(`
        INSERT INTO employees (name, department_id) VALUES
        ('John Doe', 1),
        ('Jane Smith', 2),
        ('Bob Johnson', 3);
      `);
      console.info("Initial data has been seeded into the database.");
  
      // Starting the Express server
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`Express server is now running on http://localhost:${PORT}`);
      });
    } catch (setupError) {
      // Handling any errors that occur during initialization
      console.error("An error occurred during the database initialization process:", setupError);
    }
  };
  
  // Kick off the initialization process
  init();
  
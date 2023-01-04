const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running on http://localhost:3000/");
    });
  } catch (err) {
    console.log(`DB Error : ${err.message}`);
  }
};

initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Login User API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}';
    `;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordChecked = await bcrypt.compare(password, dbUser.password);
    if (isPasswordChecked === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    }
  }
});

//API TO GET states
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
        SELECT *
        FROM state;
    `;
  const convertDbObjectToResponseObject = (dbObject) => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    };
  };
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

//API TO GET state
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT *
        FROM state
        WHERE state_id = ${stateId};
    `;
  const convertDbObjectToResponseObject = (dbObject) => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    };
  };
  const stateArray = await db.get(getStateQuery);
  response.send(convertDbObjectToResponseObject(stateArray));
});

//API TO CREATE DISTRICT
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
        INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
        VALUES (
            '${districtName}',
            ${stateId},
            ${cases}, 
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  const dbResponse = await db.run(createDistrictQuery);
  const districtId = dbResponse.lastID;
  response.send("District Successfully Added");
});

//API TO GET DISTRICT BASED ON DISTRICT_ID
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT *
        FROM district
        WHERE district_id = ${districtId};
    `;
    const convertDbObjectToResponseObject = (dbObject) => {
      return {
        districtId: dbObject.district_id,
        districtName: dbObject.district_name,
        stateId: dbObject.state_id,
        cases: dbObject.cases,
        cured: dbObject.cured,
        active: dbObject.active,
        deaths: dbObject.deaths,
      };
    };
    const districtObject = await db.get(getDistrictQuery);
    response.send(convertDbObjectToResponseObject(districtObject));
  }
);

//API TO DELETE A DISTRICT BASED ON DISTRICT_ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district
        WHERE district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API TO UPDATE DISTRICT
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE district
        SET
          district_name = '${districtName}',
          state_id = ${stateId},
          cases = ${cases},
          cured = ${cured},
          active = ${active},
          deaths = ${deaths}
    ;`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API TO GET STATS OF A STATE
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
        SELECT 
          SUM(cases), 
          SUM(cured), 
          SUM(active),
          SUM(deaths)
        FROM district
        WHERE state_id = ${stateId};
    `;
    const stats = await db.get(getStateStatsQuery);

    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;

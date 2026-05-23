import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabase";

const columns = ["Sold", "In Progress", "Waiting on Parts", "Completed"];

const salesmanColors = {
  Tom: "#1e73d8",
  Jerry: "#2fa84f",
  Matt: "#ff8a1c",
  Carmon: "#7b45c9",
  Other: "#64748b",
};

const safetyLocations = ["Goodwills", "Firby", "Auto Care", "3D Auto"];
const FOUR_DAYS = 4 * 24 * 60 * 60 * 1000;

export default function App() {
  const [vin, setVin] = useState("");
  const [stock, setStock] = useState("");
  const [salesman, setSalesman] = useState("Tom");
  const [decoded, setDecoded] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [partsPopup, setPartsPopup] = useState(null);
  const [partsText, setPartsText] = useState("");
  const [safetyPopup, setSafetyPopup] = useState(null);
  const [safetyLocation, setSafetyLocation] = useState("Goodwills");

  useEffect(() => {
  fetchVehicles();

  const interval = setInterval(() => {
    fetchVehicles();
  }, 30000);

  return () => clearInterval(interval);
}, []);

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
      return;
    }

    setVehicles(data || []);
  }

  const activeVehicles = vehicles.filter((vehicle) => {
    if (vehicle.status !== "Completed") return true;
    if (!vehicle.completed_date) return true;

    return Date.now() - new Date(vehicle.completed_date).getTime() < FOUR_DAYS;
  });

  const soldsInQueue = activeVehicles.filter(
    (vehicle) => vehicle.status === "Sold"
  ).length;

  const completedVehicles = vehicles.filter(
    (vehicle) => vehicle.completed_date && vehicle.created_at
  );

  const averageSafetyTime =
    completedVehicles.length === 0
      ? 0
      : completedVehicles.reduce((total, vehicle) => {
          const started = new Date(vehicle.created_at).getTime();
          const completed = new Date(vehicle.completed_date).getTime();
          const days = (completed - started) / (1000 * 60 * 60 * 24);
          return total + days;
        }, 0) / completedVehicles.length;

  async function decodeVin() {
    if (vin.length !== 17) {
      alert("Please enter a valid 17-character VIN.");
      return;
    }

    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    );

    const data = await res.json();

    const getValue = (name) =>
      data.Results.find((item) => item.Variable === name)?.Value || "";

    setDecoded({
      vin,
      year: getValue("Model Year"),
      make: getValue("Make"),
      model: getValue("Model"),
      trim: getValue("Trim"),
      engine: getValue("Engine Model") || getValue("Displacement (L)"),
      body: getValue("Body Class"),
      drivetrain: getValue("Drive Type"),
      fuel: getValue("Fuel Type - Primary"),
    });
  }

  async function addVehicle() {
    if (!decoded || !stock) {
      alert("Decode a VIN and enter a stock number first.");
      return;
    }

    const now = new Date();

    const newVehicle = {
      year: decoded.year,
      make: decoded.make,
      model: decoded.model,
      stock,
      salesman,
      status: "Sold",
      parts: "",
      safety_location: "",
      date_added: now.toLocaleDateString("en-CA"),
      created_at: now.toISOString(),
      completed_date: null,
    };

    const { error } = await supabase.from("vehicles").insert([newVehicle]);

    if (error) {
      console.error("Insert error:", error);
      alert("Vehicle did not save.");
      return;
    }

    await fetchVehicles();
    setVin("");
    setStock("");
    setDecoded(null);
  }

  function onDragStart(e, vehicleId) {
    e.dataTransfer.setData("text/plain", String(vehicleId));
    e.dataTransfer.effectAllowed = "move";
  }

  async function onDrop(e, status) {
    e.preventDefault();

    const vehicleId = e.dataTransfer.getData("text/plain");
    const vehicle = vehicles.find((v) => String(v.id) === String(vehicleId));

    if (!vehicle) return;

    if (status === "In Progress") {
      setSafetyPopup(vehicle);
      setSafetyLocation(vehicle.safety_location || "Goodwills");
      return;
    }

    if (status === "Waiting on Parts") {
      setPartsPopup(vehicle);
      setPartsText("");
      return;
    }

    const { error } = await supabase
      .from("vehicles")
      .update({
        status,
        completed_date:
          status === "Completed" ? new Date().toISOString() : null,
      })
      .eq("id", vehicleId);

    if (error) {
      console.error("Drag update error:", error);
      return;
    }

    fetchVehicles();
  }

  async function saveSafetyLocation() {
    const { error } = await supabase
      .from("vehicles")
      .update({
        status: "In Progress",
        safety_location: safetyLocation,
        completed_date: null,
      })
      .eq("id", safetyPopup.id);

    if (error) {
      console.error("Safety update error:", error);
      return;
    }

    setSafetyPopup(null);
    setSafetyLocation("Goodwills");
    fetchVehicles();
  }
  async function deleteVehicle(vehicleId) {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete this vehicle?"
  );

  if (!confirmDelete) return;

  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId);

  if (error) {
    console.error("Delete error:", error);
    alert("Vehicle could not be deleted.");
    return;
  }

  fetchVehicles();
}

async function onTrashDrop(e) {
  e.preventDefault();

  const vehicleId = e.dataTransfer.getData("text/plain");

  if (!vehicleId) return;

  await deleteVehicle(vehicleId);
}
  async function saveParts() {
    const { error } = await supabase
      .from("vehicles")
      .update({
        status: "Waiting on Parts",
        parts: partsText,
        completed_date: null,
      })
      .eq("id", partsPopup.id);

    if (error) {
      console.error("Parts update error:", error);
      return;
    }

    setPartsPopup(null);
    setPartsText("");
    fetchVehicles();
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <img src="/goodwills-logo.png" alt="Goodwill's Used Cars" />
          <div className="divider" />
          <h1>Sold Tracker</h1>
        </div>

        <div className="top-actions">
          <span>☁ Synced</span>
          <span>Filter</span>
          <span>⚙</span>
        </div>
      </header>

      <main>
        <aside>
          <h2>Add Vehicle</h2>

          <label>VIN</label>
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            maxLength={17}
            placeholder="Enter VIN"
          />

          <button onClick={decodeVin}>Decode VIN</button>

          {decoded && (
            <div className="decoded-box">
              <p><b>Year:</b> {decoded.year}</p>
              <p><b>Make:</b> {decoded.make}</p>
              <p><b>Model:</b> {decoded.model}</p>
              <p><b>Trim:</b> {decoded.trim}</p>
              <p><b>Engine:</b> {decoded.engine}</p>
              <p><b>Body:</b> {decoded.body}</p>
              <p><b>Drive:</b> {decoded.drivetrain}</p>
              <p><b>Fuel:</b> {decoded.fuel}</p>
            </div>
          )}

          <label>Stock Number</label>
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="1001"
          />

          <label>Salesman</label>
          <select value={salesman} onChange={(e) => setSalesman(e.target.value)}>
            <option>Tom</option>
            <option>Jerry</option>
            <option>Matt</option>
            <option>Carmon</option>
            <option>Other</option>
          </select>

          <button onClick={addVehicle}>Add Vehicle</button>

          <div className="legend">
            <h3>Salesman Colors</h3>
            {Object.entries(salesmanColors).map(([name, color]) => (
              <div key={name}>
                <span style={{ backgroundColor: color }}></span>
                {name}
              </div>
            ))}
          </div>

          <div className="stats-box">
  <div className="stat-card">
    <h3>Solds in Queue</h3>
    <p>{soldsInQueue}</p>
  </div>

  <div className="stat-card">
    <h3>Average Safety Time</h3>
    <p>{averageSafetyTime.toFixed(1)} days</p>
  </div>

  <div
    className="trash-box"
    onDragEnter={(e) => e.preventDefault()}
    onDragOver={(e) => e.preventDefault()}
    onDrop={onTrashDrop}
  >
    <div className="trash-icon">🗑️</div>

    <h3>Delete Vehicle</h3>

    <p>Drag vehicle here</p>
  </div>
</div>
          className="trash-box"
          onDragEnter={(e) => e.preventDefault()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onTrashDrop}
        >
         <div className="trash-icon">🗑️</div>
          <h3>Delete Vehicle</h3>

         <p>Drag vehicle here</p>
        </div>

        <section className="board">
          {columns.map((column) => (
            <div
              key={column}
              className="column"
              onDragEnter={(e) => e.preventDefault()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, column)}
            >
              <h2>
                {column}
                <span>
                  {activeVehicles.filter((v) => v.status === column).length}
                </span>
              </h2>

              {activeVehicles
                .filter((vehicle) => vehicle.status === column)
                .map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="vehicle-card"
                    draggable={true}
                    onDragStart={(e) => onDragStart(e, vehicle.id)}
                    style={{
                      backgroundColor: salesmanColors[vehicle.salesman],
                    }}
                  >
                    <div className="date-added">{vehicle.date_added}</div>

                    <strong>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </strong>

                    <p>Stock: {vehicle.stock}</p>

                    {vehicle.safety_location && (
                      <div className="safety-location">
                        Safety Location: {vehicle.safety_location}
                      </div>
                    )}

                    {vehicle.parts && (
                      <div className="parts-list">
                        <b>Waiting On:</b>
                        <br />
                        {vehicle.parts}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </section>
      </main>

      {safetyPopup && (
        <div className="modal-bg">
          <div className="modal">
            <h2>Safety Location</h2>
            <p>Select where this vehicle is going for safety:</p>

            <select
              value={safetyLocation}
              onChange={(e) => setSafetyLocation(e.target.value)}
            >
              {safetyLocations.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>

            <div className="modal-buttons">
              <button onClick={() => setSafetyPopup(null)}>Cancel</button>
              <button onClick={saveSafetyLocation}>Save</button>
            </div>
          </div>
        </div>
      )}

      {partsPopup && (
        <div className="modal-bg">
          <div className="modal">
            <h2>Waiting on Parts</h2>
            <p>Enter the parts being waited on:</p>

            <textarea
              value={partsText}
              onChange={(e) => setPartsText(e.target.value)}
              placeholder=""
            />

            <div className="modal-buttons">
              <button onClick={() => setPartsPopup(null)}>Cancel</button>
              <button onClick={saveParts}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
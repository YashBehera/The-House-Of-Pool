import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import PoolBillingSystem from "./components/PoolBillingSystem";
import SalesReport from "./components/SalesReport";
import OldInventory from "./components/OldInventory";
import NewInventory from "./components/NewInventory";
import Expenses from "./components/Expenses";
import Queue from "./components/Queue";
import Navbar from "./components/Navbar"; // Import Navbar

// Wrapper component to extract query params and pass props
const RouteWrapper = ({ Component, activeTables, setActiveTables, selectedLocation, setSelectedLocation }) => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const locationFromUrl = queryParams.get("location") || selectedLocation;

  // Sync App's selectedLocation with URL when it changes
  useEffect(() => {
    if (locationFromUrl !== selectedLocation) {
      setSelectedLocation(locationFromUrl);
    }
  }, [locationFromUrl, selectedLocation, setSelectedLocation]);

  return (
    <Component
      activeTables={activeTables}
      setActiveTables={setActiveTables}
      selectedLocation={locationFromUrl}
      setSelectedLocation={setSelectedLocation}
    />
  );
};

// Inventory wrapper to conditionally render based on location
const InventoryWrapper = ({ selectedLocation, setSelectedLocation }) => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const locationFromUrl = queryParams.get("location") || selectedLocation;

  useEffect(() => {
    if (locationFromUrl !== selectedLocation) {
      setSelectedLocation(locationFromUrl);
    }
  }, [locationFromUrl, selectedLocation, setSelectedLocation]);

  return locationFromUrl === "New House Of Pool" ? (
    <NewInventory selectedLocation={locationFromUrl} setSelectedLocation={setSelectedLocation} />
  ) : (
    <OldInventory selectedLocation={locationFromUrl} setSelectedLocation={setSelectedLocation} />
  );
};

export default function App() {
  const [activeTables, setActiveTables] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("Old House Of Pool");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  return (
    <Router>
      <Navbar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
      />
      <div style={{ marginTop: "56px" }}> {/* Offset for fixed Navbar */}
        <Routes>
          <Route
            path="/"
            element={
              <RouteWrapper
                Component={PoolBillingSystem}
                activeTables={activeTables}
                setActiveTables={setActiveTables}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
              />
            }
          />

          <Route
            path="/reports"
            element={
              <RouteWrapper
                Component={SalesReport}
                activeTables={activeTables}
                setActiveTables={setActiveTables}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
              />
            }
          />
          <Route
            path="/inventory"
            element={
              <InventoryWrapper
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
              />
            }
          />
          <Route
            path="/expenses"
            element={
              <RouteWrapper
                Component={Expenses}
                activeTables={activeTables}
                setActiveTables={setActiveTables}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
              />
            }
          />
          <Route
            path="/queue"
            element={
              <RouteWrapper
                Component={Queue}
                activeTables={activeTables}
                setActiveTables={setActiveTables}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
              />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

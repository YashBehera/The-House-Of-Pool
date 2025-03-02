import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PoolBillingSystem from "./components/PoolBillingSystem";
import SalesReport from "./components/SalesReport";
import Inventory from "./components/Inventory";
import OldInventory from "./components/OldInventory";
import NewInventory from "./components/NewInventory";
import Expenses from "./components/Expenses";

export default function App() {
  const [activeTables, setActiveTables] = useState([]); // Stores sales data
  const orderedItems = activeTables.flatMap((t) => t.orderedItems); // Extract all ordered items
  const [selectedLocation, setSelectedLocation] = useState("Old House Of Pool");

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <PoolBillingSystem
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
            <SalesReport
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
            <>
              <NewInventory
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
              />
              <OldInventory
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
              />
            </>
          }
        />
        <Route
          path="/expenses"
          element={
            <Expenses
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
            />
          }
        />
      </Routes>
    </Router>
  );
}

import { Button, Dropdown, Form, Input, Menu, Modal, Table, Select } from "antd";
import "antd/dist/reset.css";
import moment from "moment";
import React, { useEffect, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import pool from "./8ball.png";
import ps5 from "./PS2.png";
import tennis from "./tt.jpg";
import TURF from "./turf.png";
import Navbar from "./Navbar";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";

const TURF_RATE_PER_HOUR = 1200;
const SMALL_TABLE_RATE_PER_HOUR = 150;
const MEDIUM_TABLE_RATE_PER_HOUR = 200;
const LARGE_TABLE_RATE_PER_HOUR = 250;

// Define pool table categories and their numbers
const poolCategories = [
  { category: "Small", tables: ["Table 7", "Table 8", "Table 9", "Table 10", "Table 11", "Table 12"], rate: SMALL_TABLE_RATE_PER_HOUR },
  { category: "Medium", tables: ["Table 2", "Table 3", "Table 4", "Table 6", "Table 13", "Table 14"], rate: MEDIUM_TABLE_RATE_PER_HOUR },
  { category: "Large", tables: ["Table 1", "Table 5"], rate: LARGE_TABLE_RATE_PER_HOUR },
];
const ps = ["Controller 1", "Controller 2", "Controller 3", "Controller 4", "Controller 5", "Controller 6"];
const tt = ["Table Tennis 1", "Table Tennis 2"];
const turf = ["Turf"];

const ITEM_PRICES = {
  Lays: 20,
  Tin: 40,
  "KitKat (Small)": 35,
  "KitKat (Large)": 50,
  "Drinks (Glass)": 20,
  Water: 20,
};

const PoolBillingSystem = ({ activeTables, setActiveTables }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null); // Track selected category
  const [selectedTable, setSelectedTable] = useState(null);
  const [form] = Form.useForm();
  const [activeDropdownTable, setActiveDropdownTable] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editForm] = Form.useForm();
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const pendingUpdates = useRef({});
  const processedClicks = useRef(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      if (!user) {
        console.log("User signed out. Firestore operations will be restricted.");
      } else {
        console.log("User authenticated:", user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveTables = async (date, tables) => {
    if (!isAuthenticated) {
      console.warn("Cannot save tables: User not authenticated");
      return;
    }
    const formattedTables = tables.map((table) => ({
      ...table,
      startTime: table.startTime ? new Date(table.startTime).toISOString() : null,
      endTime: table.endTime ? new Date(table.endTime).toISOString() : null,
    }));
    await setDoc(doc(db, "tables", date), { data: formattedTables });
  };

  const getTablesByDate = async (date) => {
    if (!isAuthenticated) {
      console.warn("Cannot fetch tables: User not authenticated");
      return [];
    }
    const docSnap = await getDoc(doc(db, "tables", date));
    if (!docSnap.exists()) return [];
    return docSnap.data().data.map((table) => ({
      ...table,
      startTime: table.startTime ? moment(table.startTime).toDate() : null,
      endTime: table.endTime ? moment(table.endTime).toDate() : null,
    }));
  };

  const saveInventory = async (inventory) => {
    if (!isAuthenticated) {
      console.warn("Cannot save inventory: User not authenticated");
      return;
    }
    await setDoc(doc(db, "inventory", "stock"), { data: inventory });
  };

  const getInventory = async () => {
    if (!isAuthenticated) {
      console.warn("Cannot fetch inventory: User not authenticated");
      return {};
    }
    const docSnap = await getDoc(doc(db, "inventory", "stock"));
    return docSnap.exists() ? docSnap.data().data : {};
  };

  const canOrderItem = async (item) => {
    const stock = await getInventory();
    return stock[item]?.available > 0;
  };

  const updateInventory = async (item, change) => {
    if (!isAuthenticated) {
      console.warn("Cannot update inventory: User not authenticated");
      return false;
    }
    const stock = await getInventory();
    if (stock[item] === undefined) {
      stock[item] = { available: 0, sold: 0 };
    }

    const absChange = Math.abs(change);
    if (change < 0) {
      if (stock[item].available < absChange) {
        console.warn(`Not enough ${item} in stock! Available: ${stock[item].available}, Requested: ${absChange}`);
        return false;
      }
      stock[item].available = Math.max(0, stock[item].available + change);
      stock[item].sold = Math.max(0, stock[item].sold + absChange);
    } else {
      stock[item].available += change;
      stock[item].sold = Math.max(0, stock[item].sold - absChange);
    }

    await saveInventory(stock);
    return true;
  };

  const processPendingUpdates = async (id, item, clickId) => {
    const key = `${id}-${item}`;
    const quantity = pendingUpdates.current[key] || 0;
    if (quantity === 0 || processedClicks.current.has(clickId)) return;

    const stock = await getInventory();
    if (!stock[item]) {
      stock[item] = { available: 0, sold: 0 };
    }

    const absQuantity = Math.abs(quantity);
    if (quantity < 0) {
      await updateInventory(item, absQuantity);
    } else if (quantity > 0) {
      if (stock[item].available < absQuantity) {
        alert(`Not enough ${item} in stock! Available: ${stock[item].available}, Requested: ${absQuantity}`);
        delete pendingUpdates.current[key];
        return;
      }
      const success = await updateInventory(item, -absQuantity);
      if (!success) {
        alert(`Failed to update inventory for ${item}`);
        delete pendingUpdates.current[key];
        return;
      }
    }

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => (t.id === id ? { ...t } : t));
      if (isAuthenticated) saveTables(selectedDate, updatedTables);
      console.log(`Synced ${quantity} ${item} for table ${id} with Firestore`);
      return updatedTables;
    });

    console.log(`Processed ${quantity} ${item} for table ${id}, click ${clickId}`);
    processedClicks.current.add(clickId);
    delete pendingUpdates.current[key];
  };

  const startTable = (values) => {
    if (!values.selectedTableNumber) return; // Ensure table number is selected

    const startTime = new Date().toISOString();
    console.log("Selected Category:", selectedCategory);
    console.log("Selected Table Number:", values.selectedTableNumber);

    let gameType = "Other";
    if (selectedCategory === "Small") {
      gameType = "8-ball Pool Small";
    } else if (selectedCategory === "Medium") {
      gameType = "8-ball Pool Medium";
    } else if (selectedCategory === "Large") {
      gameType = "8-ball Pool Large";
    } else if (selectedTable === "Table Tennis 1" || selectedTable === "Table Tennis 2") {
      gameType = "Table Tennis";
    } else if (selectedTable === "Turf") {
      gameType = "Turf";
    } else if (ps.includes(selectedTable)) {
      gameType = "PS";
    }

    console.log("Determined Game Type:", gameType);

    const newEntry = {
      ...values,
      id: uuidv4(),
      table: values.selectedTableNumber || selectedTable, // Use dropdown value if pool table
      startTime,
      orderedItems: [],
      totalAmount: 0,
      gameType,
      isClosed: false,
    };

    setActiveTables((prevTables) => {
      const updatedTables = [...prevTables, newEntry];
      if (isAuthenticated) saveTables(selectedDate, updatedTables);
      return updatedTables;
    });

    setIsModalOpen(false);
    setSelectedCategory(null);
    form.resetFields();
  };

  const stopTable = (id) => {
    const tableToEdit = activeTables.find((t) => t.id === id);
    if (!tableToEdit || tableToEdit.endTime) return;

    setEditData({ ...tableToEdit, endTime: new Date() });
    setIsEditModalOpen(true);
  };

  const getEditMenu = () => (
    <Menu>
      {Object.keys(ITEM_PRICES).map((item, index) => (
        <Menu.Item key={index} onClick={() => addItemToEdit(item)}>
          {item} (Rs {ITEM_PRICES[item]})
        </Menu.Item>
      ))}
    </Menu>
  );

  const addItemToEdit = async (item) => {
    const canOrder = await canOrderItem(item);
    if (!canOrder) {
      alert(`Sorry, ${item} is out of stock!`);
      return;
    }

    const success = await updateInventory(item, -1);
    if (!success) {
      alert(`Failed to update inventory for ${item}`);
      return;
    }

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== editData.id) return t;
        const updatedItems = [...t.orderedItems, item];
        const newTotalAmount = Math.round(Number(t.totalAmount) + ITEM_PRICES[item]);
        return {
          ...t,
          orderedItems: updatedItems,
          totalAmount: newTotalAmount,
        };
      });
      if (isAuthenticated) saveTables(selectedDate, updatedTables);
      return updatedTables;
    });

    setEditData((prev) => ({
      ...prev,
      orderedItems: [...prev.orderedItems, item],
      totalAmount: Math.round(Number(prev.totalAmount) + ITEM_PRICES[item]),
    }));

    console.log(`Added 1 ${item} to editData ${editData.id}`);
  };

  const aggregateItems = (items) => {
    const itemCounts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
    console.log("Aggregated items:", itemCounts);
    return Object.entries(itemCounts)
      .map(([name, count]) => `${count} ${name}`)
      .join(", ");
  };

  const getMenu = (id) => {
    const tableData = activeTables.find((t) => t.id === id);
    if (!tableData)
      return (
        <Menu>
          <Menu.Item>No items found</Menu.Item>
        </Menu>
      );

    return (
      <Menu>
        {Object.keys(ITEM_PRICES).map((item, index) => {
          const itemCount = tableData.orderedItems
            ? tableData.orderedItems.filter((i) => i === item).length
            : 0;

          return (
            <Menu.Item key={index}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  {item} (Rs {ITEM_PRICES[item]})
                </span>
                <div style={{ display: "flex", gap: "5px", marginLeft: "10px" }}>
                  <Button
                    size="small"
                    onClick={() => decreaseItem(id, item)}
                    disabled={itemCount === 0}
                  >
                    ➖
                  </Button>
                  <span>{itemCount}</span>
                  <Button size="small" onClick={() => increaseItem(id, item)}>
                    ➕
                  </Button>
                </div>
              </div>
            </Menu.Item>
          );
        })}
      </Menu>
    );
  };

  const increaseItem = async (id, item) => {
    const key = `${id}-${item}`;
    const clickId = `${key}-${Date.now()}`;
    pendingUpdates.current[key] = (pendingUpdates.current[key] || 0) + 1;

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        const updatedItems = [...t.orderedItems, item];
        console.log(`Immediate update for ${id}, click ${clickId}:`, updatedItems);
        const newTotalAmount = Math.round(Number(t.totalAmount) + ITEM_PRICES[item]);
        return {
          ...t,
          orderedItems: updatedItems,
          totalAmount: newTotalAmount,
        };
      });
      return updatedTables;
    });

    setEditData((prev) => {
      if (!prev || prev.id !== id) return prev;
      const updatedItems = [...prev.orderedItems, item];
      console.log(`Immediate editData update for ${id}, click ${clickId}:`, updatedItems);
      return {
        ...prev,
        orderedItems: updatedItems,
        totalAmount: Math.round(Number(prev.totalAmount) + ITEM_PRICES[item]),
      };
    });

    console.log(`Queued 1 ${item} for table ${id}, total pending: ${pendingUpdates.current[key]}, click ${clickId}`);

    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, item, clickId);
    }, 500);
  };

  const decreaseItem = async (id, item) => {
    const key = `${id}-${item}`;
    const clickId = `${key}-${Date.now()}`;
    pendingUpdates.current[key] = (pendingUpdates.current[key] || 0) - 1;

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        const updatedItems = [...t.orderedItems];
        const index = updatedItems.lastIndexOf(item);
        if (index !== -1) updatedItems.splice(index, 1);
        console.log(`Immediate decrease for ${id}, click ${clickId}:`, updatedItems);
        const newTotalAmount = Math.round(Number(t.totalAmount) - ITEM_PRICES[item]);
        return {
          ...t,
          orderedItems: updatedItems,
          totalAmount: newTotalAmount,
        };
      });
      return updatedTables;
    });

    setEditData((prev) => {
      if (!prev || prev.id !== id) return prev;
      const updatedItems = prev.orderedItems.filter(
        (_, idx) => idx !== prev.orderedItems.lastIndexOf(item)
      );
      console.log(`Immediate editData decrease for ${id}, click ${clickId}:`, updatedItems);
      return {
        ...prev,
        orderedItems: updatedItems,
        totalAmount: Math.round(Number(prev.totalAmount) - ITEM_PRICES[item]),
      };
    });

    console.log(`Queued -1 ${item} for table ${id}, total pending: ${pendingUpdates.current[key]}, click ${clickId}`);

    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, item, clickId);
    }, 500);
  };

  const removeItem = (id, itemToRemove) => {
    setActiveTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id !== id) return t;
        const updatedItems = [...t.orderedItems];
        const index = updatedItems.lastIndexOf(itemToRemove);
        if (index !== -1) updatedItems.splice(index, 1);
        const newTotalAmount = Math.round(Number(t.totalAmount) - ITEM_PRICES[itemToRemove]);
        return {
          ...t,
          orderedItems: updatedItems,
          totalAmount: newTotalAmount,
        };
      })
    );

    setEditData((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            orderedItems: prev.orderedItems.filter(
              (_, idx) => idx !== prev.orderedItems.lastIndexOf(itemToRemove)
            ),
            totalAmount: Math.round(Number(prev.totalAmount) - ITEM_PRICES[itemToRemove]),
          }
        : prev
    );

    updateInventory(itemToRemove, 1);
  };

  const updateTable = (values) => {
    setActiveTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id !== editData.id) return t;

        const newEndTime = values.endTime ? new Date(values.endTime) : new Date();
        const newDuration = Math.max(
          Math.round((newEndTime - new Date(t.startTime)) / 60000),
          0
        );
        const updatedOrderedItems = values.orderedItems ?? t.orderedItems;
        const totalItemCost = updatedOrderedItems.reduce(
          (sum, item) => sum + ITEM_PRICES[item],
          0
        );

        let newTotalAmount = totalItemCost;
        if (t.gameType === "Turf") {
          newTotalAmount += Math.round((newDuration / 60) * TURF_RATE_PER_HOUR);
        } else if (t.gameType === "8-ball Pool Small") {
          newTotalAmount += Math.round((newDuration / 60) * SMALL_TABLE_RATE_PER_HOUR);
        } else if (t.gameType === "8-ball Pool Medium") {
          newTotalAmount += Math.round((newDuration / 60) * MEDIUM_TABLE_RATE_PER_HOUR);
        } else if (t.gameType === "8-ball Pool Large") {
          newTotalAmount += Math.round((newDuration / 60) * LARGE_TABLE_RATE_PER_HOUR);
        }

        return {
          ...t,
          name: values.name || t.name,
          phone: values.phone || t.phone,
          endTime: newEndTime,
          duration: newDuration,
          orderedItems: updatedOrderedItems,
          totalAmount: newTotalAmount,
          isClosed: true,
        };
      })
    );

    setIsEditModalOpen(false);
  };

  const handleEdit = (record) => {
    setEditData(record);
    setIsEditModalOpen(true);

    editForm.setFieldsValue({
      name: record.name,
      phone: record.phone,
      startTime: new Date(record.startTime).toISOString().slice(0, 16),
      endTime: record.endTime,
      orderedItems: [...record.orderedItems],
    });
  };

  const deleteTable = (id) => {
    console.log("Deleting Table with ID:", id);
    setActiveTables((prevTables) => {
      console.log("Before Delete:", prevTables);
      const updatedTables = prevTables.filter((t) => t.id !== id);
      console.log("After Delete:", updatedTables);
      if (isAuthenticated) saveTables(selectedDate, updatedTables);
      return updatedTables;
    });
  };

  useEffect(() => {
    const clearAtMidnight = async () => {
      const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD");
      const oldTables = await getTablesByDate(yesterday);

      if (oldTables.length > 0) {
        await saveTables(yesterday, oldTables);
        console.log(`Saved tables for ${yesterday} before midnight reset.`);
      }

      const today = moment().format("YYYY-MM-DD");
      await saveTables(today, []);
      setActiveTables([]);
      console.log(`Cleared active tables for ${today} at midnight.`);
    };

    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timeUntilMidnight = midnight - now;

    const timeoutId = setTimeout(() => {
      clearAtMidnight();
      setInterval(clearAtMidnight, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) {
        console.warn("Cannot load tables: User not authenticated");
        setActiveTables([]);
        return;
      }
      setActiveTables([]);
      const tables = await getTablesByDate(selectedDate);
      const updatedTables = tables || [];

      if (!updatedTables.some((table) => table.name === "FOOD")) {
        updatedTables.push({
          id: uuidv4(),
          table: "Food",
          name: "FOOD",
          phone: "",
          startTime: null,
          endTime: null,
          duration: null,
          orderedItems: [],
          totalAmount: 0,
          isClosed: false,
        });
      }
      setActiveTables(updatedTables);
    };
    loadData();
  }, [selectedDate, isAuthenticated]);

  useEffect(() => {
    if (activeTables.length > 0 && selectedDate && isAuthenticated) {
      saveTables(selectedDate, activeTables);
      console.log(`Saved Tables for ${selectedDate} in Firestore`, activeTables);
    }
  }, [activeTables, isAuthenticated]);

  const sortedTables = [...activeTables].sort((a, b) => {
    if (a.name === "FOOD") return -1;
    if (b.name === "FOOD") return 1;
    if (!a.isClosed && b.isClosed) return -1;
    if (a.isClosed && !b.isClosed) return 1;
    return 0;
  });

  return (
    <div>
      <Navbar selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      <div style={{ padding: 0, marginTop: 60 }}>
        <h1 style={{ margin: "0", display: "flex", justifyContent: "center" }} className="flex text-4xl font-bold relative top-7">
          8 Ball Pool
        </h1>
        <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
          {poolCategories.map(({ category }) => (
            <div key={category} style={{ position: "relative", textAlign: "center", width: "250px", height: "250px" }}>
              <img src={pool} alt={category} style={{ width: "250px", height: "250px", borderRadius: "5px", margin: 0, padding: 0 }} />
              <Button
                type="primary"
                onClick={() => {
                  setSelectedCategory(category);
                  setSelectedTable(category); // Temporary for modal title
                  setIsModalOpen(true);
                }}
                style={{
                  backgroundColor: "rgb(0, 89, 255)",
                  marginTop: "10px",
                  cursor: "pointer",
                  bottom: "150px",
                  color: "white",
                }}
              >
                Start {category} Table
              </Button>
              <h3 style={{ position: "relative", bottom: "80px" }}>{category}</h3>
            </div>
          ))}
        </div>

        <h1 style={{ margin: 20, display: "flex", justifyContent: "center" }} className="flex text-4xl font-bold">
          PS 5
        </h1>
        <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
          {ps.map((controller) => (
            <div key={controller} style={{ position: "relative", textAlign: "center", width: "220px", height: "210px" }}>
              <img src={ps5} alt={controller} style={{ width: "200px", height: "150px", borderRadius: "5px", margin: 0, padding: 0 }} />
              <Button
                type="primary"
                onClick={() => {
                  setSelectedTable(controller);
                  setSelectedCategory(null);
                  setIsModalOpen(true);
                }}
                disabled={activeTables.some((t) => t.table === controller && !t.isClosed)}
                style={{
                  backgroundColor: activeTables.some((t) => t.table === controller && !t.isClosed) ? "red" : "rgba(0, 89, 255, 0.93)",
                  marginTop: "10px",
                  cursor: activeTables.some((t) => t.table === controller && !t.isClosed) ? "not-allowed" : "pointer",
                  color: "white",
                }}
              >
                {activeTables.some((t) => t.table === controller && !t.isClosed) ? "In Use" : "Start ᕈᔑ𝟻"}
              </Button>
              <h3 style={{ position: "relative", top: "10px" }}>{controller}</h3>
              {activeTables
                .filter((t) => t.table === controller && !t.isClosed)
                .map((activeTable) => (
                  <div key={activeTable.id} style={{ fontSize: "14px", fontWeight: "bold", bottom: "127px", position: "relative", right: "90px" }}>
                    <p>👤 {activeTable.name}</p>
                    <p>📞 {activeTable.phone}</p>
                  </div>
                ))}
            </div>
          ))}
        </div>

        <div className="flex flex-row items-center justify-center gap-36">
          <div className="flex flex-col items-center justify-center">
            <h1 style={{ margin: 20, display: "flex", justifyContent: "center" }} className="flex text-4xl font-bold relative top-3">
              Table Tennis
            </h1>
            <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
              {tt.map((tableTennis) => (
                <div key={tableTennis} style={{ position: "relative", textAlign: "center", width: "200px", height: "210px" }}>
                  <img src={tennis} alt={tableTennis} style={{ width: "200px", height: "150px", borderRadius: "5px", margin: 0, padding: 0 }} />
                  <Button
                    type="primary"
                    onClick={() => {
                      setSelectedTable(tableTennis);
                      setSelectedCategory(null);
                      setIsModalOpen(true);
                    }}
                    disabled={activeTables.some((t) => t.table === tableTennis && !t.isClosed)}
                    style={{
                      backgroundColor: activeTables.some((t) => t.table === tableTennis && !t.isClosed) ? "red" : "rgba(0, 89, 255, 0.93)",
                      marginTop: "10px",
                      cursor: activeTables.some((t) => t.table === tableTennis && !t.isClosed) ? "not-allowed" : "pointer",
                      color: "white",
                    }}
                  >
                    {activeTables.some((t) => t.table === tableTennis && !t.isClosed) ? "In Use" : "Start Table"}
                  </Button>
                  <h3 style={{ position: "relative", top: "10px" }}>{tableTennis}</h3>
                  {activeTables
                    .filter((t) => t.table === tableTennis && !t.isClosed)
                    .map((activeTable) => (
                      <div key={activeTable.id} style={{ fontSize: "14px", fontWeight: "bold", bottom: "50px", position: "absolute" }}>
                        <p>👤 {activeTable.name}</p>
                        <p>📞 {activeTable.phone}</p>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <h1 style={{ margin: 20, display: "flex", justifyContent: "center" }} className="flex text-4xl font-bold relative top-3">
              Turf
            </h1>
            <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
              {turf.map((ground) => (
                <div key={ground} style={{ position: "relative", textAlign: "center", width: "200px", height: "210px" }}>
                  <img src={TURF} alt={ground} style={{ width: "270px", height: "170px", borderRadius: "5px", margin: 0, padding: 0 }} />
                  <Button
                    type="primary"
                    onClick={() => {
                      setSelectedTable(ground);
                      setSelectedCategory(null);
                      setIsModalOpen(true);
                    }}
                    disabled={activeTables.some((t) => t.table === ground && !t.isClosed)}
                    style={{
                      backgroundColor: activeTables.some((t) => t.table === ground && !t.isClosed) ? "red" : "rgba(0, 89, 255, 0.93)",
                      position: "relative",
                      bottom: "10px",
                      cursor: activeTables.some((t) => t.table === ground && !t.isClosed) ? "not-allowed" : "pointer",
                      color: "white",
                    }}
                  >
                    {activeTables.some((t) => t.table === ground && !t.isClosed) ? "In Use" : "Start Turf"}
                  </Button>
                  <h3>{ground}</h3>
                  {activeTables
                    .filter((t) => t.table === ground && !t.isClosed)
                    .map((activeTable) => (
                      <div key={activeTable.id} style={{ fontSize: "14px", fontWeight: "bold", bottom: "50px", position: "absolute" }}>
                        <p>👤 {activeTable.name}</p>
                        <p>📞 {activeTable.phone}</p>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Table
          dataSource={sortedTables}
          rowKey="id"
          columns={[
            { title: "Table", dataIndex: "table", key: "table" },
            { title: "Customer Name", dataIndex: "name", key: "name" },
            { title: "Phone Number", dataIndex: "phone", key: "phone" },
            {
              title: "Start Time",
              dataIndex: "startTime",
              key: "startTime",
              render: (t) => (t ? moment(t).format("hh:mm A") : "—"),
            },
            {
              title: "End Time",
              dataIndex: "endTime",
              key: "endTime",
              render: (t) => (t ? moment(t).format("hh:mm A") : "—"),
            },
            {
              title: "Duration (min)",
              dataIndex: "duration",
              key: "duration",
              render: (d) => (d ? Math.round(d) : "—"),
            },
            {
              title: "Ordered Items",
              dataIndex: "orderedItems",
              key: "orderedItems",
              render: (items) => (items?.length ? aggregateItems(items) : "—"),
            },
            {
              title: "Total Amount (Rs)",
              dataIndex: "totalAmount",
              key: "totalAmount",
              render: (a) => (a ? Math.round(a) : "—"),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, record) => (
                record.name === "FOOD" ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Dropdown
                      overlay={getMenu(record.id)}
                      trigger={["click"]}
                      visible={activeDropdownTable === record.id}
                      onVisibleChange={(visible) =>
                        setActiveDropdownTable(visible ? record.id : null)
                      }
                    >
                      <Button type="default">Add</Button>
                    </Dropdown>
                  </div>
                ) : record.endTime ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Button type="default" onClick={() => handleEdit(record)}>
                      Edit
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Button
                      type="primary"
                      onClick={() => {
                        stopTable(record.id);
                        handleEdit(record);
                      }}
                    >
                      Stop
                    </Button>
                    <Dropdown
                      overlay={getMenu(record.id)}
                      trigger={["click"]}
                      visible={activeDropdownTable === record.id}
                      onVisibleChange={(visible) =>
                        setActiveDropdownTable(visible ? record.id : null)
                      }
                    >
                      <Button type="default">Add</Button>
                    </Dropdown>
                    <Button type="primary" onClick={() => deleteTable(record.id)}>
                      Delete
                    </Button>
                  </div>
                )
              ),
            },
          ]}
          style={{ marginTop: 20 }}
        />

        <Modal
          title={`Start New ${selectedCategory || selectedTable} Game`}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
        >
          <Form form={form} onFinish={startTable}>
            <Form.Item>
              <h3>Category: {selectedCategory || selectedTable}</h3>
            </Form.Item>
            {selectedCategory && (
              <Form.Item
                name="selectedTableNumber"
                label="Table Number"
                rules={[{ required: true, message: "Please select a table number" }]}
              >
                <Select placeholder="Select table number">
                  {poolCategories
                    .find((c) => c.category === selectedCategory)
                    ?.tables.map((tableNum) => (
                      <Select.Option key={tableNum} value={tableNum} disabled={activeTables.some((t) => t.table === tableNum && !t.isClosed)}>
                        {tableNum}
                      </Select.Option>
                    ))}
                </Select>
              </Form.Item>
            )}
            <Form.Item name="name" label="Customer Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone Number" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Start
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Edit Table Entry"
          open={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          footer={null}
        >
          <Form form={editForm} onFinish={updateTable}>
            <Form.Item name="name" label="Customer Name">
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone Number">
              <Input />
            </Form.Item>
            <Form.Item name="endTime" label="Closing Time">
              <Input type="datetime-local" />
            </Form.Item>
            <h3>Ordered Items</h3>
            {Object.entries(
              (editData?.orderedItems || []).reduce((acc, item) => {
                acc[item] = (acc[item] || 0) + 1;
                return acc;
              }, {})
            ).map(([item, count], index) => (
              <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span>
                  {count} x {item} (Rs {ITEM_PRICES[item]})
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Button type="link" onClick={() => decreaseItem(editData.id, item)} disabled={count === 1}>
                    ➖
                  </Button>
                  <Button type="link" onClick={() => increaseItem(editData.id, item)}>
                    ➕
                  </Button>
                  <Button type="link" onClick={() => removeItem(editData.id, item)}>
                    ❌
                  </Button>
                </div>
              </div>
            ))}
            <Dropdown overlay={getEditMenu()} trigger={["click"]}>
              <Button type="default">Add Item</Button>
            </Dropdown>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Save Changes
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default PoolBillingSystem;
export { ITEM_PRICES };

//OLD HOP (Table add option done)

import { Button, Dropdown, Form, Input, Menu, Modal, Table } from "antd";
import "antd/dist/reset.css";
import moment from "moment"; // ✅ Ensure moment.js is installed (npm install moment)
import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid"; // Import UUID (If not installed, run: npm install uuid)
import pool from "./8ball.png";
import ps5 from "./PS2.png";
import tennis from "./tt.jpg";
import TURF from "./turf.png";
import Navbar from "./Navbar";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { useRef } from "react";
import logo1 from "./HOP3.png"; // Assuming same as Navbar
import logo2 from "./HOP5.png"; // Assuming same as Navbar
import { signInWithEmailAndPassword } from "firebase/auth";
import "./pool.css";
const POOL_RATE_PER_MIN = 2.5;
const TURF_RATE_PER_HOUR = 1200;

const tables = ["Table 1", "Table 2", "Table 3", "Table 4", "Table 5"];
const ps = [
  "Controller 1",
  "Controller 2",
  "Controller 3",
  "Controller 4",
  "Controller 5",
  "Controller 6",
];
const tt = ["Table Tennis 1", "Table Tennis 2"];
const turf = ["Turf"];

// ✅ Price List
const ITEM_PRICES = {
  Lays: 20,
  Tin: 40,
  "KitKat (Small)": 35,
  "KitKat (Large)": 50,
  "Drinks (Glass)": 20,
  Water: 20,
};

const PoolBillingSystem = ({ activeTables, setActiveTables }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [form] = Form.useForm();
  const [activeDropdownTable, setActiveDropdownTable] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [editForm] = Form.useForm();
  const [selectedDate, setSelectedDate] = useState(
    moment().format("YYYY-MM-DD")
  ); // ✅ Default to today’s date
  const pendingUpdates = useRef({});
  const processedClicks = useRef(new Set()); // Track processed click IDs
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Track auth state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [dropdownAction, setDropdownAction] = useState(null); // "edit" or "delete"
  const [dropdownRecordId, setDropdownRecordId] = useState(null);
  const [loginForm] = Form.useForm();

  // Check authentication state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      if (!user)
        console.log(
          "User signed out. Firestore operations will be restricted."
        );
      else console.log("User authenticated:", user.uid);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Function to process batched updates
  const processPendingUpdates = async (id, item, clickId) => {
    const key = `${id}-${item}`;
    const quantity = pendingUpdates.current[key] || 0;
    if (quantity === 0 || processedClicks.current.has(clickId)) return;

    const stock = await getInventory();
    if (!stock[item]) {
      stock[item] = { available: 0, sold: 0 };
    }

    if (stock[item].available < quantity) {
      alert(
        `Not enough ${item} in stock! Available: ${stock[item].available}, Requested: ${quantity}`
      );
      delete pendingUpdates.current[key];
      return;
    }

    const success = await updateInventory(item, -quantity);
    if (!success) {
      alert(`Failed to update inventory for ${item}`);
      delete pendingUpdates.current[key];
      return;
    }

    // No state update here; just sync Firestore tables
    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => (t.id === id ? { ...t } : t));
      saveTables(selectedDate, updatedTables);
      console.log(`Synced ${quantity} ${item} for table ${id} with Firestore`);
      return updatedTables;
    });

    console.log(
      `Processed ${quantity} ${item} for table ${id}, click ${clickId}`
    );
    processedClicks.current.add(clickId); // Mark this batch as processed
    delete pendingUpdates.current[key];
  };

  const saveTables = async (date, tables) => {
    if (!isAuthenticated) {
      console.warn("Cannot save tables: User not authenticated");
      return;
    }
    const formattedTables = tables.map((table) => ({
      ...table,
      startTime: table.startTime
        ? new Date(table.startTime).toISOString()
        : null,
      endTime: table.endTime ? new Date(table.endTime).toISOString() : null,
    }));
    await setDoc(doc(db, "tables", date), { data: formattedTables });
  };

  const getTablesByDate = async (date) => {
    if (!isAuthenticated) {
      console.warn("Cannot save tables: User not authenticated");
      return;
    }
    const docSnap = await getDoc(doc(db, "tables", date));
    if (!docSnap.exists()) return [];
    return docSnap.data().data.map((table) => ({
      ...table,
      startTime: table.startTime ? moment(table.startTime).toDate() : null,
      endTime: table.endTime ? moment(table.endTime).toDate() : null,
    }));
  };

  const saveInventory = async (inventory) => {
    if (!isAuthenticated) {
      console.warn("Cannot save tables: User not authenticated");
      return;
    }
    await setDoc(doc(db, "inventory", "stock"), { data: inventory });
  };

  const getInventory = async () => {
    if (!isAuthenticated) {
      console.warn("Cannot save tables: User not authenticated");
      return;
    }
    const docSnap = await getDoc(doc(db, "inventory", "stock"));
    return docSnap.exists() ? docSnap.data().data : {};
  };

  const canOrderItem = async (item) => {
    const stock = await getInventory();
    return stock[item]?.available > 0;
  };

  const startTable = (values) => {
    if (!selectedTable) return;

    const startTime = new Date().toISOString(); // Ensure correct format

    console.log("Selected Table Name :", selectedTable); // Debugging log

    let gameType = "Other"; // Default value

    if (typeof selectedTable === "string") {
      const lowerTable = selectedTable.toLowerCase(); // Normalize case

      if (lowerTable.includes("table tennis")) {
        gameType = "Table Tennis";
      } else if (lowerTable.startsWith("table ")) {
        gameType = "8-ball Pool";
      } else if (lowerTable.includes("controller")) {
        gameType = "PS";
      } else if (lowerTable.includes("turf")) {
        gameType = "Turf";
      }
    } else {
      console.error("Error: selectedTable is not a string", selectedTable);
    }

    console.log("Determined Game Type:", gameType); // Debugging log

    const newEntry = {
      ...values,
      id: uuidv4(), // ✅ Use UUID for unique ID
      table: selectedTable,
      startTime,
      orderedItems: [],
      totalAmount: 0,
      gameType,
      isClosed: false, // Ensure closed tables don't get modified
      balanceKept: 0, // New field
      balanceReceived: 0, // New field
      previousDues: 0, // New field to track dues
    };

    setActiveTables((prevTables) => {
      const updatedTables = [...prevTables, newEntry];
      if (isAuthenticated) saveTables(selectedDate, updatedTables);
      return updatedTables;
    });

    setIsModalOpen(false);
    form.resetFields();
  };

  console.log(activeTables);

  const stopTable = (id) => {
    const tableToEdit = activeTables.find((t) => t.id === id);
    if (!tableToEdit || tableToEdit.endTime) return;

    const endTime = new Date();
    const duration = Math.max(Math.round((endTime - new Date(tableToEdit.startTime)) / 60000), 0);
    const totalItemCost = tableToEdit.orderedItems.reduce(
      (sum, item) => sum + ITEM_PRICES[item],
      0
    );
    let totalAmount = totalItemCost;
    if (tableToEdit.gameType === "Turf") {
      totalAmount += Math.round((duration / 60) * TURF_RATE_PER_HOUR);
    } else {
      totalAmount += Math.round(duration * POOL_RATE_PER_MIN);
    }

    const previousEntries = activeTables.filter(
      (t) => t.phone === tableToEdit.phone && t.isClosed && t.previousDues > 0
    );
    const totalPreviousDues = previousEntries.reduce(
      (sum, entry) => sum + entry.previousDues,
      0
    );

    setEditData({
      ...tableToEdit,
      endTime,
      duration,
      totalAmount: Math.round(totalAmount), // Calculate and set initial total amount
      previousDues: totalPreviousDues,
    });
    setIsEditModalOpen(true);
  };

  const getEditMenu = () => (
    <Menu>
      {Object.keys(ITEM_PRICES).map((item, index) => (
        <Menu.Item key={index} onClick={() => addItemToEdit(item)}>
          {item} (Rs {ITEM_PRICES[item]})
        </Menu.Item>
      ))}
    </Menu>
  );

  const addItemToEdit = async (item) => {
    const key = `${editData.id}-${item}`;
    const clickId = `${key}-${Date.now()}`; // Unique ID per click batch
    pendingUpdates.current[key] = (pendingUpdates.current[key] || 0) + 1; // Queue addition

    // Immediate UI update
    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== editData.id) return t;
        const updatedItems = [...t.orderedItems, item];
        console.log(
          `Immediate addItemToEdit for ${editData.id}, click ${clickId}:`,
          updatedItems
        );
        const newTotalAmount = Math.round(
          Number(t.totalAmount) + ITEM_PRICES[item]
        );
        return {
          ...t,
          orderedItems: updatedItems,
          totalAmount: newTotalAmount,
        };
      });
      return updatedTables; // Don’t save to Firestore yet
    });

    setEditData((prev) => {
      const updatedItems = [...prev.orderedItems, item];
      console.log(
        `Immediate editData add for ${editData.id}, click ${clickId}:`,
        updatedItems
      );
      return {
        ...prev,
        orderedItems: updatedItems,
        totalAmount: Math.round(Number(prev.totalAmount) + ITEM_PRICES[item]),
      };
    });

    console.log(
      `Queued 1 ${item} for table ${editData.id}, total pending: ${pendingUpdates.current[key]}, click ${clickId}`
    );

    // Debounce Firestore update
    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(async () => {
      const canOrder = await canOrderItem(item);
      if (!canOrder) {
        alert(`Sorry, ${item} is out of stock!`);
        // Rollback UI changes
        setActiveTables((prevTables) =>
          prevTables.map((t) => {
            if (t.id !== editData.id) return t;
            const updatedItems = t.orderedItems.filter((i) => i !== item);
            const newTotalAmount = Math.round(
              Number(t.totalAmount) - ITEM_PRICES[item]
            );
            return {
              ...t,
              orderedItems: updatedItems,
              totalAmount: newTotalAmount,
            };
          })
        );
        setEditData((prev) => ({
          ...prev,
          orderedItems: prev.orderedItems.filter((i) => i !== item),
          totalAmount: Math.round(Number(prev.totalAmount) - ITEM_PRICES[item]),
        }));
        delete pendingUpdates.current[key];
        return;
      }

      const success = await updateInventory(item, -1);
      if (!success) {
        alert(`Failed to update inventory for ${item}`);
        // Rollback UI changes
        setActiveTables((prevTables) =>
          prevTables.map((t) => {
            if (t.id !== editData.id) return t;
            const updatedItems = t.orderedItems.filter((i) => i !== item);
            const newTotalAmount = Math.round(
              Number(t.totalAmount) - ITEM_PRICES[item]
            );
            return {
              ...t,
              orderedItems: updatedItems,
              totalAmount: newTotalAmount,
            };
          })
        );
        setEditData((prev) => ({
          ...prev,
          orderedItems: prev.orderedItems.filter((i) => i !== item),
          totalAmount: Math.round(Number(prev.totalAmount) - ITEM_PRICES[item]),
        }));
        delete pendingUpdates.current[key];
        return;
      }

      // Sync Firestore tables
      setActiveTables((prevTables) => {
        const updatedTables = prevTables.map((t) =>
          t.id === editData.id ? { ...t } : t
        );
        if (isAuthenticated) saveTables(selectedDate, updatedTables);
        console.log(`Synced 1 ${item} for table ${editData.id} with Firestore`);
        return updatedTables;
      });

      console.log(
        `Processed 1 ${item} for table ${editData.id}, click ${clickId}`
      );
      processedClicks.current.add(clickId);
      delete pendingUpdates.current[key];
    }, 500);
  };
  // ✅ Aggregate ordered items for display
  const aggregateItems = (items) => {
    const itemCounts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
    console.log("Aggregated items:", itemCounts);
    return Object.entries(itemCounts)
      .map(([name, count]) => `${count} ${name}`)
      .join(", ");
  };

  // ✅ Dropdown Menu List
  const getMenu = (id) => {
    // ✅ Find the correct table data, return an empty menu if not found
    const tableData = activeTables.find((t) => t.id === id);
    if (!tableData)
      return (
        <Menu>
          <Menu.Item>No items found</Menu.Item>
        </Menu>
      );

    return (
      <Menu>
        {Object.keys(ITEM_PRICES).map((item, index) => {
          const itemCount = tableData.orderedItems
            ? tableData.orderedItems.filter((i) => i === item).length
            : 0;

          return (
            <Menu.Item key={index}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  {item} (Rs {ITEM_PRICES[item]})
                </span>
                <div
                  style={{ display: "flex", gap: "5px", marginLeft: "10px" }}
                >
                  <Button
                    size="small"
                    onClick={() => decreaseItem(id, item)}
                    disabled={itemCount === 0}
                  >
                    ➖
                  </Button>
                  <span>{itemCount}</span>
                  <Button size="small" onClick={() => increaseItem(id, item)}>
                    ➕
                  </Button>
                </div>
              </div>
            </Menu.Item>
          );
        })}
      </Menu>
    );
  };

  const updateInventory = async (item, change) => {
    if (!isAuthenticated) {
      console.warn("Cannot save tables: User not authenticated");
      return;
    }
    const stock = await getInventory();
    if (stock[item] === undefined) {
      stock[item] = { available: 0, sold: 0 };
    }

    const absChange = Math.abs(change);
    if (change < 0) {
      if (stock[item].available < absChange) {
        console.warn(
          `Not enough ${item} in stock! Available: ${stock[item].available}, Requested: ${absChange}`
        );
        return false;
      }
      stock[item].available = Math.max(0, stock[item].available + change);
      stock[item].sold = Math.max(0, stock[item].sold + absChange);
    } else {
      stock[item].available += change;
      stock[item].sold = Math.max(0, stock[item].sold - absChange);
    }

    await saveInventory(stock);
    return true;
  };

  const increaseItem = async (id, item) => {
    const key = `${id}-${item}`;
    const clickId = `${key}-${Date.now()}`; // Unique ID per click batch
    pendingUpdates.current[key] = (pendingUpdates.current[key] || 0) + 1;

    // Immediate UI update (only once per click)
    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        const updatedItems = [...t.orderedItems, item];
        console.log(
          `Immediate update for ${id}, click ${clickId}:`,
          updatedItems
        );
        const newTotalAmount = Math.round(
          Number(t.totalAmount) + ITEM_PRICES[item]
        );
        return {
          ...t,
          orderedItems: updatedItems,
          totalAmount: newTotalAmount,
        };
      });
      return updatedTables; // Don’t save to Firestore yet
    });

    setEditData((prev) => {
      if (!prev || prev.id !== id) return prev;
      const updatedItems = [...prev.orderedItems, item];
      console.log(
        `Immediate editData update for ${id}, click ${clickId}:`,
        updatedItems
      );
      return {
        ...prev,
        orderedItems: updatedItems,
        totalAmount: Math.round(Number(prev.totalAmount) + ITEM_PRICES[item]),
      };
    });

    console.log(
      `Queued 1 ${item} for table ${id}, total pending: ${pendingUpdates.current[key]}, click ${clickId}`
    );

    // Debounce Firestore update
    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, item, clickId);
    }, 500);
  };

  const decreaseItem = async (id, item) => {
    const key = `${id}-${item}`;
    const clickId = `${key}-${Date.now()}`; // Unique ID per click batch
    pendingUpdates.current[key] = (pendingUpdates.current[key] || 0) - 1; // Decrease count

    // Immediate UI update (only once per click)
    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        const updatedItems = [...t.orderedItems];
        const index = updatedItems.lastIndexOf(item);
        if (index !== -1) updatedItems.splice(index, 1); // Remove last occurrence
        console.log(
          `Immediate decrease for ${id}, click ${clickId}:`,
          updatedItems
        );
        const newTotalAmount = Math.round(
          Number(t.totalAmount) - ITEM_PRICES[item]
        );
        return {
          ...t,
          orderedItems: updatedItems,
          totalAmount: newTotalAmount,
        };
      });
      return updatedTables; // Don’t save to Firestore yet
    });

    setEditData((prev) => {
      if (!prev || prev.id !== id) return prev;
      const updatedItems = prev.orderedItems.filter(
        (_, idx) => idx !== prev.orderedItems.lastIndexOf(item)
      );
      console.log(
        `Immediate editData decrease for ${id}, click ${clickId}:`,
        updatedItems
      );
      return {
        ...prev,
        orderedItems: updatedItems,
        totalAmount: Math.round(Number(prev.totalAmount) - ITEM_PRICES[item]),
      };
    });

    console.log(
      `Queued -1 ${item} for table ${id}, total pending: ${pendingUpdates.current[key]}, click ${clickId}`
    );

    // Debounce Firestore update
    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, item, clickId);
    }, 500);
  };

  const removeItem = async (id, itemToRemove) => {
    const key = `${id}-${itemToRemove}`;
    const clickId = `${key}-${Date.now()}`; // Unique ID per click batch

    // Calculate the total count of itemToRemove to remove all instances
    const currentTable = activeTables.find((t) => t.id === id);
    const itemCount =
      currentTable?.orderedItems.filter((item) => item === itemToRemove)
        .length || 0;
    pendingUpdates.current[key] =
      (pendingUpdates.current[key] || 0) - itemCount; // Queue removal of all instances

    // Immediate UI update: Remove all instances of itemToRemove
    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        const updatedItems = t.orderedItems.filter(
          (item) => item !== itemToRemove
        ); // Remove all occurrences
        console.log(
          `Immediate remove all ${itemToRemove} for ${id}, click ${clickId}:`,
          updatedItems
        );
        const totalDeduction = itemCount * ITEM_PRICES[itemToRemove];
        const newTotalAmount = Math.round(
          Number(t.totalAmount) - totalDeduction
        );
        return {
          ...t,
          orderedItems: updatedItems,
          totalAmount: newTotalAmount,
        };
      });
      return updatedTables; // Don’t save to Firestore yet
    });

    setEditData((prev) => {
      if (!prev || prev.id !== id) return prev;
      const updatedItems = prev.orderedItems.filter(
        (item) => item !== itemToRemove
      ); // Remove all occurrences
      console.log(
        `Immediate editData remove all ${itemToRemove} for ${id}, click ${clickId}:`,
        updatedItems
      );
      const totalDeduction = itemCount * ITEM_PRICES[itemToRemove];
      return {
        ...prev,
        orderedItems: updatedItems,
        totalAmount: Math.round(Number(prev.totalAmount) - totalDeduction),
      };
    });

    console.log(
      `Queued -${itemCount} ${itemToRemove} for table ${id}, total pending: ${pendingUpdates.current[key]}, click ${clickId}`
    );

    // Debounce Firestore update
    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, itemToRemove, clickId);
    }, 500);
  };

  const updateTable = (values) => {
    setActiveTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id !== editData.id) return t;

        const newEndTime = values.endTime ? new Date(values.endTime) : editData.endTime;
        const newDuration = Math.max(Math.round((newEndTime - new Date(t.startTime)) / 60000), 0);
        const updatedOrderedItems = values.orderedItems ?? t.orderedItems;
        const totalItemCost = updatedOrderedItems.reduce(
          (sum, item) => sum + ITEM_PRICES[item],
          0
        );
        let newTotalAmount = totalItemCost;
        if (t.gameType === "Turf") {
          newTotalAmount += Math.round((newDuration / 60) * TURF_RATE_PER_HOUR);
        } else {
          newTotalAmount += Math.round(newDuration * POOL_RATE_PER_MIN);
        }

        const balanceKept = Number(values.balanceKept) || 0;
        const balanceReceived = Number(values.balanceReceived) || 0;
        const unpaidAmount = Math.max(balanceKept - balanceReceived, 0);
        const previousDues = t.previousDues + unpaidAmount;

        return {
          ...t,
          name: values.name || t.name,
          phone: values.phone || t.phone,
          endTime: newEndTime,
          duration: newDuration,
          orderedItems: updatedOrderedItems,
          totalAmount: Math.round(newTotalAmount),
          balanceKept,
          balanceReceived,
          previousDues,
          isClosed: true,
        };
      })
    );

    setIsEditModalOpen(false);
  };

  function handleEdit(record) {
    const endTime = record.endTime || new Date();
    const duration = Math.max(Math.round((endTime - new Date(record.startTime)) / 60000), 0);
    const totalItemCost = record.orderedItems.reduce(
      (sum, item) => sum + ITEM_PRICES[item],
      0
    );
    let totalAmount = totalItemCost;
    if (record.gameType === "Turf") {
      totalAmount += Math.round((duration / 60) * TURF_RATE_PER_HOUR);
    } else {
      totalAmount += Math.round(duration * POOL_RATE_PER_MIN);
    }

    setEditData({ ...record, totalAmount });
    setIsEditModalOpen(true);
    editForm.setFieldsValue({
      name: record.name,
      phone: record.phone,
      endTime: record.endTime ? moment(record.endTime).format("YYYY-MM-DDTHH:mm") : null,
      balanceKept: record.balanceKept,
      balanceReceived: record.balanceReceived,
    });
  }

  const deleteTable = (id) => {
    console.log("Deleting Table with ID:", id);
    setActiveTables((prevTables) => {
      console.log("Before Delete:", prevTables);
      const updatedTables = prevTables.filter((t) => t.id !== id);
      console.log("After Delete:", updatedTables);
      return updatedTables;
    });
  };

  useEffect(() => {
    const clearAtMidnight = async () => {
      const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD"); // ✅ Get yesterday's date

      const oldTables = await getTablesByDate(yesterday); // ✅ Fetch yesterday's tables before deleting

      if (oldTables.length > 0) {
        await saveTables(yesterday, oldTables); // ✅ Save yesterday’s data correctly
        console.log(`✅ Saved tables for ${yesterday} before midnight reset.`);
      }

      const today = moment().format("YYYY-MM-DD"); // ✅ Get today's date
      await saveTables(today, []); // ✅ Clear only today's tables

      setActiveTables([]); // ✅ Reset state
      console.log(`✅ Cleared active tables for ${today} at midnight.`);
    };

    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0); // Set to midnight
    const timeUntilMidnight = midnight - now; // Calculate time until midnight

    // First time clearance at next midnight
    const timeoutId = setTimeout(() => {
      clearAtMidnight();
      // Set an interval to clear only today’s data every 24 hours
      setInterval(clearAtMidnight, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);

    return () => clearTimeout(timeoutId);
  }, []);

  const showDropdown = (action, id) => {
    setDropdownAction(action);
    setDropdownRecordId(id);
    setIsDropdownOpen(true);
  };

  const handleLoginSubmit = async (values) => {
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      if (dropdownAction === "edit") {
        const record = activeTables.find((t) => t.id === dropdownRecordId);
        if (record) handleEdit(record);
      } else if (dropdownAction === "delete") {
        deleteTable(dropdownRecordId);
      }
      setIsDropdownOpen(false);
      loginForm.resetFields();
    } catch (error) {
      console.error("Login failed:", error);
      alert("Invalid email or password. Please try again.");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) {
        console.warn("Cannot load tables: User not authenticated");
        setActiveTables([]);
        return;
      }
      setActiveTables([]); // Clear previous day's data first
      const tables = await getTablesByDate(selectedDate);
      const updatedTables = tables || [];

      // Add a row for Food if it doesn't exist
      if (!updatedTables.some((table) => table.name === "FOOD")) {
        updatedTables.push({
          id: uuidv4(),
          table: "Food",
          name: "FOOD",
          phone: "",
          startTime: null,
          endTime: null,
          duration: null,
          orderedItems: [],
          totalAmount: 0,
          isClosed: false,
        });
      }
      setActiveTables(updatedTables);
    };

    loadData();
  }, [selectedDate, isAuthenticated]);

  // ✅ Save tables when activeTables change
  useEffect(() => {
    if (activeTables.length > 0 && selectedDate && isAuthenticated) {
      saveTables(selectedDate, activeTables);
      console.log(
        `Saved Tables for ${selectedDate} in Firestore`,
        activeTables
      );
    }
  }, [activeTables, isAuthenticated]);

  const sortedTables = [...activeTables].sort((a, b) => {
    if (a.name === "FOOD") return -1; // "Food" row always first
    if (b.name === "FOOD") return 1;

    if (!a.isClosed && b.isClosed) return -1; // Open tables before closed ones
    if (a.isClosed && !b.isClosed) return 1;

    return 0; // Maintain order otherwise
  });

  const toggleDropdown = () => {
    setIsDropdownOpen((prevState) => !prevState);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false); // Close the dropdown if clicking outside
      }
    };

    // Add event listener when the dropdown is open
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    // Clean up event listener on unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div>
      {/* Navbar */}
      <Navbar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isAuthenticated={isAuthenticated}
      />

      <div style={{ padding: 0, marginTop: 60 }}>
        <h1
          style={{ margin: "0", display: "flex", justifyContent: "center" }}
          className=" flex text-4xl font-bold relative top-7"
        >
          8 Ball Pool
        </h1>
        <div
          style={{
            display: "flex",
            gap: "20px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {tables.map((table) => {
            return (
              <div
                key={table}
                style={{
                  position: "relative",
                  textAlign: "center",
                  width: "250px",
                  height: "250px",
                }}
              >
                <img
                  src={pool}
                  alt={table}
                  style={{
                    width: "250px",
                    height: "250px",
                    borderRadius: "5px",
                    margin: 0,
                    padding: 0,
                  }}
                />
                <Button
                  type="primary"
                  onClick={() => {
                    setSelectedTable(table);
                    setIsModalOpen(true);
                  }}
                  disabled={activeTables.some(
                    (t) => t.table === table && !t.isClosed
                  )} // ✅ Disable if the table is active
                  style={{
                    backgroundColor: activeTables.some(
                      (t) => t.table === table && !t.isClosed
                    )
                      ? "red"
                      : "rgb(0, 89, 255)",
                    marginTop: "10px",
                    cursor: activeTables.some(
                      (t) => t.table === table && !t.isClosed
                    )
                      ? "not-allowed" // Show disabled cursor
                      : "pointer",
                    bottom: activeTables.some(
                      (t) => t.table === table && !t.isClosed
                    )
                      ? "180px"
                      : "150px",
                    color: "white",
                  }}
                >
                  {activeTables.some((t) => t.table === table && !t.isClosed)
                    ? "In Use"
                    : "Start Table"}
                </Button>
                <h3 style={{ position: "relative", bottom: "80px" }}>
                  {table}
                </h3>
                {activeTables
                  .filter((t) => t.table === table && !t.isClosed) // ✅ Get only tables that are NOT closed
                  .map((activeTable) => (
                    <div
                      key={activeTable.id}
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        bottom: "200px",
                        position: "relative",
                      }}
                    >
                      <p>👤 {activeTable.name}</p>
                      <p>📞 {activeTable.phone}</p>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>

        <h1
          style={{ margin: 20, display: "flex", justifyContent: "center" }}
          className=" flex text-4xl font-bold "
        >
          PS 5
        </h1>
        <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
          {ps.map((controller) => {
            return (
              <div
                key={controller}
                style={{
                  position: "relative",
                  textAlign: "center",
                  width: "220px",
                  height: "210px",
                }}
              >
                <img
                  src={ps5}
                  alt={controller}
                  style={{
                    width: "200px",
                    height: "150px",
                    borderRadius: "5px",
                    margin: 0,
                    padding: 0,
                  }}
                />
                <Button
                  type="primary"
                  onClick={() => {
                    setSelectedTable(controller);
                    setIsModalOpen(true);
                  }}
                  disabled={activeTables.some(
                    (t) => t.table === controller && !t.isClosed
                  )}
                  style={{
                    backgroundColor: activeTables.some(
                      (t) => t.table === controller && !t.isClosed
                    )
                      ? "red"
                      : "rgba(0, 89, 255, 0.93)",
                    marginTop: "10px",
                    cursor: activeTables.some(
                      (t) => t.table === controller && !t.isClosed
                    )
                      ? "not-allowed" // Show disabled cursor
                      : "pointer",
                    color: "white",
                  }}
                >
                  {activeTables.some(
                    (t) => t.table === controller && !t.isClosed
                  )
                    ? "In Use"
                    : "Start ᕈᔑ𝟻"}
                </Button>
                <h3 style={{ position: "relative", top: "10px" }}>
                  {controller}
                </h3>
                {activeTables
                  .filter((t) => t.table === controller && !t.isClosed) // ✅ Get only tables that are NOT closed
                  .map((activeTable) => (
                    <div
                      key={activeTable.id}
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        bottom: "127px",
                        position: "relative",
                        right: "90px",
                      }}
                    >
                      <p>👤 {activeTable.name}</p>
                      <p>📞 {activeTable.phone}</p>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>

        <div className="flex flex-row items-center justify-center gap-36">
          <div className="flex flex-col items-center justify-center">
            <h1
              style={{ margin: 20, display: "flex", justifyContent: "center" }}
              className=" flex text-4xl font-bold relative top-3"
            >
              Table Tennis
            </h1>
            <div
              style={{
                display: "flex",
                gap: "20px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {tt.map((tableTennis) => {
                return (
                  <div
                    key={tableTennis}
                    style={{
                      position: "relative",
                      textAlign: "center",
                      width: "200px",
                      height: "210px",
                    }}
                  >
                    <img
                      src={tennis}
                      alt={tableTennis}
                      style={{
                        width: "200px",
                        height: "150px",
                        borderRadius: "5px",
                        margin: 0,
                        padding: 0,
                      }}
                    />
                    <Button
                      type="primary"
                      onClick={() => {
                        setSelectedTable(tableTennis);
                        setIsModalOpen(true);
                      }}
                      disabled={activeTables.some(
                        (t) => t.table === tableTennis && !t.isClosed
                      )}
                      style={{
                        backgroundColor: activeTables.some(
                          (t) => t.table === tableTennis && !t.isClosed
                        )
                          ? "red"
                          : "rgba(0, 89, 255, 0.93)",
                        marginTop: "10px",
                        cursor: activeTables.some(
                          (t) => t.table === tableTennis && !t.isClosed
                        )
                          ? "not-allowed" // Show disabled cursor
                          : "pointer",
                        color: "white",
                      }}
                    >
                      {activeTables.some(
                        (t) => t.table === tableTennis && !t.isClosed
                      )
                        ? "In Use"
                        : "Start Table"}
                    </Button>
                    <h3 style={{ position: "relative", top: "10px" }}>
                      {tableTennis}
                    </h3>
                    {activeTables
                      .filter((t) => t.table === tableTennis && !t.isClosed) // ✅ Get only tables that are NOT closed
                      .map((activeTable) => (
                        <div
                          key={activeTable.id}
                          style={{
                            fontSize: "14px",
                            fontWeight: "bold",
                            bottom: "50px",
                            position: "absolute",
                          }}
                        >
                          <p>👤 {activeTable.name}</p>
                          <p>📞 {activeTable.phone}</p>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <h1
              style={{ margin: 20, display: "flex", justifyContent: "center" }}
              className=" flex text-4xl font-bold relative top-3"
            >
              Turf
            </h1>
            <div
              style={{
                display: "flex",
                gap: "20px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {turf.map((ground) => {
                return (
                  <div
                    key={ground}
                    style={{
                      position: "relative",
                      textAlign: "center",
                      width: "200px",
                      height: "210px",
                    }}
                  >
                    <img
                      src={TURF}
                      alt={ground}
                      style={{
                        width: "270px",
                        height: "170px",
                        borderRadius: "5px",
                        margin: 0,
                        padding: 0,
                      }}
                    />
                    <Button
                      type="primary"
                      onClick={() => {
                        setSelectedTable(ground);
                        setIsModalOpen(true);
                      }}
                      disabled={activeTables.some(
                        (t) => t.table === ground && !t.isClosed
                      )}
                      style={{
                        backgroundColor: activeTables.some(
                          (t) => t.table === ground && !t.isClosed
                        )
                          ? "red"
                          : "rgba(0, 89, 255, 0.93)",
                        position: "relative",
                        bottom: "10px",
                        cursor: activeTables.some(
                          (t) => t.table === ground && !t.isClosed
                        )
                          ? "not-allowed" // Show disabled cursor
                          : "pointer",
                        color: "white",
                      }}
                    >
                      {activeTables.some(
                        (t) => t.table === ground && !t.isClosed
                      )
                        ? "In Use"
                        : "Start Turf"}
                    </Button>
                    <h3>{ground}</h3>
                    {activeTables
                      .filter((t) => t.table === ground && !t.isClosed) // ✅ Get only tables that are NOT closed
                      .map((activeTable) => (
                        <div
                          key={activeTable.id}
                          style={{
                            fontSize: "14px",
                            fontWeight: "bold",
                            bottom: "50px",
                            position: "absolute",
                          }}
                        >
                          <p>👤 {activeTable.name}</p>
                          <p>📞 {activeTable.phone}</p>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <Table
          dataSource={sortedTables}
          rowKey="id"
          columns={[
            { title: "Table", dataIndex: "table", key: "table" },
            { title: "Customer Name", dataIndex: "name", key: "name" },
            { title: "Phone Number", dataIndex: "phone", key: "phone" },
            {
              title: "Start Time",
              dataIndex: "startTime",
              key: "startTime",
              render: (t) => (t ? moment(t).format("hh:mm A") : "—"),
            },
            {
              title: "End Time",
              dataIndex: "endTime",
              key: "endTime",
              render: (t) => (t ? moment(t).format("hh:mm A") : "—"),
            },
            {
              title: "Duration (min)",
              dataIndex: "duration",
              key: "duration",
              render: (d) => (d ? Math.round(d) : "—"), // Ensuring integer display
            },
            {
              title: "Ordered Items",
              dataIndex: "orderedItems",
              key: "orderedItems",
              render: (items) => (items?.length ? aggregateItems(items) : "—"),
            },
            {
              title: "Total Amount (Rs)",
              dataIndex: "totalAmount",
              key: "totalAmount",
              render: (a) => (a ? Math.round(a) : "—"), // Ensuring integer display,
            },
            {
              title: "Balance Kept (Rs)",
              dataIndex: "balanceKept",
              key: "balanceKept",
              render: (b) => (b ? Math.round(b) : "—"),
            },
            {
              title: "Balance Received (Rs)",
              dataIndex: "balanceReceived",
              key: "balanceReceived",
              render: (b) => (b ? Math.round(b) : "—"),
            },
            {
              title: "Previous Dues (Rs)",
              dataIndex: "previousDues",
              key: "previousDues",
              render: (d) => (d ? Math.round(d) : "—"),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, record) =>
                record.name === "FOOD" ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    {console.log("Dropdown menu for FOOD:", getMenu(record.id))}
                    {console.log("Rendering row:", record)}
                    <Dropdown
                      overlay={getMenu(record.id)}
                      trigger={["click"]}
                      visible={activeDropdownTable === record.id} // ✅ Uses unique ID instead of table name
                      onVisibleChange={
                        (visible) =>
                          setActiveDropdownTable(visible ? record.id : null) // ✅ Now tracks by unique ID
                      }
                    >
                      <Button
                        type="default"
                        onClick={() => {
                          setActiveDropdownTable(record.id);
                          console.log("Dropdown opened for:", record.id);
                          console.log(
                            "Current activeDropdownTable:",
                            activeDropdownTable
                          );
                        }}
                      >
                        Add
                      </Button>
                    </Dropdown>
                  </div>
                ) : record.endTime ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Button
                      type="default"
                      onClick={() => showDropdown("edit", record.id)}
                    >
                      Edit
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Button
                      type="primary"
                      onClick={() => {
                        stopTable(record.id);
                        handleEdit(record);
                      }}
                    >
                      Stop
                    </Button>
                    <Dropdown
                      overlay={getMenu(record.id)}
                      trigger={["click"]}
                      visible={activeDropdownTable === record.id} // ✅ Uses unique ID instead of table name
                      onVisibleChange={
                        (visible) =>
                          setActiveDropdownTable(visible ? record.id : null) // ✅ Now tracks by unique ID
                      }
                    >
                      <Button type="default">Add</Button>
                    </Dropdown>

                    <Button
                      type="primary"
                      onClick={() => showDropdown("delete", record.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
            },
          ]}
          style={{ marginTop: 20 }}
        />

        {/* Modal */}
        <Modal
          title="Start New Game"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
        >
          <Form form={form} onFinish={startTable}>
            <Form.Item>
              <h3>Table: {selectedTable}</h3>
            </Form.Item>
            <Form.Item
              name="name"
              label="Customer Name"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Phone Number"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Start
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Edit Table Entry"
          open={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          footer={null}
        >
          <Form form={editForm} onFinish={(values) => updateTable(values)}>
            <Form.Item name="name" label="Customer Name">
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone Number">
              <Input />
            </Form.Item>

            {/* Only Allow Editing Closing Time */}
            <Form.Item name="endTime" label="Closing Time">
              <Input
                type="datetime-local"
                onChange={(e) => {
                  const newEndTime = e.target.value
                    ? new Date(e.target.value)
                    : new Date();
                  const newDuration = Math.max(
                    Math.round(
                      (newEndTime - new Date(editData.startTime)) / 60000
                    ),
                    0
                  );
                  const totalItemCost = editData.orderedItems.reduce(
                    (sum, item) => sum + ITEM_PRICES[item],
                    0
                  );
                  let newTotalAmount = totalItemCost;
                  if (editData.gameType === "Turf") {
                    newTotalAmount += Math.round(
                      (newDuration / 60) * TURF_RATE_PER_HOUR
                    );
                  } else {
                    newTotalAmount += Math.round(
                      newDuration * POOL_RATE_PER_MIN
                    );
                  }
                  setEditData((prev) => ({
                    ...prev,
                    endTime: newEndTime,
                    totalAmount: newTotalAmount,
                  }));
                }}
              />
            </Form.Item>
            <Form.Item label="Total Amount (Rs)">
              <Input value={Math.round(editData?.totalAmount || 0)} disabled />
            </Form.Item>
            <Form.Item name="balanceKept" label="Balance Kept (Rs)">
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item name="balanceReceived" label="Balance Received (Rs)">
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item label="Previous Dues (Rs)">
              <Input value={editData?.previousDues || 0} disabled />
            </Form.Item>

            {/* Ordered Items List with Remove Button */}
            <h3>Ordered Items</h3>
            {Object.entries(
              (editData?.orderedItems || []).reduce((acc, item) => {
                acc[item] = (acc[item] || 0) + 1;
                return acc;
              }, {})
            ).map(([item, count], index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <span>
                  {count} x {item} (Rs {ITEM_PRICES[item]})
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Button
                    type="link"
                    onClick={() => decreaseItem(editData.id, item)}
                    disabled={count === 1}
                  >
                    ➖
                  </Button>
                  <Button
                    type="link"
                    onClick={() => increaseItem(editData.id, item)}
                  >
                    ➕
                  </Button>
                  <Button
                    type="link"
                    onClick={() => removeItem(editData.id, item)}
                  >
                    ❌
                  </Button>
                </div>
              </div>
            ))}

            {/* Add New Item Dropdown */}
            <Dropdown overlay={getEditMenu()} trigger={["click"]}>
              <Button type="default">Add Item</Button>
            </Dropdown>

            <Form.Item>
              <Button type="primary" htmlType="submit">
                Save Changes
              </Button>
            </Form.Item>
          </Form>
        </Modal>
        {isDropdownOpen && (
          <>
            <div className="overlay fixed top-0 left-0 w-full h-full bg-zinc-900 opacity-50 z-10"></div>
            <div
              ref={dropdownRef}
              className="dropdown-menu absolute right-[28.5rem] top-[25vh] h-[26rem] w-[40rem] bg-white shadow-2xl rounded-3xl p-[6px] z-50 animate-slide-down flex items-center gap-2"
            >
              <div>
                <img
                  src={logo1}
                  className="h-[12.5rem] w-[30rem] rounded-t-3xl"
                  alt="Logo 1"
                />
                <img
                  src={logo2}
                  className="h-[12.5rem] w-[30rem] rounded-b-3xl"
                  alt="Logo 2"
                />
              </div>
              <div className="bg-gray-100 h-[25rem] w-[30rem] text-black rounded-3xl shadow-xl shadow-gray-400 p-5">
                <div className="flex mt-1 ml-10 w-60 flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-black text-center">
                    The House Of Pool
                  </span>
                  <h3>
                    Login to {dropdownAction === "edit" ? "Edit" : "Delete"}
                  </h3>
                </div>
                <div>
                  <Form
                    form={loginForm}
                    onFinish={handleLoginSubmit}
                    className="flex flex-col items-center justify-center"
                  >
                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[
                        { required: true, message: "Please enter your email" },
                      ]}
                    >
                      <Input type="email" />
                    </Form.Item>
                    <Form.Item
                      name="password"
                      label="Password"
                      rules={[
                        {
                          required: true,
                          message: "Please enter your password",
                        },
                      ]}
                    >
                      <Input.Password />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit ">
                        {dropdownAction === "edit" ? "Edit" : "Delete"}
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};



export default PoolBillingSystem;

export { ITEM_PRICES };

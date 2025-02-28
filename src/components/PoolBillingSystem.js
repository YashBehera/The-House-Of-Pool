import {
  Button,
  Dropdown,
  Form,
  Input,
  Menu,
  Modal,
  Table,
  Select,
} from "antd";
import "antd/dist/reset.css";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  collection,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import pool from "./8ball.png";
import { auth, db } from "./firebase";
import logo1 from "./HOP3.png"; // Assuming same as Navbar
import logo2 from "./HOP5.png"; // Assuming same as Navbar
import Navbar from "./Navbar";
import "./pool.css";
import ps5 from "./PS2.png";
import tennis from "./tt.jpg";
import TURF from "./turf.png";
const POOL_RATE_PER_MIN = 2.5;
const TURF_RATE_PER_HOUR = 1200;

const LOCATIONS = {
  OLD_HOUSE: "Old House Of Pool",
  NEW_HOUSE: "New House Of Pool",
};

// Configurations for each location
const OLD_HOUSE_CONFIG = {
  tables: Array.from({ length: 14 }, (_, i) => `Table ${i + 1}`),
  ps: Array.from({ length: 6 }, (_, i) => `Controller ${i + 1}`),
  tt: ["Table Tennis 1", "Table Tennis 2"],
  turf: ["Turf"],
};

const OLD_HOUSE_POOL_RATES = {
  "Table 1": 250, // Large table
  "Table 5": 250, // Large table
  "Table 2": 200, // Medium table
  "Table 3": 200, // Medium table
  "Table 4": 200, // Medium table
  "Table 6": 200, // Medium table
  "Table 13": 200, // Medium table
  "Table 14": 200, // Medium table
  "Table 7": 150, // Small table
  "Table 8": 150, // Small table
  "Table 9": 150, // Small table
  "Table 10": 150, // Small table
  "Table 11": 150, // Small table
  "Table 12": 150, // Small table
};

const NEW_HOUSE_CONFIG = {
  tables: Array.from({ length: 5 }, (_, i) => `Table ${i + 1}`),
  ps: [],
  tt: [],
  turf: [],
};

// ✅ Price List
const ITEM_PRICES = {
  Lays: 20,
  Tin: 40,
  "KitKat (Small)": 35,
  "KitKat (Large)": 50,
  "Drinks (Glass)": 20,
  Water: 20,
};

const PoolBillingSystem = ({
  activeTables,
  setActiveTables,
  selectedLocation,
  setSelectedLocation,
}) => {
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
  const [isLoading, setIsLoading] = useState(false); // New loading state
  const [regularCustomers, setRegularCustomers] = useState([]); // Store regular customers
  const [selectedPaymentOption, setSelectedPaymentOption] = useState("Paid"); // Default to "Paid"
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false); // New state for add customer modal
  const [addCustomerForm] = Form.useForm(); // New form for adding customer

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
    let unsubscribe = () => {};
    if (isAuthenticated) {
      unsubscribe = onSnapshot(
        collection(db, "regularCustomers"),
        (snapshot) => {
          const customers = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log("Real-time updated regular customers:", customers);
          setRegularCustomers(customers);
        },
        (error) => {
          console.error("Error listening to regular customers:", error);
        }
      );
    }
    return () => unsubscribe(); // Cleanup listener on unmount or auth change
  }, [isAuthenticated]);

  const addRegularCustomer = async (values) => {
    if (!isAuthenticated) {
      alert("You must be authenticated to add a customer.");
      return;
    }
    const newCustomer = {
      name: values.name,
      phone: values.phone,
      dues: parseFloat(values.dues) || 0, // Default to 0 if not provided
    };
    const customerId = uuidv4(); // Generate a unique ID
    await setDoc(doc(db, "regularCustomers", customerId), newCustomer);
    setIsAddCustomerModalOpen(false);
    addCustomerForm.resetFields();
    console.log(`Added new customer: ${newCustomer.name}`);
  };

  // Update customer dues in Firestore
  const updateCustomerDues = async (customerId, amount) => {
    if (!isAuthenticated) return;
    const customerRef = doc(db, "regularCustomers", customerId);
    const customerDoc = await getDoc(customerRef);
    if (customerDoc.exists()) {
      const currentDues = customerDoc.data().dues || 0;
      const newDues = currentDues + amount;
      await updateDoc(customerRef, { dues: newDues });
      console.log(`Updated dues for ${customerId}: ${newDues}`);
    }
  };

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
    const changes = pendingUpdates.current[key] || [];
    if (changes.length === 0 || processedClicks.current.has(clickId)) return;

    const quantityChange = changes.reduce((sum, change) => sum + change, 0);
    if (quantityChange === 0) {
      delete pendingUpdates.current[key];
      return;
    }

    const stock = await getInventory();
    if (!stock[item]) stock[item] = { available: 0, sold: 0 };

    if (quantityChange > 0 && stock[item].available < quantityChange) {
      alert(`Not enough ${item} in stock! Available: ${stock[item].available}, Requested: ${quantityChange}`);
      setActiveTables((prevTables) => {
        const updatedTables = prevTables.map((t) => {
          if (t.id !== id) return t;
          const newItems = [...t.orderedItems];
          for (let i = 0; i < quantityChange; i++) {
            const index = newItems.lastIndexOf(item);
            if (index !== -1) newItems.splice(index, 1);
          }
          return { ...t, orderedItems: newItems };
        });
        return updatedTables;
      });
      delete pendingUpdates.current[key];
      return;
    }

    const success = await updateInventory(item, -quantityChange);
    if (!success) {
      alert(`Failed to update inventory for ${item}`);
      setActiveTables((prevTables) => {
        const updatedTables = prevTables.map((t) => {
          if (t.id !== id) return t;
          const newItems = [...t.orderedItems];
          for (let i = 0; i < quantityChange; i++) {
            const index = newItems.lastIndexOf(item);
            if (index !== -1) newItems.splice(index, 1);
          }
          return { ...t, orderedItems: newItems };
        });
        return updatedTables;
      });
      delete pendingUpdates.current[key];
      return;
    }

    setActiveTables((prevTables) => {
      const updatedTables = [...prevTables];
      saveTables(selectedDate, updatedTables, selectedLocation);
      console.log(`Synced ${quantityChange} ${item} for table ${id} to Firestore`);
      return updatedTables;
    });

    processedClicks.current.add(clickId);
    delete pendingUpdates.current[key];
  };

  const saveTables = async (date, tables, location) => {
    if (!isAuthenticated) return;
    const formattedTables = tables.map((table) => ({
      ...table,
      startTime: table.startTime
        ? new Date(table.startTime).toISOString()
        : null,
      endTime: table.endTime ? new Date(table.endTime).toISOString() : null,
      location, // Store location with each table entry
    }));
    await setDoc(doc(db, "tables", `${location}_${date}`), {
      data: formattedTables,
    });
  };

  const getTablesByDate = (date, location = selectedLocation, callback) => {
    if (!isAuthenticated) {
      callback([]);
      return () => {};
    }
    if (!location) {
      console.error("Location is undefined in getTablesByDate");
      callback([]);
      return () => {};
    }
    const unsubscribe = onSnapshot(
      doc(db, "tables", `${location}_${date}`),
      (docSnap) => {
        const remoteTables = docSnap.exists()
          ? docSnap.data().data.map((table) => ({
              ...table,
              startTime: table.startTime ? moment(table.startTime).toDate() : null,
              endTime: table.endTime ? moment(table.endTime).toDate() : null,
            }))
          : [];

        setActiveTables((prevTables) => {
          const mergedTables = prevTables.map((localTable) => {
            const remoteTable = remoteTables.find((rt) => rt.id === localTable.id);
            if (!remoteTable) return localTable;

            const hasPendingUpdates = Object.keys(pendingUpdates.current).some((key) =>
              key.startsWith(`${localTable.id}-`)
            );
            if (hasPendingUpdates) {
              console.log(`Preserving local orderedItems for ${localTable.id}: ${localTable.orderedItems.length}`);
              return { ...remoteTable, orderedItems: localTable.orderedItems };
            }
            return remoteTable;
          });

          const newTables = remoteTables.filter(
            (rt) => !prevTables.some((lt) => lt.id === rt.id)
          );
          const updatedTables = [...mergedTables, ...newTables];

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
              location: selectedLocation,
              cashAmount: 0,
              onlineAmount: 0,
            });
          }
          return updatedTables;
        });

        callback(remoteTables);
      },
      (error) => {
        console.error(`Firestore listener error for ${location}_${date}:`, error);
        callback([]);
      }
    );
    return unsubscribe;
  };

  const saveInventory = async (inventory) => {
    if (!isAuthenticated) {
      console.warn("Cannot save inventory: User not authenticated");
      return;
    }
    const docId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? "oldHouseStock"
        : "newHouseStock";
    await setDoc(doc(db, "inventory", docId), { data: inventory });
  };

  const getInventory = async () => {
    if (!isAuthenticated) {
      console.warn("Cannot get inventory: User not authenticated");
      return {};
    }
    const docId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? "oldHouseStock"
        : "newHouseStock";
    const docSnap = await getDoc(doc(db, "inventory", docId));
    return docSnap.exists() ? docSnap.data().data : {};
  };

  const canOrderItem = async (item) => {
    const stock = await getInventory();
    return stock[item]?.available > 0;
  };

  const calculateTotalAmount = (table, endTime) => {
    const startTime = new Date(table.startTime);
    // Use provided endTime, table's endTime, or current time as fallback
    const effectiveEndTime = endTime
      ? new Date(endTime)
      : table.endTime
      ? new Date(table.endTime)
      : new Date();
    const duration = Math.max(
      Math.round((effectiveEndTime - startTime) / 60000),
      0
    );
    const totalItemCost = table.orderedItems.reduce(
      (sum, item) => sum + ITEM_PRICES[item],
      0
    );
    let totalAmount = totalItemCost;

    if (table.gameType === "Turf") {
      totalAmount += Math.round((duration / 60) * TURF_RATE_PER_HOUR);
    } else if (table.gameType === "8-ball Pool") {
      if (table.location === LOCATIONS.OLD_HOUSE) {
        const hourlyRate = OLD_HOUSE_POOL_RATES[table.table] || 0; // Use table-specific rate or 0 if undefined
        totalAmount += Math.round((duration / 60) * hourlyRate);
      } else {
        totalAmount += Math.round(duration * POOL_RATE_PER_MIN);
      }
    } else {
      totalAmount += Math.round(duration * POOL_RATE_PER_MIN); // Default for other game types (PS, Table Tennis)
    }

    return { totalAmount: Math.round(totalAmount), duration };
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
      location: selectedLocation, // Add location to entry
      cashAmount: 0, // New field for cash payment
      onlineAmount: 0, // New field for online payment
    };

    setActiveTables((prevTables) => {
      const updatedTables = [...prevTables, newEntry];
      if (isAuthenticated)
        saveTables(selectedDate, updatedTables, selectedLocation);
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
    const { totalAmount, duration } = calculateTotalAmount(
      tableToEdit,
      endTime
    ); // Include existing orderedItems

    setEditData({
      ...tableToEdit,
      endTime,
      totalAmount, // Initial totalAmount includes items (Step 3)
      duration,
    });
    setSelectedPaymentOption(tableToEdit.paymentOption || "Paid"); // Load stored payment option or default to "Paid"
    setIsEditModalOpen(true);

    const formattedEndTime = moment(endTime).format("YYYY-MM-DDTHH:mm");
    editForm.setFieldsValue({
      name: tableToEdit.name,
      phone: tableToEdit.phone,
      startTime: moment(tableToEdit.startTime).format("YYYY-MM-DDTHH:mm"),
      endTime: formattedEndTime,
      totalAmount,
    });
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
    const clickId = `${key}-${Date.now()}`;
    if (!pendingUpdates.current[key]) pendingUpdates.current[key] = [];
    pendingUpdates.current[key].push(1);

    setEditData((prev) => {
      const updatedItems = [...prev.orderedItems, item];
      const { totalAmount } = calculateTotalAmount({ ...prev, orderedItems: updatedItems }, prev.endTime);
      editForm.setFieldsValue({ totalAmount });
      return { ...prev, orderedItems: updatedItems, totalAmount };
    });

    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(async () => {
      processPendingUpdates(editData.id, item, clickId);
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
      console.warn("Cannot update inventory: User not authenticated");
      return false;
    }
    const stock = await getInventory();
    if (stock[item] === undefined) stock[item] = { available: 0, sold: 0 };

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
    const clickId = `${key}-${Date.now()}`;
    if (!pendingUpdates.current[key]) pendingUpdates.current[key] = [];
    pendingUpdates.current[key].push(1);

    if (isEditModalOpen && editData?.id === id) {
      setEditData((prev) => {
        const updatedItems = [...prev.orderedItems, item];
        const { totalAmount } = calculateTotalAmount(
          { ...prev, orderedItems: updatedItems },
          prev.endTime
        );
        editForm.setFieldsValue({ totalAmount });
        return { ...prev, orderedItems: updatedItems, totalAmount };
      });
    }

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        return { ...t, orderedItems: [...t.orderedItems, item] };
      });
      return updatedTables;
    });

    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, item, clickId);
    }, 500);
  };

  const decreaseItem = async (id, item) => {
    const key = `${id}-${item}`;
    const clickId = `${key}-${Date.now()}`;
    if (!pendingUpdates.current[key]) pendingUpdates.current[key] = [];
    pendingUpdates.current[key].push(-1);

    if (isEditModalOpen && editData?.id === id) {
      setEditData((prev) => {
        const updatedItems = [...prev.orderedItems];
        const index = updatedItems.lastIndexOf(item);
        if (index !== -1) updatedItems.splice(index, 1);
        const { totalAmount } = calculateTotalAmount(
          { ...prev, orderedItems: updatedItems },
          prev.endTime
        );
        editForm.setFieldsValue({ totalAmount });
        return { ...prev, orderedItems: updatedItems, totalAmount };
      });
    }

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        const updatedItems = [...t.orderedItems];
        const index = updatedItems.lastIndexOf(item);
        if (index !== -1) updatedItems.splice(index, 1);
        return { ...t, orderedItems: updatedItems };
      });
      return updatedTables;
    });

    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, item, clickId);
    }, 500);
  };

  const removeItem = async (id, itemToRemove) => {
    const key = `${id}-${itemToRemove}`;
    const clickId = `${key}-${Date.now()}`;
    const currentTable = activeTables.find((t) => t.id === id);
    const itemCount = currentTable?.orderedItems.filter((item) => item === itemToRemove).length || 0;
    if (!pendingUpdates.current[key]) pendingUpdates.current[key] = [];
    for (let i = 0; i < itemCount; i++) pendingUpdates.current[key].push(-1);

    if (isEditModalOpen && editData?.id === id) {
      setEditData((prev) => {
        const updatedItems = prev.orderedItems.filter((item) => item !== itemToRemove);
        const { totalAmount } = calculateTotalAmount(
          { ...prev, orderedItems: updatedItems },
          prev.endTime
        );
        editForm.setFieldsValue({ totalAmount });
        return { ...prev, orderedItems: updatedItems, totalAmount };
      });
    }

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        return { ...t, orderedItems: t.orderedItems.filter((item) => item !== itemToRemove) };
      });
      return updatedTables;
    });

    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, itemToRemove, clickId);
    }, 500);
  };

  const handleEndTimeChange = (e) => {
    const newEndTime = e.target.value
      ? new Date(e.target.value)
      : editData.endTime
      ? new Date(editData.endTime)
      : new Date();
    setEditData((prev) => {
      const { totalAmount } = calculateTotalAmount(prev, newEndTime);
      editForm.setFieldsValue({ totalAmount }); // Update totalAmount in modal
      return { ...prev, endTime: newEndTime, totalAmount };
    });
  };

  const updateTable = (values) => {
    setActiveTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id !== editData.id) return t;

        const newEndTime = values.endTime
          ? new Date(values.endTime)
          : new Date();
        const newDuration = Math.max(
          Math.round((newEndTime - new Date(t.startTime)) / 60000),
          0
        );
        const updatedOrderedItems = editData.orderedItems;
        const { totalAmount } = calculateTotalAmount(
          { ...t, orderedItems: updatedOrderedItems },
          newEndTime
        );

        const cashAmount = parseFloat(values.cashAmount) || 0;
        const onlineAmount = parseFloat(values.onlineAmount) || 0;

        let updatedDues = 0;
        if (selectedPaymentOption !== "Paid") {
          const selectedCustomer = regularCustomers.find(
            (c) => c.name === selectedPaymentOption
          );
          if (selectedCustomer) {
            updatedDues = totalAmount - (cashAmount + onlineAmount);
            updateCustomerDues(selectedCustomer.id, updatedDues);
          }
        }

        return {
          ...t,
          name: values.name || t.name,
          phone: values.phone || t.phone,
          endTime: newEndTime,
          duration: newDuration,
          orderedItems: updatedOrderedItems,
          totalAmount,
          cashAmount, // Store cash amount
          onlineAmount, // Store online amount
          isClosed: true,
          dues: updatedDues > 0 ? updatedDues : 0, // Track dues in table entry
          paymentOption: selectedPaymentOption, // Store the selected payment option
        };
      })
    );

    setIsEditModalOpen(false);
    setSelectedPaymentOption("Paid"); // Reset to default
  };

  const handleEdit = (record) => {
    setEditData(record);
    setSelectedPaymentOption(record.paymentOption || "Paid"); // Load stored payment option
    setIsEditModalOpen(true);

    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    const formattedStartTime = record.startTime
      ? moment(record.startTime).format("YYYY-MM-DDTHH:mm")
      : null;
    const formattedEndTime = record.endTime
      ? moment(record.endTime).format("YYYY-MM-DDTHH:mm")
      : null;

    editForm.setFieldsValue({
      name: record.name,
      phone: record.phone,
      startTime: formattedStartTime,
      endTime: formattedEndTime, // Set actual endTime correctly formatted
      totalAmount: record.totalAmount,
      cashAmount: record.cashAmount || 0, // Default to 0 if not set
      onlineAmount: record.onlineAmount || 0, // Default to 0 if not set
    });
  };

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
      const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD");
      const today = moment().format("YYYY-MM-DD");

      for (const location of [LOCATIONS.OLD_HOUSE, LOCATIONS.NEW_HOUSE]) {
        const oldTables = await getTablesByDate(yesterday, location);
        if (oldTables.length > 0)
          await saveTables(yesterday, oldTables, location);
        await saveTables(today, [], location);
      }

      setActiveTables((prev) =>
        prev.filter((t) => t.location !== selectedLocation)
      );
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
  }, [selectedLocation]);

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
    let unsubscribe = () => {};
    const loadData = () => {
      setIsLoading(true);
      unsubscribe = getTablesByDate(selectedDate, selectedLocation, (tables) => {
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
            location: selectedLocation,
            cashAmount: 0,
            onlineAmount: 0,
          });
        }
        setActiveTables(updatedTables);
        setIsLoading(false);
      });
    };
    if (isAuthenticated) loadData();
    else {
      setActiveTables([]);
      setIsLoading(false);
    }
    return () => unsubscribe();
  }, [selectedDate, selectedLocation, isAuthenticated]);

  const sortedTables = [...activeTables]
    .filter((table) => table.location === selectedLocation)
    .sort((a, b) => {
      if (a.name === "FOOD") return -1; // "Food" row always first
      if (b.name === "FOOD") return 1;

      if (!a.isClosed && b.isClosed) return -1; // Open tables before closed ones
      if (a.isClosed && !b.isClosed) return 1;

      return 0; // Maintain order otherwise
    });

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

  useEffect(() => {
    if (isEditModalOpen && editData) {
      const { totalAmount } = calculateTotalAmount(editData, editData.endTime);
      editForm.setFieldsValue({ totalAmount });
    }
  }, [editData, isEditModalOpen]);

  const config =
    selectedLocation === LOCATIONS.OLD_HOUSE
      ? OLD_HOUSE_CONFIG
      : NEW_HOUSE_CONFIG;

  const oldHouseRow1 = [
    "Table 1",
    "Table 2",
    "Table 3",
    "Table 4",
    "Table 5",
    "Table 6",
    "Table 13",
  ];
  const oldHouseRow2 = [
    "Table 7",
    "Table 8",
    "Table 9",
    "Table 10",
    "Table 11",
    "Table 12",
    "Table 14",
  ];

  return (
    <div>
      {/* Navbar */}
      <Navbar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isAuthenticated={isAuthenticated}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
      />

      <div style={{ padding: 0, marginTop: 60 }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            Loading tables...
          </div>
        ) : (
          <>
            {selectedLocation === LOCATIONS.OLD_HOUSE && (
              <>
                <Button
                  type="primary"
                  onClick={() => {
                    console.log("Button clicked!");
                    setIsAddCustomerModalOpen(true);
                  }}
                  style={{
                    position: "absolute",
                    top: "90px",
                    left: "30px",
                    zIndex: 9, // Ensure it’s above other elements
                  }}
                >
                  Add Regular Customer
                </Button>
                <h1
                  style={{
                    margin: "0",
                    display: "flex",
                    justifyContent: "center",
                  }}
                  className=" flex text-4xl font-bold relative top-5"
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
                  {oldHouseRow1.map((table) => (
                    <div
                      key={table}
                      style={{
                        position: "relative",
                        textAlign: "center",
                        width: "190px",
                        height: "190px",
                      }}
                    >
                      <img
                        src={pool}
                        alt={table}
                        style={{
                          width: "190px",
                          height: "190px",
                          borderRadius: "5px",
                        }}
                      />
                      <Button
                        type="primary"
                        onClick={() => {
                          setSelectedTable(table);
                          setIsModalOpen(true);
                        }}
                        disabled={sortedTables.some(
                          (t) => t.table === table && !t.isClosed
                        )}
                        style={{
                          backgroundColor: sortedTables.some(
                            (t) => t.table === table && !t.isClosed
                          )
                            ? "red"
                            : "rgb(0, 89, 255)",
                          marginTop: "10px",
                          bottom: sortedTables.some(
                            (t) => t.table === table && !t.isClosed
                          )
                            ? "140px"
                            : "120px",
                          color: "white",
                        }}
                      >
                        {sortedTables.some(
                          (t) => t.table === table && !t.isClosed
                        )
                          ? "In Use"
                          : "Start Table"}
                      </Button>
                      <h3 style={{ position: "relative", bottom: "80px" }}>
                        {table}
                      </h3>
                      {sortedTables
                        .filter((t) => t.table === table && !t.isClosed)
                        .map((activeTable) => (
                          <div
                            key={activeTable.id}
                            style={{
                              fontSize: "14px",
                              fontWeight: "bold",
                              bottom: "160px",
                              position: "relative",
                            }}
                          >
                            <p>👤 {activeTable.name}</p>
                            <p>📞 {activeTable.phone}</p>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>

                {/* Second Row: Tables 7, 8, 9, 10, 11, 12, 14 */}
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {oldHouseRow2.map((table) => (
                    <div
                      key={table}
                      style={{
                        position: "relative",
                        textAlign: "center",
                        width: "190px",
                        height: "190px",
                      }}
                    >
                      <img
                        src={pool}
                        alt={table}
                        style={{
                          width: "190px",
                          height: "190px",
                          borderRadius: "5px",
                        }}
                      />
                      <Button
                        type="primary"
                        onClick={() => {
                          setSelectedTable(table);
                          setIsModalOpen(true);
                        }}
                        disabled={sortedTables.some(
                          (t) => t.table === table && !t.isClosed
                        )}
                        style={{
                          backgroundColor: sortedTables.some(
                            (t) => t.table === table && !t.isClosed
                          )
                            ? "red"
                            : "rgb(0, 89, 255)",
                          marginTop: "10px",
                          bottom: sortedTables.some(
                            (t) => t.table === table && !t.isClosed
                          )
                            ? "140px"
                            : "120px",
                          color: "white",
                        }}
                      >
                        {sortedTables.some(
                          (t) => t.table === table && !t.isClosed
                        )
                          ? "In Use"
                          : "Start Table"}
                      </Button>
                      <h3 style={{ position: "relative", bottom: "80px" }}>
                        {table}
                      </h3>
                      {sortedTables
                        .filter((t) => t.table === table && !t.isClosed)
                        .map((activeTable) => (
                          <div
                            key={activeTable.id}
                            style={{
                              fontSize: "14px",
                              fontWeight: "bold",
                              bottom: "160px",
                              position: "relative",
                            }}
                          >
                            <p>👤 {activeTable.name}</p>
                            <p>📞 {activeTable.phone}</p>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>

                <h1
                  style={{
                    margin: 20,
                    display: "flex",
                    justifyContent: "center",
                  }}
                  className=" flex text-4xl font-bold "
                >
                  PS 5
                </h1>
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    justifyContent: "center",
                  }}
                >
                  {config.ps.map((controller) => {
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
                      style={{
                        margin: 20,
                        display: "flex",
                        justifyContent: "center",
                      }}
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
                      {config.tt.map((tableTennis) => {
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
                              .filter(
                                (t) => t.table === tableTennis && !t.isClosed
                              ) // ✅ Get only tables that are NOT closed
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
                      style={{
                        margin: 20,
                        display: "flex",
                        justifyContent: "center",
                      }}
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
                      {config.turf.map((ground) => {
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
                                position: "relative",
                                bottom: "20px",
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
                                    bottom: "108px",
                                    right: "10px",
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
                  </div>
                </div>
              </>
            )}

            {selectedLocation === LOCATIONS.NEW_HOUSE && (
              <>
                <Button
                  type="primary"
                  onClick={() => {
                    console.log("Button clicked!");
                    setIsAddCustomerModalOpen(true);
                  }}
                  style={{
                    position: "absolute",
                    top: "90px",
                    left: "90px",
                    zIndex: 9, // Ensure it’s above other elements
                  }}
                >
                  Add Regular Customer
                </Button>
                <h1
                  style={{
                    margin: "0",
                    display: "flex",
                    justifyContent: "center",
                  }}
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
                  {config.tables.map((table) => {
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
                          {activeTables.some(
                            (t) => t.table === table && !t.isClosed
                          )
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
              </>
            )}
          </>
        )}

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
              title: "Cash (Rs)",
              dataIndex: "cashAmount",
              key: "cashAmount",
              render: (a) => (a !== undefined ? Math.round(a) : "0"),
            },
            {
              title: "Online (Rs)",
              dataIndex: "onlineAmount",
              key: "onlineAmount",
              render: (a) => (a !== undefined ? Math.round(a) : "0"),
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
                ) : record.isClosed ? (
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
          loading={isLoading} // Show loading spinner on table
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
          title="Add New Regular Customer"
          open={isAddCustomerModalOpen}
          onCancel={() => setIsAddCustomerModalOpen(false)}
          footer={null}
        >
          <Form form={addCustomerForm} onFinish={addRegularCustomer}>
            <Form.Item
              name="name"
              label="Customer Name"
              rules={[
                { required: true, message: "Please enter the customer name" },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Phone Number"
              rules={[
                { required: true, message: "Please enter the phone number" },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="dues"
              label="Initial Dues (Rs)"
              rules={[
                {
                  message: "Dues must be a non-negative number",
                },
              ]}
            >
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Add Customer
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
              <Input type="datetime-local" onChange={handleEndTimeChange} />
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

            <Form.Item name="totalAmount" label="Total Amount (Rs)">
              <Input disabled />
            </Form.Item>

            <Form.Item name="cashAmount" label="Cash Amount (Rs)">
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item name="onlineAmount" label="Online Amount (Rs)">
              <Input type="number" min={0} />
            </Form.Item>

            <Form.Item label="Payment Option">
              <Select
                value={selectedPaymentOption}
                onChange={(value) => setSelectedPaymentOption(value)}
                style={{ width: "100%" }}
              >
                <Select.Option value="Paid">Paid</Select.Option>
                {regularCustomers.map((customer) => (
                  <Select.Option key={customer.id} value={customer.name}>
                    {customer.name} (Dues: Rs {customer.dues})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

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
              className="dropdown-menu fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-[40rem] h-[26rem] bg-white shadow-2xl rounded-3xl p-2 z-30 flex flex-row md:flex-row items-center gap-2 animate-fade-in"
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
                  <span className="text-3xl font-bold text-black text-center relative bottom-4">
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

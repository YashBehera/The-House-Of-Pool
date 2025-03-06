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
  query,
  where,
} from "firebase/firestore";
import moment from "moment";
import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import pool from "./8ball.png";
import { auth, db } from "./firebase";
import logo1 from "./HOP3.png";
import logo2 from "./HOP5.png";
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

const OLD_HOUSE_CONFIG = {
  tables: Array.from({ length: 14 }, (_, i) => `Table ${i + 1}`),
  ps: Array.from({ length: 6 }, (_, i) => `Controller ${i + 1}`),
  tt: ["Table Tennis 1", "Table Tennis 2"],
  turf: ["Turf"],
};

const OLD_HOUSE_POOL_RATES = {
  "Table 1": 250,
  "Table 5": 250,
  "Table 2": 200,
  "Table 3": 200,
  "Table 4": 200,
  "Table 6": 200,
  "Table 13": 200,
  "Table 14": 200,
  "Table 7": 150,
  "Table 8": 150,
  "Table 9": 150,
  "Table 10": 150,
  "Table 11": 150,
  "Table 12": 150,
};

const getTableSize = (table) => {
  const price = OLD_HOUSE_POOL_RATES[table] || 0;
  if (price === 150) return "Small";
  if (price === 200) return "Medium";
  if (price === 250) return "Large";
  return ""; // Default if price isn’t matched (shouldn’t happen with your data)
};

const NEW_HOUSE_CONFIG = {
  tables: Array.from({ length: 5 }, (_, i) => `Table ${i + 1}`),
  ps: [],
  tt: [],
  turf: [],
};

export const getItemPrices = async (location) => {
  const docId =
    location === "Old House Of Pool" ? "oldHouseStock" : "newHouseStock";
  const docSnap = await getDoc(doc(db, "inventory", docId));
  const inventory = docSnap.exists() ? docSnap.data().data : {};
  const prices = {};
  Object.entries(inventory).forEach(([item, values]) => {
    prices[item] = values.price || 0;
  });
  return prices;
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
  );
  const pendingUpdates = useRef({});
  const processedClicks = useRef(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [dropdownAction, setDropdownAction] = useState(null);
  const [dropdownRecordId, setDropdownRecordId] = useState(null);
  const [loginForm] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [regularCustomers, setRegularCustomers] = useState([]);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState("Paid");
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [addCustomerForm] = Form.useForm();
  const [turfReservations, setTurfReservations] = useState([]);
  const [isEditingTurf, setIsEditingTurf] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState(null);
  const [ITEM_PRICES, setITEM_PRICES] = useState({}); // New state for dynamic item prices
  const [isFoodPaymentModalOpen, setIsFoodPaymentModalOpen] = useState(false);
  const [foodPaymentForm] = Form.useForm();
  const [foodTableId, setFoodTableId] = useState(null);
  const [dropdownItems, setDropdownItems] = useState([]); // New state for dropdown working set

  useEffect(() => {
    if (!isAuthenticated || !selectedLocation) return;

    const docId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? "oldHouseStock"
        : "newHouseStock";
    const unsubscribe = onSnapshot(
      doc(db, "inventory", docId),
      (docSnap) => {
        const inventory = docSnap.exists() ? docSnap.data().data : {};
        const prices = {};
        Object.entries(inventory).forEach(([item, values]) => {
          prices[item] = values.price || 0;
        });
        setITEM_PRICES(prices);
      },
      (error) => {
        console.error("Error fetching inventory:", error);
        setITEM_PRICES({}); // Fallback to empty object on error
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated, selectedLocation]);

  const editTurfReservation = (reservation) => {
    setIsEditingTurf(true);
    setEditingReservationId(reservation.id);
    form.setFieldsValue({
      name: reservation.name,
      phone: reservation.phone,
      startTime: moment(reservation.startTime).format("YYYY-MM-DDTHH:mm"),
      endTime: moment(reservation.endTime).format("YYYY-MM-DDTHH:mm"),
      advancePayment: reservation.advancePayment,
    });
  };

  const saveEditedTurfReservation = async (values) => {
    if (!selectedTable || selectedTable !== "Turf" || !editingReservationId)
      return;

    const startTime = moment(values.startTime);
    const endTime = moment(values.endTime);
    const advancePayment = parseFloat(values.advancePayment) || 0;

    // Validate time slot (exclude the current reservation being edited)
    const isSlotTaken = turfReservations.some((res) => {
      if (res.id === editingReservationId) return false; // Skip the current reservation
      const resStart = moment(res.startTime);
      const resEnd = moment(res.endTime);
      return (
        startTime.isBetween(resStart, resEnd, null, "[]") ||
        endTime.isBetween(resStart, resEnd, null, "[]") ||
        (startTime.isBefore(resStart) && endTime.isAfter(resEnd))
      );
    });

    if (isSlotTaken) {
      alert("This time slot is already reserved. Please choose another time.");
      return;
    }

    const updatedReservation = {
      ...turfReservations.find((res) => res.id === editingReservationId),
      name: values.name,
      phone: values.phone,
      startTime: startTime.toDate(),
      endTime: endTime.toDate(),
      advancePayment,
    };

    await saveTurfReservation(updatedReservation);
    setIsEditingTurf(false);
    setEditingReservationId(null);
    setIsModalOpen(false);
    form.resetFields();
  };

  // Fetch turf reservations from Firestore
  const fetchTurfReservations = async () => {
    if (!isAuthenticated) return;
    const q = query(
      collection(db, "turfReservations"),
      where("location", "==", selectedLocation)
    );
    const querySnapshot = await getDocs(q);
    const reservations = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      startTime: moment(doc.data().startTime).toDate(),
      endTime: moment(doc.data().endTime).toDate(),
    }));
    setTurfReservations(reservations);
  };

  useEffect(() => {
    fetchTurfReservations();
  }, [selectedLocation, isAuthenticated]);

  // Check and move turf reservations to activeTables when start time hits
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkTurfReservations = () => {
      const now = moment();
      const readyReservations = turfReservations.filter(
        (res) => moment(res.startTime).isSameOrBefore(now) && !res.isActive
      );

      if (readyReservations.length > 0) {
        setActiveTables((prevTables) => {
          const updatedTables = [...prevTables];
          readyReservations.forEach((res) => {
            if (!updatedTables.some((t) => t.id === res.id)) {
              updatedTables.push({
                ...res,
                isClosed: false,
                cashAmount: 0,
                onlineAmount: 0,
                orderedItems: [],
              });
            }
          });
          saveTables(selectedDate, updatedTables, selectedLocation);
          return updatedTables;
        });

        // Mark reservations as active in Firestore
        readyReservations.forEach(async (res) => {
          await updateDoc(doc(db, "turfReservations", res.id), {
            isActive: true,
          });
        });
        fetchTurfReservations(); // Refresh reservations
      }
    };

    const interval = setInterval(checkTurfReservations, 60000); // Check every minute
    checkTurfReservations(); // Initial check
    return () => clearInterval(interval);
  }, [turfReservations, selectedDate, selectedLocation, isAuthenticated]);

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
    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkTurfReservations = async () => {
      const now = moment();
      const readyReservations = turfReservations.filter(
        (res) => moment(res.startTime).isSameOrBefore(now) && !res.isActive
      );

      if (readyReservations.length > 0) {
        // Update activeTables locally and persist to Firestore
        setActiveTables((prevTables) => {
          const updatedTables = [...prevTables];
          readyReservations.forEach((res) => {
            if (!updatedTables.some((t) => t.id === res.id)) {
              updatedTables.push({
                ...res,
                isClosed: false,
                cashAmount: 0,
                onlineAmount: 0,
                orderedItems: [],
              });
            }
          });
          // Save to Firestore immediately
          saveTables(selectedDate, updatedTables, selectedLocation);
          return updatedTables;
        });

        // Mark reservations as active in Firestore
        await Promise.all(
          readyReservations.map((res) =>
            updateDoc(doc(db, "turfReservations", res.id), { isActive: true })
          )
        );

        // Refresh reservations to ensure UI consistency
        await fetchTurfReservations();
      }
    };

    const interval = setInterval(checkTurfReservations, 60000); // Check every minute
    checkTurfReservations(); // Initial check
    return () => clearInterval(interval);
  }, [turfReservations, selectedDate, selectedLocation, isAuthenticated]);

  const addRegularCustomer = async (values) => {
    if (!isAuthenticated) {
      alert("You must be authenticated to add a customer.");
      return;
    }
    const newCustomer = {
      name: values.name,
      phone: values.phone,
      dues: parseFloat(values.dues) || 0,
    };
    const customerId = uuidv4();
    await setDoc(doc(db, "regularCustomers", customerId), newCustomer);
    setIsAddCustomerModalOpen(false);
    addCustomerForm.resetFields();
    console.log(`Added new customer: ${newCustomer.name}`);
  };

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
      alert(
        `Not enough ${item} in stock! Available: ${stock[item].available}, Requested: ${quantityChange}`
      );
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
      console.log(
        `Synced ${quantityChange} ${item} for table ${id} to Firestore`
      );
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
      location,
    }));
    await setDoc(doc(db, "tables", `${location}_${date}`), {
      data: formattedTables,
    });
  };

  const saveTurfReservation = async (reservation) => {
    if (!isAuthenticated) return;
    const reservationDoc = doc(db, "turfReservations", reservation.id);
    await setDoc(reservationDoc, {
      ...reservation,
      startTime: reservation.startTime.toISOString(),
      endTime: reservation.endTime.toISOString(),
      location: selectedLocation,
      isActive: false,
    });
    await fetchTurfReservations();
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
        let remoteTables = docSnap.exists()
          ? docSnap.data().data.map((table) => ({
              ...table,
              startTime: table.startTime
                ? moment(table.startTime).toDate()
                : null,
              endTime: table.endTime ? moment(table.endTime).toDate() : null,
            }))
          : [];

        setActiveTables((prevTables) => {
          const mergedTables = prevTables.map((localTable) => {
            const remoteTable = remoteTables.find(
              (rt) => rt.id === localTable.id
            );
            if (!remoteTable) return localTable;

            const hasPendingUpdates = Object.keys(pendingUpdates.current).some(
              (key) => key.startsWith(`${localTable.id}-`)
            );
            if (hasPendingUpdates || localTable.isClosed) {
              return {
                ...remoteTable,
                orderedItems: localTable.orderedItems,
                isClosed: localTable.isClosed,
              };
            }
            return remoteTable;
          });

          const newTables = remoteTables.filter(
            (rt) => !prevTables.some((lt) => lt.id === rt.id)
          );
          let updatedTables = [...mergedTables, ...newTables];

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
        console.error(
          `Firestore listener error for ${location}_${date}:`,
          error
        );
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

  const calculateTotalAmount = (table, endTime) => {
    const startTime = new Date(table.startTime);
    const effectiveEndTime = endTime
      ? new Date(endTime)
      : table.endTime
      ? new Date(table.endTime)
      : new Date();
    const totalMinutes = Math.max(
      Math.round((effectiveEndTime - startTime) / 60000),
      0
    );
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const durationString =
      hours > 0
        ? `${hours} hour${hours > 1 ? "s" : ""}${
            minutes > 0 ? ` ${minutes} min` : ""
          }`
        : `${minutes} min`;

    const totalItemCost = table.orderedItems.reduce(
      (sum, item) => sum + ITEM_PRICES[item],
      0
    );
    let totalAmount = totalItemCost;

    if (table.gameType === "Turf") {
      totalAmount += Math.round((totalMinutes / 60) * TURF_RATE_PER_HOUR);
    } else if (table.gameType === "Snooker Table") {
      if (table.location === LOCATIONS.OLD_HOUSE) {
        const hourlyRate = OLD_HOUSE_POOL_RATES[table.table] || 0;
        totalAmount += Math.round((totalMinutes / 60) * hourlyRate);
      } else {
        totalAmount += Math.round(totalMinutes * POOL_RATE_PER_MIN);
      }
    } else {
      totalAmount += Math.round(totalMinutes * POOL_RATE_PER_MIN);
    }

    return {
      totalAmount: Math.round(totalAmount),
      duration: totalMinutes,
      durationString,
    };
  };

  const startTable = (values) => {
    if (!selectedTable) return;

    const startTime = new Date().toISOString();
    let gameType = "Other";

    if (typeof selectedTable === "string") {
      const lowerTable = selectedTable.toLowerCase();
      if (lowerTable.includes("table tennis")) gameType = "Table Tennis";
      else if (lowerTable.startsWith("table ")) gameType = "Snooker Table";
      else if (lowerTable.includes("controller")) gameType = "Play Station";
      else if (lowerTable.includes("turf")) gameType = "Turf";
    } else {
      console.error("Error: selectedTable is not a string", selectedTable);
    }

    if (gameType !== "Turf") {
      const newEntry = {
        ...values,
        id: uuidv4(),
        table: selectedTable,
        startTime,
        orderedItems: [],
        totalAmount: 0,
        gameType,
        isClosed: false,
        location: selectedLocation,
        cashAmount: 0,
        onlineAmount: 0,
      };

      setActiveTables((prevTables) => {
        const updatedTables = [...prevTables, newEntry];
        if (isAuthenticated)
          saveTables(selectedDate, updatedTables, selectedLocation);
        return updatedTables;
      });

      setIsModalOpen(false);
      form.resetFields();
    }
    // Turf-specific logic is handled in reserveTurf
  };

  const reserveTurf = async (values) => {
    if (!selectedTable || selectedTable !== "Turf") return;

    const startTime = moment(values.startTime);
    const endTime = moment(values.endTime);
    const advancePayment = parseFloat(values.advancePayment) || 0;

    // Validate time slot
    const isSlotTaken = turfReservations.some((res) => {
      const resStart = moment(res.startTime);
      const resEnd = moment(res.endTime);
      return (
        startTime.isBetween(resStart, resEnd, null, "[]") ||
        endTime.isBetween(resStart, resEnd, null, "[]") ||
        (startTime.isBefore(resStart) && endTime.isAfter(resEnd))
      );
    });

    if (isSlotTaken) {
      alert("This time slot is already reserved. Please choose another time.");
      return;
    }

    const reservation = {
      id: uuidv4(),
      table: selectedTable,
      name: values.name,
      phone: values.phone,
      startTime: startTime.toDate(),
      endTime: endTime.toDate(),
      advancePayment,
      gameType: "Turf",
      isClosed: false,
      location: selectedLocation,
      isActive: false,
    };

    await saveTurfReservation(reservation);
    setIsModalOpen(false);
    form.resetFields();
  };

  const stopTable = (id) => {
    const tableToEdit = activeTables.find((t) => t.id === id);
    if (!tableToEdit || tableToEdit.endTime) return;

    const endTime = new Date();
    const { totalAmount, duration, durationString } = calculateTotalAmount(
      tableToEdit,
      endTime
    );

    setEditData({
      ...tableToEdit,
      endTime,
      totalAmount,
      duration,
      durationString,
      isClosed: true,
    });
    setSelectedPaymentOption(tableToEdit.paymentOption || "Paid");
    setIsEditModalOpen(true);

    const formattedEndTime = moment(endTime).format("YYYY-MM-DDTHH:mm");
    editForm.setFieldsValue({
      name: tableToEdit.name,
      phone: tableToEdit.phone,
      startTime: moment(tableToEdit.startTime).format("YYYY-MM-DDTHH:mm"),
      endTime: formattedEndTime,
      totalAmount,
      advancePayment: tableToEdit.advancePayment || 0,
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
      const { totalAmount, duration, durationString } = calculateTotalAmount(
        { ...prev, orderedItems: updatedItems },
        prev.endTime
      );
      editForm.setFieldsValue({ totalAmount });
      return {
        ...prev,
        orderedItems: updatedItems,
        totalAmount,
        duration,
        durationString,
      };
    });

    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(async () => {
      processPendingUpdates(editData.id, item, clickId);
    }, 500);
  };

  const aggregateItems = (items) => {
    const itemCounts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(itemCounts)
      .map(([name, count]) => `${count} ${name}`)
      .join(", ");
  };

  const getMenu = (id) => {
    const tableData = activeTables.find((t) => t.id === id);
    if (!tableData) {
      return (
        <Menu>
          <Menu.Item>No items found</Menu.Item>
        </Menu>
      );
    }

    const sortedItems = Object.keys(ITEM_PRICES).sort((a, b) =>
      a.localeCompare(b)
    );
    const isFoodRow = tableData.name === "FOOD";

    return (
      <Menu>
        {sortedItems.map((item) => {
          const itemCount = isFoodRow
            ? dropdownItems.filter((i) => i === item).length
            : tableData.orderedItems
            ? tableData.orderedItems.filter((i) => i === item).length
            : 0;
          return (
            <Menu.Item key={item}>
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
        {isFoodRow && (
          <Menu.Item key="add-payment">
            <Button
              type="primary"
              style={{ width: "100%" }}
              onClick={() => {
                setFoodTableId(id);
                setIsFoodPaymentModalOpen(true);
                const totalPayment = dropdownItems.reduce(
                  (sum, item) => sum + (ITEM_PRICES[item] || 0),
                  0
                );
                foodPaymentForm.setFieldsValue({
                  cashAmount: 0,
                  onlineAmount: 0,
                  totalPayment: totalPayment.toFixed(2),
                });
                setActiveDropdownTable(null); // Close dropdown
              }}
            >
              Add Payment
            </Button>
          </Menu.Item>
        )}
      </Menu>
    );
  };

  const handleFoodPaymentSubmit = (values) => {
    const cashAmount = parseFloat(values.cashAmount) || 0;
    const onlineAmount = parseFloat(values.onlineAmount) || 0;

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((table) => {
        if (table.id === foodTableId) {
          const totalItemCost = dropdownItems.reduce(
            (sum, item) => sum + (ITEM_PRICES[item] || 0),
            0
          );
          return {
            ...table,
            cashAmount: (table.cashAmount || 0) + cashAmount,
            onlineAmount: (table.onlineAmount || 0) + onlineAmount,
            totalAmount: (table.totalAmount || 0) + totalItemCost,
            orderedItems: [...table.orderedItems, ...dropdownItems], // Append to existing items
          };
        }
        return table;
      });
      saveTables(selectedDate, updatedTables, selectedLocation);
      return updatedTables;
    });

    setDropdownItems([]); // Reset dropdown count
    setIsFoodPaymentModalOpen(false);
    foodPaymentForm.resetFields();
    setFoodTableId(null);
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
        const { totalAmount, duration, durationString } = calculateTotalAmount(
          { ...prev, orderedItems: updatedItems },
          prev.endTime
        );
        editForm.setFieldsValue({ totalAmount });
        return {
          ...prev,
          orderedItems: updatedItems,
          totalAmount,
          duration,
          durationString,
        };
      });
    }

    const table = activeTables.find((t) => t.id === id);
    if (table?.name === "FOOD") {
      setDropdownItems((prev) => [...prev, item]);
    } else {
      setActiveTables((prevTables) => {
        const updatedTables = prevTables.map((t) => {
          if (t.id !== id) return t;
          return { ...t, orderedItems: [...t.orderedItems, item] };
        });
        return updatedTables;
      });
    }

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
        const { totalAmount, duration, durationString } = calculateTotalAmount(
          { ...prev, orderedItems: updatedItems },
          prev.endTime
        );
        editForm.setFieldsValue({ totalAmount });
        return {
          ...prev,
          orderedItems: updatedItems,
          totalAmount,
          duration,
          durationString,
        };
      });
    }
    const table = activeTables.find((t) => t.id === id);
    if (table?.name === "FOOD") {
      // Only update dropdownItems for FOOD row
      setDropdownItems((prev) => {
        const updatedItems = [...prev];
        const index = updatedItems.lastIndexOf(item);
        if (index !== -1) updatedItems.splice(index, 1);
        return updatedItems;
      });
    } else {
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
    }
    clearTimeout(pendingUpdates.current[`timeout-${key}`]);
    pendingUpdates.current[`timeout-${key}`] = setTimeout(() => {
      processPendingUpdates(id, item, clickId);
    }, 500);
  };

  const removeItem = async (id, itemToRemove) => {
    const key = `${id}-${itemToRemove}`;
    const clickId = `${key}-${Date.now()}`;
    const currentTable = activeTables.find((t) => t.id === id);
    const itemCount =
      currentTable?.orderedItems.filter((item) => item === itemToRemove)
        .length || 0;
    if (!pendingUpdates.current[key]) pendingUpdates.current[key] = [];
    for (let i = 0; i < itemCount; i++) pendingUpdates.current[key].push(-1);

    if (isEditModalOpen && editData?.id === id) {
      setEditData((prev) => {
        const updatedItems = prev.orderedItems.filter(
          (item) => item !== itemToRemove
        );
        const { totalAmount, duration, durationString } = calculateTotalAmount(
          { ...prev, orderedItems: updatedItems },
          prev.endTime
        );
        editForm.setFieldsValue({ totalAmount });
        return {
          ...prev,
          orderedItems: updatedItems,
          totalAmount,
          duration,
          durationString,
        };
      });
    }

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          orderedItems: t.orderedItems.filter((item) => item !== itemToRemove),
        };
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
      : editData.endTime || new Date();
    setEditData((prev) => {
      const { totalAmount, duration, durationString } = calculateTotalAmount(
        prev,
        newEndTime
      );
      editForm.setFieldsValue({ totalAmount });
      return {
        ...prev,
        endTime: newEndTime,
        totalAmount,
        duration,
        durationString,
      };
    });
  };

  const updateTable = (values) => {
    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) => {
        if (t.id !== editData.id) return t;

        const newEndTime = values.endTime
          ? new Date(values.endTime)
          : editData.endTime || new Date();
        const newDuration = Math.max(
          Math.round((newEndTime - new Date(t.startTime)) / 60000),
          0
        );
        const updatedOrderedItems = editData.orderedItems || t.orderedItems;
        const { totalAmount, duration, durationString } = calculateTotalAmount(
          { ...t, orderedItems: updatedOrderedItems },
          newEndTime
        );

        const cashAmount = parseFloat(values.cashAmount) || 0;
        const onlineAmount = parseFloat(values.onlineAmount) || 0;
        const advancePayment = t.advancePayment || 0;
        let updatedDues = 0;

        if (selectedPaymentOption !== "Paid") {
          const selectedCustomer = regularCustomers.find(
            (c) => c.name === selectedPaymentOption
          );
          if (selectedCustomer) {
            updatedDues =
              totalAmount - advancePayment - (cashAmount + onlineAmount);
            if (updatedDues > 0)
              updateCustomerDues(selectedCustomer.id, updatedDues);
          }
        }

        return {
          ...t,
          name: values.name || t.name,
          phone: values.phone || t.phone,
          endTime: newEndTime,
          duration,
          durationString,
          orderedItems: updatedOrderedItems,
          totalAmount,
          cashAmount,
          onlineAmount,
          advancePayment,
          isClosed: true,
          dues: updatedDues > 0 ? updatedDues : 0,
          paymentOption: selectedPaymentOption,
        };
      });

      saveTables(selectedDate, updatedTables, selectedLocation);
      return updatedTables;
    });

    setIsEditModalOpen(false);
    setSelectedPaymentOption("Paid");
  };

  const handleEdit = (record) => {
    setEditData(record);
    setSelectedPaymentOption(record.paymentOption || "Paid");
    setIsEditModalOpen(true);

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
      endTime: formattedEndTime,
      totalAmount: record.totalAmount,
      cashAmount: record.cashAmount || 0,
      onlineAmount: record.onlineAmount || 0,
      advancePayment: record.advancePayment || 0,
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
      const { email, password } = values;
      if (email === "hop@gmail.com" && password === "123456") {
        if (dropdownAction === "edit") {
          const record = activeTables.find((t) => t.id === dropdownRecordId);
          if (record) handleEdit(record);
        } else if (dropdownAction === "delete") {
          deleteTable(dropdownRecordId);
        }
        setIsDropdownOpen(false);
        loginForm.resetFields();
      } else {
        alert("You do not have permission to access this feature.");
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Invalid email or password. Please try again.");
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};
    const loadData = () => {
      setIsLoading(true);
      unsubscribe = getTablesByDate(
        selectedDate,
        selectedLocation,
        (tables) => {
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
        }
      );
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
      if (a.name === "FOOD") return -1;
      if (b.name === "FOOD") return 1;
      if (!a.isClosed && b.isClosed) return -1;
      if (a.isClosed && !b.isClosed) return 1;
      return 0;
    });

  console.log(activeTables);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
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

  const reservationColumns = [
    { title: "Customer Name", dataIndex: "name", key: "name" },
    {
      title: "Start Time",
      dataIndex: "startTime",
      key: "startTime",
      render: (t) => moment(t).format("DD-MMM-YYYY hh:mm A"), // Simplified format
    },
    {
      title: "End Time",
      dataIndex: "endTime",
      key: "endTime",
      render: (t) => moment(t).format("DD-MMM-YYYY hh:mm A"), // Simplified format
    },
    {
      title: "Advance Payment (Rs)",
      dataIndex: "advancePayment",
      key: "advancePayment",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button type="link" onClick={() => editTurfReservation(record)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
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
                    zIndex: 9,
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
                  Snooker Table
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
                      <p
                        style={{
                          position: "relative",
                          bottom: "70px",
                          fontSize: "12px",
                          color: "#666",
                          margin: 0,
                        }}
                      >
                        {getTableSize(table)}
                      </p>
                      {sortedTables
                        .filter((t) => t.table === table && !t.isClosed)
                        .map((activeTable) => (
                          <div
                            key={activeTable.id}
                            style={{
                              fontSize: "14px",
                              fontWeight: "bold",
                              bottom: "180px",
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
                      <p
                        style={{
                          position: "relative",
                          bottom: "70px",
                          fontSize: "12px",
                          color: "#666",
                          margin: 0,
                        }}
                      >
                        {getTableSize(table)}
                      </p>
                      {sortedTables
                        .filter((t) => t.table === table && !t.isClosed)
                        .map((activeTable) => (
                          <div
                            key={activeTable.id}
                            style={{
                              fontSize: "14px",
                              fontWeight: "bold",
                              bottom: "180px",
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
                  className="flex text-4xl font-bold"
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
                  {config.ps.map((controller) => (
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
                            ? "not-allowed"
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
                        .filter((t) => t.table === controller && !t.isClosed)
                        .map((activeTable) => (
                          <div
                            key={activeTable.id}
                            style={{
                              fontSize: "14px",
                              fontWeight: "bold",
                              bottom: "127px",
                              position: "relative",
                              right: "100px",
                            }}
                          >
                            <p>👤 {activeTable.name}</p>
                            <p>📞 {activeTable.phone}</p>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>

                <div className="flex flex-row items-center justify-center gap-36">
                  <div className="flex flex-col items-center justify-center">
                    <h1
                      style={{
                        margin: 20,
                        display: "flex",
                        justifyContent: "center",
                      }}
                      className="flex text-4xl font-bold relative top-3"
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
                      {config.tt.map((tableTennis) => (
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
                                ? "not-allowed"
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
                            )
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
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <h1
                      style={{
                        margin: 20,
                        display: "flex",
                        justifyContent: "center",
                      }}
                      className="flex text-4xl font-bold relative top-3"
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
                      {config.turf.map((ground) => (
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
                            style={{
                              backgroundColor: activeTables.some(
                                (t) => t.table === ground && !t.isClosed
                              )
                                ? "red"
                                : "rgba(0, 89, 255, 0.93)",
                              position: "relative",
                              bottom: "10px",
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
                            .filter((t) => t.table === ground && !t.isClosed)
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
                      ))}
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
                    zIndex: 9,
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
                  className="flex text-4xl font-bold relative top-7"
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
                  {config.tables.map((table) => (
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
                        )}
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
                            ? "not-allowed"
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
                        .filter((t) => t.table === table && !t.isClosed)
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
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <Table
          dataSource={sortedTables}
          rowKey="id"
          columns={[
            {
              title: "Table No.",
              dataIndex: "table",
              key: "table",
              render: (table) => (
                <span style={{ whiteSpace: "nowrap" }}>{table}</span>
              ),
            },
            {
              title: "Name",
              dataIndex: "name",
              key: "name",
              render: (name) => (
                <span style={{ whiteSpace: "nowrap" }}>{name}</span>
              ),
            },
            {
              title: "Mobile Number",
              dataIndex: "phone",
              key: "phone",
              render: (phone) => (
                <span style={{ whiteSpace: "nowrap" }}>{phone}</span>
              ),
            },
            {
              title: "Start Time",
              dataIndex: "startTime",
              key: "startTime",
              render: (t) => (
                <span style={{ whiteSpace: "nowrap" }}>
                  {t ? moment(t).format("hh:mm A") : "—"}
                </span>
              ),
            },
            {
              title: "End Time",
              dataIndex: "endTime",
              key: "endTime",
              render: (t) => (
                <span style={{ whiteSpace: "nowrap" }}>
                  {t ? moment(t).format("hh:mm A") : "—"}
                </span>
              ),
            },
            {
              title: "Duration",
              dataIndex: "durationString",
              key: "duration",
              render: (d) => (
                <span style={{ whiteSpace: "nowrap" }}>{d || "—"}</span>
              ),
            },
            {
              title: "Ordered Items",
              dataIndex: "orderedItems",
              key: "orderedItems",
              render: (items) => (items?.length ? aggregateItems(items) : "—"),
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
              title: "Total Amount (Rs)",
              dataIndex: "totalAmount",
              key: "totalAmount",
              render: (a) => (a ? Math.round(a) : "—"),
            },
            {
              title: "Actions",
              key: "actions",
              render: (_, record) =>
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
                      visible={activeDropdownTable === record.id}
                      onVisibleChange={(visible) =>
                        setActiveDropdownTable(visible ? record.id : null)
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
          loading={isLoading}
          pagination={{ pageSize: 30 }}
        />

        <Modal
          title={isEditingTurf ? "Edit Turf Reservation" : "Start New Game"}
          open={isModalOpen}
          onCancel={() => {
            setIsModalOpen(false);
            setIsEditingTurf(false);
            setEditingReservationId(null);
            form.resetFields();
          }}
          footer={null}
        >
          <Form
            form={form}
            onFinish={
              selectedTable === "Turf"
                ? isEditingTurf
                  ? saveEditedTurfReservation
                  : reserveTurf
                : startTable
            }
          >
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
            {selectedTable === "Turf" ? (
              <>
                <Form.Item
                  name="startTime"
                  label="Start Time"
                  rules={[
                    { required: true, message: "Please select start time" },
                  ]}
                >
                  <Input
                    type="datetime-local"
                    min={moment().format("YYYY-MM-DDTHH:mm")}
                  />
                </Form.Item>
                <Form.Item
                  name="endTime"
                  label="End Time"
                  rules={[
                    { required: true, message: "Please select end time" },
                  ]}
                >
                  <Input
                    type="datetime-local"
                    min={moment().format("YYYY-MM-DDTHH:mm")}
                  />
                </Form.Item>
                <Form.Item
                  name="advancePayment"
                  label="Advance Payment (Rs)"
                  rules={[
                    { required: true, message: "Please enter advance payment" },
                  ]}
                >
                  <Input type="number" min={0} />
                </Form.Item>
                <Table
                  dataSource={turfReservations.filter((res) => !res.isActive)}
                  columns={reservationColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  style={{ marginBottom: 16 }}
                />
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    {isEditingTurf ? "Save Changes" : "Reserve Turf"}
                  </Button>
                </Form.Item>
              </>
            ) : (
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Start
                </Button>
              </Form.Item>
            )}
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
              rules={[{ message: "Dues must be a non-negative number" }]}
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
            <Form.Item name="endTime" label="Closing Time">
              <Input type="datetime-local" onChange={handleEndTimeChange} />
            </Form.Item>
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
            <Dropdown overlay={getEditMenu()} trigger={["click"]}>
              <Button type="default">Add Item</Button>
            </Dropdown>
            {editData?.gameType === "Turf" && (
              <Form.Item name="advancePayment" label="Advance Payment (Rs)">
                <Input disabled />
              </Form.Item>
            )}
            <Form.Item name="totalAmount" label="Total Amount (Rs)">
              <Input disabled />
            </Form.Item>

            <Form.Item
              name="onlineAmount"
              label="Online Amount (Rs)"
              rules={[
                { required: true, message: "Please enter online amount" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const online = parseFloat(value) || 0; // Convert to number, default to 0 if invalid
                    if (online < 0) {
                      return Promise.reject(
                        new Error("Online amount cannot be negative")
                      );
                    }
                    const cash = parseFloat(getFieldValue("cashAmount")) || 0;
                    const total = parseFloat(getFieldValue("totalAmount")) || 0;

                    // Only validate the sum if both cash and online are filled
                    if (value && getFieldValue("cashAmount")) {
                      if (cash + online !== total) {
                        return Promise.reject(
                          new Error("Cash + Online must equal Total Amount")
                        );
                      }
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input type="number" min={0} step="0.01" />
            </Form.Item>
            <Form.Item
              name="cashAmount"
              label="Cash Amount (Rs)"
              rules={[
                { required: true, message: "Please enter cash amount" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const cash = parseFloat(value) || 0; // Convert to number, default to 0 if invalid
                    if (cash < 0) {
                      return Promise.reject(
                        new Error("Cash amount cannot be negative")
                      );
                    }
                    const online =
                      parseFloat(getFieldValue("onlineAmount")) || 0;
                    const total = parseFloat(getFieldValue("totalAmount")) || 0;

                    // Only validate the sum if both cash and online are filled
                    if (value && getFieldValue("onlineAmount")) {
                      if (cash + online !== total) {
                        return Promise.reject(
                          new Error("Cash + Online must equal Total Amount")
                        );
                      }
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input type="number" min={0} step="0.01" />
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

        <Modal
          title="Add Payment for FOOD Ordered Items"
          open={isFoodPaymentModalOpen}
          onCancel={() => {
            setIsFoodPaymentModalOpen(false);
            foodPaymentForm.resetFields();
            setFoodTableId(null);
          }}
          footer={null}
        >
          <Form
            form={foodPaymentForm}
            onFinish={handleFoodPaymentSubmit}
            layout="vertical" // Added for better spacing
          >
            <Form.Item label="Ordered Items">
              <Input value={aggregateItems(dropdownItems)} disabled />
            </Form.Item>
            <Form.Item name="totalPayment" label="Payment Amount (Rs)">
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="onlineAmount"
              label="Online Amount (Rs)"
              rules={[
                { required: true, message: "Please enter online amount" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const online = parseFloat(value) || 0; // Convert to number, default to 0 if invalid
                    if (online < 0) {
                      return Promise.reject(
                        new Error("Online amount cannot be negative")
                      );
                    }
                    const cash = parseFloat(getFieldValue("cashAmount")) || 0;
                    const total =
                      parseFloat(getFieldValue("totalPayment")) || 0;

                    // Only validate the sum if both cash and online are filled
                    if (value && getFieldValue("cashAmount")) {
                      if (cash + online !== total) {
                        return Promise.reject(
                          new Error("Cash + Online must equal Total Amount")
                        );
                      }
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input type="number" min={0} step="0.01" />
            </Form.Item>
            <Form.Item
              name="cashAmount"
              label="Cash Amount (Rs)"
              rules={[
                { required: true, message: "Please enter cash amount" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const cash = parseFloat(value) || 0; // Convert to number, default to 0 if invalid
                    if (cash < 0) {
                      return Promise.reject(
                        new Error("Cash amount cannot be negative")
                      );
                    }
                    const online =
                      parseFloat(getFieldValue("onlineAmount")) || 0;
                    const total =
                      parseFloat(getFieldValue("totalPayment")) || 0;

                    // Only validate the sum if both cash and online are filled
                    if (value && getFieldValue("onlineAmount")) {
                      if (cash + online !== total) {
                        return Promise.reject(
                          new Error("Cash + Online must equal Total Amount")
                        );
                      }
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <Input type="number" min={0} step="0.01" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Save Payment
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
                      <Button type="primary" htmlType="submit">
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

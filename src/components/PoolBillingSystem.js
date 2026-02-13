import {
  Button,
  Dropdown,
  Form,
  Input,
  Menu,
  Modal,
  Table,
  Select,
  message,
  Typography,
} from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import "antd/dist/reset.css";
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
  limit,
  orderBy,
  deleteDoc,
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

const { Title, Text } = Typography;
const POOL_RATE_PER_MIN = 2.5;
const TURF_RATE_PER_HOUR = 1200;

const LOCATIONS = {
  OLD_HOUSE: "Old House Of Pool",
  NEW_HOUSE: "New House Of Pool",
};

const OLD_HOUSE_CONFIG = {
  tables: Array.from({ length: 15 }, (_, i) => `Table ${i + 1}`),
  ps: Array.from({ length: 8 }, (_, i) => `Controller ${i + 1}`),
  tt: ["Table Tennis 1", "Table Tennis 2"],
  turf: ["Turf"],
  turfAdvance: ["Turf Advance"], // Make sure this matches what you use in the code
};

const OLD_HOUSE_POOL_RATES = {
  "Table 1": 300,
  "Table 5": 300,
  "Table 2": 240,
  "Table 3": 240,
  "Table 4": 240,
  "Table 6": 240,
  "Table 13": 180,
  "Table 14": 180,
  "Table 7": 240,
  "Table 8": 180,
  "Table 9": 180,
  "Table 10": 180,
  "Table 11": 180,
  "Table 12": 180,
  "Table 15": 240,
  "Table Tennis 1": 200,
  "Table Tennis 2": 200,
};

const NEW_HOUSE_POOL_RATES = {
  "Table 1": 180,
  "Table 2": 180,
  "Table 3": 180,
  "Table 4": 180,
  "Table 5": 180,
  "Table 6": 180, // Small
  "Table 7": 240, // Medium
  "Table 8": 180, // Small
  "Table 9": 240, // Medium
};

const getTableSize = (table) => {
  const price = OLD_HOUSE_POOL_RATES[table] || 0;
  if (price === 180) return "Small";
  if (price === 240) return "Medium";
  if (price === 300) return "Large";
  return ""; // Default if price isn’t matched (shouldn’t happen with your data)
};

const NEW_HOUSE_CONFIG = {
  tables: Array.from({ length: 9 }, (_, i) => `Table ${i + 1}`),
  ps: Array.from({ length: 8 }, (_, i) => `Controller ${i + 1}`),
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
  const [formErrors, setFormErrors] = useState([]);
  const [editFormErrors, setEditFormErrors] = useState([]);
  const [isViewFoodItemsModalOpen, setIsViewFoodItemsModalOpen] =
    useState(false);
  const [viewFoodItems, setViewFoodItems] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [isActionAuthenticated, setIsActionAuthenticated] = useState(false);
  const [monthlyTableCount, setMonthlyTableCount] = useState(0);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [tableIdToDelete, setTableIdToDelete] = useState(null);

  const fetchMonthlyTableCountUpToYesterday = async (date) => {
    if (!isAuthenticated || !selectedLocation) return 0;

    const startOfMonth = moment(date).startOf("month").format("YYYY-MM-DD");
    const previousDay = moment(date).subtract(1, "day").endOf("day").toDate();
    const tablesCollection = collection(db, "tables");
    const q = query(
      tablesCollection,
      where("location", "==", selectedLocation),
      where("startTime", ">=", new Date(`${startOfMonth}T00:00:00Z`)),
      where("startTime", "<=", previousDay),
      orderBy("startTime")
    );

    try {
      const querySnapshot = await getDocs(q);
      let totalTablesUpToYesterday = 0;
      querySnapshot.forEach((doc) => {
        const tableData = doc.data().data || [];
        totalTablesUpToYesterday += tableData.filter(
          (t) => t.name !== "FOOD" // Exclude FOOD row from counting
        ).length;
      });
      return totalTablesUpToYesterday;
    } catch (error) {
      console.error("Error fetching table count up to yesterday:", error);
      return 0;
    }
  };

  // Update useEffect to fetch monthly table count up to yesterday
  useEffect(() => {
    const fetchCount = async () => {
      const count = await fetchMonthlyTableCountUpToYesterday(selectedDate);
      setMonthlyTableCount(count);
    };
    fetchCount();
  }, [selectedDate, selectedLocation, isAuthenticated]);

  const handleViewFoodItems = (record) => {
    setViewFoodItems(record.orderedItems || []);
    setIsViewFoodItemsModalOpen(true);
  };

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

  const removeTurfReservation = async (reservationId) => {
    if (!isAuthenticated) return;
    try {
      // Use deleteDoc for hard delete instead of soft delete
      await deleteDoc(doc(db, "turfReservations", reservationId));
      console.log(`Reservation ${reservationId} deleted successfully`);
      await fetchTurfReservations(); // Refresh the reservations list
    } catch (error) {
      console.error("Error removing turf reservation:", error);
      alert("Failed to remove reservation: " + error.message);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        const docRef = doc(db, "Users", user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUserRole(userData.role || "unknown");
            setIsActionAuthenticated(userData.role === "admin"); // Admin has full access by default
            if (userData.role === "restricted" && userData.location) {
              setSelectedLocation(userData.location); // Pre-set location for restricted users
            }
          } else {
            // Default user setup if no Firestore doc exists
            const email = user.email;
            if (email === "hop@gmail.com") {
              setUserRole("admin");
              setIsActionAuthenticated(true); // Admin has full access
            } else if (
              email === "oldhop@gmail.com" ||
              email === "newhop@gmail.com"
            ) {
              setUserRole("restricted");
              setIsActionAuthenticated(false); // Restricted users need to authenticate
              setSelectedLocation(
                email === "oldhop@gmail.com"
                  ? "Old House Of Pool"
                  : "New House Of Pool"
              );
            } else {
              setUserRole("unknown");
              setIsActionAuthenticated(false);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error.message);
          setUserRole("unknown");
          setIsActionAuthenticated(false);
        }
      } else {
        setUserRole(null);
        setIsActionAuthenticated(false);
        console.log(
          "User signed out. Firestore operations will be restricted."
        );
      }
    });
    return () => unsubscribe();
  }, [setSelectedLocation]);

  useEffect(() => {
    let unsubscribe = () => { };
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
    const formattedTables = tables.map((table) => {
      const formattedTable = {
        ...table,
        startTime: table.startTime
          ? new Date(table.startTime).toISOString()
          : null,
        endTime: table.endTime ? new Date(table.endTime).toISOString() : null,
        location: location || selectedLocation,
        orderedItems: table.orderedItems || [],
        cashAmount: table.cashAmount || 0,
        onlineAmount: table.onlineAmount || 0,
        totalAmount: table.totalAmount || 0,
        advancePayment: table.advancePayment || 0,
        isClosed: table.isClosed || false,
      };
      // Log each table to check for undefined values
      console.log("Formatted Table:", formattedTable);
      return formattedTable;
    });
    console.log("Saving tables for", `${location}_${date}`, formattedTables);
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
      return () => { };
    }
    if (!location) {
      console.error("Location is undefined in getTablesByDate");
      callback([]);
      return () => { };
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
        ? `${hours} hr${minutes > 0 ? ` ${minutes} min` : ""}`
        : `${minutes} min`;

    const totalItemCost = (table.orderedItems || []).reduce(
      (sum, item) => sum + ITEM_PRICES[item],
      0
    );
    let totalAmount = totalItemCost;

    if (table.gameType === "Turf Advance") {
      // For advance bookings, just return the advance amount
      return {
        totalAmount: (table.cashAdvance || 0) + (table.onlineAdvance || 0),
        duration: table.duration || 0,
        durationString: table.durationString || "—",
      };
    }

    if (table.gameType === "Turf") {
      const turfCost = Math.round((totalMinutes / 60) * TURF_RATE_PER_HOUR);
      const totalAdvance = (table.cashAdvance || 0) + (table.onlineAdvance || 0);
      totalAmount += turfCost - totalAdvance; // Subtract advance from total
    }
    else if (table.gameType === "Snooker Table") {
      if (table.location === LOCATIONS.OLD_HOUSE) {
        const hourlyRate = OLD_HOUSE_POOL_RATES[table.table] || 0;
        totalAmount += Math.round((totalMinutes / 60) * hourlyRate);
      } else {
        const hourlyRate = NEW_HOUSE_POOL_RATES[table.table] || 0;
        totalAmount += Math.round((totalMinutes / 60) * hourlyRate);
      }
    }
    else if (table.gameType === "Table Tennis") {
      const hourlyRate = OLD_HOUSE_POOL_RATES[table.table] || 0;
      totalAmount += Math.round((totalMinutes / 60) * hourlyRate);
    }
    else {
      totalAmount += Math.round(totalMinutes * POOL_RATE_PER_MIN);
    }

    return {
      totalAmount: Math.round(totalAmount),
      duration: totalMinutes,
      durationString,
    };
  };

  const handleStartTimeChange = (e) => {
    const newStartTime = e.target.value
      ? new Date(e.target.value)
      : editData.startTime || new Date();
    setEditData((prev) => {
      const { totalAmount, duration, durationString } = calculateTotalAmount(
        { ...prev, startTime: newStartTime },
        prev.endTime
      );
      editForm.setFieldsValue({ totalAmount });
      return {
        ...prev,
        startTime: newStartTime,
        totalAmount,
        duration,
        durationString,
      };
    });
  };

  const startTable = (values) => {
    if (!selectedTable) return;

    const now = moment(selectedDate || new Date()); // Use selectedDate if available, else today
    const [hours, minutes] = values.startTime.split(":");
    const startTime = now
      .clone()
      .set({
        hour: parseInt(hours),
        minute: parseInt(minutes),
        second: 0,
        millisecond: 0,
      })
      .toISOString();
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
    const cashAdvance = parseFloat(values.cashAdvance) || 0;
    const onlineAdvance = parseFloat(values.onlineAdvance) || 0;

    const reservation = {
      id: uuidv4(),
      table: "Turf Advance", // Changed to match OLD_HOUSE_CONFIG
      name: values.name,
      phone: values.phone,
      startTime: startTime.toDate(),
      endTime: endTime.toDate(),
      cashAdvance,
      onlineAdvance,
      gameType: "Turf Advance", // New game type for advance bookings
      isClosed: true, // Mark as closed since it's just an advance
      location: selectedLocation,
      orderedItems: [], // No items for advance
      totalAmount: cashAdvance + onlineAdvance, // Total advance amount
      cashAmount: cashAdvance,
      onlineAmount: onlineAdvance,
      duration: endTime.diff(startTime, 'minutes'),
      durationString: `${endTime.diff(startTime, 'hours')} hr ${endTime.diff(startTime, 'minutes') % 60} min`,
      paymentOption: "Paid",
    };

    // Add to active tables
    setActiveTables((prevTables) => {
      const updatedTables = [...prevTables, reservation];
      saveTables(selectedDate, updatedTables, selectedLocation);
      return updatedTables;
    });

    // Also save to turf reservations collection
    await saveTurfReservation({
      ...reservation,
      isActive: false // Not active until started
    });

    setIsModalOpen(false);
    form.resetFields();
  };

  const stopTable = (id) => {
    const tableToEdit = activeTables.find((t) => t.id === id);
    if (!tableToEdit) return;

    const endTime = new Date();
    const { totalAmount, duration, durationString } = calculateTotalAmount(
      tableToEdit,
      endTime
    );

    setActiveTables((prevTables) => {
      const updatedTables = prevTables.map((t) =>
        t.id === id
          ? {
            ...t,
            endTime,
            totalAmount,
            duration,
            durationString,
          }
          : t
      );
      saveTables(selectedDate, updatedTables, selectedLocation);
      return updatedTables;
    });

    setActiveTables((prevTables) => {
      const updatedTable = prevTables.find((t) => t.id === id);
      setEditData({
        ...updatedTable,
      });
      setSelectedPaymentOption(updatedTable.paymentOption || "Paid");
      setIsEditModalOpen(true);

      const formattedEndTime = moment(updatedTable.endTime).format(
        "YYYY-MM-DDTHH:mm"
      );
      editForm.setFieldsValue({
        name: updatedTable.name,
        phone: updatedTable.phone,
        startTime: moment(updatedTable.startTime).format("YYYY-MM-DDTHH:mm"),
        endTime: formattedEndTime,
        totalAmount: updatedTable.totalAmount,
        advancePayment: updatedTable.advancePayment || 0,
        cashAmount: Math.round(updatedTable.cashAmount || 0), // Round to integer
        onlineAmount: Math.round(updatedTable.onlineAmount || 0), // Round to integer
      });

      return prevTables;
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

        const newStartTime = values.startTime
          ? new Date(values.startTime)
          : t.startTime || new Date();
        const newEndTime = values.endTime
          ? new Date(values.endTime)
          : t.endTime || new Date();
        const updatedOrderedItems = editData.orderedItems || t.orderedItems;

        // For turf, we calculate based on duration
        const { totalAmount, duration, durationString } = t.gameType === "Turf"
          ? calculateTotalAmount(
            { ...t, startTime: newStartTime },
            newEndTime
          )
          : calculateTotalAmount(
            { ...t, orderedItems: updatedOrderedItems, startTime: newStartTime },
            newEndTime
          );

        const cashAmount = Math.round(parseFloat(values.cashAmount) || 0);
        const onlineAmount = Math.round(parseFloat(values.onlineAmount) || 0);
        const cashAdvance = t.cashAdvance || 0;
        const onlineAdvance = t.onlineAdvance || 0;
        let updatedDues = 0;

        if (selectedPaymentOption !== "Paid") {
          const selectedCustomer = regularCustomers.find(
            (c) => c.name === selectedPaymentOption
          );
          if (selectedCustomer) {
            updatedDues =
              totalAmount -
              (cashAdvance + onlineAdvance) -
              (cashAmount + onlineAmount);
            if (updatedDues > 0)
              updateCustomerDues(selectedCustomer.id, updatedDues);
          }
        }

        return {
          ...t,
          name: values.name || t.name,
          phone: values.phone || t.phone,
          startTime: newStartTime,
          endTime: newEndTime,
          duration,
          durationString,
          orderedItems: updatedOrderedItems,
          totalAmount,
          cashAmount,
          onlineAmount,
          cashAdvance,
          onlineAdvance,
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
      cashAmount: Math.round(record.cashAmount || 0), // Round to integer
      onlineAmount: Math.round(record.onlineAmount || 0), // Round to integer
      advancePayment: record.advancePayment || 0,
    });
  };

  const deleteTable = async (id) => {
    console.log("Preparing to delete Table with ID:", id);
    setTableIdToDelete(id);
    setShowDeleteConfirmModal(true); // Show confirmation modal instead of deleting immediately
  };

  // New confirmDelete function
  const confirmDelete = async () => {
    if (!isAuthenticated) {
      console.warn("Cannot delete table: User not authenticated");
      return;
    }

    try {
      setActiveTables((prevTables) => {
        console.log("Before Delete:", prevTables);
        const updatedTables = prevTables.filter(
          (t) => t.id !== tableIdToDelete
        );
        console.log("After Delete:", updatedTables);
        saveTables(selectedDate, updatedTables, selectedLocation);
        return updatedTables;
      });
    } catch (error) {
      console.error("Error deleting table from Firestore:", error);
      alert("Failed to delete table. Please try again.");
    } finally {
      setShowDeleteConfirmModal(false);
      setTableIdToDelete(null);
    }
  };

  // New cancelDelete function
  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setTableIdToDelete(null);
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
    if (!userRole) {
      alert("Please log in to perform this action.");
      return;
    }

    if (userRole === "admin" || isActionAuthenticated) {
      if (action === "edit") {
        const record = activeTables.find((t) => t.id === id);
        if (record) handleEdit(record);
      } else if (action === "delete") {
        deleteTable(id); // This now triggers the confirmation modal
      }
    } else if (userRole === "restricted") {
      setDropdownAction(action);
      setDropdownRecordId(id);
      setIsDropdownOpen(true);
    } else {
      alert("You do not have permission to perform this action.");
    }
  };

  const handleLoginSubmit = async (values) => {
    try {
      const { password } = values;
      const user = auth.currentUser;

      if (!user) {
        alert("No user is logged in.");
        return;
      }

      const docRef = doc(db, "Users", user.uid);
      const docSnap = await getDoc(docRef);
      let adminPassword = "defaultAdminPassword";

      if (docSnap.exists() && docSnap.data().adminPassword) {
        adminPassword = docSnap.data().adminPassword;
      } else {
        console.error("Admin password not found !");
      }

      if (password === adminPassword) {
        // Only perform the current action, don't set isActionAuthenticated to true
        if (dropdownAction === "edit") {
          const record = activeTables.find((t) => t.id === dropdownRecordId);
          if (record) handleEdit(record);
        } else if (dropdownAction === "delete") {
          await deleteTable(dropdownRecordId);
        }
        setIsDropdownOpen(false);
        loginForm.resetFields();
      } else {
        alert("Invalid admin password. Please try again.");
      }
    } catch (error) {
      console.error("Error during admin login:", error);
      alert("An error occurred. Please try again.");
    }
  };

  useEffect(() => {
    let unsubscribe = () => { };
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
      // 1. "FOOD" row always comes first
      if (a.name === "FOOD") return -1;
      if (b.name === "FOOD") return 1;

      // 2. Turf Advance reservations come next (before regular Turf)
      const isATurfAdvance = a.gameType === "Turf Advance";
      const isBTurfAdvance = b.gameType === "Turf Advance";

      if (isATurfAdvance && !isBTurfAdvance) return -1;
      if (!isATurfAdvance && isBTurfAdvance) return 1;

      // 3. Regular Turf tables come after Turf Advance
      const isATurf = a.gameType === "Turf";
      const isBTurf = b.gameType === "Turf";

      if (isATurf && !isBTurf) return -1; // Turf comes before non-turf
      if (!isATurf && isBTurf) return 1; // Non-turf comes after turf

      // 4. If both are turf (either advance or regular) or both are not turf, 
      // sort by active/closed status
      if ((isATurf || isATurfAdvance) && (isBTurf || isBTurfAdvance)) {
        // Both are turf-related, maintain order based on isClosed
        if (!a.isClosed && b.isClosed) return -1; // Active turf before closed turf
        if (a.isClosed && !b.isClosed) return 1; // Closed turf after active turf
        return 0; // If both are active or both are closed, maintain original order
      }

      // 5. For non-turf tables, sort by active/closed status
      if (!a.isClosed && b.isClosed) return -1; // Active tables before closed
      return 0; // Maintain original order if both are active or both are closed
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

  const calculateEditDuration = (startTime, currentEndTime) => {
    if (!startTime) return "—";

    const start = new Date(startTime);
    const effectiveEndTime = currentEndTime
      ? new Date(currentEndTime)
      : new Date(); // Use current time if no endTime is set
    const totalMinutes = Math.max(
      Math.round((effectiveEndTime - start) / 60000),
      0
    );
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return hours > 0
      ? `${hours} hr${minutes > 0 ? ` ${minutes} min` : ""}`
      : `${minutes} min`;
  };

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
    "Table 7",
  ];
  const oldHouseRow2 = [
    "Table 8",
    "Table 9",
    "Table 10",
    "Table 11",
    "Table 12",
    "Table 13",
    "Table 14",
    "Table 15",
  ];

  const ps5Row1 = [
    "Controller 1",
    "Controller 2",
    "Controller 3",
    "Controller 4",
  ]

  const ps5Row2 = [
    "Controller 5",
    "Controller 6",
    "Controller 7",
    "Controller 8",
  ]

  const reservationColumns = [
    { title: "Customer Name", dataIndex: "name", key: "name" },
    {
      title: "Time",
      key: "timeRange",
      render: (_, record) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {moment(record.startTime).format("DD-MMM-YYYY hh:mm A")} -{" "}
          {moment(record.endTime).format("DD-MMM-YYYY hh:mm A")}
        </span>
      ),
      align: "center",
    },
    {
      title: "Advance Payment (Rs)",
      dataIndex: "advancePayment",
      key: "advancePayment",
      render: (_, record) => (
        <span>{(record.cashAdvance || 0) + (record.onlineAdvance || 0)}</span>
      ), // Combine cash and online advance for display
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button type="link" onClick={() => editTurfReservation(record)}>
            Edit
          </Button>
          <Button
            type="link"
            danger
            onClick={() => removeTurfReservation(record.id)}
          >
            Remove
          </Button>
          <Button
            type="link"
            onClick={() => startTurfFromReservation(record)}
            disabled={record.isActive} // Disable if already active
          >
            Start Turf
          </Button>
        </div>
      ),
    },
  ];

  const startTurfFromReservation = async (reservation) => {
    // Calculate turf duration and cost
    const startTime = moment(reservation.startTime);
    const endTime = moment(reservation.endTime);
    const durationHours = endTime.diff(startTime, 'hours', true);
    const turfCost = Math.round(durationHours * TURF_RATE_PER_HOUR);

    // Calculate remaining amount after advance
    const totalAdvance = (reservation.cashAdvance || 0) + (reservation.onlineAdvance || 0);
    const remainingAmount = Math.max(0, turfCost - totalAdvance);

    const activeTable = {
      id: reservation.id,
      table: "Turf", // Regular turf table when started
      name: reservation.name,
      phone: reservation.phone,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      gameType: "Turf",
      cashAdvance: reservation.cashAdvance || 0, // Track advance separately
      onlineAdvance: reservation.onlineAdvance || 0, // Track advance separately
      isClosed: false,
      location: reservation.location,
      isActive: true,
      orderedItems: [], // No items initially
      totalAmount: turfCost,
      cashAmount: 0, // Main cash payment starts at 0
      onlineAmount: 0, // Main online payment starts at 0
      duration: endTime.diff(startTime, 'minutes'),
      durationString: `${Math.floor(durationHours)} hr ${Math.round((durationHours % 1) * 60)} min`,
      paymentOption: "Paid",
      remainingAmount: remainingAmount,
    };

    try {
      setActiveTables((prevTables) => {
        // Remove any existing table with same ID (if any)
        const filteredTables = prevTables.filter(t => t.id !== reservation.id);
        const updatedTables = [...filteredTables, activeTable];
        saveTables(selectedDate, updatedTables, selectedLocation);
        return updatedTables;
      });

      // Remove the reservation
      await deleteDoc(doc(db, "turfReservations", reservation.id));
      setTurfReservations(prev => prev.filter(res => res.id !== reservation.id));

      message.success(`Turf started successfully! ${remainingAmount > 0 ?
        `Remaining amount to pay: Rs ${remainingAmount}` :
        'Full amount paid in advance'}`);
    } catch (error) {
      console.error("Error starting turf from reservation:", error);
      message.error("Failed to start turf. Please try again.");
    }
  };

  useEffect(() => {
    if (isModalOpen && selectedTable !== "Turf" && !isEditingTurf) {
      form.setFieldsValue({
        startTime: moment().format("HH:mm"), // Set to current time
      });
    }
  }, [isModalOpen, selectedTable, form]);

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
                  Regular Customer
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
                          const activeTable = sortedTables.find(
                            (t) => t.table === table && !t.isClosed
                          );
                          if (activeTable) {
                            handleEdit(activeTable); // Open edit modal for active table
                          } else {
                            setSelectedTable(table);
                            setIsModalOpen(true); // Open start modal for inactive table
                          }
                        }}
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
                          fontSize: "14px",
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
                          const activeTable = sortedTables.find(
                            (t) => t.table === table && !t.isClosed
                          );
                          if (activeTable) {
                            handleEdit(activeTable); // Open edit modal for active table
                          } else {
                            setSelectedTable(table);
                            setIsModalOpen(true); // Open start modal for inactive table
                          }
                        }}
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
                          fontSize: "14px",
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
                          const activeTable = sortedTables.find(
                            (t) => t.table === controller && !t.isClosed
                          );
                          if (activeTable) {
                            handleEdit(activeTable); // Open edit modal for active table
                          } else {
                            setSelectedTable(controller);
                            setIsModalOpen(true); // Open start modal for inactive table
                          }
                        }}
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
                              bottom: "210px",
                              position: "relative",
                              right: "50px",
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
                              const activeTable = sortedTables.find(
                                (t) => t.table === tableTennis && !t.isClosed
                              );
                              if (activeTable) {
                                handleEdit(activeTable); // Open edit modal for active table
                              } else {
                                setSelectedTable(tableTennis);
                                setIsModalOpen(true); // Open start modal for inactive table
                              }
                            }}
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
                              height: "200px",
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
                              bottom: "40px",
                              color: "white",
                            }}
                          >
                            {activeTables.some(
                              (t) => t.table === ground && !t.isClosed
                            )
                              ? "In Use"
                              : "Reserve Turf"}
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
                                  bottom: "200px",
                                  left: "150px",
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

                {/* Ground Floor Section */}
                <h1
                  style={{
                    margin: "0",
                    display: "flex",
                    justifyContent: "center",
                  }}
                  className="flex text-4xl font-bold relative top-7"
                >
                  1st Floor
                </h1>
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginBottom: "40px"
                  }}
                >
                  {config.tables.slice(0, 5).map((table) => (
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
                          const activeTable = sortedTables.find(
                            (t) => t.table === table && !t.isClosed
                          );
                          if (activeTable) {
                            handleEdit(activeTable);
                          } else {
                            setSelectedTable(table);
                            setIsModalOpen(true);
                          }
                        }}
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

                {/* New Floor Section */}
                <h1
                  style={{
                    margin: "0",
                    display: "flex",
                    justifyContent: "center",
                  }}
                  className="flex text-4xl font-bold relative top-7"
                >
                  2nd Floor
                </h1>
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginBottom: "40px"
                  }}
                >
                  {config.tables.slice(5, 9).map((table) => (
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
                          const activeTable = sortedTables.find(
                            (t) => t.table === table && !t.isClosed
                          );
                          if (activeTable) {
                            handleEdit(activeTable);
                          } else {
                            setSelectedTable(table);
                            setIsModalOpen(true);
                          }
                        }}
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
                      {/* Show size clearly for these new tables */}
                      <p
                        style={{
                          position: "relative",
                          bottom: "70px",
                          fontSize: "14px",
                          color: "#666",
                          margin: 0,
                        }}
                      >
                        {NEW_HOUSE_POOL_RATES[table] === 180 ? "Small" : "Medium"}
                      </p>

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

                {/* Play Station Section - Header removed to group with New Floor */}
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    justifyContent: "flex-start", // Start from left
                    flexWrap: "nowrap", // Ensure single line
                    overflowX: "auto", // Allow scrolling if needed
                    paddingBottom: "10px", // Add padding for scrollbar
                    width: "100%", // Full width
                    paddingLeft: "20px",
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
                          const activeTable = sortedTables.find(
                            (t) => t.table === controller && !t.isClosed
                          );
                          if (activeTable) {
                            handleEdit(activeTable);
                          } else {
                            setSelectedTable(controller);
                            setIsModalOpen(true);
                          }
                        }}
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
                              bottom: "210px",
                              position: "relative",
                              right: "50px",
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
              title: "S.No.",
              key: "serialNumber",
              render: (_, record) => {
                // Exclude "FOOD" row from serial numbering
                if (record.name === "FOOD") return "-";

                // Filter and sort tables for the current day (excluding "FOOD")
                const todaysTables = sortedTables
                  .filter(
                    (t) =>
                      t.name !== "FOOD" &&
                      moment(t.startTime).isSame(moment(selectedDate), "day")
                  )
                  .sort(
                    (a, b) => new Date(a.startTime) - new Date(b.startTime)
                  );

                // Find the index of the current record in today's tables
                const tableIndex = todaysTables.indexOf(record);

                // If not in today's tables, return "-"
                if (tableIndex === -1) return "-";

                // Serial number = total up to yesterday + today's index (starting from 1)
                return monthlyTableCount + tableIndex + 1;
              },
              align: "center",
            },
            {
              title: "Table No.",
              dataIndex: "table",
              key: "table",
              render: (table) => (
                <span style={{ whiteSpace: "nowrap" }}>{table}</span>
              ),
              align: "center",
            },
            {
              title: "Size",
              key: "size",
              render: (_, record) => {
                let tableSize = "";
                if (record.location === LOCATIONS.OLD_HOUSE) {
                  tableSize = getTableSize(record.table);
                } else if (record.location === LOCATIONS.NEW_HOUSE) {
                  const price = NEW_HOUSE_POOL_RATES[record.table];
                  if (price === 180) tableSize = "Small";
                  else if (price === 240) tableSize = "Medium";
                }
                return tableSize || "-";
              },
              align: "center",
            },
            {
              title: "Name",
              dataIndex: "name",
              key: "name",
              render: (name) => (
                <span style={{ whiteSpace: "nowrap" }}>{name}</span>
              ),
              align: "center",
            },
            {
              title: "Mobile Number",
              dataIndex: "phone",
              key: "phone",
              render: (phone) => (
                <span style={{ whiteSpace: "nowrap" }}>{phone}</span>
              ),
              align: "center",
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
              align: "center",
            },
            {
              title: "End Time",
              dataIndex: "endTime",
              key: "endTime",
              render: (t, record) => (
                <span style={{ whiteSpace: "nowrap" }}>
                  {record.isClosed && t ? moment(t).format("hh:mm A") : "—"}
                </span>
              ),
              align: "center",
            },
            {
              title: "Duration",
              dataIndex: "durationString",
              key: "duration",
              render: (d, record) => (
                <span style={{ whiteSpace: "nowrap" }}>
                  {record.isClosed && d ? d : "—"}
                </span>
              ),
              align: "center",
            },
            {
              title: "Ordered Items",
              dataIndex: "orderedItems",
              key: "orderedItems",
              render: (items, record) =>
                record.name === "FOOD"
                  ? "—"
                  : items?.length
                    ? aggregateItems(items)
                    : "—",
              align: "center",
            },
            {
              title: "Cash (Rs)",
              dataIndex: "cashAmount",
              key: "cashAmount",
              render: (cashAmount, record) => {
                const totalCash =
                  record.gameType === "Turf"
                    ? Math.round((cashAmount || 0))
                    : Math.round(cashAmount || 0);
                return totalCash;
              },
              align: "center",
            },
            {
              title: "Online (Rs)",
              dataIndex: "onlineAmount",
              key: "onlineAmount",
              render: (onlineAmount, record) => {
                const totalOnline =
                  record.gameType === "Turf"
                    ? Math.round(
                      (onlineAmount || 0))
                    : Math.round(onlineAmount || 0);
                return totalOnline;
              },
              align: "center",
            },
            {
              title: "Total Amount (Rs)",
              dataIndex: "totalAmount",
              key: "totalAmount",
              render: (a, record) => {
                if (!record.isClosed) return "—";

                if (record.gameType === "Turf") {
                  // For Turf, we need to calculate the final amount including items and advance
                  const turfCost = Math.round((record.duration / 60) * TURF_RATE_PER_HOUR);
                  const itemCost = (record.orderedItems || []).reduce(
                    (sum, item) => sum + ITEM_PRICES[item],
                    0
                  );
                  const totalAdvance = (record.cashAdvance || 0) + (record.onlineAdvance || 0);
                  const finalAmount = turfCost + itemCost - totalAdvance;
                  return Math.max(0, finalAmount); // Ensure it's not negative
                }

                return Math.round(a);
              },
              align: "center",
            }, ,
            {
              title: "Actions",
              key: "actions",
              align: "center",
              render: (_, record) =>
                record.name === "FOOD" ? (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
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
                          setDropdownItems([]);
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
                    <Button
                      type="default"
                      onClick={() => handleViewFoodItems(record)}
                    >
                      View
                    </Button>
                  </div>
                ) : record.isClosed ? (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Button
                      type="default"
                      onClick={() => showDropdown("edit", record.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => showDropdown("delete", record.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
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
                      <Button type="default" >Add</Button>
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
            initialValues={{}}
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
                  <Input type="datetime-local" />
                </Form.Item>
                <Form.Item
                  name="endTime"
                  label="End Time"
                  rules={[
                    { required: true, message: "Please select end time" },
                  ]}
                >
                  <Input type="datetime-local" />
                </Form.Item>
                <Form.Item
                  name="cashAdvance"
                  label="Cash Advance (Rs)"
                  rules={[
                    { required: true, message: "Please enter cash advance" },
                  ]}
                >
                  <Input type="number" min={0} step="1" />
                </Form.Item>
                <Form.Item
                  name="onlineAdvance"
                  label="Online Advance (Rs)"
                  rules={[
                    { required: true, message: "Please enter online advance" },
                  ]}
                >
                  <Input type="number" min={0} step="1" />
                </Form.Item>
                <Table
                  dataSource={turfReservations.filter((res) => !res.isActive)}
                  columns={reservationColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  style={{ marginBottom: 16, width: "100%" }} // Ensure table takes full width
                  scroll={{ x: 500 }} // Horizontal scroll if content overflows (match modal width)
                />
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    {isEditingTurf ? "Save Changes" : "Reserve Turf"}
                  </Button>
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  name="startTime"
                  label="Start Time"
                  rules={[
                    { required: true, message: "Please select start time" },
                  ]}
                >
                  <Input type="time" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    Start
                  </Button>
                </Form.Item>
              </>
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
          onCancel={() => {
            setIsEditModalOpen(false);
            editForm.resetFields();
            setEditFormErrors([]);
          }}
          footer={null}
        >
          {/* Error Display */}
          {editFormErrors.length > 0 && (
            <div
              style={
                {
                  /* existing styles */
                }
              }
            >
              {editFormErrors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          )}

          <Form
            form={editForm}
            onFinish={(values) => {
              const cash = Math.round(parseFloat(values.cashAmount) || 0);
              const online = Math.round(parseFloat(values.onlineAmount) || 0);

              // Calculate amounts based on game type
              let totalAmount, amountPending;
              if (editData?.gameType === "Turf") {
                const turfCost = Math.round((editData.duration / 60) * TURF_RATE_PER_HOUR);
                const itemsCost = (editData.orderedItems || []).reduce(
                  (sum, item) => sum + ITEM_PRICES[item],
                  0
                );
                const totalAdvance = (editData.cashAdvance || 0) + (editData.onlineAdvance || 0);
                totalAmount = turfCost + itemsCost;
                amountPending = Math.max(0, totalAmount - totalAdvance); // Ensure not negative
              } else {
                totalAmount = Math.round(parseFloat(values.totalAmount) || 0);
                amountPending = totalAmount;
              }

              setEditFormErrors([]);
              const errors = [];

              // Validation rules
              if (editData?.gameType === "Turf") {
                if (cash + online !== amountPending) {
                  errors.push(`Cash + Online (${cash + online}) must equal Amount Pending (${amountPending})`);
                }
              } else {
                if (totalAmount > 0 && cash === 0 && online === 0) {
                  errors.push("Cash or Online must be greater than 0");
                }
              }

              if (cash + online > totalAmount) {
                errors.push("Cash + Online cannot exceed Total Amount");
              }
              if (cash < 0) errors.push("Cash amount cannot be negative");
              if (online < 0) errors.push("Online amount cannot be negative");

              if (errors.length > 0) {
                setEditFormErrors(errors);
                return;
              }

              updateTable({
                ...values,
                cashAmount: cash,
                onlineAmount: online,
                totalAmount: totalAmount,
              });
            }}
          >
            {/* Existing fields */}
            <Form.Item name="name" label="Customer Name">
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone Number">
              <Input />
            </Form.Item>
            <Form.Item name="startTime" label="Start Time">
              <Input type="datetime-local" onChange={handleStartTimeChange} />
            </Form.Item>
            <Form.Item name="endTime" label="Closing Time">
              <Input type="datetime-local" onChange={handleEndTimeChange} />
            </Form.Item>
            <Form.Item label="Duration">
              <Input
                value={calculateEditDuration(
                  editForm.getFieldValue("startTime"),
                  editData?.endTime
                )}
                disabled
              />
            </Form.Item>

            {/* Ordered Items */}
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

            {/* Turf-specific calculations */}
            {editData?.gameType === "Turf" && (
              <>
                <Form.Item label="Turf Cost (Rs)">
                  <Input
                    value={Math.round((editData.duration / 60) * TURF_RATE_PER_HOUR)}
                    disabled
                  />
                </Form.Item>
                <Form.Item label="Items Cost (Rs)">
                  <Input
                    value={(editData.orderedItems || []).reduce(
                      (sum, item) => sum + ITEM_PRICES[item],
                      0
                    )}
                    disabled
                  />
                </Form.Item>
                <Form.Item label="Total Advance (Rs)">
                  <Input
                    value={(editData.cashAdvance || 0) + (editData.onlineAdvance || 0)}
                    disabled
                  />
                </Form.Item>
                <Form.Item label="Gross Amount (Rs)">
                  <Input
                    value={
                      Math.round((editData.duration / 60) * TURF_RATE_PER_HOUR) +
                      (editData.orderedItems || []).reduce(
                        (sum, item) => sum + ITEM_PRICES[item],
                        0
                      )
                    }
                    disabled
                  />
                </Form.Item>
                <Form.Item label="Amount Pending (Rs)">
                  <Input
                    value={Math.max(0,
                      Math.round((editData.duration / 60) * TURF_RATE_PER_HOUR) +
                      (editData.orderedItems || []).reduce(
                        (sum, item) => sum + ITEM_PRICES[item],
                        0
                      ) -
                      ((editData.cashAdvance || 0) + (editData.onlineAdvance || 0))
                    )}
                    disabled
                  />
                </Form.Item>
              </>
            )}

            {/* Regular tables total amount */}
            {editData?.gameType !== "Turf" && (
              <Form.Item
                name="totalAmount"
                label="Total Amount (Rs)"
              >
                <Input disabled />
              </Form.Item>
            )}

            <Form.Item
              name="onlineAmount"
              label="Online Amount (Rs)"
              rules={[
                { required: true, message: "Please enter online amount" },
                {
                  pattern: /^[0-9]+$/,
                  message: "Online amount must be a whole number",
                },
              ]}
            >
              <Input type="number" min={0} step="1" />
            </Form.Item>
            <Form.Item
              name="cashAmount"
              label="Cash Amount (Rs)"
              rules={[
                { required: true, message: "Please enter cash amount" },
                {
                  pattern: /^[0-9]+$/,
                  message: "Cash amount must be a whole number",
                },
              ]}
            >
              <Input type="number" min={0} step="1" />
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
          title="Confirm Delete"
          open={showDeleteConfirmModal}
          onOk={confirmDelete}
          onCancel={cancelDelete}
          okText="Yes"
          okButtonProps={{ danger: true }}
          cancelText="No"
        >
          <p>
            Are you sure you want to delete this table? This action cannot be
            undone.
          </p>
        </Modal>

        <Modal
          title="Add Payment for FOOD Ordered Items"
          open={isFoodPaymentModalOpen}
          onCancel={() => {
            setIsFoodPaymentModalOpen(false);
            foodPaymentForm.resetFields();
            setFoodTableId(null);
            setFormErrors([]); // Reset errors on cancel
          }}
          footer={null}
        >
          {/* State to hold errors */}
          {(() => {
            return (
              <>
                {/* Error Display */}
                {formErrors.length > 0 && (
                  <div
                    style={{
                      backgroundColor: "#fff1f0",
                      border: "1px solid #ffa39e",
                      borderRadius: "4px",
                      padding: "10px",
                      marginBottom: "16px",
                      color: "#cf1322",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>⚠️</span>
                    <div>
                      {formErrors.map((error, index) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  </div>
                )}

                <Form
                  form={foodPaymentForm}
                  onFinish={(values) => {
                    const cash = parseFloat(values.cashAmount) || 0;
                    const online = parseFloat(values.onlineAmount) || 0;
                    const total = parseFloat(values.totalPayment) || 0;

                    // Reset errors before validation
                    setFormErrors([]);

                    // Validation after submission
                    const errors = [];
                    if (total > 0 && cash === 0 && online === 0) {
                      errors.push("Cash or Online must be greater than 0");
                    }
                    if (cash + online !== total) {
                      errors.push("Cash + Online must equal Total Amount");
                    }
                    if (cash < 0) {
                      errors.push("Cash amount cannot be negative");
                    }
                    if (online < 0) {
                      errors.push("Online amount cannot be negative");
                    }

                    // If there are errors, display them and stop submission
                    if (errors.length > 0) {
                      setFormErrors(errors);
                      return;
                    }

                    // If validation passes, proceed with submission
                    handleFoodPaymentSubmit(values);
                  }}
                  layout="vertical"
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
                    ]}
                  >
                    <Input type="number" min={0} step="1" />
                  </Form.Item>
                  <Form.Item
                    name="cashAmount"
                    label="Cash Amount (Rs)"
                    rules={[
                      { required: true, message: "Please enter cash amount" },
                    ]}
                  >
                    <Input type="number" min={0} step="1" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      Save Payment
                    </Button>
                  </Form.Item>
                </Form>
              </>
            );
          })()}
        </Modal>

        <Modal
          title={
            <div
              style={{
                background: "#001529",
                padding: "12px 16px",
                margin: "-16px -16px 16px -16px",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ShoppingCartOutlined
                style={{ fontSize: "22px", color: "#fff" }}
              />
              <Title
                level={4}
                style={{ color: "#fff", margin: 0, marginLeft: "12px" }}
              >
                FOOD Ordered Items
              </Title>
            </div>
          }
          open={isViewFoodItemsModalOpen}
          onCancel={() => setIsViewFoodItemsModalOpen(false)}
          footer={[
            <Button
              key="close"
              type="primary"
              style={{
                background: "#52c41a",
                borderColor: "#52c41a",
                borderRadius: "6px",
                padding: "6px 20px",
                fontWeight: "bold",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              }}
              onClick={() => setIsViewFoodItemsModalOpen(false)}
            >
              Close
            </Button>,
          ]}
          width={600} // Increased width to accommodate table
          bodyStyle={{
            padding: "20px",
            background: "#fff",
            borderRadius: "0 0 8px 8px",
            boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.05)",
          }}
        >
          {viewFoodItems.length > 0 ? (
            <div>
              {/* Table for food items */}
              <Table
                dataSource={Object.entries(
                  viewFoodItems.reduce((acc, item) => {
                    acc[item] = (acc[item] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([item, quantity], index) => ({
                  key: index,
                  itemName: item,
                  quantity: quantity,
                  price: ITEM_PRICES[item] || 0,
                  total: (ITEM_PRICES[item] || 0) * quantity,
                }))}
                columns={[
                  {
                    title: "Item Name",
                    dataIndex: "itemName",
                    key: "itemName",
                  },
                  {
                    title: "Sold Quantity",
                    dataIndex: "quantity",
                    key: "quantity",
                    align: "center",
                  },
                  {
                    title: "Price (Rs)",
                    dataIndex: "price",
                    key: "price",
                    align: "center",
                    render: (price) => price.toFixed(2),
                  },
                  {
                    title: "Total (Rs)",
                    dataIndex: "total",
                    key: "total",
                    align: "center",
                    render: (total) => total.toFixed(2),
                  },
                ]}
                pagination={false}
                size="small"
                style={{ marginBottom: "16px" }}
              />

              {/* Total amount display */}
              <div
                style={{
                  textAlign: "right",
                  padding: "12px",
                  background: "#f5f5f5",
                  borderRadius: "6px",
                  borderTop: "1px solid #e8e8e8",
                }}
              >
                <Text strong style={{ fontSize: "16px", color: "#1890ff" }}>
                  Total Amount: Rs{" "}
                  {viewFoodItems
                    .reduce((sum, item) => sum + (ITEM_PRICES[item] || 0), 0)
                    .toFixed(2)}
                </Text>
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                background: "#f5f5f5",
                borderRadius: "6px",
              }}
            >
              <Text type="secondary" style={{ fontSize: "16px" }}>
                No items ordered yet
              </Text>
            </div>
          )}
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
                    Enter Admin Password to{" "}
                    {dropdownAction === "edit" ? "Edit" : "Delete"}
                  </h3>
                </div>
                <div>
                  <Form
                    form={loginForm}
                    onFinish={handleLoginSubmit}
                    className="flex flex-col items-center justify-center"
                  >
                    <Form.Item
                      name="password"
                      label="Admin Password"
                      rules={[
                        {
                          required: true,
                          message: "Please enter the admin password",
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

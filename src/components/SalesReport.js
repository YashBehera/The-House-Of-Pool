import { MoneyCollectOutlined, SearchOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Spin,
  Statistic,
  Table,
  Typography,
} from "antd";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { auth } from "./firebase";
import moment from "moment";
import "./sales.css";
import React, { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import logo1 from "./HOP3.png";
import logo2 from "./HOP5.png";
import Navbar from "./Navbar";
import { getItemPrices } from "./PoolBillingSystem";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const SalesReport = ({
  activeTables,
  setActiveTables,
  selectedLocation,
  setSelectedLocation,
}) => {
  const [searchText, setSearchText] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    moment().format("YYYY-MM-DD")
  );
  const [reportType, setReportType] = useState("daily");
  const [dateRange, setDateRange] = useState([]);
  const [loading, setLoading] = useState(false);
  const [regularCustomers, setRegularCustomers] = useState([]);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [editCustomerData, setEditCustomerData] = useState(null);
  const [editCustomerForm] = Form.useForm();
  const [isShowTablesModalOpen, setIsShowTablesModalOpen] = useState(false);
  const [selectedCustomerTables, setSelectedCustomerTables] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm] = Form.useForm();
  const dropdownRef = useRef(null);
  const [dropdownActionCustomer, setDropdownActionCustomer] = useState(null);
  const [isPaymentHistoryModalOpen, setIsPaymentHistoryModalOpen] =
    useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [ITEM_PRICES, setITEM_PRICES] = useState({});
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [cashRevenue, setCashRevenue] = useState(0);
  const [onlineRevenue, setOnlineRevenue] = useState(0);
  const [balanceReceived, setBalanceReceived] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isEditExpenseModalOpen, setIsEditExpenseModalOpen] = useState(false);
  const [isDeleteExpenseModalOpen, setIsDeleteExpenseModalOpen] =
    useState(false);
  const [editExpenseRecord, setEditExpenseRecord] = useState(null);
  const [deleteExpenseRecord, setDeleteExpenseRecord] = useState(null);
  const [expenseForm] = Form.useForm();
  const [editExpenseForm] = Form.useForm();
  const [userRole, setUserRole] = useState(null);
  const [isActionAuthenticated, setIsActionAuthenticated] = useState(false);

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
    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const expensesCollection = collection(db, "expenses");
        const snapshot = await getDocs(expensesCollection);
        const fetchedExpenses = snapshot.docs
          .map((doc) => ({
            key: doc.id,
            ...doc.data(),
          }))
          .filter((expense) => expense.location === selectedLocation);
        setExpenses(fetchedExpenses);
      } catch (error) {
        console.error("Error fetching expenses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [selectedLocation]);

  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true); // Add loading state for prices
      const prices = await getItemPrices(selectedLocation);
      setITEM_PRICES(prices);
      setLoading(false);
    };
    fetchPrices();
  }, [selectedLocation]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "regularCustomers"),
      (snapshot) => {
        const customers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRegularCustomers(customers);
      },
      (error) => {
        console.error("Error fetching regular customers:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  const getTablesByDate = async (date, location) => {
    const docSnap = await getDoc(doc(db, "tables", `${location}_${date}`));
    if (!docSnap.exists()) return [];
    return docSnap.data().data.map((table) => ({
      ...table,
      startTime: table.startTime ? moment(table.startTime).toDate() : null,
      endTime: table.endTime ? moment(table.endTime).toDate() : null,
      cashAmount: table.cashAmount || 0,
      onlineAmount: table.onlineAmount || 0,
    }));
  };

  const saveTables = async (date, tables, location) => {
    const formattedTables = tables.map((table) => ({
      ...table,
      startTime: table.startTime
        ? new Date(table.startTime).toISOString()
        : null,
      endTime: table.endTime ? new Date(table.endTime).toISOString() : null,
      cashAmount: table.cashAmount || 0,
      onlineAmount: table.onlineAmount || 0,
    }));
    await setDoc(doc(db, "tables", `${location}_${date}`), {
      data: formattedTables,
    });
  };

  // Modify the fetchSalesData function
  const fetchSalesData = async () => {
    setLoading(true);
    try {
      let tables = [];
      let totalRevenue = 0;
      let cashRevenue = 0;
      let onlineRevenue = 0;
      let balanceReceived = 0;
      let salesByGameType = {};
      let salesByItems = {};

      if (reportType === "daily") {
        tables = (await getTablesByDate(selectedDate, selectedLocation)) || [];
        console.log("Fetched Tables:", tables);
        setActiveTables(tables);

        const reportDocRef = doc(
          db,
          "dailySalesReports",
          `${selectedLocation}_${selectedDate}`
        );

        // Fetch payments for the selected date and location
        const paymentsQuery = query(
          collection(db, "payments"),
          where("location", "==", selectedLocation),
          where("date", "==", selectedDate)
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        const payments = paymentsSnap.docs.map((doc) => doc.data());

        const paymentCashRevenue = payments.reduce(
          (sum, payment) => sum + (payment.cashAmount || 0),
          0
        );
        const paymentOnlineRevenue = payments.reduce(
          (sum, payment) => sum + (payment.onlineAmount || 0),
          0
        );
        const paymentTotalRevenue = payments.reduce(
          (sum, payment) => sum + (payment.totalAmount || 0),
          0
        );

        cashRevenue =
          tables.reduce(
            (sum, entry) => sum + (Number(entry.cashAmount) || 0),
            0
          ) + paymentCashRevenue;
        onlineRevenue =
          tables.reduce(
            (sum, entry) => sum + (Number(entry.onlineAmount) || 0),
            0
          ) + paymentOnlineRevenue;
        balanceReceived = paymentTotalRevenue;

        totalRevenue = cashRevenue + onlineRevenue;

        salesByGameType = tables.reduce((acc, entry) => {
          const { gameType, totalAmount, paymentOption, orderedItems } = entry;
          if (
            !gameType ||
            totalAmount === undefined ||
            gameType === "FOOD" ||
            !entry.isClosed ||
            paymentOption !== "Paid"
          )
            return acc;
          const itemCost = orderedItems.reduce(
            (sum, item) => sum + (ITEM_PRICES[item] || 0),
            0
          );
          const gameRevenue = Number(totalAmount) - itemCost;
          acc[gameType] =
            (acc[gameType] || 0) + (gameRevenue > 0 ? gameRevenue : 0);
          return acc;
        }, {});

        salesByItems = tables.reduce((acc, entry) => {
          entry.orderedItems.forEach((item) => {
            acc[item] = (acc[item] || 0) + 1;
          });
          return acc;
        }, {});

        const updatedReportData = {
          totalRevenue,
          cashRevenue,
          onlineRevenue,
          balanceReceived,
          salesByGameType,
          salesByItems,
          lastUpdated: new Date().toISOString(),
        };
        console.log("Saving to Firestore:", updatedReportData);
        await setDoc(reportDocRef, updatedReportData, { merge: true });

        setTotalRevenue(totalRevenue);
        setCashRevenue(cashRevenue);
        setOnlineRevenue(onlineRevenue);
        setBalanceReceived(balanceReceived);
        console.log("State Updated:", {
          totalRevenue,
          cashRevenue,
          onlineRevenue,
          balanceReceived,
        });
      } else if (reportType === "custom" && dateRange.length === 2) {
        const [start, end] = dateRange;
        const startDate = moment(start).startOf("day");
        const endDate = moment(end).endOf("day");
        const days = [];
        for (
          let day = startDate.clone();
          day.isSameOrBefore(endDate);
          day.add(1, "day")
        ) {
          days.push(day.format("YYYY-MM-DD"));
        }

        const dailyDataPromises = days.map(async (day) => {
          const dayTables = await getTablesByDate(day, selectedLocation);
          const reportDocRef = doc(
            db,
            "dailySalesReports",
            `${selectedLocation}_${day}`
          );
          const reportSnap = await getDoc(reportDocRef);
          let dayData = {
            totalRevenue: 0,
            cashRevenue: 0,
            onlineRevenue: 0,
            balanceReceived: 0,
            salesByGameType: {},
            salesByItems: {},
            tables: dayTables,
          };

          if (reportSnap.exists()) {
            const reportData = reportSnap.data();
            dayData.totalRevenue = reportData.totalRevenue || 0;
            dayData.cashRevenue = reportData.cashRevenue || 0;
            dayData.onlineRevenue = reportData.onlineRevenue || 0;
            dayData.balanceReceived = reportData.balanceReceived || 0;
            dayData.salesByGameType = reportData.salesByGameType || {};
            dayData.salesByItems = reportData.salesByItems || {};
          } else {
            const foodRow = dayTables.find((entry) => entry.name === "FOOD");

            const nonFoodTablesRevenue = dayTables.reduce((acc, entry) => {
              const { totalAmount, paymentOption, isClosed, gameType } = entry;
              if (
                !isClosed ||
                paymentOption !== "Paid" ||
                totalAmount === undefined ||
                gameType === "FOOD"
              )
                return acc;
              return acc + Number(totalAmount);
            }, 0);

            const foodItemsRevenue = foodRow
              ? foodRow.orderedItems.reduce(
                  (sum, item) => sum + (ITEM_PRICES[item] || 0),
                  0
                )
              : 0;
            const foodPaymentsRevenue = foodRow
              ? (foodRow.cashAmount || 0) + (foodRow.onlineAmount || 0)
              : 0;
            const foodTotalRevenue =
              foodRow && foodRow.isClosed && foodRow.paymentOption === "Paid"
                ? Number(foodRow.totalAmount || 0) + foodPaymentsRevenue
                : foodItemsRevenue + foodPaymentsRevenue;

            dayData.totalRevenue = nonFoodTablesRevenue + foodTotalRevenue;
            dayData.cashRevenue = dayTables.reduce(
              (sum, entry) => sum + (Number(entry.cashAmount) || 0),
              0
            );
            dayData.onlineRevenue = dayTables.reduce(
              (sum, entry) => sum + (Number(entry.onlineAmount) || 0),
              0
            );
            dayData.balanceReceived = foodPaymentsRevenue;

            dayData.salesByGameType = dayTables.reduce((acc, entry) => {
              const { gameType, totalAmount, paymentOption, orderedItems } =
                entry;
              if (
                !gameType ||
                totalAmount === undefined ||
                gameType === "FOOD" ||
                !entry.isClosed ||
                paymentOption !== "Paid"
              )
                return acc;
              const itemCost = orderedItems.reduce(
                (sum, item) => sum + (ITEM_PRICES[item] || 0),
                0
              );
              const gameRevenue = Number(totalAmount) - itemCost;
              acc[gameType] =
                (acc[gameType] || 0) + (gameRevenue > 0 ? gameRevenue : 0);
              return acc;
            }, {});

            dayData.salesByItems = dayTables.reduce((acc, entry) => {
              entry.orderedItems.forEach((item) => {
                acc[item] = (acc[item] || 0) + 1;
              });
              return acc;
            }, {});
          }
          return dayData;
        });

        const dailyData = await Promise.all(dailyDataPromises);
        tables = dailyData.flatMap((data) => data.tables);
        setActiveTables(tables);

        // Aggregate values for custom report
        dailyData.forEach((dayData) => {
          totalRevenue += dayData.totalRevenue;
          cashRevenue += dayData.cashRevenue;
          onlineRevenue += dayData.onlineRevenue;
          balanceReceived += dayData.balanceReceived;

          Object.entries(dayData.salesByGameType).forEach(([game, revenue]) => {
            salesByGameType[game] = (salesByGameType[game] || 0) + revenue;
          });

          Object.entries(dayData.salesByItems).forEach(([item, count]) => {
            salesByItems[item] = (salesByItems[item] || 0) + count;
          });
        });

        // Update state for custom report
        setTotalRevenue(totalRevenue);
        setCashRevenue(cashRevenue);
        setOnlineRevenue(onlineRevenue);
        setBalanceReceived(balanceReceived);
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Modify the useEffect hook to only run for daily report
  useEffect(() => {
    if (reportType !== "daily" || !activeTables || !Array.isArray(activeTables))
      return;

    const foodRow = activeTables.find((entry) => entry.name === "FOOD");

    const nonFoodTablesRevenue = activeTables.reduce((acc, entry) => {
      const { totalAmount, paymentOption, isClosed, gameType } = entry;
      if (
        !isClosed ||
        paymentOption !== "Paid" ||
        totalAmount === undefined ||
        gameType === "FOOD"
      )
        return acc;
      return acc + Number(totalAmount);
    }, 0);

    const foodItemsRevenue = foodRow
      ? foodRow.orderedItems.reduce(
          (sum, item) => sum + (ITEM_PRICES[item] || 0),
          0
        )
      : 0;
    const foodPaymentsRevenue = foodRow
      ? (foodRow.cashAmount || 0) + (foodRow.onlineAmount || 0)
      : 0;
    const foodTotalRevenue =
      foodRow && foodRow.isClosed && foodRow.paymentOption === "Paid"
        ? Number(foodRow.totalAmount || 0) + foodPaymentsRevenue
        : foodItemsRevenue + foodPaymentsRevenue;

    const newTotalRevenue = nonFoodTablesRevenue + foodTotalRevenue;
    const newCashRevenue = activeTables.reduce(
      (sum, entry) => sum + (Number(entry.cashAmount) || 0),
      0
    );
    const newOnlineRevenue = activeTables.reduce(
      (sum, entry) => sum + (Number(entry.onlineAmount) || 0),
      0
    );
    const newBalanceReceived = foodPaymentsRevenue;

    console.log("Daily - nonFoodTablesRevenue:", nonFoodTablesRevenue);
    console.log("Daily - foodTotalRevenue:", foodTotalRevenue);

    setTotalRevenue(newTotalRevenue);
    console.log(totalRevenue);
    setCashRevenue(newCashRevenue);
    setOnlineRevenue(newOnlineRevenue);
    setBalanceReceived(newBalanceReceived);
  }, [activeTables, ITEM_PRICES, reportType]); // Add reportType to dependencies

  useEffect(() => {
    if (Object.keys(ITEM_PRICES).length === 0) return; // Wait for prices
    fetchSalesData();
  }, [selectedLocation, reportType, selectedDate, dateRange, ITEM_PRICES]);

  const handleEditCustomer = (customer) => {
    console.log("handleEditCustomer called with:", customer); // Debug
    setEditCustomerData(customer);
    setIsEditCustomerModalOpen(true);
    editCustomerForm.setFieldsValue({
      name: customer.name,
      phone: customer.phone,
      dues: customer.dues,
      cashPaymentAmount: 0,
      onlinePaymentAmount: 0,
    });
  };

  const updateCustomerDues = async (values) => {
    if (!editCustomerData) return;

    const customerRef = doc(db, "regularCustomers", editCustomerData.id);
    const currentDues = editCustomerData.dues || 0;
    const cashPaymentAmount = parseFloat(values.cashPaymentAmount) || 0;
    const onlinePaymentAmount = parseFloat(values.onlinePaymentAmount) || 0;
    const totalPayment = cashPaymentAmount + onlinePaymentAmount;
    const newDues = Math.max(0, currentDues - totalPayment);

    try {
      // Update customer dues
      await updateDoc(customerRef, { dues: newDues });

      if (totalPayment > 0) {
        // Store payment in the "payments" collection
        const paymentRef = doc(collection(db, "payments"));
        await setDoc(paymentRef, {
          customerId: editCustomerData.id,
          customerName: editCustomerData.name,
          location: selectedLocation,
          date: selectedDate,
          cashAmount: cashPaymentAmount,
          onlineAmount: onlinePaymentAmount,
          totalAmount: totalPayment,
          timestamp: new Date().toISOString(),
        });

        // Update daily sales report
        const reportDocRef = doc(
          db,
          "dailySalesReports",
          `${selectedLocation}_${selectedDate}`
        );
        const reportSnap = await getDoc(reportDocRef);
        const existingData = reportSnap.exists()
          ? reportSnap.data()
          : {
              totalRevenue: 0,
              cashRevenue: 0,
              onlineRevenue: 0,
              balanceReceived: 0,
              salesByGameType: {},
              salesByItems: {},
            };

        const updatedReportData = {
          totalRevenue: (existingData.totalRevenue || 0) + totalPayment,
          cashRevenue: (existingData.cashRevenue || 0) + cashPaymentAmount,
          onlineRevenue:
            (existingData.onlineRevenue || 0) + onlinePaymentAmount,
          balanceReceived: (existingData.balanceReceived || 0) + totalPayment,
          salesByGameType: existingData.salesByGameType || {},
          salesByItems: existingData.salesByItems || {},
          lastUpdated: new Date().toISOString(),
        };
        await setDoc(reportDocRef, updatedReportData, { merge: true });

        // Update state directly
        setTotalRevenue((prev) => prev + totalPayment);
        setCashRevenue((prev) => prev + cashPaymentAmount);
        setOnlineRevenue((prev) => prev + onlinePaymentAmount);
        setBalanceReceived((prev) => prev + totalPayment);
      }

      setIsEditCustomerModalOpen(false);
      editCustomerForm.resetFields();
    } catch (error) {
      console.error("Error updating customer dues:", error);
    }
  };

  const handleShowCustomerTables = async (customer) => {
    const allTables = [];
    const dates =
      reportType === "daily"
        ? [selectedDate]
        : dateRange.length === 2
        ? (() => {
            const [start, end] = dateRange;
            const days = [];
            for (
              let day = moment(start).startOf("day");
              day.isSameOrBefore(moment(end).endOf("day"));
              day.add(1, "day")
            ) {
              days.push(day.format("YYYY-MM-DD"));
            }
            return days;
          })()
        : [];
    for (const date of dates) {
      const tables = await getTablesByDate(date, selectedLocation);
      const customerTables = tables.filter(
        (table) => table.paymentOption === customer.name && table.dues > 0
      );
      allTables.push(...customerTables);
    }
    setSelectedCustomerTables(allTables);
    setIsShowTablesModalOpen(true);
  };

  const handleShowPaymentHistory = async (customer) => {
    const paymentsCollection = collection(db, "payments");
    const q = query(
      paymentsCollection,
      where("customerId", "==", customer.id),
      where("location", "==", selectedLocation)
    );
    const querySnapshot = await getDocs(q);
    const paymentRecords = querySnapshot.docs.map((doc) => ({
      date: doc.data().date,
      cashAmount: doc.data().cashAmount || 0,
      onlineAmount: doc.data().onlineAmount || 0,
      totalAmount: doc.data().totalAmount || 0,
    }));

    // Sort paymentRecords by date in descending order (most recent first)
    paymentRecords.sort(
      (a, b) =>
        moment(b.date, "YYYY-MM-DD").unix() -
        moment(a.date, "YYYY-MM-DD").unix()
    );

    // Set states and open modal after data is fetched and sorted
    setPaymentHistory(paymentRecords);
    setEditCustomerData(customer);
    setIsPaymentHistoryModalOpen(true);
  };

  if (!activeTables || !Array.isArray(activeTables)) {
    return (
      <div>
        <Navbar
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
        />
        <p style={{ marginTop: 60, textAlign: "center" }}>
          No sales data available for {selectedLocation} on {selectedDate}.
        </p>
      </div>
    );
  }

  const sortedGameSales = Object.entries(
    activeTables.reduce((acc, entry) => {
      const { gameType, totalAmount, paymentOption, orderedItems } = entry;
      if (
        !gameType ||
        totalAmount === undefined ||
        gameType === "FOOD" ||
        !entry.isClosed ||
        paymentOption !== "Paid"
      )
        return acc;
      const itemCost = orderedItems.reduce(
        (sum, item) => sum + (ITEM_PRICES[item] || 0),
        0
      );
      const gameRevenue = Number(totalAmount) - itemCost;
      acc[gameType] =
        (acc[gameType] || 0) + (gameRevenue > 0 ? gameRevenue : 0);
      return acc;
    }, {})
  )
    .map(([game, total]) => ({ gameType: game, totalSales: total }))
    .sort((a, b) => b.totalSales - a.totalSales);

  const sortedItemSales = Object.entries(
    activeTables.reduce((acc, entry) => {
      entry.orderedItems.forEach((item) => {
        acc[item] = (acc[item] || 0) + 1;
      });
      return acc;
    }, {})
  )
    .map(([item, count]) => ({
      itemName: item,
      quantitySold: count,
      totalRevenue: count * (ITEM_PRICES[item] || 0),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const filteredItems = sortedItemSales.filter(({ itemName }) =>
    itemName.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredGames = sortedGameSales.filter(({ gameType }) =>
    gameType.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredCustomers = regularCustomers.filter(({ name }) =>
    name.toLowerCase().includes(searchText.toLowerCase())
  );

  const getTodaysDues = (customerName) => {
    return activeTables
      .filter((table) => table.paymentOption === customerName && table.dues > 0)
      .reduce((sum, table) => sum + (table.dues || 0), 0);
  };

  const totalGameSales = filteredGames.reduce(
    (sum, game) => sum + game.totalSales,
    0
  );
  const totalItemSales = filteredItems.reduce(
    (sum, item) => sum + item.totalRevenue,
    0
  );

  const handleAddExpense = async (values) => {
    const newExpense = {
      expense: values.expense,
      amount: parseFloat(values.amount),
      location: selectedLocation,
    };

    try {
      const docRef = await addDoc(collection(db, "expenses"), newExpense);
      setExpenses([...expenses, { key: docRef.id, ...newExpense }]);
      expenseForm.resetFields();
      setIsAddExpenseModalOpen(false);
    } catch (error) {
      console.error("Error adding expense:", error);
      alert("Failed to add expense: " + error.message);
    }
  };

  // Handle editing an expense
  const handleEditExpense = (record) => {
    setEditExpenseRecord(record);
    setIsEditExpenseModalOpen(true);
    editExpenseForm.setFieldsValue({
      expense: record.expense,
      amount: record.amount,
    });
  };

  const handleUpdateExpense = async (values) => {
    const updatedExpense = {
      expense: values.expense,
      amount: parseFloat(values.amount),
      location: selectedLocation,
    };

    try {
      const expenseDocRef = doc(db, "expenses", editExpenseRecord.key);
      await updateDoc(expenseDocRef, updatedExpense);
      const updatedExpenses = expenses.map((item) =>
        item.key === editExpenseRecord.key
          ? { ...item, ...updatedExpense }
          : item
      );
      setExpenses(updatedExpenses);
      setIsEditExpenseModalOpen(false);
      setEditExpenseRecord(null);
      editExpenseForm.resetFields();
    } catch (error) {
      console.error("Error updating expense:", error);
      alert("Failed to update expense: " + error.message);
    }
  };

  // Handle deleting an expense
  const handleDeleteExpense = (record) => {
    setDeleteExpenseRecord(record);
    setIsDeleteExpenseModalOpen(true);
  };

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseRecord) return;
    try {
      const expenseDocRef = doc(db, "expenses", deleteExpenseRecord.key);
      await deleteDoc(expenseDocRef);
      setExpenses(
        expenses.filter((item) => item.key !== deleteExpenseRecord.key)
      );
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Failed to delete expense: " + error.message);
    } finally {
      setIsDeleteExpenseModalOpen(false);
      setDeleteExpenseRecord(null);
    }
  };

  // Expenses table columns
  const expenseColumns = [
    {
      title: "Expense",
      dataIndex: "expense",
      key: "expense",
      sorter: (a, b) => a.expense.localeCompare(b.expense),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      sorter: (a, b) => a.amount - b.amount,
      render: (amount) => `Rs ${amount.toFixed(2)}`,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEditExpense(record)}
          >
            Edit
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteExpense(record)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const gameColumns = [
    {
      title: "Game Type 🎱",
      dataIndex: "gameType",
      key: "gameType",
      sorter: (a, b) => a.gameType.localeCompare(b.gameType),
    },
    {
      title: "Total Sales (Rs) 💰",
      dataIndex: "totalSales",
      key: "totalSales",
      sorter: (a, b) => a.totalSales - b.totalSales,
      render: (total) => `Rs ${total.toFixed(2)}`,
    },
  ];

  const itemColumns = [
    {
      title: "Item Name 🍽️",
      dataIndex: "itemName",
      key: "itemName",
      sorter: (a, b) => a.itemName.localeCompare(b.itemName),
    },
    {
      title: "Quantity Sold 🛒",
      dataIndex: "quantitySold",
      key: "quantitySold",
      sorter: (a, b) => a.quantitySold - b.quantitySold,
    },
    {
      title: "Total Sales(Rs) 💵",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
      render: (total) => `Rs ${total.toFixed(2)}`,
    },
  ];

  const customerColumns = [
    {
      title: "Customer Name 👤",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    { title: "Phone Number 📞", dataIndex: "phone", key: "phone" },
    {
      title: "Total Dues (Rs) 💸",
      dataIndex: "dues",
      key: "dues",
      sorter: (a, b) => a.dues - b.dues,
      render: (dues) => `Rs ${dues.toFixed(2)}`,
    },
    {
      title: "Today Dues (Rs) 📅",
      key: "todaysDues",
      render: (_, record) => `Rs ${getTodaysDues(record.name).toFixed(2)}`,
      sorter: (a, b) => getTodaysDues(a.name) - getTodaysDues(b.name),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            type="primary"
            onClick={() => {
              console.log(
                "Edit button clicked, userRole:",
                userRole,
                "isActionAuthenticated:",
                isActionAuthenticated
              ); // Debug
              if (!userRole) {
                alert("Please log in to perform this action.");
                return;
              }
              if (userRole === "admin" || isActionAuthenticated) {
                handleEditCustomer(record);
              } else if (userRole === "restricted") {
                setDropdownActionCustomer(record);
                setIsDropdownOpen(true);
              } else {
                alert("You do not have permission to perform this action.");
              }
            }}
          >
            Edit
          </Button>
          <Button
            type="default"
            onClick={() => handleShowCustomerTables(record)}
          >
            Show
          </Button>
          <Button
            type="default"
            onClick={() => handleShowPaymentHistory(record)}
          >
            Bill
          </Button>
        </div>
      ),
    },
  ];

  const tableColumns = [
    { title: "Table", dataIndex: "table", key: "table" },
    { title: "Customer Name", dataIndex: "name", key: "name" },
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
      title: "Total Amount (Rs)",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (a) => `Rs ${a.toFixed(2)}`,
    },
    {
      title: "Cash (Rs)",
      dataIndex: "cashAmount",
      key: "cashAmount",
      render: (a) => `Rs ${(a || 0).toFixed(2)}`,
    },
    {
      title: "Online (Rs)",
      dataIndex: "onlineAmount",
      key: "onlineAmount",
      render: (a) => `Rs ${(a || 0).toFixed(2)}`,
    },
    {
      title: "Dues Added (Rs)",
      dataIndex: "dues",
      key: "dues",
      render: (d) => `Rs ${d.toFixed(2)}`,
    },
  ];

  const paymentHistoryColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) =>
        date ? moment(date, "YYYY-MM-DD").format("MMMM D, YYYY") : "—",
    },
    {
      title: "Cash Amount (Rs)",
      dataIndex: "cashAmount",
      key: "cashAmount",
      render: (amount) => `Rs ${amount.toFixed(2)}`,
    },
    {
      title: "Online Amount (Rs)",
      dataIndex: "onlineAmount",
      key: "onlineAmount",
      render: (amount) => `Rs ${amount.toFixed(2)}`,
    },
    {
      title: "Total Payment (Rs)",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (amount) => `Rs ${amount.toFixed(2)}`,
    },
  ];

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
      let adminPassword = "defaultAdminPassword"; // Fallback (set in Firestore ideally)

      if (docSnap.exists() && docSnap.data().adminPassword) {
        adminPassword = docSnap.data().adminPassword;
      } else {
        console.error("Admin password not found in Config/adminSettings");
      }

      if (password === adminPassword) {
        setIsActionAuthenticated(true);
        if (dropdownActionCustomer) {
          handleEditCustomer(dropdownActionCustomer);
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

  return (
    <div>
      <Navbar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
      />
      <Card
        style={{
          margin: "20px",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
          background: "#ffffff",
        }}
      >
        <Title level={3} style={{ textAlign: "center", color: "#1890ff" }}>
          <div>📊 Sales Report for {selectedLocation} </div>
          {reportType === "daily"
            ? `${moment(selectedDate).format("MMMM D, YYYY")}`
            : reportType === "custom" && dateRange.length === 2
            ? `From ${moment(dateRange[0]).format("MMMM D, YYYY")} To ${moment(
                dateRange[1]
              ).format("MMMM D, YYYY")}`
            : ""}
        </Title>

        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={3}>
            <Select
              value={reportType}
              onChange={setReportType}
              className="w-36"
            >
              <Option value="daily">Daily</Option>
              <Option value="custom">Custom</Option>
            </Select>
          </Col>
          {reportType === "custom" && (
            <Col span={12}>
              <RangePicker
                onChange={(dates) =>
                  setDateRange(dates ? dates.map((d) => d.toDate()) : [])
                }
              />
            </Col>
          )}
        </Row>

        {loading ? (
          <Spin
            size="large"
            style={{ display: "block", margin: "20px auto" }}
          />
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: "20px" }}>
              <Col span={6}>
                <Card
                  style={{
                    backgroundColor: "#e6f7ff",
                    borderLeft: "5px solid #1890ff",
                  }}
                >
                  <Statistic
                    title={<span style={{ fontSize: "18px" }}>Cash</span>} // Direct styling
                    value={cashRevenue.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#1890ff", fontSize: "20px" }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card
                  style={{
                    backgroundColor: "#fff1f0",
                    borderLeft: "5px solid #ff4d4f",
                  }}
                >
                  <Statistic
                    title={<span style={{ fontSize: "18px" }}>Online</span>} // Direct styling
                    value={onlineRevenue.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#ff4d4f", fontSize: "20px" }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card
                  style={{
                    backgroundColor: "#fff0f5",
                    borderLeft: "5px solid #eb2f96",
                  }}
                >
                  <Statistic
                    title={
                      <span style={{ fontSize: "18px" }}>Balance Received</span>
                    } // Direct styling
                    value={balanceReceived.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#eb2f96", fontSize: "20px" }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card
                  style={{
                    backgroundColor: "#f6ffed",
                    borderLeft: "5px solid #52c41a",
                  }}
                >
                  <Statistic
                    title={
                      <span style={{ fontSize: "18px" }}>Total Sales</span>
                    } // Direct styling
                    value={totalRevenue.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#52c41a", fontSize: "20px" }}
                  />
                </Card>
              </Col>
            </Row>

            <Input
              placeholder="🔍 Search sales..."
              allowClear
              prefix={<SearchOutlined />}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: "100%",
                marginBottom: "15px",
                padding: "10px",
                borderRadius: "5px",
              }}
            />

            <Title level={4} style={{ marginTop: "20px", color: "#1890ff" }}>
              🎮 Sales by Game Type
            </Title>
            <Table
              dataSource={filteredGames}
              columns={gameColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{
                marginBottom: "20px",
                borderRadius: "8px",
                overflow: "hidden",
              }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <strong>Total</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <strong>Rs {totalGameSales.toFixed(2)}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            <Title level={4} style={{ marginTop: "20px", color: "#52c41a" }}>
              🍔 Sales by Ordered Items
            </Title>
            <Table
              dataSource={filteredItems}
              columns={itemColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{ borderRadius: "8px", overflow: "hidden" }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <strong>Total</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <strong>Rs {totalItemSales.toFixed(2)}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            <Title level={4} style={{ marginTop: "20px", color: "#fa8c16" }}>
              👥 Regular Customer Dues
            </Title>
            <Table
              dataSource={filteredCustomers}
              columns={customerColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{ borderRadius: "8px", overflow: "hidden" }}
            />

            <Title level={4} style={{ marginTop: "20px", color: "#ff4d4f" }}>
              💸 Expenses
            </Title>
            <Button
              type="primary"
              onClick={() => setIsAddExpenseModalOpen(true)}
              style={{ marginBottom: "15px" }}
            >
              Add Expense
            </Button>
            <Table
              dataSource={expenses}
              columns={expenseColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{ borderRadius: "8px", overflow: "hidden" }}
            />

            {/* Add Expense Modal */}
            <Modal
              title="Add New Expense"
              open={isAddExpenseModalOpen}
              onCancel={() => setIsAddExpenseModalOpen(false)}
              footer={null}
            >
              <Form
                form={expenseForm}
                onFinish={handleAddExpense}
                layout="vertical"
              >
                <Form.Item
                  name="expense"
                  label="Expense"
                  rules={[
                    {
                      required: true,
                      message: "Please enter the expense name",
                    },
                  ]}
                >
                  <Input placeholder="Enter expense name" />
                </Form.Item>
                <Form.Item
                  name="amount"
                  label="Amount"
                  rules={[
                    { required: true, message: "Please enter the amount" },
                  ]}
                >
                  <Input type="number" min="0" placeholder="Enter amount" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" disabled={loading}>
                    Add
                  </Button>
                </Form.Item>
              </Form>
            </Modal>

            {/* Edit Expense Modal */}
            <Modal
              title="Edit Expense"
              open={isEditExpenseModalOpen}
              onCancel={() => setIsEditExpenseModalOpen(false)}
              footer={null}
            >
              <Form
                form={editExpenseForm}
                onFinish={handleUpdateExpense}
                layout="vertical"
              >
                <Form.Item
                  name="expense"
                  label="Expense"
                  rules={[
                    {
                      required: true,
                      message: "Please enter the expense name",
                    },
                  ]}
                >
                  <Input placeholder="Enter expense name" />
                </Form.Item>
                <Form.Item
                  name="amount"
                  label="Amount"
                  rules={[
                    { required: true, message: "Please enter the amount" },
                  ]}
                >
                  <Input type="number" min="0" placeholder="Enter amount" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" disabled={loading}>
                    Update
                  </Button>
                </Form.Item>
              </Form>
            </Modal>

            {/* Delete Expense Confirmation Modal */}
            <Modal
              title="Confirm Deletion"
              open={isDeleteExpenseModalOpen}
              onOk={confirmDeleteExpense}
              onCancel={() => setIsDeleteExpenseModalOpen(false)}
              okText="Yes"
              okButtonProps={{ danger: true }}
              cancelText="No"
            >
              <p>
                Are you sure you want to delete the expense "
                {deleteExpenseRecord?.expense}" of Rs{" "}
                {deleteExpenseRecord?.amount.toFixed(2)}?
              </p>
            </Modal>
          </>
        )}

        <Modal
          title="Edit Customer Dues"
          open={isEditCustomerModalOpen}
          onCancel={() => setIsEditCustomerModalOpen(false)}
          footer={null}
        >
          <Form form={editCustomerForm} onFinish={updateCustomerDues}>
            <Form.Item name="name" label="Customer Name">
              <Input disabled />
            </Form.Item>
            <Form.Item name="phone" label="Phone Number">
              <Input disabled />
            </Form.Item>
            <Form.Item name="dues" label="Current Dues (Rs)">
              <Input disabled />
            </Form.Item>
            <Form.Item name="cashPaymentAmount" label="Cash Payment (Rs)">
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item name="onlinePaymentAmount" label="Online Payment (Rs)">
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Update Dues
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Tables Contributing to Customer Dues"
          open={isShowTablesModalOpen}
          onCancel={() => setIsShowTablesModalOpen(false)}
          footer={null}
          width={800}
        >
          <Table
            dataSource={selectedCustomerTables}
            columns={tableColumns}
            rowKey="id"
            pagination={{ pageSize: 5 }}
          />
        </Modal>

        <Modal
          title={`Payment History for ${editCustomerData?.name || "Customer"}`}
          open={isPaymentHistoryModalOpen}
          onCancel={() => setIsPaymentHistoryModalOpen(false)}
          footer={null}
          width={800}
        >
          <Table
            dataSource={paymentHistory}
            columns={paymentHistoryColumns}
            rowKey="date"
            pagination={{ pageSize: 5 }}
            loading={loading}
          />
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
                  <h3>Login to Edit Customer Dues</h3>
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
                        Edit
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default SalesReport;

import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  Card,
  Typography,
  Input,
  Statistic,
  Row,
  Col,
  Select,
  Spin,
  Form,
  Modal,
  Button,
} from "antd";
import { SearchOutlined, MoneyCollectOutlined } from "@ant-design/icons";
import Navbar from "./Navbar";
import moment from "moment";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  updateDoc,
  setDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import logo1 from "./HOP3.png";
import logo2 from "./HOP5.png";
import { db, auth } from "./firebase";
import { getItemPrices } from "./PoolBillingSystem";
const { Title } = Typography;
const { Option } = Select;

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
  const [monthlyTotalRevenue, setMonthlyTotalRevenue] = useState(0);
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
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [allMonthTables, setAllMonthTables] = useState([]);
  const [isPaymentHistoryModalOpen, setIsPaymentHistoryModalOpen] =
    useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [ITEM_PRICES, setITEM_PRICES] = useState({});

  useEffect(() => {
    const fetchPrices = async () => {
      const prices = await getItemPrices(selectedLocation);
      setITEM_PRICES(prices);
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

  const calculateDailyTotalRevenue = async (date) => {
    const tables = (await getTablesByDate(date, selectedLocation)) || [];
    const closedTables = tables.filter((table) => table.isClosed);
    const salesByGameType = closedTables.reduce((acc, entry) => {
      const { gameType, totalAmount, paymentOption } = entry;
      if (
        !gameType ||
        totalAmount === undefined ||
        gameType === "FOOD" ||
        paymentOption !== "Paid"
      )
        return acc;
      acc[gameType] = (acc[gameType] || 0) + (Number(totalAmount) || 0);
      return acc;
    }, {});
    const totalGameRevenue = Object.values(salesByGameType).reduce(
      (sum, total) => sum + total,
      0
    );
    const foodRow = tables.find((entry) => entry.name === "FOOD");
    const foodItemsRevenue = foodRow
      ? foodRow.orderedItems.reduce(
          (sum, item) => sum + (ITEM_PRICES[item] || 0),
          0
        )
      : 0;

    const paymentsQuery = query(
      collection(db, "payments"),
      where("date", "==", date),
      where("location", "==", selectedLocation)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    const paymentsRevenue = paymentsSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data.cashAmount || 0) + (data.onlineAmount || 0);
    }, 0);

    // Include FOOD table cash and online payments explicitly
    const foodPaymentsRevenue = foodRow
      ? (foodRow.cashAmount || 0) + (foodRow.onlineAmount || 0)
      : 0;

    return (
      totalGameRevenue +
      foodItemsRevenue +
      paymentsRevenue +
      foodPaymentsRevenue
    );
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

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      if (reportType === "daily") {
        const tables =
          (await getTablesByDate(selectedDate, selectedLocation)) || [];
        setActiveTables(tables);
      } else if (reportType === "weekly") {
        const startOfWeek = moment(selectedDate).startOf("week");
        const endOfWeek = moment(selectedDate).endOf("week");
        const weekTables = [];
        const days = [];
        for (
          let day = startOfWeek.clone();
          day.isSameOrBefore(endOfWeek);
          day.add(1, "day")
        ) {
          days.push(day.format("YYYY-MM-DD"));
        }

        const dailyDataPromises = days.map(async (day) => {
          const dayTables = await getTablesByDate(day, selectedLocation);
          return dayTables;
        });

        const dailyData = await Promise.all(dailyDataPromises);
        dailyData.forEach((tables) => weekTables.push(...tables));
        setActiveTables(weekTables);
      } else if (reportType === "monthly" || reportType === "yearly") {
        const endDate = moment().endOf("month");
        const startDate = moment().subtract(11, "months").startOf("month");
        const allTables = [];
        const monthlySales = {};
        const yearlySales = {};

        const days = [];
        for (
          let day = startDate.clone();
          day.isSameOrBefore(endDate);
          day.add(1, "day")
        ) {
          days.push(day.format("YYYY-MM-DD"));
        }

        const chunkSize = 30;
        const dailyDataPromises = [];
        for (let i = 0; i < days.length; i += chunkSize) {
          const chunk = days.slice(i, i + chunkSize);
          dailyDataPromises.push(
            Promise.all(
              chunk.map(async (day) => {
                const dayTables = await getTablesByDate(day, selectedLocation);
                const dailyTotal = await calculateDailyTotalRevenue(day);
                return { day, tables: dayTables, dailyTotal };
              })
            )
          );
        }

        const chunkedData = await Promise.all(dailyDataPromises);
        const dailyData = chunkedData.flat();

        dailyData.forEach(({ day, tables, dailyTotal }) => {
          const monthKey = moment(day).format("YYYY-MM");
          const yearKey = moment(day).format("YYYY");

          if (tables.length > 0) {
            if (!monthlySales[monthKey]) {
              monthlySales[monthKey] = { totalRevenue: 0, tables: [] };
            }
            monthlySales[monthKey].totalRevenue += dailyTotal;
            monthlySales[monthKey].tables.push(...tables);

            if (!yearlySales[yearKey]) {
              yearlySales[yearKey] = { totalRevenue: 0, tables: [] };
            }
            yearlySales[yearKey].totalRevenue += dailyTotal;
            yearlySales[yearKey].tables.push(...tables);

            allTables.push(...tables.map((table) => ({ ...table, monthKey })));
          }
        });

        const monthlyDataArray = Object.entries(monthlySales).map(
          ([month, data]) => ({
            key: month,
            month: moment(month, "YYYY-MM").format("MMMM YYYY"),
            totalRevenue: Math.round(data.totalRevenue),
          })
        );

        const yearlyDataArray = Object.entries(yearlySales).map(
          ([year, data]) => ({
            key: year,
            year,
            totalRevenue: Math.round(data.totalRevenue),
          })
        );

        if (reportType === "monthly") {
          setAllMonthTables(allTables);
          setActiveTables([]);
          setMonthlyTotalRevenue(
            monthlyDataArray.reduce((sum, entry) => sum + entry.totalRevenue, 0)
          );
          setMonthlyData(monthlyDataArray);
        } else if (reportType === "yearly") {
          setActiveTables(allTables);
          setMonthlyTotalRevenue(
            yearlyDataArray.reduce((sum, entry) => sum + entry.totalRevenue, 0)
          );
          setYearlyData(yearlyDataArray);
        }
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [selectedLocation, reportType, selectedDate]);

  const handleMonthClick = (monthKey) => {
    const monthTables = allMonthTables.filter(
      (table) => table.monthKey === monthKey
    );
    setActiveTables(monthTables);
    setSelectedMonth(monthKey);
  };

  const showLoginDropdownForEdit = (customer) => {
    setDropdownActionCustomer(customer);
    setIsDropdownOpen(true);
  };

  const handleLoginSubmit = async (values) => {
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      setIsAuthenticated(true);
      if (dropdownActionCustomer) {
        handleEditCustomer(dropdownActionCustomer);
      }
      setIsDropdownOpen(false);
      loginForm.resetFields();
    } catch (error) {
      console.error("Login failed:", error);
      alert("Invalid email or password. Please try again.");
    }
  };

  const handleEditCustomer = (customer) => {
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

    await updateDoc(customerRef, { dues: newDues });

    if (totalPayment > 0) {
      const tables =
        (await getTablesByDate(selectedDate, selectedLocation)) || [];
      let foodTable = tables.find((entry) => entry.name === "FOOD");
      if (!foodTable) {
        foodTable = {
          id: `${selectedDate}-FOOD`,
          table: "Food",
          name: "FOOD",
          phone: "",
          startTime: null,
          endTime: null,
          duration: null,
          orderedItems: [],
          totalAmount: 0,
          isClosed: false,
          cashAmount: 0,
          onlineAmount: 0,
        };
        tables.push(foodTable);
      }

      foodTable.cashAmount = (foodTable.cashAmount || 0) + cashPaymentAmount;
      foodTable.onlineAmount =
        (foodTable.onlineAmount || 0) + onlinePaymentAmount;
      foodTable.totalAmount = (foodTable.totalAmount || 0) + totalPayment;

      await saveTables(selectedDate, tables, selectedLocation);

      if (reportType === "daily") {
        setActiveTables(tables);
      }
    }

    setIsEditCustomerModalOpen(false);
    editCustomerForm.resetFields();
  };

  const handleShowCustomerTables = async (customer) => {
    const allTables = [];
    const dates = [selectedDate];
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
    setLoading(true);
    try {
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
      setPaymentHistory(paymentRecords);
      setEditCustomerData(customer);
      setIsPaymentHistoryModalOpen(true);
    } catch (error) {
      console.error("Error fetching payment history:", error);
    } finally {
      setLoading(false);
    }
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
          No sales data available for {selectedLocation} on {selectedDate} in
          the selected {reportType} period.
        </p>
      </div>
    );
  }

  const weeklyData = [];
  if (reportType === "weekly") {
    const startOfWeek = moment(selectedDate).startOf("week");
    const endOfWeek = moment(selectedDate).endOf("week");
    const totalRevenue = activeTables.reduce(
      (sum, table) =>
        sum + (table.paymentOption === "Paid" ? table.totalAmount || 0 : 0),
      0
    );
    weeklyData.push({
      key: `${startOfWeek.format("YYYY-MM-DD")}-${endOfWeek.format(
        "YYYY-MM-DD"
      )}`,
      range: `${startOfWeek.format("YYYY-MM-DD")} to ${endOfWeek.format(
        "YYYY-MM-DD"
      )}`,
      totalRevenue: Math.round(totalRevenue),
    });
  }

  const salesByGameType = activeTables.reduce((acc, entry) => {
    const { gameType, totalAmount, paymentOption } = entry;
    if (
      !gameType ||
      totalAmount === undefined ||
      gameType === "FOOD" ||
      !entry.isClosed ||
      paymentOption !== "Paid"
    )
      return acc;
    acc[gameType] = (acc[gameType] || 0) + (Number(totalAmount) || 0);
    return acc;
  }, {});

  const salesByItems = activeTables.reduce((acc, entry) => {
    entry.orderedItems.forEach((item) => {
      acc[item] = (acc[item] || 0) + 1;
    });
    return acc;
  }, {});

  const foodRow = activeTables.find((entry) => entry.name === "FOOD");
  const foodItemsRevenue = foodRow
    ? foodRow.orderedItems.reduce(
        (sum, item) => sum + (ITEM_PRICES[item] || 0),
        0
      )
    : 0;

  const sortedItemSales = Object.entries(salesByItems)
    .map(([item, count]) => ({
      itemName: item,
      quantitySold: count,
      totalRevenue: count * (ITEM_PRICES[item] || 0),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const sortedGameSales = Object.entries(salesByGameType)
    .map(([game, total]) => ({ gameType: game, totalSales: total }))
    .sort((a, b) => b.totalSales - a.totalSales);

  const totalGameRevenue = sortedGameSales.reduce(
    (sum, entry) => sum + entry.totalSales,
    0
  );
  const totalRevenue =
    totalGameRevenue +
    foodItemsRevenue +
    (foodRow ? (foodRow.cashAmount || 0) + (foodRow.onlineAmount || 0) : 0);

  const cashRevenue = activeTables.reduce(
    (sum, entry) => sum + (Number(entry.cashAmount) || 0),
    0
  );
  const onlineRevenue = activeTables.reduce(
    (sum, entry) => sum + (Number(entry.onlineAmount) || 0),
    0
  );

  const filteredItems = sortedItemSales.filter(({ itemName }) =>
    itemName.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredGames = sortedGameSales.filter(({ gameType }) =>
    gameType.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredCustomers = regularCustomers.filter(({ name }) =>
    name.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredWeekly = weeklyData.filter((entry) =>
    entry.range.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredMonthly = monthlyData.filter((entry) =>
    entry.month.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredYearly = yearlyData.filter((entry) =>
    entry.year.toLowerCase().includes(searchText.toLowerCase())
  );

  const getTodaysDues = (customerName) => {
    return activeTables
      .filter((table) => table.paymentOption === customerName && table.dues > 0)
      .reduce((sum, table) => sum + (table.dues || 0), 0);
  };

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
      title: "Total Revenue (Rs) 💵",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
      render: (total) => `Rs ${total.toFixed(2)}`,
    },
  ];

  const weeklyColumns = [
    { title: "Week Range", dataIndex: "range", key: "range" },
    {
      title: "Total Revenue (Rs)",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      render: (total) => `Rs ${total}`,
    },
  ];

  const monthlyColumns = [
    { title: "Month", dataIndex: "month", key: "month" },
    {
      title: "Total Revenue (Rs)",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      render: (total) => `Rs ${total}`,
    },
  ];

  const yearlyColumns = [
    { title: "Year", dataIndex: "year", key: "year" },
    {
      title: "Total Revenue (Rs)",
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      render: (total) => `Rs ${total}`,
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
      title: "Today's Dues (Rs) 📅",
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
            onClick={() =>
              isAuthenticated
                ? handleEditCustomer(record)
                : showLoginDropdownForEdit(record)
            }
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
      render: (date) => moment(date, "YYYY-MM-DD").format("YYYY-MM-DD"),
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
          📊 Sales Report for {selectedLocation}{" "}
          {reportType === "daily" ? `on ${selectedDate}` : ""}
        </Title>

        <Select
          value={reportType}
          onChange={setReportType}
          style={{ width: 200, marginBottom: 20 }}
        >
          <Option value="daily">Daily</Option>
          <Option value="weekly">Weekly</Option>
          <Option value="monthly">Monthly</Option>
          <Option value="yearly">Yearly</Option>
        </Select>

        {loading ? (
          <Spin
            size="large"
            style={{ display: "block", margin: "20px auto" }}
          />
        ) : reportType === "daily" ? (
          <>
            <Row gutter={16} style={{ marginBottom: "20px" }}>
              <Col span={8}>
                <Card
                  style={{
                    backgroundColor: "#f6ffed",
                    borderLeft: "5px solid #52c41a",
                  }}
                >
                  <Statistic
                    title="Total Revenue"
                    value={totalRevenue.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#52c41a", fontSize: "20px" }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  style={{
                    backgroundColor: "#e6f7ff",
                    borderLeft: "5px solid #1890ff",
                  }}
                >
                  <Statistic
                    title="Cash Revenue"
                    value={cashRevenue.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#1890ff", fontSize: "20px" }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  style={{
                    backgroundColor: "#fff1f0",
                    borderLeft: "5px solid #ff4d4f",
                  }}
                >
                  <Statistic
                    title="Online Revenue"
                    value={onlineRevenue.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#ff4d4f", fontSize: "20px" }}
                  />
                </Card>
              </Col>
            </Row>

            <Input
              placeholder="🔍 Search daily sales..."
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
              🎮 Daily Sales by Game Type on {selectedDate}
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
            />

            <Title level={4} style={{ marginTop: "20px", color: "#52c41a" }}>
              🍔 Daily Sales by Ordered Items on {selectedDate}
            </Title>
            <Table
              dataSource={filteredItems}
              columns={itemColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{ borderRadius: "8px", overflow: "hidden" }}
            />

            <Title level={4} style={{ marginTop: "20px", color: "#fa8c16" }}>
              👥 Regular Customer Dues on {selectedDate}
            </Title>
            <Table
              dataSource={filteredCustomers}
              columns={customerColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{ borderRadius: "8px", overflow: "hidden" }}
            />
          </>
        ) : reportType === "weekly" ? (
          <>
            <Input
              placeholder="🔍 Search weekly sales..."
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
              📅 Weekly Sales
            </Title>
            <Table
              dataSource={filteredWeekly}
              columns={weeklyColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{
                marginBottom: "20px",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            />
            <Title level={4} style={{ marginTop: "20px", color: "#1890ff" }}>
              🎮 Weekly Sales by Game Type
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
            />
            <Title level={4} style={{ marginTop: "20px", color: "#52c41a" }}>
              🍔 Weekly Sales by Ordered Items
            </Title>
            <Table
              dataSource={filteredItems}
              columns={itemColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{ borderRadius: "8px", overflow: "hidden" }}
            />
          </>
        ) : reportType === "monthly" ? (
          <>
            <Input
              placeholder="🔍 Search monthly sales..."
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
              📅 Monthly Sales (Click a month for details)
            </Title>
            <Table
              dataSource={filteredMonthly}
              columns={monthlyColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{
                marginBottom: "20px",
                borderRadius: "8px",
                overflow: "hidden",
              }}
              onRow={(record) => ({
                onClick: () => handleMonthClick(record.key),
              })}
            />
            {selectedMonth && (
              <>
                <Title
                  level={4}
                  style={{ marginTop: "20px", color: "#1890ff" }}
                >
                  🎮 Monthly Sales by Game Type for{" "}
                  {moment(selectedMonth, "YYYY-MM").format("MMMM YYYY")}
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
                />
                <Title
                  level={4}
                  style={{ marginTop: "20px", color: "#52c41a" }}
                >
                  🍔 Monthly Sales by Ordered Items for{" "}
                  {moment(selectedMonth, "YYYY-MM").format("MMMM YYYY")}
                </Title>
                <Table
                  dataSource={filteredItems}
                  columns={itemColumns}
                  bordered
                  pagination={{ pageSize: 5 }}
                  style={{
                    marginBottom: "20px",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                />
              </>
            )}
            <Row gutter={16} style={{ marginTop: "20px" }}>
              <Col span={24}>
                <Card
                  style={{
                    backgroundColor: "#f6ffed",
                    borderLeft: "5px solid #52c41a",
                  }}
                >
                  <Statistic
                    title="Total Revenue Across All Months"
                    value={monthlyTotalRevenue.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#52c41a", fontSize: "20px" }}
                  />
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          <>
            <Input
              placeholder="🔍 Search yearly sales..."
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
              📅 Yearly Sales
            </Title>
            <Table
              dataSource={filteredYearly}
              columns={yearlyColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{
                marginBottom: "20px",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            />
            <Title level={4} style={{ marginTop: "20px", color: "#1890ff" }}>
              🎮 Yearly Sales by Game Type
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
            />
            <Title level={4} style={{ marginTop: "20px", color: "#52c41a" }}>
              🍔 Yearly Sales by Ordered Items
            </Title>
            <Table
              dataSource={filteredItems}
              columns={itemColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{
                marginBottom: "20px",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            />
            <Row gutter={16} style={{ marginTop: "20px" }}>
              <Col span={24}>
                <Card
                  style={{
                    backgroundColor: "#f6ffed",
                    borderLeft: "5px solid #52c41a",
                  }}
                >
                  <Statistic
                    title="Total Revenue Across All Years"
                    value={monthlyTotalRevenue.toFixed(2)}
                    prefix={<MoneyCollectOutlined />}
                    suffix="Rs"
                    valueStyle={{ color: "#52c41a", fontSize: "20px" }}
                  />
                </Card>
              </Col>
            </Row>
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
              className="dropdown-menu fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-11/12 max-w-[40rem] h-[26rem] bg-white shadow-2xl rounded-3xl p-2 z-30 flex flex-col md:flex-row items-center gap-2 animate-fade-in"
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

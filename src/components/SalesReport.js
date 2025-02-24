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
import { ITEM_PRICES } from "./PoolBillingSystem";
import Navbar from "./Navbar";
import moment from "moment";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  updateDoc,
} from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import logo1 from "./HOP3.png"; // Ensure these images are available
import logo2 from "./HOP5.png";
import { db, auth } from "./firebase";
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
  const [reportType, setReportType] = useState("daily"); // Daily, Weekly, Monthly
  const [monthlyTotalRevenue, setMonthlyTotalRevenue] = useState(0); // New state for monthly total
  const [loading, setLoading] = useState(false);
  const [regularCustomers, setRegularCustomers] = useState([]); // New state for regular customers
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
        console.log("Fetched regular customers:", customers); // Debug log
        setRegularCustomers(customers);
      },
      (error) => {
        console.error("Error fetching regular customers:", error);
      }
    );
    return () => unsubscribe(); // Cleanup listener
  }, []);

  const getTablesByDate = async (date, location) => {
    const docSnap = await getDoc(doc(db, "tables", `${location}_${date}`));
    if (!docSnap.exists()) return [];

    return docSnap.data().data.map((table) => ({
      ...table,
      startTime: table.startTime ? moment(table.startTime).toDate() : null,
      endTime: table.endTime ? moment(table.endTime).toDate() : null,
      cashAmount: table.cashAmount || 0, // Ensure defaults
      onlineAmount: table.onlineAmount || 0,
    }));
  };

  const calculateDailyTotalRevenue = async (date) => {
    const tables = (await getTablesByDate(date, selectedLocation)) || [];
    const closedTables = tables.filter((table) => table.isClosed);
    const salesByGameType = closedTables.reduce((acc, entry) => {
      const { gameType, totalAmount } = entry;
      if (!gameType || totalAmount === undefined || gameType === "FOOD")
        return acc;
      acc[gameType] = (acc[gameType] || 0) + (Number(totalAmount) || 0);
      return acc;
    }, {});
    const totalGameRevenue = Object.values(salesByGameType).reduce(
      (sum, total) => sum + total,
      0
    );
    const foodRow = tables.find((entry) => entry.name === "FOOD"); // Use all tables, not just closed
    const foodItemsRevenue = foodRow
      ? foodRow.orderedItems.reduce(
          (sum, item) => sum + (ITEM_PRICES[item] || 0),
          0
        )
      : 0;
    console.log(totalGameRevenue + foodItemsRevenue);
    return totalGameRevenue + foodItemsRevenue;
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
        for (
          let day = startOfWeek.clone();
          day.isSameOrBefore(endOfWeek);
          day.add(1, "day")
        ) {
          const dayTables = await getTablesByDate(
            day.format("YYYY-MM-DD"),
            selectedLocation
          );
          weekTables.push(...dayTables);
        }
        setActiveTables(weekTables);
      } else if (reportType === "monthly") {
        const startOfMonth = moment(selectedDate).startOf("month");
        const endOfMonth = moment(selectedDate).endOf("month");
        const monthTables = [];
        const foodRowEntries = [];
        const days = [];

        for (
          let day = startOfMonth.clone();
          day.isSameOrBefore(endOfMonth);
          day.add(1, "day")
        ) {
          days.push(day.format("YYYY-MM-DD"));
        }

        const dailyDataPromises = days.map(async (day) => {
          const dayTables = await getTablesByDate(day, selectedLocation);
          const dailyTotal = await calculateDailyTotalRevenue(day);
          return { tables: dayTables, dailyTotal };
        });

        const dailyData = await Promise.all(dailyDataPromises);
        let monthlyTotal = 0;

        dailyData.forEach(({ tables, dailyTotal }) => {
          monthlyTotal += dailyTotal;
          const foodRows = tables.filter((entry) => entry.name === "FOOD");
          const nonFoodTables = tables.filter((entry) => entry.name !== "FOOD");
          monthTables.push(...nonFoodTables);
          foodRowEntries.push(...foodRows);
        });

        if (foodRowEntries.length > 0) {
          const mergedFoodRow = {
            ...foodRowEntries[0],
            orderedItems: [].concat(
              ...foodRowEntries.map((entry) => entry.orderedItems)
            ),
          };
          monthTables.push(mergedFoodRow);
        }

        setActiveTables(monthTables);
        setMonthlyTotalRevenue(Math.round(monthlyTotal));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [selectedDate, selectedLocation, reportType]);

  const showLoginDropdownForEdit = (customer) => {
    setDropdownActionCustomer(customer);
    setIsDropdownOpen(true);
  };

  // Handle login submission
  const handleLoginSubmit = async (values) => {
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
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
      paymentAmount: 0, // Default payment amount
    });
  };

  const updateCustomerDues = async (values) => {
    if (!editCustomerData) return;
    const customerRef = doc(db, "regularCustomers", editCustomerData.id);
    const currentDues = editCustomerData.dues || 0;
    const paymentAmount = parseFloat(values.paymentAmount) || 0;
    const newDues = Math.max(0, currentDues - paymentAmount); // Ensure dues don’t go negative
    await updateDoc(customerRef, { dues: newDues });
    setIsEditCustomerModalOpen(false);
    editCustomerForm.resetFields();
  };

  const handleShowCustomerTables = async (customer) => {
    const allTables = [];
    // Fetch tables for all dates in the selected location (simplified for this example)
    const dates = [selectedDate]; // You could expand this to fetch all dates if needed
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

  if (
    !activeTables ||
    !Array.isArray(activeTables) ||
    activeTables.length === 0
  ) {
    return (
      <div>
        <Navbar
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
        />
        <p style={{ marginTop: 60, textAlign: "center" }}>
          No sales data available for {selectedLocation} in the selected{" "}
          {reportType} period.
        </p>
      </div>
    );
  }
  //DAILY

  // Aggregate sales by game type (excluding FOOD items)
  const salesByGameType = activeTables.reduce((acc, entry) => {
    const { gameType, totalAmount } = entry;
    if (!gameType || totalAmount === undefined || gameType === "FOOD")
      return acc; // Exclude FOOD row here

    acc[gameType] = (acc[gameType] || 0) + (Number(totalAmount) || 0);
    return acc;
  }, {});

  // Aggregate sales by ordered items across all rows
  const salesByItems = activeTables.reduce((acc, entry) => {
    entry.orderedItems.forEach((item) => {
      acc[item] = (acc[item] || 0) + 1; // Count occurrences
    });
    return acc;
  }, {});

  // Calculate revenue from FOOD row items only
  const foodRow = activeTables.find((entry) => entry.name === "FOOD");
  const foodItemsRevenue = foodRow
    ? foodRow.orderedItems.reduce(
        (sum, item) => sum + (ITEM_PRICES[item] || 0),
        0
      )
    : 0;

  // Convert item sales to array format (all items)
  const sortedItemSales = Object.entries(salesByItems)
    .map(([item, count]) => ({
      itemName: item,
      quantitySold: count,
      totalRevenue: count * (ITEM_PRICES[item] || 0),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Convert game type sales to array format
  const sortedGameSales = Object.entries(salesByGameType)
    .map(([game, total]) => ({ gameType: game, totalSales: total }))
    .sort((a, b) => b.totalSales - a.totalSales);

  // Total Revenue: Game sales + FOOD row items only
  const totalGameRevenue = sortedGameSales.reduce(
    (sum, entry) => sum + entry.totalSales,
    0
  );
  const totalRevenue = totalGameRevenue + foodItemsRevenue;

  const cashRevenue = activeTables.reduce(
    (sum, entry) => sum + (Number(entry.cashAmount) || 0),
    0
  );
  const onlineRevenue = activeTables.reduce(
    (sum, entry) => sum + (Number(entry.onlineAmount) || 0),
    0
  );

  // Search filter
  const filteredItems = sortedItemSales.filter(({ itemName }) =>
    itemName.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredGames = sortedGameSales.filter(({ gameType }) =>
    gameType.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredCustomers = regularCustomers.filter(
    ({ name }) => name.toLowerCase().includes(searchText.toLowerCase()) // Filter customers by name
  );

  // Weekly Report
  const weeklyData = [];
  if (reportType === "weekly") {
    const startOfWeek = moment(selectedDate).startOf("week");
    const endOfWeek = moment(selectedDate).endOf("week");
    const totalRevenue = activeTables.reduce(
      (sum, table) => sum + (table.totalAmount || 0),
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

  // Monthly Report
  const monthlyData = [];
  let monthlyGameSales = [];
  let monthlyFoodItemsRevenue = 0;
  if (reportType === "monthly") {
    const gameTypeSales = activeTables.reduce((acc, entry) => {
      const { gameType, totalAmount } = entry;
      if (
        !gameType ||
        totalAmount === undefined ||
        gameType === "FOOD" ||
        !entry.isClosed
      )
        return acc;
      acc[gameType] = (acc[gameType] || 0) + (Number(totalAmount) || 0);
      return acc;
    }, {});

    monthlyGameSales = Object.entries(gameTypeSales)
      .map(([game, total]) => ({ gameType: game, totalSales: total }))
      .sort((a, b) => b.totalSales - a.totalSales);

    const foodRows = activeTables.filter((entry) => entry.name === "FOOD"); // Include all FOOD rows, open or closed
    monthlyFoodItemsRevenue = foodRows.reduce((sum, entry) => {
      return (
        sum +
        entry.orderedItems.reduce(
          (itemSum, item) => itemSum + (ITEM_PRICES[item] || 0),
          0
        )
      );
    }, 0);

    monthlyData.push({
      key: moment(selectedDate).format("YYYY-MM"),
      month: moment(selectedDate).format("MMMM YYYY"),
      totalRevenue: monthlyTotalRevenue, // Pre-calculated from daily totals
    });
  }

  const getTodaysDues = (customerName) => {
    return activeTables
      .filter((table) => table.paymentOption === customerName && table.dues > 0)
      .reduce((sum, table) => sum + (table.dues || 0), 0);
  };

  // Table Columns (Game Type Sales)
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

  // Table Columns (Ordered Item Sales)
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

  const customerColumns = [
    {
      title: "Customer Name 👤",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Phone Number 📞",
      dataIndex: "phone",
      key: "phone",
    },
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
      render: (_, record) => {
        const todaysDues = getTodaysDues(record.name);
        return `Rs ${todaysDues.toFixed(2)}`;
      },
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
          📊 Sales Report for {selectedLocation} on {selectedDate}
        </Title>

        <Select
          value={reportType}
          onChange={setReportType}
          style={{ width: 200, marginBottom: 20 }}
        >
          <Option value="daily">Daily</Option>
          <Option value="weekly">Weekly</Option>
          <Option value="monthly">Monthly</Option>
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

            {/* Search Bar */}
            <Input
              placeholder="🔍 Search..."
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

            {/* Sales by Game Type */}
            <Title level={4} style={{ marginTop: "20px", color: "#1890ff" }}>
              🎮 Game Type Sales
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
              🍔 Ordered Item Sales
            </Title>
            <Table
              dataSource={filteredItems}
              columns={itemColumns}
              bordered
              pagination={{ pageSize: 5 }}
              style={{ borderRadius: "8px", overflow: "hidden" }}
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
                <Form.Item name="paymentAmount" label="Payment Amount (Rs)">
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
                            {
                              required: true,
                              message: "Please enter your email",
                            },
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

          </>
        ) : (
          <Table
            dataSource={
              reportType === "weekly"
                ? weeklyData.filter((entry) =>
                    entry.range.toLowerCase().includes(searchText.toLowerCase())
                  )
                : monthlyData.filter((entry) =>
                    entry.month.toLowerCase().includes(searchText.toLowerCase())
                  )
            }
            columns={reportType === "weekly" ? weeklyColumns : monthlyColumns}
            bordered
            pagination={{ pageSize: 5 }}
            style={{ borderRadius: "8px", overflow: "hidden" }}
          />
        )}
      </Card>
    </div>
  );
};

export default SalesReport;

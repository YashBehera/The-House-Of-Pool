import React, { useState, useEffect } from "react";
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
} from "antd";
import { SearchOutlined, MoneyCollectOutlined } from "@ant-design/icons";
import { ITEM_PRICES } from "./PoolBillingSystem";
import Navbar from "./Navbar";
import moment from "moment";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
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
          <Spin size="large" style={{ display: "block", margin: "20px auto" }} />
        ): reportType === "daily" ? (
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
            {/* Sales by Ordered Items */}
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

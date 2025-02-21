import React, { useState, useEffect } from "react";
import { Table, Card, Typography, Input, Statistic } from "antd";
import { SearchOutlined, MoneyCollectOutlined } from "@ant-design/icons";
import { ITEM_PRICES } from "./PoolBillingSystem";
import Navbar from "./Navbar";
import moment from "moment";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
const { Title } = Typography;

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

  const getTablesByDate = async (date, location) => {
    const docSnap = await getDoc(doc(db, "tables", `${location}_${date}`));
    if (!docSnap.exists()) return [];

    return docSnap.data().data.map((table) => ({
      ...table,
      startTime: table.startTime ? moment(table.startTime).toDate() : null,
      endTime: table.endTime ? moment(table.endTime).toDate() : null,
    }));
  };

  useEffect(() => {
    const fetchSalesData = async () => {
      const tables =
        (await getTablesByDate(selectedDate, selectedLocation)) || [];
      setActiveTables(tables);
    };

    fetchSalesData();
  }, [selectedDate, selectedLocation, setActiveTables]);

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
          No sales data available for {selectedLocation} on {selectedDate}.
        </p>
      </div>
    );
  }

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

  // Search filter
  const filteredItems = sortedItemSales.filter(({ itemName }) =>
    itemName.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredGames = sortedGameSales.filter(({ gameType }) =>
    gameType.toLowerCase().includes(searchText.toLowerCase())
  );

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

        {/* Total Revenue */}
        <Card
          style={{
            marginBottom: "20px",
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
      </Card>
    </div>
  );
};

export default SalesReport;
